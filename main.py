#!/usr/bin/env python3
import os
import json
import logging
import secrets
import time
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, Response, Form
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Inigma - Secure Message Sharing")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create directories
KEYS_DIR = Path("keys")
KEYS_DIR.mkdir(exist_ok=True)
logger.info(f"Created keys directory at {KEYS_DIR}")

# Static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Data models
class CreateMessageRequest(BaseModel):
    encrypted_message: str
    encrypted: str = "true"
    iv: str
    salt: str
    ttl: Optional[int] = 30
    multiopen: bool = True
    custom_name: Optional[str] = ""

class UpdateOwnerRequest(BaseModel):
    view: str
    uid: str
    encrypted_message: str
    iv: str
    salt: str

class ViewMessageRequest(BaseModel):
    view: str
    uid: str

class ListSecretsRequest(BaseModel):
    uid: str
    page: int = 1
    per_page: int = 10

class UpdateCustomNameRequest(BaseModel):
    view: str
    uid: str
    custom_name: str

class MessageData(BaseModel):
    multiopen: bool
    ttl: int
    uid: str
    encrypted: str
    encrypted_message: str
    message: str = ""
    iv: str
    salt: str
    custom_name: str = ""

def generate_random_string(length: int = 25) -> str:
    """Generate cryptographically secure random string"""
    logger.debug(f"Generating random string of length {length}")
    return secrets.token_urlsafe(length)[:length]

def get_timestamp() -> int:
    """Get current timestamp"""
    return int(time.time())

def cleanup_old_files():
    """Remove files older than 50 days"""
    logger.info("Starting cleanup of old files")
    current_time = get_timestamp()
    deleted_count = 0
    
    for file_path in KEYS_DIR.glob("*"):
        if file_path.is_file():
            file_age_days = (current_time - file_path.stat().st_mtime) / (24 * 60 * 60)
            if file_age_days > 50:
                file_path.unlink()
                deleted_count += 1
                logger.debug(f"Deleted old file: {file_path.name}")
    
    logger.info(f"Cleanup completed. Deleted {deleted_count} files")

@app.on_event("startup")
async def startup_event():
    """Run cleanup on startup"""
    logger.info("Application starting up")
    cleanup_old_files()

@app.get("/", response_class=HTMLResponse)
async def index():
    """Serve main page"""
    logger.info("Serving index page")
    with open("templates/index.html", "r") as f:
        return f.read()

@app.get("/view", response_class=HTMLResponse)
async def view_page():
    """Serve view page"""
    logger.info("Serving view page")
    with open("templates/view.html", "r") as f:
        return f.read()

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
    
    # Generate unique filename
    fname = generate_random_string(25)
    logger.debug(f"Generated filename: {fname}")
    
    # Create message data
    message_data = MessageData(
        multiopen=request.multiopen,
        ttl=ttl,
        uid="",
        encrypted=request.encrypted,
        encrypted_message=request.encrypted_message,
        message="",
        iv=request.iv,
        salt=request.salt,
        custom_name=request.custom_name or ""
    )
    
    # Save to file
    file_path = KEYS_DIR / fname
    with open(file_path, "w") as f:
        json.dump(message_data.dict(), f)
    logger.info(f"Message saved to {fname}")
    
    # Get domain from environment or use default
    domain = os.getenv("DOMAIN", "localhost:8000")
    protocol = "https" if domain != "localhost:8000" else "http"
    
    return {
        "url": f"{protocol}://{domain}/",
        "view": fname
    }

