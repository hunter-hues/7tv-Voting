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

    async with httpx.AsyncClient() as client:
        response = await client.post("https://7tv.io/v3/gql", json={"query": user_query})
        data = response.json().get("data")
        print(response.status_code)
        pprint.pprint(data)
        print('----------------------------')
        correct_user = [user for user in data['users'] if user['username'] == username and any(conn['platform'] == platform for conn in user['connections'])]
        if len(correct_user) == 1:
            id = correct_user[0]['id']
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
            response = await client.post("https://7tv.io/v3/gql", json={"query": query})
            data = response.json().get("data")
            print(response.status_code)
            #pprint.pprint(data)
            print(data["user"]["username"])
            #print([emote_set["name"] for emote_set in data["user"]["emote_sets"]])
            emote_sets = [{"name": emote_set['name']} for emote_set in data['user']['emote_sets']]
            emote_sets_string = ", ".join([f"[{i}] {emote_set['name']}" for i, emote_set in enumerate(emote_sets)])
            print(f"Found {len(emote_sets)} emote sets: {emote_sets_string}")
            while True:
                chosen_set = int(input("Which set would you like?(use arr[i] notation): " + emote_sets_string + "\n"))
                if chosen_set < 0 or chosen_set > len(emote_sets) - 1:
                    print('invalid input try again')
                else:
                    break
            
            emotes = [{"name": emote["name"], "id": emote["id"]} for emote in data['user']['emote_sets'][chosen_set]["emotes"]]
            print(emotes[0])
            print(get_emote_img_url(emotes[0]["id"], 4))
            print(data["user"]['connections'])   

        

asyncio.run(get_emotes())