from fastapi import APIRouter, HTTPException, Depends, Request
from database import get_database
from models import VotingEvent, User, IndividualVote
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta, timezone as dt_timezone
from pydantic import BaseModel
from typing import Optional, List
from api.twitch_api import check_user_follows_channel, check_user_subscribed_to_channel
import httpx
import os

router = APIRouter()

class VoteEventCreate(BaseModel):
    emoteSet: dict 
    emoteSetOwner: str
    voteTitle: str
    activeTimeTab: str
    duration: dict
    endTime: Optional[datetime] = None
    permissions: str
    specific_users: List[str] = [] 

class VoteEventUpdate(BaseModel):
    title: Optional[str]
    duration_hours: Optional[float]
    end_time: Optional[datetime]
    time_tab: Optional[str]
    end_now: Optional[bool]

class IndividualVoteSubmit(BaseModel):
    voting_event_id: int
    emote_id: str
    vote_choice: str


async def can_user_edit_event(user: User, voting_event: VotingEvent, db: AsyncSession):
    if not user or not voting_event:
        return False
    
    result = await db.execute(select(User).where(User.id == voting_event.creator_id))
    vote_creator = result.scalar_one_or_none()
    
    if not vote_creator:
        return False

    if user.id == voting_event.creator_id:
        return True
    
    if vote_creator.moderators and user.twitch_username in vote_creator.moderators:
        return True
    
    return False

@router.put('/votes/update/{event_id}')
async def update_voting_event(event_id: int, update_data: VoteEventUpdate, request: Request, db: AsyncSession = Depends(get_database)):
    return True

@router.get('/votes/check')
async def check_vote_exists(voting_event_id: int, emote_id: str, request: Request, db: AsyncSession = Depends(get_database)):
    user_session = request.session.get('user')
    if not user_session:
        return {"vote_exists": False, "message": "User not authenticated"}

    result = await db.execute(select(User).where(User.twitch_username == user_session['login']))
    user = result.scalar_one_or_none()
    if not user:
        return {"vote_exists": False, "message": "User not found"}

    result = await db.execute(
        select(IndividualVote).where(
            IndividualVote.voter_id == int(user.id),
            IndividualVote.voting_event_id == voting_event_id,
            IndividualVote.emote_id == emote_id
        )
    )
    existing_vote = result.scalar_one_or_none()
    
    if existing_vote:
        return {"vote_exists": True, "current_vote": existing_vote.vote_choice}
    else:
        return {"vote_exists": False}

@router.post('/votes/submit')
async def submit_individual_vote(vote_data: IndividualVoteSubmit, request: Request, db: AsyncSession = Depends(get_database)):
    user_session = request.session.get('user')
    if not user_session:
        return {'success': False, 'message': 'User not authenticated'}

    result = await db.execute(select(User).where(User.twitch_username == user_session['login']))
    user = result.scalar_one_or_none()
    if not user:
        return {'success': False, 'message': 'User not not found in database'}

    # Check and update event status
    result = await db.execute(select(VotingEvent).where(VotingEvent.id == vote_data.voting_event_id))
    voting_event = result.scalar_one_or_none()
    
    if not voting_event:
        return {"success": False, "message": "Event not found"}
    
    # Calculate if event is currently active
    if voting_event.active_time_tab == "duration":
        end_time = voting_event.created_at + timedelta(hours=voting_event.duration_hours)
    elif voting_event.active_time_tab == "endTime":
        end_time = voting_event.end_time
    
    now = datetime.now(dt_timezone.utc)
    is_currently_active = end_time > now
    
    # Update database if event has expired
    if not is_currently_active and voting_event.is_active:
        voting_event.is_active = False
        await db.commit()
    
    # Prevent voting on expired events
    if not is_currently_active:
        return {"success": False, "message": "This voting event has expired"}
    if not voting_event:
        return {'success': False, 'message': 'Event not not found in database or is not active'}
    result = await db.execute(
        select(IndividualVote).where(
            IndividualVote.voter_id == int(user.id), 
            vote_data.voting_event_id == IndividualVote.voting_event_id, 
            IndividualVote.emote_id == vote_data.emote_id
            ))
    vote = result.scalar_one_or_none()
    if vote and vote.vote_choice != vote_data.vote_choice:
        try:
            vote.vote_choice = vote_data.vote_choice
            await db.commit()
            return {'success': True, 'message': 'Vote updated successfully'}
        except Exception as e:
            await db.rollback()
            return {"success": False, "message": f"Failed to update vote: {str(e)}"}
    elif vote and vote.vote_choice == vote_data.vote_choice:
        return {'success': True, 'message': 'Vote doesn\'t need updating'}

    individual_vote = IndividualVote(
        voting_event_id = vote_data.voting_event_id,
        voter_id = int(user.id),
        emote_id = vote_data.emote_id,
        vote_choice = vote_data.vote_choice
    )

    try:
        db.add(individual_vote)
        await db.commit()
        return {"success": True, "message": "Vote submitted successfully"}
    except Exception as e:
        await db.rollback()
        return {"success": False, "message": f"Failed to submit vote: {str(e)}"}