@app.post("/api/view")
async def view_message(request: ViewMessageRequest):
    """Retrieve encrypted message"""
    logger.info(f"Viewing message {request.view} for uid {request.uid}")
    
    # Validate filename
    if not request.view.replace("-", "").replace("_", "").isalnum():
        logger.warning(f"Invalid view parameter: {request.view}")
        raise HTTPException(status_code=400, detail="Invalid view parameter")
    
    file_path = KEYS_DIR / request.view
    
    # Check if file exists
    if not file_path.exists():
        logger.warning(f"Message not found: {request.view}")
        return {
            "message": "No such hash!",
            "redirect_root": "true"
        }
    
    # Read message data
    try:
        with open(file_path, "r") as f:
            data = json.load(f)
        logger.debug(f"Message data loaded for {request.view}")
    except json.JSONDecodeError:
        logger.error(f"Invalid JSON in file {request.view}")
        return {
            "message": "Invalid message data!",
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
        return data
    
    logger.warning(f"Access denied for message {request.view}")
    return {
        "message": "Access denied!",
        "redirect_root": "true"
    }

@app.post("/api/update")
async def update_owner(request: UpdateOwnerRequest):
    """Update message owner"""
    logger.info(f"Updating owner for message {request.view}")
    
    # Validate filename
    if not request.view.replace("-", "").replace("_", "").isalnum():
        logger.warning(f"Invalid view parameter: {request.view}")
        return {"status": "failed", "message": "Invalid view parameter"}
    
    file_path = KEYS_DIR / request.view
    
    # Check if file exists
    if not file_path.exists():
        logger.warning(f"Message not found for update: {request.view}")
        return {"status": "failed", "message": "No such secret"}
    
    # Read current data
    try:
        with open(file_path, "r") as f:
            data = json.load(f)
    except json.JSONDecodeError:
        logger.error(f"Invalid JSON in file {request.view}")
        return {"status": "failed", "message": "Invalid message data"}
    
    # Check if already owned
    if data["uid"] != "":
        logger.info(f"Message {request.view} already owned")
        return {"status": "failed", "message": "Secret already owned"}
    
    # Update data
    data["uid"] = request.uid
    data["encrypted_message"] = request.encrypted_message
    data["iv"] = request.iv
    data["salt"] = request.salt
    data["message"] = ""
    data["encrypted"] = "true"
    
    # Save updated data
    with open(file_path, "w") as f:
        json.dump(data, f)
    
    logger.info(f"Successfully updated owner for message {request.view}")
    return {"status": "success", "message": "secret owned"}

@app.post("/api/list-secrets")
async def list_user_secrets(request: ListSecretsRequest):
    """List user's secrets with pagination"""
    logger.info(f"Listing secrets for user {request.uid}")
    
    user_secrets = []
    current_time = get_timestamp()
    
    # Scan all files for user's secrets
    for file_path in KEYS_DIR.glob("*"):
        if file_path.is_file():
            try:
                with open(file_path, "r") as f:
                    data = json.load(f)
                
                # Check if this secret belongs to the user
                if data.get("uid") == request.uid:
                    # Calculate days remaining
                    if data["ttl"] == 9999999999:
                        days_remaining = -1  # Permanent
                    else:
                        days_remaining = max(0, (data["ttl"] - current_time) // (24 * 60 * 60))
                    
                    # Skip expired secrets
                    if data["ttl"] < current_time and data["ttl"] != 9999999999:
                        continue
                    
                    user_secrets.append({
                        "id": file_path.name,
                        "custom_name": data.get("custom_name", ""),
                        "days_remaining": days_remaining,
                        "created_time": file_path.stat().st_mtime
                    })
            except (json.JSONDecodeError, KeyError):
                continue
    
    # Sort by creation time (newest first)
    user_secrets.sort(key=lambda x: x["created_time"], reverse=True)
    
    # Pagination
    total = len(user_secrets)
    per_page = min(request.per_page, 50)  # Max 50 per page
    start_idx = (request.page - 1) * per_page
    end_idx = start_idx + per_page
    
    paginated_secrets = user_secrets[start_idx:end_idx]
    
    # Remove created_time from response
    for secret in paginated_secrets:
        del secret["created_time"]
    
    return {
        "secrets": paginated_secrets,
        "page": request.page,
        "per_page": per_page,
        "total": total,
        "has_more": end_idx < total
    }

@app.post("/api/update-custom-name")
async def update_custom_name(request: UpdateCustomNameRequest):
    """Update custom name for a secret"""
    logger.info(f"Updating custom name for secret {request.view}")
    
    # Validate filename
    if not request.view.replace("-", "").replace("_", "").isalnum():
        logger.warning(f"Invalid view parameter: {request.view}")
        return {"status": "failed", "message": "Invalid view parameter"}
    
    file_path = KEYS_DIR / request.view
    
    # Check if file exists
    if not file_path.exists():
        logger.warning(f"Secret not found: {request.view}")
        return {"status": "failed", "message": "Secret not found"}
    
    # Read current data
    try:
        with open(file_path, "r") as f:
            data = json.load(f)
    except json.JSONDecodeError:
        logger.error(f"Invalid JSON in file {request.view}")
        return {"status": "failed", "message": "Invalid secret data"}
    
    # Check if user owns this secret
    if data.get("uid") != request.uid:
        logger.warning(f"Access denied for secret {request.view}")
        return {"status": "failed", "message": "Access denied"}
    
    # Update custom name
    data["custom_name"] = request.custom_name
    
    # Save updated data
    with open(file_path, "w") as f:
        json.dump(data, f)
    
    logger.info(f"Successfully updated custom name for secret {request.view}")
    return {"status": "success", "message": "Custom name updated"}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}

if __name__ == "__main__":
    logger.info("Starting Inigma server")
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
