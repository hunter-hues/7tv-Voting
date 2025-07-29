from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from api.users import router as users_router
from api.emotes import router as emotes_router

app = FastAPI()
app.include_router(users_router)
app.include_router(emotes_router)
app.mount("/static", StaticFiles(directory="."), name="static")

@app.get("/")
async def root():
    return FileResponse("index.html")