@router.get('/votes/voting-events')
async def get_voting_events(request: Request, db: AsyncSession = Depends(get_database)):
    user_session = request.session.get('user')
    if not user_session:
        return {"success": False, "message": "User not in session"}

    result = await db.execute(select(User).where(User.twitch_username == user_session['login']))
    user = result.scalar_one_or_none()
    if not user: 
        return {"success": False, "message": "User not in database"}

    result = await db.execute(
        select(VotingEvent, User.twitch_username, User.twitch_user_id)
        .join(User, VotingEvent.creator_id == User.id)
        .order_by(VotingEvent.id.asc())  
    )

    voter_counts = await db.execute(
        select(
            IndividualVote.voting_event_id,
            func.count(func.distinct(IndividualVote.voter_id)).label('unique_voters')
        )
        .group_by(IndividualVote.voting_event_id)
    )
    voter_counts_dict = {row.voting_event_id: row.unique_voters for row in voter_counts.fetchall()}

    voting_events = result.fetchall()

    for row in voting_events:
        event = row[0]

    allowed_events = []

    for row in voting_events:
        event = row[0]
        creator_username = row[1]
        creator_twitch_user_id = row[2]

        user_can_access = False
        # Event creator always has access
        if user.id == event.creator_id:
            user_can_access = True
        else:
            # Check permission levels for everyone else
            if event.permission_level == "all":
                user_can_access = True 
            elif event.permission_level == "specific":
                if user_session["login"] in event.specific_users:
                    user_can_access = True  
            elif event.permission_level == "followers":
                # Check if user follows the event creator
                user_can_access = await check_user_follows_channel(
                    user = user,
                    channel_id=str(creator_twitch_user_id),  # Need to get this from creator
                    db = db
                )
            elif event.permission_level == "subscribers":
                # Check if user is subscribed to the event creator
                user_can_access = await check_user_subscribed_to_channel(
                    user = user,
                    broadcaster_id=str(creator_twitch_user_id),
                    db=db
                )

        if user_can_access:
            allowed_events.append(row)
    
    # Replace the current response_events list building with:
    active_events = []
    expired_events = []

    for row in allowed_events:
        event = row[0]
        creator_name = row[1]
        
        # Calculate end time
        if event.active_time_tab == "duration":
            end_time = event.created_at + timedelta(hours=event.duration_hours)
        elif event.active_time_tab == "endTime":
            end_time = event.end_time

        now = datetime.now(dt_timezone.utc)

        is_currently_active = end_time > now
        
        # NEW: Update database if event has expired
        if not is_currently_active and event.is_active:
            event.is_active = False
            await db.commit()
        
        # Build event data
        event_data = {
            "id": event.id,
            "title": event.title,
            "creator_username": creator_name,
            "emote_set_name": event.emote_set_name,
            "emote_set_id": event.emote_set_id,
            "total_votes": voter_counts_dict.get(event.id, 0),
            "is_active": is_currently_active
        }
        
        if is_currently_active:
            # Calculate time remaining for active events
            remaining = end_time - now
            days = remaining.days
            hours = remaining.seconds // 3600
            minutes = (remaining.seconds % 3600) // 60
            seconds = remaining.seconds % 60  

            if days > 0:
                time_left = f"{days} days, {hours} hours remaining"
            elif hours > 0:
                time_left = f"{hours} hours, {minutes} minutes remaining"
            elif minutes > 0:
                time_left = f"{minutes} minutes remaining"
            else:
                time_left = f"{seconds} seconds remaining"
            event_data["time_remaining"] = time_left
            active_events.append(event_data)
        else:
            # Calculate how long ago it ended
            expired_time = now - end_time
            if expired_time.days > 0:
                time_ended = f"Ended {expired_time.days} days ago"
            elif expired_time.seconds > 3600:
                hours_ago = expired_time.seconds // 3600
                time_ended = f"Ended {hours_ago} hours ago"
            else:
                time_ended = "Recently ended"
            
            event_data["time_ended"] = time_ended
            expired_events.append(event_data)

    return {
        "success": True, 
        "active_events": active_events,
        "expired_events": expired_events
    }

