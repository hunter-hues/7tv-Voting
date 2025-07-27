from fastapi import FastAPI, APIRouter, HTTPException
from api.users import router as users_router

app = FastAPI()
app.include_router(users_router)

@app.get("/")
async def root():
    return{'message':'hello world'}