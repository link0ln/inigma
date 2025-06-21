#!/usr/bin/env python3
import os
import json
import logging
import secrets
import time
import html
import re
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, Response, Form
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator
import uvicorn
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from database import DatabaseManager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

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
    
    # Replace all {{> filename }} patterns
    content = re.sub(r'\{\{>\s*([^}]+)\s*\}\}', replace_include, content)
    
    return content

app = FastAPI(title="Inigma - Secure Message Sharing")

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

# Security headers middleware
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    return add_security_headers(response)

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


# Data models
class CreateMessageRequest(BaseModel):
    encrypted_message: str
    iv: str
    salt: str
    ttl: Optional[int] = 30
    custom_name: Optional[str] = ""
    creator_uid: str
    
    @validator('custom_name')
    def sanitize_custom_name_field(cls, v):
        return sanitize_custom_name(v or "")
    
    @validator('ttl')
    def validate_ttl(cls, v):
        if v is not None and (v < 0 or v > 365):
            raise ValueError('TTL must be between 0 and 365 days')
        return v

class UpdateOwnerRequest(BaseModel):
    view: str
    uid: str
    encrypted_message: str
    iv: str
    salt: str
    
    @validator('view')
    def validate_view_id(cls, v):
        if not validate_message_id(v):
            raise ValueError('Invalid message ID format')
        return v

class ViewMessageRequest(BaseModel):
    view: str
    uid: str
    
    @validator('view')
    def validate_view_id(cls, v):
        if not validate_message_id(v):
            raise ValueError('Invalid message ID format')
        return v

class ListSecretsRequest(BaseModel):
    uid: str
    page: int = 1
    per_page: int = 10
    
    @validator('page')
    def validate_page(cls, v):
        if v < 1:
            raise ValueError('Page must be >= 1')
        return v
    
    @validator('per_page')
    def validate_per_page(cls, v):
        if v < 1 or v > 50:
            raise ValueError('Per page must be between 1 and 50')
        return v

class UpdateCustomNameRequest(BaseModel):
    view: str
    uid: str
    custom_name: str
    
    @validator('view')
    def validate_view_id(cls, v):
        if not validate_message_id(v):
            raise ValueError('Invalid message ID format')
        return v
    
    @validator('custom_name')
    def sanitize_custom_name_field(cls, v):
        return sanitize_custom_name(v or "")

class DeleteSecretRequest(BaseModel):
    view: str
    uid: str
    
    @validator('view')
    def validate_view_id(cls, v):
        if not validate_message_id(v):
            raise ValueError('Invalid message ID format')
        return v

def generate_random_string(length: int = 25) -> str:
    """Generate cryptographically secure random string"""
    logger.debug(f"Generating random string of length {length}")
    return secrets.token_urlsafe(length)[:length]

def sanitize_text(text: str) -> str:
    """Sanitize text input to prevent XSS"""
    if not isinstance(text, str):
        return ""
    
    # HTML escape the text
    sanitized = html.escape(text)
    
    # Remove any remaining dangerous characters
    sanitized = re.sub(r'[<>"/\\]', '', sanitized)
    
    return sanitized[:1000]  # Limit length

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
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://unpkg.com https://cdnjs.cloudflare.com; "
        "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com; "
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

@app.on_event("startup")
async def startup_event():
    """Run cleanup on startup and start scheduler"""
    logger.info("Application starting up")
    
    # Run initial cleanup
    db.cleanup_expired_messages()
    
    # Schedule daily cleanup at 2:00 AM
    scheduler.add_job(
        cleanup_database,
        CronTrigger(hour=2, minute=0),
        id='daily_cleanup',
        replace_existing=True
    )
    
    # Start the scheduler
    scheduler.start()
    logger.info("Scheduler started - daily cleanup scheduled for 2:00 AM")

@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown cleanup"""
    logger.info("Application shutting down")
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler stopped")

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
    logger.info("Creating new message")
    
    # Calculate TTL
    if request.ttl == 0:
        ttl = 9999999999
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
    
    response = JSONResponse(response_data)
    return add_security_headers(response)

@app.post("/api/view")
async def view_message(request: ViewMessageRequest):
    """Retrieve encrypted message"""
    logger.info(f"Viewing message {request.view} for uid {request.uid}")
    
    # Retrieve message from database
    data = db.retrieve_message(request.view)
    
    # Check if message exists
    if not data:
        logger.warning(f"Message not found: {request.view}")
        return {
            "message": "No such hash!",
            "redirect_root": "true"
        }
    
    # Check TTL
    current_time = get_timestamp()
    if data["ttl"] < current_time:
        logger.info(f"Message {request.view} has expired")
        return {
            "message": "Message has expired!",
            "redirect_root": "true"
        }
    
    # Check access permissions
    if data["uid"] == "" or data["uid"] == request.uid:
        logger.info(f"Access granted for message {request.view}")
        
        # Create response with only necessary fields, excluding sensitive uid and creator_uid
        response_data = {
            "encrypted_message": data["encrypted_message"],
            "iv": data["iv"],
            "salt": data["salt"],
            "custom_name": data.get("custom_name", ""),
            "is_owner": data["uid"] == request.uid
        }
        return response_data
    
    logger.warning(f"Access denied for message {request.view}")
    return {
        "message": "Access denied!",
        "redirect_root": "true"
    }

@app.post("/api/update")
async def update_owner(request: UpdateOwnerRequest):
    """Update message owner"""
    logger.info(f"Updating owner for message {request.view}")
    
    # Check if message exists and is not owned
    data = db.retrieve_message(request.view)
    if not data:
        logger.warning(f"Message not found for update: {request.view}")
        return {"status": "failed", "message": "No such secret"}
    
    # Check if already owned
    if data["uid"] != "":
        logger.info(f"Message {request.view} already owned")
        return {"status": "failed", "message": "Secret already owned"}
    
    # Update message owner
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
        logger.error(f"Failed to update owner for message {request.view}")
        return {"status": "failed", "message": "Failed to update secret"}

@app.post("/api/list-pending-secrets")
async def list_pending_secrets(request: ListSecretsRequest):
    """List user's pending secrets (created but not yet claimed)"""
    logger.info(f"Listing pending secrets for creator {request.uid}")
    
    result = db.list_pending_secrets(request.uid, request.page, request.per_page)
    return result

@app.post("/api/list-secrets")
async def list_user_secrets(request: ListSecretsRequest):
    """List user's secrets with pagination"""
    logger.info(f"Listing secrets for user {request.uid}")
    
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
        return {"status": "failed", "message": "Secret not found or access denied"}

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
        return {"status": "failed", "message": "Secret not found or access denied"}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}

if __name__ == "__main__":
    logger.info("Starting Inigma server")
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
