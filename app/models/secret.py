import secrets
from datetime import datetime, timedelta
from typing import Optional

from sqlmodel import Field, SQLModel


class SecretBase(SQLModel):
    encrypted_message_b64: str
    salt_b64: str
    iv_b64: str
    multi_open: bool = False
    views_remaining: int = Field(default=1)
    ttl_expires_at: Optional[datetime] = None


class Secret(SecretBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    unique_id: str = Field(default_factory=lambda: secrets.token_urlsafe(16), unique=True, index=True, nullable=False)
    # max_views is implicitly handled by views_remaining during creation in the service layer
    # If multi_open is False, views_remaining is 1.
    # If multi_open is True, views_remaining is set to SecretCreate.max_views or a default.


class SecretCreate(SQLModel):
    encrypted_message_b64: str
    salt_b64: str
    iv_b64: str
    ttl_days: Optional[int] = 0  # 0 or None for no expiry
    multi_open: bool = False
    max_views: Optional[int] = 1 # Default to 1 view if not specified or if multi_open is False


class SecretRead(SQLModel):
    unique_id: str
    encrypted_message_b64: str
    salt_b64: str
    iv_b64: str
    multi_open: bool
    views_remaining: int
    ttl_expires_at: Optional[datetime] = None
