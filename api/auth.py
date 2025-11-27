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
from models import User, ChannelTokens, PendingPermissions
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
    client_kwargs={'scope': 'user:read:email channel:read:subscriptions user:read:follows'}
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
                            # Use a placeholder value for users without a 7TV account
                            seventv_id = f"no_account_{twitch_username}"

                                                # Query for any pending permissions for this new user
                        result = await db.execute(
                            select(PendingPermissions).where(PendingPermissions.twitch_username == twitch_username)
                        )
                        pending_permissions = result.scalars().all()

                        # Process pending permissions - get usernames from user IDs
                        can_create_for = []
                        for pending in pending_permissions:
                            # Get the user who granted this permission
                            granter_result = await db.execute(
                                select(User).where(User.id == pending.granted_by_user_id)
                            )
                            granter_user = granter_result.scalar_one_or_none()
                            
                            if granter_user:
                                can_create_for.append(granter_user.twitch_username)
                            
                            # Delete the pending permission since we're applying it
                            await db.delete(pending)

                    new_user = User(
                        twitch_user_id=user_object['id'],
                        twitch_username=twitch_username,
                        sevenTV_id=seventv_id,
                        can_create_votes_for=can_create_for if can_create_for else [],
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
                    # Check if ChannelTokens already exists for this user
                    token_result = await db.execute(
                        select(ChannelTokens).where(ChannelTokens.user_id == existing_user.id)
                    )
                    channel_token = token_result.scalar_one_or_none()
                    
                    if channel_token:
                        # Update existing token to match User
                        channel_token.access_token = access_token
                        channel_token.refresh_token = token_data.get("refresh_token")
                        channel_token.expires_at = datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 3600))
                        channel_token.scopes = json.dumps(token_data.get("scope", []))
                    else:
                        # Create new token entry
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
                # Store database user ID for other endpoints
                if existing_user:
                    request.session["user_id"] = existing_user.id
                else:
                    await db.refresh(new_user)  # Refresh to get the auto-generated ID
                    request.session["user_id"] = new_user.id
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
            
            # Return both Twitch data AND database fields
            return {
                "authenticated": True,
                "user": {
                    **request.session.get("user"),  # Spread Twitch user data
                    "can_create_votes_for": user.can_create_votes_for or [],  # Add database field
                    "sevenTV_id": user.sevenTV_id  # ADD THIS LINE
                }
            }
        
        return {"authenticated": True, "user": request.session.get("user")}
    else:
        return {"authenticated": False}

@router.get('/auth/logout')
async def logout(request: Request):
    request.session.clear()
    return RedirectResponse(url="/", status_code=302)
