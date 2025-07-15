import httpx
import asyncio
import pprint

async def get_example():
    async with httpx.AsyncClient() as client:
        response = await client.get("https://httpbin.org/get")
        print(response.status_code)
        print(response.json())

def get_emote_img_url(id: str, size: int):
    return f"https://cdn.7tv.app/emote/{id}/{size}x"

async def get_emotes():
    username = "hunter_hues"
    platform = 'TWITCH'
    id = "" #01GFHQ0NVG0003MXBXD46YE188
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

    query = f"""
    {{ 
        user(id: "{id}") {{
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
        response = await client.post("https://7tv.io/v3/gql", json={"query": user_query})
        data = response.json().get("data")
        print(response.status_code)
        pprint.pprint(response.json())
        correct_user = [user for user in data['users'] if user['username'] == username and user["connections"]['platform'] == platform]
        if len(correct_user) == 1:
            id = correct_user[0]['id']
            response = await client.post("https://7tv.io/v3/gql", json={"query": query})
            data = response.json().get("data")
            print(response.status_code)
            #pprint.pprint(data)
            print(data["user"]["username"])
            print([emote_set["name"] for emote_set in data["user"]["emote_sets"]])
            emotes = [{"name": emote["name"], "id": emote["id"]} for emote in data["user"]["emote_sets"][0]["emotes"]]
            print(emotes[0])
            print(get_emote_img_url(emotes[0]["id"], 4))
            print(data["user"]['connections'])   

        



asyncio.run(get_emotes())