from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models import ChannelTokens, User
import os
import httpx
from typing import Optional

async def check_user_follows_channel(user: User, channel_id: str, db: AsyncSession, retry_count: int = 0) -> bool:
    """
    Check if a user follows a specific channel using Twitch Helix API
    """
    user_id = user.twitch_user_id
    access_token = user.access_token
    print(f"DEBUG [Follow Check - retry {retry_count}]: Using token ending in ...{access_token[-10:] if access_token else 'None'}")
    try:
        client_id = os.getenv("TWITCH_CLIENT_ID")

        async with httpx.AsyncClient() as client:
            # Fetch all pages to search for the broadcaster
            all_followed_channels = []
            cursor = None
            
            while True:
                url = f"https://api.twitch.tv/helix/channels/followed?user_id={user_id}&first=100"
                if cursor:
                    url += f"&after={cursor}"
                    
                following_response = await client.get(url,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Client-Id": client_id
                })
                
                if following_response.status_code == 401:
                    # Token expired
                    if retry_count >= 1:
                        print("Token refresh already attempted, failing")
                        return False
                    
                    # Try to refresh
                    print("Token expired, attempting refresh...")
                    refresh_result = await refresh_access_token(user, db)
                    
                    if refresh_result.get("Success"):
                        user_id = user.twitch_user_id
                        access_token = user.access_token
                        print(f"DEBUG [Follow Check - retry {retry_count}]: Using token ending in ...{access_token[-10:] if access_token else 'None'}")
                        print("Token refreshed, retrying follow check")
                        return await check_user_follows_channel(user, channel_id, db, retry_count + 1)
                    else:
                        print("Token refresh failed")
                        return False
                
                following_data = following_response.json()
                
                if 'error' in following_data:
                    return False
                
                page_data = following_data.get('data', [])
                all_followed_channels.extend(page_data)
                
                # Check if we found the broadcaster on this page
                result = any(ch.get('broadcaster_id') == channel_id for ch in page_data)
                if result:
                    return True
                
                # Check if there are more pages
                cursor = following_data.get('pagination', {}).get('cursor')
                if not cursor:
                    break
            
            # Check the complete list
            result = any(ch.get('broadcaster_id') == channel_id for ch in all_followed_channels)
            return result

    except httpx.HTTPStatusError as e:
        if e.response.status_code == 410:
            return False
        print(f"HTTP error: {e.response.status_code} - {e.response.text}")
        return False
    except httpx.HTTPStatusError as e:
        print(f"HTTP error: {e.response.status_code} - {e.response.text}")
        return False
    except httpx.RequestError as e:
        print(f"Request error: {e}")
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        return False
    
async def check_user_subscribed_to_channel(user: User, broadcaster_id: str, db: AsyncSession, retry_count: int = 0) -> bool:
    # First, convert broadcaster's twitch_user_id to their internal user_id
    user_id = user.twitch_user_id
    try:
        # Look up the broadcaster's internal user_id from their twitch_user_id
        user_result = await db.execute(
            select(User.id).where(User.twitch_user_id == broadcaster_id)
        )
        user_row = user_result.first()
        if not user_row:
            return False
        creator_user_id = user_row[0]
        
        token_result = await db.execute(
            select(ChannelTokens).where(ChannelTokens.user_id == creator_user_id)
        )
        token_row = token_result.first()
        if not token_row:
            return False
        token = token_row[0]  # Extract the ChannelTokens object
        print(f"DEBUG [Sub Check - retry {retry_count}]: Using broadcaster token ending in ...{token.access_token[-10:] if token.access_token else 'None'}")
        if not token:
            return False

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://api.twitch.tv/helix/subscriptions?broadcaster_id={broadcaster_id}&user_id={user_id}",
                headers={
                    "Authorization": f"Bearer {token.access_token}",
                    "Client-Id": os.getenv("TWITCH_CLIENT_ID")
                }
            )
            if response.status_code == 401:
                # Broadcaster's token expired
                if retry_count >= 1:
                    print("Token refresh already attempted, failing")
                    return False
                
                # Need to get the broadcaster's User object to refresh their token
                print("Broadcaster token expired, attempting refresh...")
                broadcaster_result = await db.execute(
                    select(User).where(User.twitch_user_id == broadcaster_id)
                )
                broadcaster_user = broadcaster_result.scalar_one_or_none()
                
                if not broadcaster_user:
                    return False
                
                refresh_result = await refresh_access_token(broadcaster_user, db)
                
                if refresh_result.get("Success"):
                    print("Broadcaster token refreshed, retrying subscription check")
                    return await check_user_subscribed_to_channel(user, broadcaster_id, db, retry_count + 1)
                else:
                    print("Broadcaster token refresh failed")
                    return False

            # Check status code FIRST
            elif response.status_code == 200:
                data = response.json()
                return len(data.get('data', [])) > 0

            elif response.status_code == 403:
                # Don't have permission
                print(f"Forbidden: Missing required scope")
                return False
            
            else:
                # Other errors
                print(f"Unexpected status: {response.status_code}")
                return False
    
    except httpx.RequestError as e:
        # Network errors only
        print(f"Request error: {e}")
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        return False

async def refresh_access_token(user: User, db: AsyncSession):
    try:    
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://id.twitch.tv/oauth2/token",
                data={
                    "client_id": os.getenv("TWITCH_CLIENT_ID"),
                    "client_secret": os.getenv("TWITCH_CLIENT_SECRET"),
                    "grant_type": "refresh_token",
                    "refresh_token": user.refresh_token
                }
            )

            if response.status_code == 200:
                data = response.json()
                
                if 'access_token' not in data:
                    print(f"ERROR: No access_token in response: {data}")
                    return {"Success": False, "message": "Invalid response from Twitch"}

                token_result = await db.execute(select(ChannelTokens).where(ChannelTokens.user_id == user.id))
                token_row = token_result.first()
                if token_row:
                    user_token = token_row[0]
                    user_token.access_token = data['access_token']
                    user.access_token = data['access_token']
                    print(f"DEBUG [Refresh]: Updated user.access_token to ...{data['access_token'][-10:]}")

                    # Check if Twitch sent a new refresh token
                    if 'refresh_token' in data:
                        user_token.refresh_token = data['refresh_token']
                        user.refresh_token = data['refresh_token']

                    await db.commit()

                return {"Success": True, "access_token": data['access_token']}
            
            elif response.status_code == 400:
                print(f"Bad request: Invalid refresh token")
                return {"Success": False, "message": "Refresh token invalid. Please log in again."}
            
            elif response.status_code == 401:
                print(f"Unauthorized: Check client_id/client_secret")
                return {"Success": False, "message": "Authentication configuration error"}

            else:
                print(f"Unexpected status code: {response.status_code}, body: {response.text}")
                return {"Success": False, "message": "Token refresh failed"}

    except httpx.RequestError as e:
        print(f"Network error during token refresh: {e}")
        return {"Success": False, "message": "Network error"}
    except Exception as e:
        print(f"Unexpected error during token refresh: {e}")
        return {"Success": False, "message": "Token refresh failed"}