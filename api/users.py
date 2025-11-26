from fastapi import APIRouter, HTTPException, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_database
from models import User
import httpx
import pprint
import os

router = APIRouter()

@router.get('/users/{username}')
async def get_user(username: str) -> dict:
    user_query = f"""
    {{
        users(query: "{username}") {{
            id
            username
            connections {{
                id
                platform
            }}
        }}
    }}
    """
    async with httpx.AsyncClient() as client:
        response = await client.post("https://7tv.io/v3/gql", json={"query": user_query})
        data = response.json().get('data')
        pprint.pprint(data)
        correct_user = [user for user in data['users'] if user['username'] == username and any(conn['platform'] == 'TWITCH' for conn in user['connections'])]
        if response.status_code !=200:
            raise HTTPException(status_code=500, detail='7TV API error')
        elif len(correct_user) == 1:
            return {'message': f'{correct_user[0]['username']} has been found', 'id': correct_user[0]['id']}
        elif len(correct_user) == 0:
            raise HTTPException(status_code=404, detail='User not found')
        else:
            raise HTTPException(status_code=404, detail='Multiple users found, unknown error')


@router.get('/user/following')
async def get_user_following(request: Request, db: AsyncSession = Depends(get_database)):
    """
    Get all channels the current user follows from Twitch
    """
    # Check authentication
    user_session = request.session.get("user")
    if not user_session:
        raise HTTPException(status_code=401, detail="User not signed in")
    
    # Get user from database
    result = await db.execute(
        select(User).where(User.twitch_user_id == user_session['id'])
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found in database")
    
    # Fetch followed channels from Twitch
    user_id = user.twitch_user_id
    access_token = user.access_token
    client_id = os.getenv("TWITCH_CLIENT_ID")
    
    try:
        async with httpx.AsyncClient() as client:
            all_followed_channels = []
            cursor = None
            
            # Paginate through all followed channels
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
                    raise HTTPException(
                        status_code=following_response.status_code,
                        detail=f"Twitch API error: {following_response.text}"
                    )
                
                following_data = following_response.json()
                
                if 'error' in following_data:
                    raise HTTPException(status_code=400, detail="Error fetching followed channels")
                
                page_data = following_data.get('data', [])
                all_followed_channels.extend(page_data)
                
                # Check if there are more pages
                cursor = following_data.get('pagination', {}).get('cursor')
                if not cursor:
                    break
            
            # Extract broadcaster IDs
            channel_ids = [channel.get('broadcaster_id') for channel in all_followed_channels]
            
            return {"channel_ids": channel_ids}
    
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Request error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")