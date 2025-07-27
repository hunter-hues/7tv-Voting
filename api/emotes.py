from fastapi import APIRouter, HTTPException
import httpx
import pprint

router = APIRouter()

@router.get('/emotes/{username}')

    return {'username': username, 'emotes': []}