@router.post('/votes/create')
async def create_vote(vote_data: VoteEventCreate, request: Request, db: AsyncSession = Depends(get_database)):
    user_session = request.session.get('user')
    if not user_session:
        return {"success": False, "message": "User not in session"}

    result = await db.execute(select(User).where(User.twitch_username == user_session['login']))
    user = result.scalar_one_or_none()
    if not user: 
        return {"success": False, "message": "User not in database"}

    # Refresh 7TV ID if it looks like a placeholder
    if user.sevenTV_id and user.sevenTV_id.startswith("no_account_"):
        base_url = os.getenv("BASE_URL")
        async with httpx.AsyncClient() as client:
            seventv_response = await client.get(f"{base_url}/users/{user.twitch_username}")
            if seventv_response.status_code == 200:
                seventv_data = seventv_response.json()
                if seventv_data and 'id' in seventv_data:
                    user.sevenTV_id = seventv_data['id']
                    await db.commit()
                else:
                    return {"success": False, "message": "You need a 7TV account to create voting events. Please create one at 7tv.app and sign in again."}
            else:
                return {"success": False, "message": "You need a 7TV account to create voting events. Please create one at 7tv.app and sign in again."}
    
    # Final check: if still placeholder after refresh attempt, reject
    if user.sevenTV_id and user.sevenTV_id.startswith("no_account_"):
        return {"success": False, "message": "You need a 7TV account to create voting events. Please create one at 7tv.app and sign in again."}

    # Check 1: emoteSet exists and isn't empty
    if not vote_data.emoteSet:
        return {"success": False, "message": "You have no emote sets. Please add emote sets to your 7TV account at 7tv.app."}

    # Check 2: id and name keys exist and aren't empty strings
    if not vote_data.emoteSet.get('id') or not vote_data.emoteSet.get('name'):
        return {"success": False, "message": "Invalid emote set selected. Please select a valid emote set or try again."}

    if vote_data.activeTimeTab == 'duration':
        duration_days = int(vote_data.duration.get('days', 0))
        duration_hours = int(vote_data.duration.get('hours', 0))
        duration_minutes = int(vote_data.duration.get('minutes', 0))
        total_minutes = (duration_days * 24 * 60) + (duration_hours * 60) + duration_minutes
        if total_minutes < 5 or total_minutes > 31 * 24 * 60:
            return {"success": False, "message": "Duration out of bounds"}
    
    if vote_data.activeTimeTab == "endTime":
        now = datetime.utcnow()
        min_end_time = now + timedelta(minutes=5)
        max_end_time = now + timedelta(days=31)
        if vote_data.endTime < min_end_time or vote_data.endTime > max_end_time:
            return {"success": False, "message": "End time out of bounds"}

    if user.twitch_username != vote_data.emoteSetOwner:
        owner_result = await db.execute(select(User).where(User.twitch_username == vote_data.emoteSetOwner))
        emote_set_owner = owner_result.scalar_one_or_none()
        
        if not emote_set_owner:
            return {"success": False, "message": "Emote set owner not found"}
        
        if user.twitch_username not in emote_set_owner.can_create_votes_for:
            return {"success": False, "message": "Permission denied: cannot create votes for this user"}

    print(f"Vote data: {vote_data}")
    print(f"Specific users: {getattr(vote_data, 'specific_users', 'NOT_FOUND')}")
    print(f"Permissions: {vote_data.permissions}")

    if vote_data.activeTimeTab == 'duration':
        total_hours = duration_days * 24 + duration_hours + (duration_minutes / 60)
        voting_event = VotingEvent(
            creator_id=user.id,
            title=vote_data.voteTitle,
            emote_set_id=vote_data.emoteSet['id'],
            emote_set_name=vote_data.emoteSet['name'],
            duration_hours=total_hours,
            active_time_tab=vote_data.activeTimeTab,
            permission_level=vote_data.permissions,
            specific_users=getattr(vote_data, 'specific_users', [])
        )
    else:
        voting_event = VotingEvent(
            creator_id=user.id,
            title=vote_data.voteTitle,
            emote_set_id=vote_data.emoteSet['id'],
            emote_set_name=vote_data.emoteSet['name'],
            end_time=vote_data.endTime,
            active_time_tab=vote_data.activeTimeTab,
            permission_level=vote_data.permissions,
            specific_users=getattr(vote_data, 'specific_users', [])
        )

    try:
        db.add(voting_event)
        await db.commit()
        await db.refresh(voting_event)
        return {"success": True, "message": "Vote created successfully", "vote_id": voting_event.id}
    except Exception as e:
        await db.rollback()  # Undo any partial changes
        return {"success": False, "message": f"Failed to save vote: {str(e)}"}

