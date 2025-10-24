from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import RedirectResponse
from authlib.integrations.starlette_client import OAuth
import httpx
import os
import json
from dotenv import load_dotenv
from jose import JWTError, jwt
from datetime import datetime, timedelta, date
from database import get_database
from models import User, ChannelTokens
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

load_dotenv()

router = APIRouter()

# OAuth configuration
oauth = OAuth()
oauth.register(
    name='twitch',
    client_id=os.getenv('TWITCH_CLIENT_ID'),
    client_secret=os.getenv('TWITCH_CLIENT_SECRET'),
    authorize_url='https://id.twitch.tv/oauth2/authorize',
    access_token_url='https://id.twitch.tv/oauth2/token',
    client_kwargs={'scope': 'user:read:email channel:read:subscriptions'}
)

SECRET_KEY = os.getenv('SECRET_KEY')
ALGORITHM = "HS256"

@router.get('/auth/login')
async def login(request: Request):
    # Create the redirect URL that Twitch will send user back to
    redirect_uri = os.getenv('REDIRECT_URI')
    
    # Generate the authorization URL with all needed parameters
    return await oauth.twitch.authorize_redirect(request, redirect_uri)

@router.get('/auth/callback')
async def callback(request: Request, db: AsyncSession = Depends(get_database)):
    code = request.query_params.get('code')
    if not code:
        raise HTTPException(status_code=500, detail='OAuth api error: no code returned')

    async with httpx.AsyncClient() as client:
        token_response = await client.post("https://id.twitch.tv/oauth2/token", 
            json={
                "code": code, 
                "client_id": os.getenv("TWITCH_CLIENT_ID"), 
                "client_secret":os.getenv("TWITCH_CLIENT_SECRET"), 
                "grant_type": "authorization_code", 
                "redirect_uri": os.getenv("REDIRECT_URI")})
        token_data = token_response.json()
        access_token = token_data.get("access_token")
        if token_response.status_code != 200:
            raise HTTPException(status_code=500, detail="Twitch token access error")

        elif not token_data or not token_data.get("access_token"):
            raise HTTPException(status_code=404, detail="Token not found")

        else:
            user_info_response = await client.get("https://api.twitch.tv/helix/users",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Client-Id": os.getenv("TWITCH_CLIENT_ID")
            })
            user_data = user_info_response.json()
            if user_info_response.status_code != 200:
                raise HTTPException(status_code=500, detail="Helix access error")

            elif not user_data or not user_data.get("data"):
                raise HTTPException(status_code=404, detail="User info not found")

            else:
                user_object = user_data['data'][0]
                result = await db.execute(select(User).where(User.twitch_username == user_object['login']))
                existing_user = result.scalar_one_or_none()
                if not existing_user:
                    twitch_username = user_object['login']
                    base_url = os.getenv("BASE_URL")

                    async with httpx.AsyncClient() as client:
                        seventv_response = await client.get(f"{base_url}/users/{twitch_username}")
                        if seventv_response.status_code == 200:
                            seventv_data = seventv_response.json()
                            seventv_id = seventv_data['id']
                        
                        else:
                            seventv_id = None

                    new_user = User(
                        twitch_user_id=user_object['id'],
                        twitch_username=twitch_username,
                        sevenTV_id=seventv_id,
                        login_count=1,
                        last_login=datetime.utcnow(),
                        last_seen_date=date.today(),
                        daily_visits=1,
                        access_token=access_token,
                        refresh_token=token_data.get("refresh_token"),
                        token_expires_at=datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 3600)),
                        token_scopes=json.dumps(token_data.get("scope", []))
                    )
                    db.add(new_user)
                    await db.commit() 
                    
                else:
                    # Update daily visit tracking
                    today = date.today()
                    if existing_user.last_seen_date != today:
                        if existing_user.daily_visits is None:
                            existing_user.daily_visits = 1
                        else:
                            existing_user.daily_visits += 1
                        existing_user.last_seen_date = today

                    # Keep login count for backwards compatibility
                    existing_user.login_count += 1
                    existing_user.last_login = datetime.utcnow()
                    # In your existing user update section (around line 122-127):
                    print(f"Updating tokens for user: {existing_user.twitch_username}")
                    print(f"Access token: {access_token}")
                    print(f"Token data: {token_data}")

                    await db.commit()
                # Update tokens for ALL users (both new and existing)
                if existing_user:
                    # For existing users, update their tokens
                    existing_user.access_token = access_token
                    existing_user.refresh_token = token_data.get("refresh_token")
                    existing_user.token_expires_at = datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 3600))
                    existing_user.token_scopes = json.dumps(token_data.get("scope", []))
                    # Also store tokens in ChannelTokens for subscriber checks
                    channel_token = ChannelTokens(
                        user_id=existing_user.id,
                        channel_username=existing_user.twitch_username,
                        access_token=access_token,
                        refresh_token=token_data.get("refresh_token"),
                        expires_at=datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 3600)),
                        scopes=json.dumps(token_data.get("scope", []))
                    )
                    db.add(channel_token)
                    await db.commit()
                # For new users, tokens are already set in the User() constructor

                request.session["user"] = user_object
                return RedirectResponse(url="/", status_code=302)

@router.get('/auth/me')
async def get_current_user(request: Request, db: AsyncSession = Depends(get_database)):
    if request.session.get("user"):
        # Update daily visit tracking for authenticated users
        user_session = request.session.get("user")
        result = await db.execute(select(User).where(User.twitch_username == user_session['login']))
        user = result.scalar_one_or_none()
        
        if user:
            today = date.today()
            if user.last_seen_date != today:
                if user.daily_visits is None:
                    user.daily_visits = 1
                else:
                    user.daily_visits += 1
                user.last_seen_date = today
                await db.commit()
        
        return {"authenticated": True, "user": request.session.get("user")}
    else:
        return {"authenticated": False, "user": "not authenticated"}

@router.get('/auth/logout')
async def logout(request: Request):
    request.session.clear()
    return RedirectResponse(url="/", status_code=302)
