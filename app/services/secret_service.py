from datetime import datetime, timedelta, timezone # Keep timezone for awareness if needed, but use utcnow() for naive UTC
from typing import Optional, List

from sqlmodel import Session, select

# Use SecretDb as an alias for the table model app.models.secret.Secret
from app.models.secret import Secret as SecretDb, SecretCreate


def create_secret(db: Session, *, secret_in: SecretCreate) -> SecretDb:
    """
    Creates a new secret.
    """
    ttl_timestamp: Optional[datetime] = None
    if secret_in.ttl_days is not None and secret_in.ttl_days > 0:
        ttl_timestamp = datetime.utcnow() + timedelta(days=secret_in.ttl_days)

    # Determine effective_views_remaining based on multi_open and max_views
    # SecretCreate.max_views defaults to 1.
    if secret_in.multi_open:
        if secret_in.max_views is not None and secret_in.max_views > 0:
            effective_views_remaining = secret_in.max_views
        else:
            # Default for multi_open if max_views is invalid or not specified (though model defaults to 1)
            effective_views_remaining = 1 
    else: # Not multi_open
        effective_views_remaining = 1
    
    # The Secret model (SecretDb) only has views_remaining, not max_views.
    # The plan's SecretDb(..., max_views=effective_max_views, ...) implies SecretDb has max_views.
    # I will set views_remaining to effective_views_remaining.
    db_secret = SecretDb(
        encrypted_message_b64=secret_in.encrypted_message_b64,
        salt_b64=secret_in.salt_b64,
        iv_b64=secret_in.iv_b64,
        ttl_expires_at=ttl_timestamp,
        multi_open=secret_in.multi_open,
        views_remaining=effective_views_remaining  # This sets the initial number of views
        # unique_id is handled by default_factory in model
        # created_at is handled by default_factory in model
    )

    db.add(db_secret)
    db.commit()
    db.refresh(db_secret)
    return db_secret


def get_secret_for_viewing(db: Session, *, unique_id: str) -> Optional[SecretDb]:
    """
    Retrieves a secret for viewing, handles TTL and view count.
    Returns the secret data as it was *before* this view, then decrements/deletes.
    """
    statement = select(SecretDb).where(SecretDb.unique_id == unique_id)
    secret = db.exec(statement).first()

    if not secret:
        return None

    # TTL check using naive UTC datetimes
    if secret.ttl_expires_at and secret.ttl_expires_at < datetime.utcnow():
        db.delete(secret)
        db.commit()
        return None

    if secret.views_remaining <= 0:
        # This implies it was already fully consumed but somehow not deleted.
        # Or, it's a new secret with an invalid initial view count (should not happen with create_secret logic).
        return None

    # Pydantic v2 method for deep copy. SQLModel models are Pydantic models.
    secret_data_to_return = secret.model_copy(deep=True)

    secret.views_remaining -= 1

    if secret.views_remaining <= 0:
        # Delete if views are exhausted (covers single-view and multi-view that reached its limit)
        db.delete(secret)
    else:
        # If it's multi_open and still has views, just save the decremented count
        db.add(secret)  # Mark for saving the change to views_remaining
    
    db.commit()
    
    return secret_data_to_return


def delete_expired_secrets(db: Session) -> int:
    """
    Deletes all secrets that have passed their TTL.
    Uses naive UTC datetime for comparison.
    """
    now_naive_utc = datetime.utcnow()
    
    statement = select(SecretDb).where(SecretDb.ttl_expires_at != None, SecretDb.ttl_expires_at < now_naive_utc)
    expired_secrets: List[SecretDb] = db.exec(statement).all()

    count = 0
    if expired_secrets:
        for secret_to_delete in expired_secrets:
            db.delete(secret_to_delete)
            count += 1
        if count > 0: # Only commit if there were deletions
            db.commit()
    return count
