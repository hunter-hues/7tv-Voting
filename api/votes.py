from fastapi import APIRouter, HTTPException, Depends, Request
from database import get_database
from models import VotingEvent, User
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta
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