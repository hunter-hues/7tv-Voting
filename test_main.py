from fastapi import FastAPI, HTTPException 
from pydantic import BaseModel

app = FastAPI()

emote_list = ["Kappa", "PogChamp", "LUL"]

class Emote(BaseModel):
    name: str

""" Obselete and redone later in the practice
@app.get("/")
async def root():
    return {"message": "Hello World"}
"""

@app.get("/ping")
async def ping():
    return {"message": "pong"}

""" Also obselete
@app.get("/emotes")
async def emotes():
    return {"emotes": emote_list}
"""

@app.post("/emotes")
async def add_emote(emote: Emote):
    emote_list.append(emote.name)
    return {"message" : f"{emote.name} has been added", "emotes" : emote_list}

@app.put("/emotes/{index}")
async def update_emote(index:int , emote:Emote):
    if index < 0 or index >= len(emote_list):
        raise HTTPException(status_code=404, detail="Out of bounds")
    
    emote_list[index] = emote.name
    return {
        'message': f'{emote.name} has been updated at index {index}', 
        'emotes': emote_list
        }

@app.post("/emotes/insert/{index}")
async def insert_emote(index:int, emote:Emote):
    if index < 0 or len(emote_list) < index:
        raise HTTPException(status_code=404, detail="Out of bounds")
    emote_list.insert(index, emote.name)
    return {"message": f"emote {emote.name} added at index {index}"}

@app.delete("/emotes/{index}")
async def delete_emote(index:int):
    if index < 0 or len(emote_list) <= index:
        raise HTTPException(status_code=404, detail="Out of bounds")
    del emote_list[index]
    return {'message': f'emote at index {index} has been deleted', 'emotes': emote_list}

""" Creating Copy of this before adding to it so progress can be seen
@app.get("/emotes")
async def search_emotes(search:str | None = None):
    if search is None:
        return {"emotes": emote_list}
    matching_emotes = []
    for emote in emote_list:
        if search.lower() in emote.lower():
            matching_emotes.append(emote)
    return {"emotes": matching_emotes}
"""

@app.get("/emotes")
async def search_emotes(search:str | None = None, limit:int | None = None):
    if limit is not None and limit < 0:
        raise HTTPException(status_code=400, detail="Limit cannot be a negative value")
    
    matching_emotes = emote_list

    if search is not None:
        matching_emotes = [emote for emote in emote_list if search.lower() in emote.lower()]
    
    if limit is not None:
        matching_emotes = matching_emotes[:limit]
    
    return {"emotes": matching_emotes}