from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models import PendingPermissions, User
from fastapi import APIRouter, HTTPException, Depends, Request
from database import get_database
from pydantic import BaseModel


router = APIRouter()

class AddModRequest(BaseModel):
    username: str 

class RemoveModRequest(BaseModel):
    username: str 

@router.get('/mods/list')
async def list_mods(request: Request, db: AsyncSession = Depends(get_database)):
    user_id = request.session.get('user_id')
    if not user_id:
        return {"success": False, "message": "User not signed in"}

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return {"success": False, "message": "User not found in database"}

    if not user.moderators:
        return {"success": True, "message": "User has no moderators", "moderators": []}
    
    return {"success": True, "message": None, "moderators": user.moderators}

@router.delete('/mods/remove')
async def remove_mod(mod_data: RemoveModRequest, request: Request, db: AsyncSession = Depends(get_database)):
    user_id = request.session.get('user_id')
    if not user_id:
        return {"success": False, "message": "User not signed in"}

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return {"success": False, "message": "User not found in database"}

    mod_username = mod_data.username
    if user.moderators and mod_username not in user.moderators:
        return {"success": False, "message": "Mod not found on your mod list"}
    
    result = await db.execute(select(User).where(User.twitch_username == mod_username))
    mod = result.scalar_one_or_none()

    if user.moderators and mod_username in user.moderators:
        user.moderators.remove(mod_username)
        from sqlalchemy.orm import attributes
        attributes.flag_modified(user, 'moderators')  # ← ADD THIS
        
    if mod and mod.can_create_votes_for and user.twitch_username in mod.can_create_votes_for:
        mod.can_create_votes_for.remove(user.twitch_username)
        attributes.flag_modified(mod, 'can_create_votes_for')  # ← ADD THIS

    result = await db.execute(
        select(PendingPermissions)
        .where(PendingPermissions.twitch_username == mod_username)
        .where(PendingPermissions.granted_by_user_id == user.id)
    )
    pending = result.scalar_one_or_none()
    if pending:
        await db.delete(pending)
    await db.commit()
    return {"success": True, "message": "Mod removed successfully"}


@router.post('/mods/add')
async def add_mod(mod_data: AddModRequest, request: Request, db: AsyncSession = Depends(get_database)):
    user_id = request.session.get('user_id')
    print(f"DEBUG: user_id from session: {user_id}")
    if not user_id:
        return {"success": False, "message": "User not signed in"}

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    print(f"DEBUG: Found user: {user.twitch_username if user else 'None'}")
    print(f"DEBUG: Current moderators: {user.moderators if user else 'None'}")
    if not user:
        return {"success": False, "message": "User not found in database"}

    potential_mod_username = mod_data.username
    print(f"DEBUG: Trying to add: {potential_mod_username}")
    if user.moderators and potential_mod_username in user.moderators:
        return {"success": False, "message": "Potential mod is already on your mod team"}
        
    result = await db.execute(select(User).where(User.twitch_username == potential_mod_username))
    potential_mod = result.scalar_one_or_none()
    print(f"DEBUG: Potential mod exists in DB: {potential_mod is not None}")
    
    if not potential_mod:
        new_pending = PendingPermissions(
            twitch_username = potential_mod_username,
            granted_by_user_id = user.id,
            permission_type = "moderator",
        )
        db.add(new_pending)
        
        # ALSO add to the current user's moderators list
        if user.moderators is None:
            user.moderators = [potential_mod_username]
        else:
            user.moderators.append(potential_mod_username)
        
        from sqlalchemy.orm import attributes
        attributes.flag_modified(user, 'moderators')  # ← ADD THIS
        
        print(f"DEBUG: After adding, moderators: {user.moderators}")
        await db.commit()
        print(f"DEBUG: Committed to database")
        return {"success": True, "message": "Potential mod will be granted permissions once they make an account"}

    elif potential_mod:
        if potential_mod.can_create_votes_for is None:
            potential_mod.can_create_votes_for = [user.twitch_username]
        else:
            potential_mod.can_create_votes_for.append(user.twitch_username)
        
        from sqlalchemy.orm import attributes
        attributes.flag_modified(potential_mod, 'can_create_votes_for')  # ← ADD THIS
        
        if user.moderators is None:
            user.moderators = [potential_mod_username]
        else:
            user.moderators.append(potential_mod_username)
        
        attributes.flag_modified(user, 'moderators')  # ← ADD THIS
        
        print(f"DEBUG: After adding, moderators: {user.moderators}")
        await db.commit()
        print(f"DEBUG: Committed to database")
        return {"success": True, "message": "Potential mod is now on your mod team"}