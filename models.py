from sqlalchemy import Column, Integer, String, DateTime, Date, ARRAY, ForeignKey, Boolean, Float
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    twitch_username = Column(String, unique=True, nullable=False)
    sevenTV_id = Column(String, unique=True, nullable=False)
    can_create_votes_for = Column(ARRAY(String), default=[])
    moderators = Column(ARRAY(String), default=[])
    login_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True))
    last_seen_date = Column(Date)  # Track last daily visit
    daily_visits = Column(Integer, default=0)  # Count of unique days visited

class VotingEvent(Base):
    __tablename__ = "voting_events"

    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String, nullable=False)
    emote_set_id = Column(String)
    emote_set_name = Column(String)
    duration_hours = Column(Float)
    end_time = Column(DateTime(timezone=True))
    active_time_tab = Column(String)
    permission_level = Column(String)
    specific_users = Column(ARRAY(String))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class IndividualVote(Base):
    __tablename__ = "individual_votes"

    id = Column(Integer, primary_key=True, index=True)
    voting_event_id = Column(Integer, ForeignKey("voting_events.id"))
    voter_id = Column(Integer, ForeignKey("users.id"))
    emote_id = Column(String)
    vote_choice = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class PendingPermissions(Base):
    __tablename__ = "pending_permissions"

    id = Column(Integer, primary_key=True, index=True)
    twitch_username = Column(String)
    granted_by_user_id = Column(Integer, ForeignKey("users.id"))
    permission_type = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())