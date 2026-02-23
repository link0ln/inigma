#!/usr/bin/env python3
import os
import json
import logging
import secrets
import time
import html
import re
import uuid
from typing import Optional, Dict, Any
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, field_validator
import uvicorn
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from database import DatabaseManager, PERMANENT_TTL


class JSONFormatter(logging.Formatter):
    """JSON log formatter for structured logging"""
    def format(self, record):
        entry = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname.lower(),
            "logger": record.name,
            "message": record.getMessage(),
        }
        if hasattr(record, 'request_id') and record.request_id:
            entry["requestId"] = record.request_id
        if record.exc_info and record.exc_info[0]:
            entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(entry, ensure_ascii=False)


# Configure logging
handler = logging.StreamHandler()
handler.setFormatter(JSONFormatter())
logging.basicConfig(level=logging.INFO, handlers=[handler])
logger = logging.getLogger(__name__)

# Request ID context (per-request, set by middleware)
_request_id_ctx: dict = {}

# Template builder function
def build_template_from_modular(template_name):
    """Build template from modular components"""
    template_path = f"templates-modular/pages/{template_name}"
    
    if not os.path.exists(template_path):
        raise FileNotFoundError(f"Template not found: {template_path}")
    
    with open(template_path, 'r') as f:
        content = f.read()
    
    # Process {{> filename }} includes
    import re
    def replace_include(match):
        filename = match.group(1).strip()
        
        # Determine file type and directory
        if filename.endswith('.css'):
            file_path = f"templates-modular/styles/{filename}"
        elif filename.endswith('.js'):
            file_path = f"templates-modular/scripts/{filename}"
        else:
            # HTML component
            file_path = f"templates-modular/components/{filename}.html"
        
        if not os.path.exists(file_path):
            logger.warning(f"Include file not found: {file_path}")
            return f"<!-- Missing: {filename} -->"
        
        with open(file_path, 'r') as f:
            return f.read()
    
    # Recursively resolve includes until none remain (max 10 levels)
    for _ in range(10):
        new_content = re.sub(r'\{\{>\s*([^}]+)\s*\}\}', replace_include, content)
        if new_content == content:
            break
        content = new_content

    return content

app = FastAPI(title="Inigma - Secure Message Sharing", lifespan=lifespan)

# Configure CORS with target domain restrictions
allowed_origins = [
    "https://inigma.idone.su",  # Production domain
    "http://localhost:8000",    # Local development
    "http://127.0.0.1:8000",   # Alternative local
]

# Add environment variable override for custom domains
if custom_origins := os.getenv("CORS_ORIGINS"):
    allowed_origins.extend(custom_origins.split(","))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


# Request ID + security headers middleware
@app.middleware("http")
async def request_middleware(request: Request, call_next):
    request_id = uuid.uuid4().hex[:16]
    # Inject request_id into log records via a filter
    log_filter = RequestIdFilter(request_id)
    logging.getLogger().addFilter(log_filter)
    try:
        logger.info(f"Incoming request", extra={"request_id": request_id})
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return add_security_headers(response)
    finally:
        logging.getLogger().removeFilter(log_filter)


class RequestIdFilter(logging.Filter):
    """Injects request_id into all log records"""
    def __init__(self, request_id: str):
        super().__init__()
        self.request_id = request_id

    def filter(self, record):
        record.request_id = self.request_id
        return True

# Initialize database
db = DatabaseManager()

# Initialize scheduler
scheduler = AsyncIOScheduler()

def cleanup_database():
    """Background task to cleanup expired messages"""
    try:
        deleted_count = db.cleanup_expired_messages()
        logger.info(f"Scheduled cleanup completed. Deleted {deleted_count} expired messages")
    except Exception as e:
        logger.error(f"Error during scheduled cleanup: {e}")


