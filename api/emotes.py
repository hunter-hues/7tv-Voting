from fastapi import APIRouter, HTTPException, Request, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_database
from models import User
import httpx
import pprint
import os
import asyncio
from datetime import datetime

router = APIRouter()

@router.get('/emotes/emote_sets/{user_id}')
async def get_emote_sets(user_id: str) -> dict:
    query = f"""
            {{ 
                user(id: "{user_id}") {{
                    id
                    username
                    emote_sets {{
                        id
                        name
                        emotes {{
                            id
                            name
                        }}
                    }}
                    connections {{
                        id
                        platform
                    }}
                }}
            }}
            """
    async with httpx.AsyncClient() as client:
        response = await client.post("https://7tv.io/v3/gql", json={"query": query})
        data = response.json().get("data")
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail='7TV API error')
        elif not data or not data.get('user'):
            raise HTTPException(status_code=404, detail='user not found')
        else: 
            emote_sets = [
                {
                    'id': emote_set['id'],
                    'name': emote_set['name'],
                    'preview_emotes': emote_set['emotes'][:3]
                }
                for emote_set in data['user']['emote_sets']
            ]

            return {'emote_sets': emote_sets}

@router.get('/emotes/set/{emote_set_id}/emotes')
async def get_emotes_from_set(emote_set_id: str):
    query = f"""
        {{
            emoteSet(id: "{emote_set_id}") {{
                id
                name
                emotes {{
                    id
                    name 
                }}
            }}

        }}
    """
    async with httpx.AsyncClient() as client:
        response = await client.post("https://7tv.io/v3/gql", json={"query": query})
        data = response.json().get("data")
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail='7TV API error')
        elif not data or not data.get('emoteSet'):
            raise HTTPException(status_code=404, detail='emote set not found')
        else:
            emotes = [
                {
                    'id': emote['id'],
                    'name': emote['name']
                } 
                for emote in data['emoteSet']['emotes']
            ]
        
            return {'emotes': emotes}
        
@router.get('/emotes/mod-list')
async def get_mod_list(request: Request, db: AsyncSession = Depends(get_database)):
    user_session = request.session.get('user')
    if not user_session:
        return {"success": False, "message": "User not authenticated"}

    result = await db.execute(select(User).where(User.twitch_user_id == user_session['id']))
    user = result.scalar_one_or_none()
    if not user:
        return {"success": False, "message": "User not found in database"}

    if not user.can_create_votes_for or len(user.can_create_votes_for) == 0:
        return {"success": True, "message": "User is not a mod anywhere", "mod_channels": []}

    BASE_URL = os.getenv("BASE_URL")
    
    # OPTIMIZATION #3: Parallelize mod list fetching
    parallel_start_time = datetime.now()
    print(f"[PARALLEL MOD FETCH] Starting to fetch emote sets for {len(user.can_create_votes_for)} mod channels...")
    
    # Get all mod usernames (already checked above that it's not empty)
    mod_usernames = user.can_create_votes_for
    
    # Create tasks for parallel fetching
    async def fetch_channel_emotes(mod_for_username):
        try:
            # Get the user from database
            result = await db.execute(select(User).where(User.twitch_username == mod_for_username))
            mod_for_user = result.scalar_one_or_none()
            
            # Skip if not found or no 7TV ID
            if not mod_for_user or not mod_for_user.sevenTV_id or mod_for_user.sevenTV_id.startswith("no_account_"):
                return None
                
            # Use the existing function!
            emote_sets_data = await get_emote_sets(mod_for_user.sevenTV_id)
            
            # Return result
            return {
                'channel_username': mod_for_username,
                'emote_sets': emote_sets_data['emote_sets']
            }
        except Exception as e:
            print(f"Error fetching emote sets for {mod_for_username}: {str(e)}")
            return None
    
    # Fetch all channels in parallel
    results = await asyncio.gather(*[fetch_channel_emotes(username) for username in mod_usernames])
    
    # Filter out None results (failed or skipped channels)
    channels_and_emotes = [result for result in results if result is not None]
    
    parallel_end_time = datetime.now()
    parallel_duration = (parallel_end_time - parallel_start_time).total_seconds() * 1000
    print(f"[PARALLEL MOD FETCH] Completed fetching {len(channels_and_emotes)} channels in {parallel_duration:.2f}ms (parallel)")
    print(f"[PARALLEL MOD FETCH] Fetched {len(channels_and_emotes)} of {len(mod_usernames)} channels successfully")
    
    return {
        "success": True,
        "mod_channels": channels_and_emotes
    }