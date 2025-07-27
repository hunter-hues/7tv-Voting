from fastapi import APIRouter, HTTPException
import httpx
import pprint

router = APIRouter()

@router.get('/user/{username}')
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