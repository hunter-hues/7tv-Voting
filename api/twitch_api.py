from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models import ChannelTokens
import os
import httpx
from typing import Optional

async def check_user_follows_channel(user_id: str, channel_id: str, access_token: str) -> bool:
    """
    Check if a user follows a specific channel using Twitch Helix API
    """
    try:
        async with httpx.AsyncClient() as client:
            following_response = await client.get("https://api.twitch.tv/helix/users/follows?from_id={user_id}&to_id={channel_id}",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Client-Id": os.getenv("TWITCH_CLIENT_ID")
            })

            following_data = following_response.json()
            # Just check if data array has items
            return len(following_data.get('data', [])) > 0

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
    # Look up the broadcaster's token from database
    # Then use it for the API call
    try:
        token_result = await db.execute(select(ChannelTokens).where(ChannelTokens.user_id == broadcaster_id))
        token = token_result.scalar_one_or_none()

        if not token:
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

    except httpx.HTTPStatusError as e:
        print(f"HTTP error: {e.response.status_code} - {e.response.text}")
        return False
    except httpx.RequestError as e:
        print(f"Request error: {e}")
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        return False