from fastapi import APIRouter, HTTPException, Depends, Request
from database import get_database
from models import VotingEvent, User, IndividualVote, ChannelTokens
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased
from datetime import datetime, timedelta, timezone as dt_timezone
from pydantic import BaseModel
from typing import Optional, List
from api.twitch_api import check_user_follows_channel, check_user_subscribed_to_channel
import httpx
import os
import asyncio
from datetime import datetime

router = APIRouter()

class VoteEventCreate(BaseModel):
    emoteSet: dict 
    emoteSetOwner: str
    voteTitle: str
    activeTimeTab: str
    duration: dict
    endTime: Optional[datetime] = None
    permissions: str
    specific_users: Optional[List[str]] = None

class VoteEventUpdate(BaseModel):
    title: Optional[str] = None
    duration_hours: Optional[float] = None
    end_time: Optional[datetime] = None
    time_tab: Optional[str] = None
    end_now: Optional[bool] = False
    specific_users: Optional[List[str]] = None

class IndividualVoteSubmit(BaseModel):
    voting_event_id: int
    emote_id: str
    vote_choice: str

class BatchVoteSubmit(BaseModel):
    voting_event_id: int
    votes: List[dict]  # List of {"emote_id": str, "vote_choice": str}


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
    user_session = request.session.get('user')
    if not user_session:
        return {"success": False, "message": "User not authenticated"}

    result = await db.execute(select(User).where(User.twitch_username == user_session['login']))
    user = result.scalar_one_or_none()
    if not user:
        return {"success": False, "message": "User not found"}

    result = await db.execute(select(VotingEvent).where(VotingEvent.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        return {"success": False, "message": "Event not found"}

    if not await can_user_edit_event(user, event, db):
        return {"success": False, "message": "Event not found"}

    # Step 4: Handle end_now first (and return immediately)
    if update_data.end_now:
        event.end_time = datetime.now(dt_timezone.utc)
        event.is_active = False
        await db.commit()
        # Refresh the event to get updated values
        await db.refresh(event)

        # Build event_data similar to get_voting_event_by_id
        if event.active_time_tab == "duration":
            end_time = event.created_at + timedelta(hours=event.duration_hours)
        elif event.active_time_tab == "endTime":
            end_time = event.end_time

        now = datetime.now(dt_timezone.utc)
        is_currently_active = end_time > now

        # Get voter count
        voter_counts = await db.execute(
            select(
                func.count(func.distinct(IndividualVote.voter_id)).label('unique_voters')
            )
            .where(IndividualVote.voting_event_id == event.id)
        )
        voter_count = voter_counts.scalar() or 0

        # Get creator username
        result = await db.execute(select(User).where(User.id == event.creator_id))
        creator = result.scalar_one_or_none()

        event_data = {
            "id": event.id,
            "title": event.title,
            "creator_username": creator.twitch_username if creator else "Unknown",
            "emote_set_name": event.emote_set_name,
            "emote_set_id": event.emote_set_id,
            "total_votes": voter_count,
            "is_active": is_currently_active,
            "created_at": event.created_at.isoformat()  # Add this for frontend validation
        }
        return {"success": True, "message": "Event ended", "event": event_data}

    # Step 5: Update title if provided
    if update_data.title:
        event.title = update_data.title

    # Step 6: Update time based on mode
    now = datetime.now(dt_timezone.utc)
    
    if update_data.time_tab == "endTime" and update_data.end_time:
        # Validate - end time must be at least 5 minutes from NOW (not creation)
        min_time = now + timedelta(minutes=5)
        max_time = event.created_at + timedelta(days=31)
        
        if update_data.end_time < min_time:
            return {"success": False, "message": "End time must be at least 5 minutes from now"}
        if update_data.end_time > max_time:
            return {"success": False, "message": "End time cannot be more than 31 days from creation"}
        # Update
        event.end_time = update_data.end_time
        event.active_time_tab = "endTime"

    elif update_data.time_tab == "duration" and update_data.duration_hours:
        # Calculate what the end time would be
        new_end_time = now + timedelta(hours=update_data.duration_hours)
        # Validate - end time must be at least 5 minutes from NOW (not creation)
        min_time = now + timedelta(minutes=5)
        max_time = event.created_at + timedelta(days=31)
        
        if new_end_time < min_time:
            return {"success": False, "message": "Duration must result in end time at least 5 minutes from now"}
        if new_end_time > max_time:
            return {"success": False, "message": "Duration cannot result in end time more than 31 days from creation"}
        # Update - SWITCH TO ENDTIME MODE!
        event.end_time = new_end_time
        event.active_time_tab = "endTime"  # Change from duration to endTime

    # Step 7: Update specific_users if provided (only for "specific" permission events)
    if update_data.specific_users is not None:
        if event.permission_level != "specific" and event.permission_level != "specific_users":
            return {"success": False, "message": "Can only update specific_users for specific permission events"}
        
        # Get current users and new users
        old_users = set(event.specific_users or [])
        new_users = set(update_data.specific_users)
        
        # Find users being removed
        removed_users = old_users - new_users
        
        # Delete votes from removed users
        if removed_users:
            # Get user IDs for removed usernames
            removed_user_ids = []
            for username in removed_users:
                user_result = await db.execute(select(User).where(User.twitch_username == username))
                removed_user = user_result.scalar_one_or_none()
                if removed_user:
                    removed_user_ids.append(removed_user.id)
            
            # Delete all votes from removed users for this event
            if removed_user_ids:
                await db.execute(
                    delete(IndividualVote).where(
                        IndividualVote.voting_event_id == event.id,
                        IndividualVote.voter_id.in_(removed_user_ids)
                    )
                )
        
        # Update the specific_users list
        event.specific_users = update_data.specific_users
        
        # Flag the ARRAY field as modified so SQLAlchemy detects the change
        from sqlalchemy.orm import attributes
        attributes.flag_modified(event, 'specific_users')

    # Step 8: Commit once at the end
    await db.commit()
    # Refresh the event to get updated values
    await db.refresh(event)

    # Build event_data similar to get_voting_event_by_id
    if event.active_time_tab == "duration":
        end_time = event.created_at + timedelta(hours=event.duration_hours)
    elif event.active_time_tab == "endTime":
        end_time = event.end_time

    now = datetime.now(dt_timezone.utc)
    is_currently_active = end_time > now

    # Get voter count
    voter_counts = await db.execute(
        select(
            func.count(func.distinct(IndividualVote.voter_id)).label('unique_voters')
        )
        .where(IndividualVote.voting_event_id == event.id)
    )
    voter_count = voter_counts.scalar() or 0

    # Get creator username
    result = await db.execute(select(User).where(User.id == event.creator_id))
    creator = result.scalar_one_or_none()

    event_data = {
        "id": event.id,
        "title": event.title,
        "creator_username": creator.twitch_username if creator else "Unknown",
        "emote_set_name": event.emote_set_name,
        "emote_set_id": event.emote_set_id,
        "total_votes": voter_count,
        "is_active": is_currently_active,
        "created_at": event.created_at.isoformat()  # Add this for frontend validation
    }
    return {"success": True, "message": "Event updated successfully", "event": event_data}

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
        return {'success': False, 'message': 'User not found in database'}

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
    
    result = await db.execute(
        select(IndividualVote).where(
            IndividualVote.voter_id == int(user.id), 
            IndividualVote.voting_event_id == vote_data.voting_event_id, 
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

@router.post('/votes/submit-batch')
async def submit_batch_votes(batch_data: BatchVoteSubmit, request: Request, db: AsyncSession = Depends(get_database)):
    """OPTIMIZATION: Batch create multiple neutral votes in a single API call."""
    user_session = request.session.get('user')
    if not user_session:
        return {'success': False, 'message': 'User not authenticated'}
    
    result = await db.execute(select(User).where(User.twitch_username == user_session['login']))
    user = result.scalar_one_or_none()
    if not user:
        return {'success': False, 'message': 'User not found in database'}
    
    # Check and update event status
    result = await db.execute(select(VotingEvent).where(VotingEvent.id == batch_data.voting_event_id))
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
    
    batch_start_time = datetime.now()
    print(f"[BATCH VOTES] Starting batch creation of {len(batch_data.votes)} votes...")
    
    # Check which votes already exist
    emote_ids = [vote['emote_id'] for vote in batch_data.votes]
    existing_votes_result = await db.execute(
        select(IndividualVote).where(
            IndividualVote.voter_id == int(user.id),
            IndividualVote.voting_event_id == batch_data.voting_event_id,
            IndividualVote.emote_id.in_(emote_ids)
        )
    )
    existing_votes = existing_votes_result.fetchall()
    existing_vote_map = {(v.voting_event_id, v.emote_id): v for v in existing_votes}
    
    # Create new votes and track results
    votes_to_create = []
    votes_skipped = 0
    votes_updated = 0
    
    for vote_data in batch_data.votes:
        emote_id = vote_data['emote_id']
        vote_choice = vote_data['vote_choice']
        
        # Check if vote already exists
        existing_vote = existing_vote_map.get((batch_data.voting_event_id, emote_id))
        
        if existing_vote:
            if existing_vote.vote_choice != vote_choice:
                # Update existing vote
                existing_vote.vote_choice = vote_choice
                votes_updated += 1
            else:
                # Vote already exists with same choice
                votes_skipped += 1
        else:
            # Create new vote
            individual_vote = IndividualVote(
                voting_event_id=batch_data.voting_event_id,
                voter_id=int(user.id),
                emote_id=emote_id,
                vote_choice=vote_choice
            )
            votes_to_create.append(individual_vote)
    
    # Batch add all new votes
    if votes_to_create:
        db.add_all(votes_to_create)
    
    try:
        await db.commit()
        batch_end_time = datetime.now()
        batch_duration = (batch_end_time - batch_start_time).total_seconds() * 1000
        
        print(f"[BATCH VOTES] Completed in {batch_duration:.2f}ms: {len(votes_to_create)} created, {votes_updated} updated, {votes_skipped} skipped")
        print(f"[BATCH VOTES] Saved {len(batch_data.votes)} individual API calls by batching")
        
        return {
            "success": True,
            "message": f"Batch votes submitted: {len(votes_to_create)} created, {votes_updated} updated, {votes_skipped} skipped",
            "created": len(votes_to_create),
            "updated": votes_updated,
            "skipped": votes_skipped
        }
    except Exception as e:
        await db.rollback()
        return {"success": False, "message": f"Failed to submit batch votes: {str(e)}"}

@router.get('/votes/voting-events')
async def get_voting_events(request: Request, db: AsyncSession = Depends(get_database)):
    user_session = request.session.get('user')
    if not user_session:
        return {"success": False, "message": "User not in session"}

    result = await db.execute(select(User).where(User.twitch_username == user_session['login']))
    user = result.scalar_one_or_none()
    if not user: 
        return {"success": False, "message": "User not in database"}

    Creator = aliased(User)
    Owner = aliased(User)

    result = await db.execute(
        select(
            VotingEvent, 
            Owner.twitch_username,      
            Owner.twitch_user_id, 
            Creator.moderators,          
            Creator.twitch_username,
            Creator.twitch_user_id 
        )
        .outerjoin(Owner, VotingEvent.emote_set_owner_id == Owner.id)
        .join(Creator, VotingEvent.creator_id == Creator.id)
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

    # OPTIMIZATION #4: Batch Twitch API calls for follower/subscriber checks
    batch_start_time = datetime.now()
    
    # Collect events that need permission checks
    events_needing_follower_check = []  # List of (row, creator_twitch_user_id)
    events_needing_subscriber_check = []  # List of (row, creator_twitch_user_id)
    
    # First pass: categorize events by permission type
    for row in voting_events:
        event = row[0]
        creator_twitch_user_id = row[5]
        
        # Skip if user is creator or mod (already has access)
        creator_moderators = row[3]
        if user.id == event.creator_id or (creator_moderators and user.twitch_username in creator_moderators):
            continue
            
        # Categorize events needing API checks
        if event.permission_level == "followers":
            events_needing_follower_check.append((row, str(creator_twitch_user_id)))
        elif event.permission_level == "subscribers":
            events_needing_subscriber_check.append((row, str(creator_twitch_user_id)))
    
    # Fetch followed channels ONCE (if needed)
    followed_channels_set = set()
    if events_needing_follower_check:
        print(f"[BATCH TWITCH API] Fetching followed channels for {len(events_needing_follower_check)} follower checks...")
        try:
            user_id = user.twitch_user_id
            # Get access token from ChannelTokens (stored for this user)
            token_result = await db.execute(
                select(ChannelTokens).where(ChannelTokens.user_id == user.id)
            )
            channel_token = token_result.scalar_one_or_none()
            if not channel_token or not channel_token.access_token:
                print(f"[BATCH TWITCH API] No access token found for user {user.twitch_username}")
                followed_channels_set = set()  # Empty set if no token
            else:
                access_token = channel_token.access_token
                client_id = os.getenv("TWITCH_CLIENT_ID")
                
                async with httpx.AsyncClient() as client:
                    all_followed_channels = []
                    cursor = None
                    
                    while True:
                        url = f"https://api.twitch.tv/helix/channels/followed?user_id={user_id}&first=100"
                        if cursor:
                            url += f"&after={cursor}"
                        
                        following_response = await client.get(
                            url,
                            headers={
                                "Authorization": f"Bearer {access_token}",
                                "Client-Id": client_id
                            }
                        )
                        
                        if following_response.status_code != 200:
                            print(f"[BATCH TWITCH API] Error fetching followed channels: {following_response.status_code}")
                            break
                        
                        following_data = following_response.json()
                        if 'error' in following_data:
                            break
                        
                        page_data = following_data.get('data', [])
                        all_followed_channels.extend(page_data)
                        
                        cursor = following_data.get('pagination', {}).get('cursor')
                        if not cursor:
                            break
                    
                    # Create set of broadcaster IDs for O(1) lookup
                    followed_channels_set = {ch.get('broadcaster_id') for ch in all_followed_channels}
                    print(f"[BATCH TWITCH API] Fetched {len(followed_channels_set)} total followed channels in single API call (will check {len(events_needing_follower_check)} events against this set)")
        except Exception as e:
            print(f"[BATCH TWITCH API] Error fetching followed channels: {str(e)}")
            followed_channels_set = set()  # Empty set on error
    
    # Batch subscriber checks in parallel
    subscriber_results = {}
    if events_needing_subscriber_check:
        print(f"[BATCH TWITCH API] Checking {len(events_needing_subscriber_check)} subscription statuses in parallel...")
        async def check_subscription(row_and_id):
            row, broadcaster_id = row_and_id
            try:
                result = await check_user_subscribed_to_channel(user, broadcaster_id, db)
                return (broadcaster_id, result)
            except Exception as e:
                print(f"[BATCH TWITCH API] Error checking subscription for {broadcaster_id}: {str(e)}")
                return (broadcaster_id, False)
        
        subscription_checks = await asyncio.gather(*[check_subscription(item) for item in events_needing_subscriber_check])
        subscriber_results = {broadcaster_id: result for broadcaster_id, result in subscription_checks}
        print(f"[BATCH TWITCH API] Completed {len(subscription_checks)} subscription checks in parallel")
    
    batch_end_time = datetime.now()
    batch_duration = (batch_end_time - batch_start_time).total_seconds() * 1000
    print(f"[BATCH TWITCH API] Total batch API time: {batch_duration:.2f}ms (saved {len(events_needing_follower_check)} individual follower API calls)")
    
    # Second pass: check permissions using cached/batched results
    allowed_events = []
    
    for row in voting_events:
        event = row[0]
        owner_username = row[1]      
        owner_twitch_id = row[2]
        print(f"DEBUG: owner_twitch_id = {owner_twitch_id}, type = {type(owner_twitch_id)}")   
        creator_moderators = row[3]  
        creator_username = row[4]
        creator_twitch_user_id = row[5]
        print(f"Debug - Event {event.id}: owner_username={owner_username}, creator_username={creator_username}")   

        user_can_access = False
        # Event creator always has access
        if user.id == event.creator_id:
            user_can_access = True
        # Moderators of the creator also have access
        elif creator_moderators and user.twitch_username in creator_moderators:
            user_can_access = True
        else:
            # Check permission levels for everyone else
            # DEBUG: Log permission check
            print(f"[PERMISSION DEBUG] Event {event.id}: permission_level='{event.permission_level}' (type: {type(event.permission_level)}, repr: {repr(event.permission_level)})")
            print(f"[PERMISSION DEBUG] Event {event.id}: Comparing '{event.permission_level}' == 'all': {event.permission_level == 'all'}")
            if event.permission_level == "all":
                user_can_access = True 
            elif event.permission_level == "specific":
                if event.specific_users and user_session["login"] in event.specific_users:
                    user_can_access = True  
            elif event.permission_level == "followers":
                # Use cached followed channels set
                user_can_access = str(creator_twitch_user_id) in followed_channels_set
            elif event.permission_level == "subscribers":
                # Use cached subscription result
                user_can_access = subscriber_results.get(str(creator_twitch_user_id), False)
            print(f"[PERMISSION DEBUG] Event {event.id}: user_can_access={user_can_access} after permission check")

        if user_can_access:
            allowed_events.append(row)
    
    # Replace the current response_events list building with:
    active_events = []
    expired_events = []
    
    # OPTIMIZATION #2: Batch database commits
    events_to_expire = []
    commit_count_before = 0
    total_events_checked = 0
    already_expired_count = 0

    for row in allowed_events:
        event = row[0]
        owner_username = row[1] 
        owner_twitch_id = row[2]  # Add this if missing
        creator_moderators = row[3]
        creator_username = row[4]  # ADD THIS LINE - extract creator username
        
        # Calculate end time
        if event.active_time_tab == "duration":
            end_time = event.created_at + timedelta(hours=event.duration_hours)
        elif event.active_time_tab == "endTime":
            end_time = event.end_time

        now = datetime.now(dt_timezone.utc)

        is_currently_active = end_time > now
        total_events_checked += 1
        
        # OPTIMIZATION #2: Collect events that need to be expired (batch commit later)
        if not is_currently_active and event.is_active:
            event.is_active = False
            events_to_expire.append(event)
            commit_count_before += 1
            print(f"[BATCH COMMIT DEBUG] Event {event.id} needs to be expired (was active, now expired)")
        elif not is_currently_active and not event.is_active:
            already_expired_count += 1
        
        # Build event data
        event_data = {
            "id": event.id,
            "title": event.title,
            "creator_username": creator_username or "Unknown",  # Keep this for filtering/search
            "owner_username": owner_username or "Unknown",  # ADD THIS - for display
            "owner_twitch_id": owner_twitch_id,
            "emote_set_name": event.emote_set_name,
            "emote_set_id": event.emote_set_id,
            "total_votes": voter_counts_dict.get(event.id, 0),
            "is_active": is_currently_active,
            "can_edit": user.id == event.creator_id or (creator_moderators and user.twitch_username in creator_moderators),  
            "permission_level": event.permission_level,
            "specific_users": event.specific_users or []
        }
        print(f"DEBUG: event_data for event {event.id}: owner_twitch_id = {event_data.get('owner_twitch_id')}")
        
        if is_currently_active:
            # Calculate time remaining for active events
            remaining = end_time - now
            days = remaining.days
            hours = remaining.seconds // 3600
            minutes = (remaining.seconds % 3600) // 60
            seconds = remaining.seconds % 60  

            # Format as DD:HH:MM (always show all three, pad with zeros)
            days_str = str(days).zfill(2)
            hours_str = str(hours).zfill(2)
            minutes_str = str(minutes).zfill(2)
            time_left = f"{days_str}:{hours_str}:{minutes_str}"
            event_data["time_remaining"] = time_left
            event_data["end_time"] = end_time.isoformat()  # Add end_time for live countdown
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
    
    # OPTIMIZATION #2: Batch commit all expired events at once
    print(f"[BATCH COMMIT DEBUG] Checked {total_events_checked} events: {len(events_to_expire)} need expiring, {already_expired_count} already expired")
    
    if events_to_expire:
        commit_batch_start_time = datetime.now()
        await db.commit()
        commit_batch_end_time = datetime.now()
        commit_batch_duration = (commit_batch_end_time - commit_batch_start_time).total_seconds() * 1000
        print(f"[BATCH COMMIT] Expired {len(events_to_expire)} events in single commit ({commit_batch_duration:.2f}ms)")
        print(f"[BATCH COMMIT] Saved {commit_count_before} individual commits by batching")
    else:
        print(f"[BATCH COMMIT] No events needed expiring (all {total_events_checked} events already processed)")

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

    # Only check 7TV ID if user is creating vote for themselves
    if user.twitch_username == vote_data.emoteSetOwner:
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
    # If creating for someone else (as a mod), skip the 7TV check for the logged-in user

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
        from datetime import timezone
        now = datetime.now(timezone.utc)  # Make it timezone-aware
        min_end_time = now + timedelta(minutes=5)
        max_end_time = now + timedelta(days=31)
        if vote_data.endTime < min_end_time or vote_data.endTime > max_end_time:
            return {"success": False, "message": "End time out of bounds"}

    if user.twitch_username != vote_data.emoteSetOwner:
        owner_result = await db.execute(select(User).where(User.twitch_username == vote_data.emoteSetOwner))
        emote_set_owner = owner_result.scalar_one_or_none()
        
        if not emote_set_owner:
            return {"success": False, "message": "Emote set owner not found"}
        
        if user.twitch_username not in emote_set_owner.moderators:
            return {"success": False, "message": "Permission denied: cannot create votes for this user"}

    print(f"Vote data: {vote_data}")
    print(f"Specific users: {getattr(vote_data, 'specific_users', 'NOT_FOUND')}")
    print(f"Permissions: {vote_data.permissions}")

    # Get the emote set owner
    owner_result = await db.execute(select(User).where(User.twitch_username == vote_data.emoteSetOwner))
    emote_set_owner = owner_result.scalar_one_or_none()

    if not emote_set_owner:
        return {"success": False, "message": "Emote set owner not found in database"}

    if vote_data.activeTimeTab == 'duration':
        total_hours = duration_days * 24 + duration_hours + (duration_minutes / 60)
        voting_event = VotingEvent(
            creator_id=user.id,
            emote_set_owner_id=emote_set_owner.id,
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
            emote_set_owner_id=emote_set_owner.id,
            title=vote_data.voteTitle,
            emote_set_id=vote_data.emoteSet['id'],
            emote_set_name=vote_data.emoteSet['name'],
            end_time=vote_data.endTime,
            active_time_tab=vote_data.activeTimeTab,
            permission_level=vote_data.permissions,
            specific_users=getattr(vote_data, 'specific_users', [])
        )

    # DEBUG: Log what we're storing
    print(f"[CREATE DEBUG] Storing permission_level='{vote_data.permissions}' (type: {type(vote_data.permissions)}, repr: {repr(vote_data.permissions)})")

    try:
        db.add(voting_event)
        await db.commit()
        await db.refresh(voting_event)
        print(f"[CREATE DEBUG] Event {voting_event.id} created with permission_level='{voting_event.permission_level}' (type: {type(voting_event.permission_level)}, repr: {repr(voting_event.permission_level)})")
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
        
        # Get user from database to get the correct user.id (not Twitch ID)
        result = await db.execute(select(User).where(User.twitch_username == user_session['login']))
        user = result.scalar_one_or_none()
        if not user:
            return {"success": False, "error": "User not found in database"}
        
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
            .where(IndividualVote.voting_event_id == event_id, IndividualVote.voter_id == int(user.id))
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

    # Get creator's Twitch user ID for permission checks
    creator_result = await db.execute(select(User).where(User.id == event.creator_id))
    creator = creator_result.scalar_one_or_none()
    if not creator:
        return {"success": False, "message": "Event creator not found"}
    creator_twitch_user_id = creator.twitch_user_id

    # Check permissions
    user_can_access = False
    # Event creator always has access
    if user.id == event.creator_id:
        user_can_access = True
    else:
        # Check permission levels for everyone else
        # DEBUG: Log permission check
        print(f"[PERMISSION DEBUG] Event {event.id}: permission_level='{event.permission_level}' (type: {type(event.permission_level)}, repr: {repr(event.permission_level)})")
        print(f"[PERMISSION DEBUG] Event {event.id}: Comparing '{event.permission_level}' == 'all': {event.permission_level == 'all'}")
        if event.permission_level == "all":
            user_can_access = True 
        elif event.permission_level == "specific":
            if event.specific_users and user_session["login"] in event.specific_users:
                user_can_access = True 
        elif event.permission_level == "followers":
            # Check if user follows the event creator
            user_can_access = await check_user_follows_channel(
                user = user,
                channel_id=str(creator_twitch_user_id), 
                db = db
            )
        elif event.permission_level == "subscribers":
            # Check if user is subscribed to the event creator
            user_can_access = await check_user_subscribed_to_channel(
                user = user,
                broadcaster_id=str(creator_twitch_user_id),
                db=db
            )
        print(f"[PERMISSION DEBUG] Event {event.id}: user_can_access={user_can_access} after permission check") 
    
    if not user_can_access:
        return {"success": False, "message": "Access denied"}

    # Get creator username (creator already fetched above for permission checks)
    creator_name = creator.twitch_username if creator else "Unknown"

    # Check if user can edit this event
    can_edit = False
    if user.id == event.creator_id:
        can_edit = True
    elif creator and creator.moderators and user.twitch_username in creator.moderators:
        can_edit = True
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

        # Format as DD:HH:MM (always show all three, pad with zeros)
        days_str = str(days).zfill(2)
        hours_str = str(hours).zfill(2)
        minutes_str = str(minutes).zfill(2)
        time_left = f"{days_str}:{hours_str}:{minutes_str}"
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
        .where(IndividualVote.voting_event_id == event_id)
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
    "time_remaining": time_left if is_currently_active else None,
    "time_ended": time_ended if not is_currently_active else None,
    "end_time": end_time.isoformat() if is_currently_active else None,  # Add end_time for live countdown
    "can_edit": can_edit,
    "permission_level": event.permission_level,  
    "specific_users": event.specific_users or []  
}
    return {"success": True, "event": event_data}