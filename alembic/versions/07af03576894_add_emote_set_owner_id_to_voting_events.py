"""add emote_set_owner_id to voting_events

Revision ID: 07af03576894
Revises: a6c87ace9e74
Create Date: 2025-11-23 22:22:05.905464

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '07af03576894'
down_revision: Union[str, Sequence[str], None] = 'a6c87ace9e74'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create unique constraint only if it doesn't exist
    op.execute("""
        DO $$ 
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints 
                WHERE table_name = 'users' 
                AND constraint_type = 'UNIQUE'
                AND constraint_name LIKE '%twitch_user_id%'
            ) THEN
                ALTER TABLE users ADD CONSTRAINT users_twitch_user_id_key UNIQUE (twitch_user_id);
            END IF;
        END $$;
    """)
    
    # Add emote_set_owner_id column
    op.add_column('voting_events', sa.Column('emote_set_owner_id', sa.Integer(), nullable=True))
    
    # Create foreign key constraint
    op.create_foreign_key(
        'fk_voting_events_emote_set_owner_id',  # Give it a name!
        'voting_events', 
        'users', 
        ['emote_set_owner_id'], 
        ['id']
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Drop foreign key constraint by finding its actual name
    op.execute("""
        DO $$ 
        DECLARE
            r RECORD;
        BEGIN
            FOR r IN (
                SELECT constraint_name 
                FROM information_schema.table_constraints 
                WHERE table_name = 'voting_events' 
                AND constraint_type = 'FOREIGN KEY'
                AND constraint_name LIKE '%emote_set_owner_id%'
            ) LOOP
                EXECUTE 'ALTER TABLE voting_events DROP CONSTRAINT ' || quote_ident(r.constraint_name);
            END LOOP;
        END $$;
    """)
    op.drop_column('voting_events', 'emote_set_owner_id')
    
    # Drop unique constraint on users.twitch_user_id
    op.execute("""
        DO $$ 
        DECLARE
            r RECORD;
        BEGIN
            FOR r IN (
                SELECT constraint_name 
                FROM information_schema.table_constraints 
                WHERE table_name = 'users' 
                AND constraint_type = 'UNIQUE'
                AND constraint_name LIKE '%twitch_user_id%'
            ) LOOP
                EXECUTE 'ALTER TABLE users DROP CONSTRAINT ' || quote_ident(r.constraint_name);
            END LOOP;
        END $$;
    """)
