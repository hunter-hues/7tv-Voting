from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost/dbname")

# Remove sslmode for asyncpg (it doesn't support it)
ASYNC_DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://").replace("?sslmode=require", "")
engine = create_async_engine(
    ASYNC_DATABASE_URL,
    pool_pre_ping=True,  # Test connections before use
    pool_recycle=3600,   # Recycle connections every hour
    pool_timeout=30,     # Wait up to 30 seconds for a connection
    max_overflow=20      # Allow extra connections if needed
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)
Base = declarative_base()

async def get_database():
    async with AsyncSessionLocal() as session:
        yield session