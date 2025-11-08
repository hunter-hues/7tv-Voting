from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from api.users import router as users_router
from api.emotes import router as emotes_router
from api.auth import router as auth_router
from api.votes import router as votes_router
import mimetypes
import os
from dotenv import load_dotenv
from starlette.middleware.sessions import SessionMiddleware

# This is crucial - add JavaScript MIME type before creating the app
mimetypes.add_type('application/javascript', '.js')

app = FastAPI()
app.include_router(users_router)
app.include_router(emotes_router)
app.include_router(auth_router)
app.include_router(votes_router)
app.add_middleware(SessionMiddleware, secret_key=os.getenv('SECRET_KEY', 'default_secret_key'))

# Mount static files with the updated MIME types
app.mount("/static", StaticFiles(directory=".", html=True), name="static")

@app.get("/")
async def root():
    return FileResponse("index.html")
@app.get("/favicon.ico")
async def favicon():
    return {"message": "No favicon"}
    
@app.get("/{filename}")
async def serve_js_files(filename: str):
    if filename.endswith('.js'):
        from fastapi.responses import Response
        with open(filename, 'r') as f:
            content = f.read()
        return Response(content, media_type="application/javascript")
    return FileResponse(filename)

