from fastapi import APIRouter, HTTPException
import httpx
import pprint

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