from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models import ChannelTokens, User
import os
import httpx
from typing import Optional

async def check_user_follows_channel(user_id: str, channel_id: str, access_token: str) -> bool:
    """
    Check if a user follows a specific channel using Twitch Helix API
    """
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
                
                following_data = following_response.json()
                
                if 'error' in following_data:
                    print(f"DEBUG: Error in response: {following_data.get('message')}")
                    return False
                
                page_data = following_data.get('data', [])
                all_followed_channels.extend(page_data)
                
                # Check if we found the broadcaster on this page
                result = any(ch.get('broadcaster_id') == channel_id for ch in page_data)
                if result:
                    print(f"DEBUG: Found broadcaster in followed list")
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
            print(f"DEBUG: Twitch API endpoint not available (410 Gone)")
            return False
        print(f"HTTP error: {e.response.status_code} - {e.response.text}")
        return False
    except httpx.RequestError as e:
        print(f"Request error: {e}")
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
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
    
async def check_user_subscribed_to_channel(user_id: str, broadcaster_id: str, db: AsyncSession) -> bool:
    # First, convert broadcaster's twitch_user_id to their internal user_id
    print(f"DEBUG: Looking for token for broadcaster_id: {broadcaster_id}")
    try:
        # Look up the broadcaster's internal user_id from their twitch_user_id
        user_result = await db.execute(
            select(User.id).where(User.twitch_user_id == broadcaster_id)
        )
        user_row = user_result.first()
        if not user_row:
            print(f"DEBUG: No user found with twitch_user_id: {broadcaster_id}")
            return False
        creator_user_id = user_row[0]
        
        token_result = await db.execute(
            select(ChannelTokens).where(ChannelTokens.user_id == creator_user_id)
        )
        token_row = token_result.first()
        if not token_row:
            print(f"DEBUG: No token found for user_id: {creator_user_id}")
            return False
        token = token_row[0]  # Extract the ChannelTokens object

        if not token:
            print(f"DEBUG: No token found for user_id: {creator_user_id}")
            return False

        async with httpx.AsyncClient() as client:
            following_response = await client.get(f"https://api.twitch.tv/helix/subscriptions?broadcaster_id={broadcaster_id}&user_id={user_id}",
            headers={
                "Authorization": f"Bearer {token.access_token}",
                "Client-Id": os.getenv("TWITCH_CLIENT_ID")
            })

            following_data = following_response.json()
            # Just check if data array has items
            return len(following_data.get('data', [])) > 0
        print(f"DEBUG: Checking if user {user_id} is subscribed to broadcaster {broadcaster_id}")
        print(f"DEBUG: Response: {following_data}")

    except httpx.HTTPStatusError as e:
        print(f"HTTP error: {e.response.status_code} - {e.response.text}")
        return False
    except httpx.RequestError as e:
        print(f"Request error: {e}")
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        return False