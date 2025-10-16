from fastapi import APIRouter, HTTPException, Depends, Request
from database import get_database
from models import VotingEvent, User, IndividualVote
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta, timezone as dt_timezone
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

class VoteEventCreate(BaseModel):
    emoteSet: dict 
    emoteSetOwner: str
    voteTitle: str
    activeTimeTab: str
    duration: dict
    endTime: Optional[datetime] = None
    permissions: str

class IndividualVoteSubmit(BaseModel):
    voting_event_id: int
    emote_id: str
    vote_choice: str

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
            IndividualVote.voter_id == user.id,
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

    # TODO: Verify voting event exists and is active
    result = await db.execute(select(VotingEvent).where(VotingEvent.id == vote_data.voting_event_id, VotingEvent.is_active == True))
    voting_event = result.scalar_one_or_none()
    if not voting_event:
        return {'success': False, 'message': 'Event not not found in database or is not active'}
    # TODO: Check if user already voted on this emote (handle conflicts)
    result = await db.execute(
        select(IndividualVote).where(
            IndividualVote.voter_id == user.id, 
            vote_data.voting_event_id == IndividualVote.voting_event_id, 
            IndividualVote.emote_id == vote_data.emote_id
            ))
    vote = result.scalar_one_or_none()
    if vote and vote.vote_choice != vote_data.vote_choice:
        try:
            # TODO: unsure how to change an entry opposed to add
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
        voter_id = user.id,
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
        select(VotingEvent, User.twitch_username)
        .join(User, VotingEvent.creator_id == User.id)
        .where(VotingEvent.is_active == True)
    )

    voting_events = result.fetchall()
    print(f"Total voting events found: {len(voting_events)}")

    for row in voting_events:
        event = row[0]
        print(f"Event: {event.title}, Permission: {event.permission_level}, Active: {event.is_active}")

    allowed_events = []

    for row in voting_events:
        event = row[0]
        creator = row[1]

        user_can_access = False

        if event.permission_level == "all":
            user_can_access = True 
        elif event.permission_level == "specific_users":
            if user_session["login"] in event.specific_users:
                user_can_access = True 
        #elif event.permission_level == "followers": #or other specific ones
            #todo add followers, subs etc check later
        
        user_can_access = True

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
        
        # Build event data
        event_data = {
            "id": event.id,
            "title": event.title,
            "creator_username": creator_name,
            "emote_set_name": event.emote_set_name,
            "emote_set_id": event.emote_set_id,
            "total_votes": 0,  # TODO: count from individual_votes
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

    if vote_data.activeTimeTab == 'duration':
        total_hours = duration_days * 24 + duration_hours + (duration_minutes / 60)
        voting_event = VotingEvent(
            creator_id=user.id,
            title=vote_data.voteTitle,
            emote_set_id=vote_data.emoteSet['id'],
            emote_set_name=vote_data.emoteSet['name'],
            duration_hours=total_hours,
            active_time_tab=vote_data.activeTimeTab,
            permission_level=vote_data.permissions
        )
    else:
        voting_event = VotingEvent(
            creator_id=user.id,
            title=vote_data.voteTitle,
            emote_set_id=vote_data.emoteSet['id'],
            emote_set_name=vote_data.emoteSet['name'],
            end_time=vote_data.endTime,
            active_time_tab=vote_data.activeTimeTab,
            permission_level=vote_data.permissions
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
async def get_vote_counts(event_id: int, db:AsyncSession = Depends(get_database)):
    result = await db.execute(select(IndividualVote).where(IndividualVote.voting_event_id == event_id))