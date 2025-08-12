from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import RedirectResponse
from authlib.integrations.starlette_client import OAuth
import httpx
import os
from dotenv import load_dotenv
from jose import JWTError, jwt
from datetime import datetime, timedelta

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
    client_kwargs={'scope': 'user:read:email'}
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
async def callback(request: Request):
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
                request.session["user"] = user_object
                return RedirectResponse(url="/", status_code=302)

@router.get('/auth/me')
async def get_current_user(request: Request):
    if request.session.get("user"):
        return {"authenticated": True, "user": request.session.get("user")}
    else:
        return {"authenticated": False, "user": "not authenticated"}