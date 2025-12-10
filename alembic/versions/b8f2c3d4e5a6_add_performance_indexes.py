"""add performance indexes

Revision ID: b8f2c3d4e5a6
Revises: 07af03576894
Create Date: 2025-01-XX XX:XX:XX.XXXXXX

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8f2c3d4e5a6'
down_revision: Union[str, Sequence[str], None] = '07af03576894'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - add performance indexes."""
    
    # Create indexes only if they don't already exist
    # This prevents errors if indexes were created manually or already exist
    
    # Indexes for VotingEvent table
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_voting_events_creator_id 
        ON voting_events(creator_id);
    """)
    
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_voting_events_emote_set_owner_id 
        ON voting_events(emote_set_owner_id);
    """)
    
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_voting_events_is_active 
        ON voting_events(is_active);
    """)
    
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_voting_events_creator_active 
        ON voting_events(creator_id, is_active);
    """)
    
    # Indexes for IndividualVote table
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_individual_votes_voting_event_id 
        ON individual_votes(voting_event_id);
    """)
    
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_individual_votes_voter_id 
        ON individual_votes(voter_id);
    """)
    
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_individual_votes_emote_id 
        ON individual_votes(emote_id);
    """)
    
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_individual_votes_event_voter 
        ON individual_votes(voting_event_id, voter_id);
    """)
    
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_individual_votes_event_emote 
        ON individual_votes(voting_event_id, emote_id);
    """)
    
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_individual_votes_event_choice 
        ON individual_votes(voting_event_id, vote_choice);
    """)


def downgrade() -> None:
    """Downgrade schema - remove performance indexes."""
    
    # Drop VotingEvent indexes
    op.drop_index('ix_voting_events_creator_active', table_name='voting_events')
    op.drop_index('ix_voting_events_is_active', table_name='voting_events')
    op.drop_index('ix_voting_events_emote_set_owner_id', table_name='voting_events')
    op.drop_index('ix_voting_events_creator_id', table_name='voting_events')
    
    # Drop IndividualVote indexes
    op.drop_index('ix_individual_votes_event_choice', table_name='individual_votes')
    op.drop_index('ix_individual_votes_event_emote', table_name='individual_votes')
    op.drop_index('ix_individual_votes_event_voter', table_name='individual_votes')
    op.drop_index('ix_individual_votes_emote_id', table_name='individual_votes')
    op.drop_index('ix_individual_votes_voter_id', table_name='individual_votes')
    op.drop_index('ix_individual_votes_voting_event_id', table_name='individual_votes')