@router.get('/votes/{event_id}/counts')
async def get_vote_counts(event_id: int, request: Request, db: AsyncSession = Depends(get_database)):
    try:
        # First, verify the event exists
        event_check = await db.execute(select(VotingEvent).where(VotingEvent.id == event_id))
        event = event_check.scalar_one_or_none()
        if not event:
            return {"success": False, "error": "Event not found"}
        user_session = request.session.get('user')
        if not user_session:
            return {"success": False, "error": "User not authenticated"}
        user_id = user_session.get('id')
        if not user_id:
            return {"success": False, "error": "User not authenticated"}
        
        result = await db.execute(
            select(
                IndividualVote.emote_id,
                IndividualVote.vote_choice,
                func.count(IndividualVote.id).label('count')
            )
            .where(IndividualVote.voting_event_id == event_id)
            .group_by(IndividualVote.emote_id, IndividualVote.vote_choice)
        )
        
        vote_counts = result.fetchall()
        
        result = await db.execute(
            select(IndividualVote.emote_id, IndividualVote.vote_choice)
            .where(IndividualVote.voting_event_id == event_id, IndividualVote.voter_id == int(user_id))
        )
        
        vote_choices = result.fetchall()
        # Organize the data by emote_id
        emote_counts = {}
        for row in vote_counts:
            emote_id = row.emote_id
            vote_choice = row.vote_choice
            count = row.count
            
            if emote_id not in emote_counts:
                emote_counts[emote_id] = {
                    'keep': 0,
                    'remove': 0,
                    'neutral': 0
                }
            
            emote_counts[emote_id][vote_choice] = count
        
        user_choices = {}
        for choice in vote_choices:
            emote_id = choice.emote_id
            vote_choice = choice.vote_choice
            
            user_choices[emote_id] = vote_choice
        
        return {
            "success": True,
            "event_id": event_id,
            "vote_counts": emote_counts,
            "vote_choices": user_choices
        }
        
    except Exception as e:
        return {"success": False, "error": f"Database error: {str(e)}"}