@asynccontextmanager
async def lifespan(app):
    """Application lifespan: startup and shutdown logic"""
    logger.info("Application starting up")

    # Run initial cleanup
    try:
        db.cleanup_expired_messages()
    except Exception as e:
        logger.error(f"Failed to run startup cleanup: {e}")

    # Schedule daily cleanup at 2:00 AM
    scheduler.add_job(
        cleanup_database,
        CronTrigger(hour=2, minute=0),
        id='daily_cleanup',
        replace_existing=True
    )
    scheduler.start()
    logger.info("Scheduler started - daily cleanup scheduled for 2:00 AM")

    yield

    logger.info("Application shutting down")
    try:
        if scheduler.running:
            scheduler.shutdown()
            logger.info("Scheduler stopped")
    except Exception as e:
        logger.error(f"Error shutting down scheduler: {e}")


# Data models
MAX_ENCRYPTED_MESSAGE_SIZE = 2 * 1024 * 1024  # 2MB
BASE64_REGEX = re.compile(r'^[A-Za-z0-9+/]*={0,2}$')
UID_REGEX = re.compile(r'^[a-zA-Z0-9_-]{1,128}$')


class CreateMessageRequest(BaseModel):
    encrypted_message: str
    iv: str
    salt: str
    ttl: Optional[int] = 30
    custom_name: Optional[str] = ""
    creator_uid: str
    idempotency_key: Optional[str] = None

    @field_validator('idempotency_key')
    @classmethod
    def validate_idempotency_key(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and (len(v) > 64 or not re.match(r'^[a-zA-Z0-9_-]+$', v)):
            raise ValueError('Invalid idempotency key format')
        return v

    @field_validator('encrypted_message')
    @classmethod
    def validate_encrypted_message(cls, v: str) -> str:
        if not v:
            raise ValueError('Encrypted message cannot be empty')
        if len(v) > MAX_ENCRYPTED_MESSAGE_SIZE:
            raise ValueError('Encrypted message too large (max 2MB)')
        if not BASE64_REGEX.match(v):
            raise ValueError('Invalid base64 format')
        return v

    @field_validator('iv')
    @classmethod
    def validate_iv(cls, v: str) -> str:
        if not v or len(v) > 64:
            raise ValueError('Invalid IV length')
        if not re.match(r'^[A-Za-z0-9+/=]{1,64}$', v):
            raise ValueError('Invalid IV format')
        return v

    @field_validator('salt')
    @classmethod
    def validate_salt(cls, v: str) -> str:
        if not v or len(v) > 128:
            raise ValueError('Invalid salt length')
        if not re.match(r'^[A-Za-z0-9+/=]{1,128}$', v):
            raise ValueError('Invalid salt format')
        return v

    @field_validator('creator_uid')
    @classmethod
    def validate_creator_uid(cls, v: str) -> str:
        if not v or not UID_REGEX.match(v):
            raise ValueError('Invalid creator_uid format')
        return v

    @field_validator('custom_name')
    @classmethod
    def sanitize_custom_name_field(cls, v: Optional[str]) -> str:
        return sanitize_custom_name(v or "")

    @field_validator('ttl')
    @classmethod
    def validate_ttl(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and (v < 0 or v > 365):
            raise ValueError('TTL must be between 0 and 365 days')
        return v

class UpdateOwnerRequest(BaseModel):
    view: str
    uid: str
    encrypted_message: str
    iv: str
    salt: str

    @field_validator('view')
    @classmethod
    def validate_view_id(cls, v: str) -> str:
        if not validate_message_id(v):
            raise ValueError('Invalid message ID format')
        return v

    @field_validator('uid')
    @classmethod
    def validate_uid(cls, v: str) -> str:
        if not v or not UID_REGEX.match(v):
            raise ValueError('Invalid UID format')
        return v

    @field_validator('encrypted_message')
    @classmethod
    def validate_encrypted_message(cls, v: str) -> str:
        if not v:
            raise ValueError('Encrypted message cannot be empty')
        if len(v) > MAX_ENCRYPTED_MESSAGE_SIZE:
            raise ValueError('Encrypted message too large (max 2MB)')
        if not BASE64_REGEX.match(v):
            raise ValueError('Invalid base64 format')
        return v

    @field_validator('iv')
    @classmethod
    def validate_iv(cls, v: str) -> str:
        if not v or len(v) > 64:
            raise ValueError('Invalid IV length')
        if not re.match(r'^[A-Za-z0-9+/=]{1,64}$', v):
            raise ValueError('Invalid IV format')
        return v

    @field_validator('salt')
    @classmethod
    def validate_salt(cls, v: str) -> str:
        if not v or len(v) > 128:
            raise ValueError('Invalid salt length')
        if not re.match(r'^[A-Za-z0-9+/=]{1,128}$', v):
            raise ValueError('Invalid salt format')
        return v

class ViewMessageRequest(BaseModel):
    view: str
    uid: str

    @field_validator('view')
    @classmethod
    def validate_view_id(cls, v: str) -> str:
        if not validate_message_id(v):
            raise ValueError('Invalid message ID format')
        return v

    @field_validator('uid')
    @classmethod
    def validate_uid(cls, v: str) -> str:
        if not v or not UID_REGEX.match(v):
            raise ValueError('Invalid UID format')
        return v

class ListSecretsRequest(BaseModel):
    uid: str
    page: int = 1
    per_page: int = 10

    @field_validator('uid')
    @classmethod
    def validate_uid(cls, v: str) -> str:
        if not v or not UID_REGEX.match(v):
            raise ValueError('Invalid UID format')
        return v

    @field_validator('page')
    @classmethod
    def validate_page(cls, v: int) -> int:
        if v < 1:
            raise ValueError('Page must be >= 1')
        return v

    @field_validator('per_page')
    @classmethod
    def validate_per_page(cls, v: int) -> int:
        if v < 1 or v > 50:
            raise ValueError('Per page must be between 1 and 50')
        return v

class UpdateCustomNameRequest(BaseModel):
    view: str
    uid: str
    custom_name: str

    @field_validator('view')
    @classmethod
    def validate_view_id(cls, v: str) -> str:
        if not validate_message_id(v):
            raise ValueError('Invalid message ID format')
        return v

    @field_validator('uid')
    @classmethod
    def validate_uid(cls, v: str) -> str:
        if not v or not UID_REGEX.match(v):
            raise ValueError('Invalid UID format')
        return v

    @field_validator('custom_name')
    @classmethod
    def sanitize_custom_name_field(cls, v: str) -> str:
        return sanitize_custom_name(v or "")

class DeleteSecretRequest(BaseModel):
    view: str
    uid: str

    @field_validator('view')
    @classmethod
    def validate_view_id(cls, v: str) -> str:
        if not validate_message_id(v):
            raise ValueError('Invalid message ID format')
        return v

    @field_validator('uid')
    @classmethod
    def validate_uid(cls, v: str) -> str:
        if not v or not UID_REGEX.match(v):
            raise ValueError('Invalid UID format')
        return v

def generate_random_string(length: int = 25) -> str:
    """Generate cryptographically secure random string"""
    logger.debug(f"Generating random string of length {length}")
    return secrets.token_urlsafe(length)[:length]

def sanitize_custom_name(name: str) -> str:
    """Sanitize custom name input"""
    if not isinstance(name, str):
        return ""
    
    # Remove HTML tags and dangerous characters
    sanitized = re.sub(r'<[^>]*>', '', name)  # Remove HTML tags
    sanitized = re.sub(r'[<>"/\\]', '', sanitized)  # Remove dangerous chars
    sanitized = sanitized.strip()
    
    return sanitized[:100]  # Limit to 100 characters

def validate_message_id(message_id: str) -> bool:
    """Validate message ID format"""
    if not isinstance(message_id, str):
        return False
    return bool(re.match(r'^[a-zA-Z0-9_-]{1,50}$', message_id))

def add_security_headers(response: Response) -> Response:
    """Add security headers to response"""
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://unpkg.com https://cdnjs.cloudflare.com; "
        "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; "
        "font-src 'self' https://cdnjs.cloudflare.com; "
        "img-src 'self' data:; "
        "connect-src 'self'; "
        "frame-ancestors 'none'; "
        "object-src 'none'; "
        "base-uri 'self'"
    )
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    
    return response

def get_timestamp() -> int:
    """Get current timestamp"""
    return int(time.time())

# Simple in-memory idempotency cache (key -> (response, expires_at))
_idempotency_cache: Dict[str, tuple] = {}

def check_idempotency(key: str) -> Optional[dict]:
    """Check idempotency cache, return cached response or None"""
    if key in _idempotency_cache:
        response, expires_at = _idempotency_cache[key]
        if time.time() < expires_at:
            return response
        del _idempotency_cache[key]
    return None

def store_idempotency(key: str, response: dict, ttl: int = 3600):
    """Store response in idempotency cache"""
    # Evict expired entries if cache grows too large
    if len(_idempotency_cache) > 10000:
        now = time.time()
        expired = [k for k, (_, exp) in _idempotency_cache.items() if now >= exp]
        for k in expired:
            del _idempotency_cache[k]
    _idempotency_cache[key] = (response, time.time() + ttl)

@app.get("/", response_class=HTMLResponse)
async def index():
    """Serve main page"""
    logger.info("Serving index page")
    content = build_template_from_modular("index.html")
    
    response = HTMLResponse(content)
    return add_security_headers(response)

@app.get("/view", response_class=HTMLResponse)
async def view_page():
    """Serve view page"""
    logger.info("Serving view page")
    content = build_template_from_modular("view.html")
    
    response = HTMLResponse(content)
    return add_security_headers(response)

@app.post("/api/create")
async def create_message(request: CreateMessageRequest):
    """Create a new encrypted message"""
    # Idempotency check
    if request.idempotency_key:
        cached = check_idempotency(request.idempotency_key)
        if cached:
            logger.info(f"Idempotent request: returning cached response")
            return cached

    logger.info("Creating new message")
    
    # Calculate TTL
    if request.ttl == 0:
        ttl = PERMANENT_TTL
        logger.debug("Setting permanent TTL")
    else:
        ttl = get_timestamp() + (request.ttl * 24 * 60 * 60)
        logger.debug(f"Setting TTL to {request.ttl} days")
    
    # Generate unique message ID
    message_id = generate_random_string(25)
    logger.debug(f"Generated message ID: {message_id}")
    
    # Create message data
    message_data = {
        "ttl": ttl,
        "uid": "",
        "encrypted_message": request.encrypted_message,
        "iv": request.iv,
        "salt": request.salt,
        "custom_name": request.custom_name or "",
        "creator_uid": request.creator_uid
    }
    
    # Save to database
    if not db.store_message(message_id, message_data):
        logger.error(f"Failed to store message {message_id}")
        raise HTTPException(status_code=500, detail="Failed to store message")
    
    logger.info(f"Message saved with ID {message_id}")
    
    # Get domain from environment or use default
    domain = os.getenv("DOMAIN", "localhost:8000")
    protocol = "https" if domain != "localhost:8000" else "http"
    
    response_data = {
        "url": f"{protocol}://{domain}/",
        "view": message_id
    }

    # Cache for idempotency
    if request.idempotency_key:
        store_idempotency(request.idempotency_key, response_data)

    response = JSONResponse(response_data)
    return add_security_headers(response)

@app.post("/api/view")
async def view_message(request: ViewMessageRequest):
    """Retrieve encrypted message"""
    logger.info(f"Viewing message {request.view} for uid {request.uid[:8]}...")
    
    # Retrieve message from database
    data = db.retrieve_message(request.view)
    
    # Check if message exists
    if not data:
        logger.warning(f"Message not found: {request.view}")
        return JSONResponse(
            status_code=404,
            content={"message": "No such hash!", "redirect_root": "true"}
        )

    # Check TTL
    current_time = get_timestamp()
    if data["ttl"] < current_time:
        logger.info(f"Message {request.view} has expired")
        return JSONResponse(
            status_code=410,
            content={"message": "Message has expired!", "redirect_root": "true"}
        )

    # Check access permissions
    if data["uid"] == "" or data["uid"] == request.uid:
        logger.info(f"Access granted for message {request.view}")

        # Create response with only necessary fields, excluding sensitive uid and creator_uid
        return {
            "encrypted_message": data["encrypted_message"],
            "iv": data["iv"],
            "salt": data["salt"],
            "custom_name": data.get("custom_name", ""),
            "is_owner": data["uid"] == request.uid
        }

    logger.warning(f"Access denied for message {request.view}")
    return JSONResponse(
        status_code=403,
        content={"message": "Access denied!", "redirect_root": "true"}
    )

@app.post("/api/update")
async def update_owner(request: UpdateOwnerRequest):
    """Update message owner"""
    logger.info(f"Updating owner for message {request.view}")

    # Atomically update owner — SQL WHERE uid = '' prevents race conditions
    success = db.update_message_owner(
        request.view,
        request.uid,
        request.encrypted_message,
        request.iv,
        request.salt
    )

    if success:
        logger.info(f"Successfully updated owner for message {request.view}")
        return {"status": "success", "message": "secret owned"}
    else:
        logger.warning(f"Ownership update failed for message {request.view}")
        return JSONResponse(
            status_code=404,
            content={"status": "failed", "message": "Secret not found or already owned"}
        )

@app.post("/api/list-pending-secrets")
async def list_pending_secrets(request: ListSecretsRequest):
    """List user's pending secrets (created but not yet claimed)"""
    logger.info(f"Listing pending secrets for creator {request.uid[:8]}...")
    
    result = db.list_pending_secrets(request.uid, request.page, request.per_page)
    return result

@app.post("/api/list-secrets")
async def list_user_secrets(request: ListSecretsRequest):
    """List user's secrets with pagination"""
    logger.info(f"Listing secrets for user {request.uid[:8]}...")
    
    result = db.list_user_secrets(request.uid, request.page, request.per_page)
    return result

@app.post("/api/update-custom-name")
async def update_custom_name(request: UpdateCustomNameRequest):
    """Update custom name for a secret"""
    logger.info(f"Updating custom name for secret {request.view}")
    
    success = db.update_custom_name(request.view, request.uid, request.custom_name)

    if success:
        logger.info(f"Successfully updated custom name for secret {request.view}")
        return {"status": "success", "message": "Custom name updated"}
    else:
        logger.warning(f"Failed to update custom name for secret {request.view}")
        return JSONResponse(
            status_code=404,
            content={"status": "failed", "message": "Secret not found or access denied"}
        )

@app.post("/api/delete-secret")
async def delete_secret(request: DeleteSecretRequest):
    """Delete a secret"""
    logger.info(f"Deleting secret {request.view}")
    
    success = db.delete_message(request.view, request.uid)

    if success:
        logger.info(f"Successfully deleted secret {request.view}")
        return {"status": "success", "message": "Secret deleted"}
    else:
        logger.warning(f"Failed to delete secret {request.view}")
        return JSONResponse(
            status_code=404,
            content={"status": "failed", "message": "Secret not found or access denied"}
        )

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}

# Mount static files after all routes are defined
app.mount("/templates-modular", StaticFiles(directory="templates-modular"), name="static")

if __name__ == "__main__":
    logger.info("Starting Inigma server")
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