@router.get('/votes/{event_id}')
async def get_voting_event_by_id(event_id: int, request: Request, db: AsyncSession = Depends(get_database)):
    # User session check (you have this)
    user_session = request.session.get('user')
    if not user_session:
        return {"success": False, "message": "User not in session"}

    result = await db.execute(select(User).where(User.twitch_username == user_session['login']))
    user = result.scalar_one_or_none()
    if not user: 
        return {"success": False, "message": "User not in database"}

    # Get the specific event
    result = await db.execute(select(VotingEvent).where(VotingEvent.id == event_id))
    event = result.scalar_one_or_none()
    if not event: 
        return {"success": False, "message": "Event not found"}

    # Check permissions
    user_can_access = False
    # Event creator always has access
    if user.id == event.creator_id:
        user_can_access = True
    else:
        # Check permission levels for everyone else
        if event.permission_level == "all":
            user_can_access = True 
        # ... rest of existing logic
        if event.permission_level == "all":
            user_can_access = True 
        elif event.permission_level == "specific_users":
            if user_session["login"] in event.specific_users:
                user_can_access = True 
        elif event.permission_level == "followers":
            # Check if user follows the event creator
            user_can_access = await check_user_follows_channel(
                user = user,
                channel_id=str(event.creator_id), 
                db = db
            )
        elif event.permission_level == "subscribers":
            # Check if user is subscribed to the event creator
            user_can_access = await check_user_subscribed_to_channel(
                user = user,
                broadcaster_id=str(event.creator_id),
                db=db
            ) 
    
    if not user_can_access:
        return {"success": False, "message": "Access denied"}

    # Get creator username
    creator_result = await db.execute(select(User).where(User.id == event.creator_id))
    creator = creator_result.scalar_one_or_none()
    creator_name = creator.twitch_username if creator else "Unknown"
    # Rest of your logic...
    # Calculate end time
    if event.active_time_tab == "duration":
        end_time = event.created_at + timedelta(hours=event.duration_hours)
    elif event.active_time_tab == "endTime":
        end_time = event.end_time

    now = datetime.now(dt_timezone.utc)

    is_currently_active = end_time > now
    
    # NEW: Update database if event has expired
    if not is_currently_active and event.is_active:
        event.is_active = False
        await db.commit()

    # Calculate time info
    if is_currently_active:
        remaining = end_time - now
        days = remaining.days
        hours = remaining.seconds // 3600
        minutes = (remaining.seconds % 3600) // 60
        seconds = remaining.seconds % 60  

        if days > 0:
            time_left = f"{days} days, {hours} hours remaining"
        elif hours > 0:
            time_left = f"{hours} hours, {minutes} minutes remaining"
        elif minutes > 0:
            time_left = f"{minutes} minutes remaining"
        else:
            time_left = f"{seconds} seconds remaining"
    else:
        # Calculate how long ago it ended
        expired_time = now - end_time
        if expired_time.days > 0:
            time_ended = f"Ended {expired_time.days} days ago"
        elif expired_time.seconds > 3600:
            hours_ago = expired_time.seconds // 3600
            time_ended = f"Ended {hours_ago} hours ago"
        else:
            time_ended = "Recently ended"

    voter_counts = await db.execute(
        select(
            IndividualVote.voting_event_id,
            func.count(func.distinct(IndividualVote.voter_id)).label('unique_voters')
        )
        .where(IndividualVote.voting_event_id == event_id)  # Add this line
        .group_by(IndividualVote.voting_event_id)
    )

    voter_counts_dict = {row.voting_event_id: row.unique_voters for row in voter_counts.fetchall()}

    event_data = {
    "id": event.id,
    "title": event.title,
    "creator_username": creator_name,
    "emote_set_name": event.emote_set_name,
    "emote_set_id": event.emote_set_id,
    "total_votes": voter_counts_dict.get(event.id, 0),
    "is_active": is_currently_active,
    "time_remaining": time_left if is_currently_active else None,  # Add this
    "time_ended": time_ended if not is_currently_active else None  # Add this
}
    return {"success": True, "event": event_data}