#!/usr/bin/env python3
import sqlite3
import logging
import time
from pathlib import Path
from typing import Optional, Dict, Any
from contextlib import contextmanager

logger = logging.getLogger(__name__)

def calculate_time_remaining(ttl: int, current_time: int) -> Dict[str, Any]:
    """
    Calculate time remaining for a secret with smart formatting
    Returns object with time remaining and formatted display string
    """
    if ttl == 9999999999:
        return {
            "value": -1,
            "display": "Permanent",
            "type": "permanent"
        }
    
    seconds_remaining = max(0, ttl - current_time)
    hours_remaining = seconds_remaining // (60 * 60)
    days_remaining = seconds_remaining // (24 * 60 * 60)
    
    if seconds_remaining == 0:
        return {
            "value": 0,
            "display": "Expired",
            "type": "expired"
        }
    
    if days_remaining >= 1:
        return {
            "value": days_remaining,
            "display": f"{days_remaining} day{'s' if days_remaining != 1 else ''}",
            "type": "days"
        }
    elif hours_remaining >= 1:
        return {
            "value": hours_remaining,
            "display": f"{hours_remaining} hour{'s' if hours_remaining != 1 else ''}",
            "type": "hours"
        }
    else:
        minutes_remaining = max(1, seconds_remaining // 60)
        return {
            "value": minutes_remaining,
            "display": f"{minutes_remaining} minute{'s' if minutes_remaining != 1 else ''}",
            "type": "minutes"
        }

class DatabaseManager:
    """SQLite database manager for Inigma messages"""
    
    def __init__(self, db_path: str = "data/inigma.db"):
        self.db_path = Path(db_path)
        # Создаем папку data если её нет
        self.db_path.parent.mkdir(exist_ok=True)
        self.init_database()
    
    def init_database(self):
        """Initialize database with required tables"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Create messages table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    ttl INTEGER NOT NULL,
                    uid TEXT NOT NULL DEFAULT '',
                    encrypted_message TEXT NOT NULL,
                    iv TEXT NOT NULL,
                    salt TEXT NOT NULL,
                    custom_name TEXT DEFAULT '',
                    creator_uid TEXT DEFAULT '',
                    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
                )
            """)
            
            # Create indexes for efficient queries
            # Single-column indexes
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_messages_uid ON messages(uid)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_messages_creator_uid ON messages(creator_uid)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_messages_ttl ON messages(ttl)
            """)

            # Composite indexes for better performance
            # Optimizes list_user_secrets query
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_messages_uid_ttl_created
                ON messages(uid, ttl, created_at DESC)
            """)

            # Optimizes list_pending_secrets query
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_messages_creator_uid_ttl
                ON messages(creator_uid, uid, ttl)
            """)

            # Optimizes cleanup_expired_messages query
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_messages_ttl_created_cleanup
                ON messages(ttl, created_at)
            """)
            
            conn.commit()
            logger.info(f"Database initialized at {self.db_path}")
    
    @contextmanager
    def get_connection(self):
        """Get database connection with proper error handling"""
        conn = None
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row  # Enable dict-like access
            yield conn
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Database error: {e}")
            raise
        finally:
            if conn:
                conn.close()
    
    def store_message(self, message_id: str, data: Dict[str, Any]) -> bool:
        """Store message data in database"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO messages 
                    (id, ttl, uid, encrypted_message, iv, salt, custom_name, creator_uid)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    message_id,
                    data['ttl'],
                    data.get('uid', ''),
                    data['encrypted_message'],
                    data['iv'],
                    data['salt'],
                    data.get('custom_name', ''),
                    data.get('creator_uid', '')
                ))
                conn.commit()
                logger.debug(f"Message {message_id} stored successfully")
                return True
        except Exception as e:
            logger.error(f"Error storing message {message_id}: {e}")
            return False
    
    def retrieve_message(self, message_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve message data from database"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT * FROM messages WHERE id = ?
                """, (message_id,))
                row = cursor.fetchone()
                
                if row:
                    return dict(row)
                return None
        except Exception as e:
            logger.error(f"Error retrieving message {message_id}: {e}")
            return None
    
    def update_message_owner(self, message_id: str, uid: str, encrypted_message: str, 
                           iv: str, salt: str) -> bool:
        """Update message owner and content"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                # Debug: Check current state
                cursor.execute("SELECT id, uid FROM messages WHERE id = ?", (message_id,))
                current_state = cursor.fetchone()
                logger.debug(f"Current state for message {message_id}: {current_state}")
                
                cursor.execute("""
                    UPDATE messages 
                    SET uid = ?, encrypted_message = ?, iv = ?, salt = ?
                    WHERE id = ? AND uid = ''
                """, (uid, encrypted_message, iv, salt, message_id))
                
                if cursor.rowcount > 0:
                    conn.commit()
                    logger.debug(f"Message {message_id} owner updated successfully to uid: {uid}")
                    
                    # Debug: Verify update
                    cursor.execute("SELECT id, uid FROM messages WHERE id = ?", (message_id,))
                    new_state = cursor.fetchone()
                    logger.debug(f"New state for message {message_id}: {new_state}")
                    
                    return True
                else:
                    logger.warning(f"Message {message_id} not found or already owned")
                    return False
        except Exception as e:
            logger.error(f"Error updating message owner {message_id}: {e}")
            return False
    
    def update_custom_name(self, message_id: str, uid: str, custom_name: str) -> bool:
        """Update custom name for a message"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE messages 
                    SET custom_name = ?
                    WHERE id = ? AND uid = ?
                """, (custom_name, message_id, uid))
                
                if cursor.rowcount > 0:
                    conn.commit()
                    logger.debug(f"Custom name updated for message {message_id}")
                    return True
                else:
                    logger.warning(f"Message {message_id} not found or access denied")
                    return False
        except Exception as e:
            logger.error(f"Error updating custom name for {message_id}: {e}")
            return False
    
    def delete_message(self, message_id: str, uid: str) -> bool:
        """Delete a message (only if user owns it or created it)"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                # Delete if user owns it or created it (for pending messages)
                cursor.execute("""
                    DELETE FROM messages 
                    WHERE id = ? AND (uid = ? OR (uid = '' AND creator_uid = ?))
                """, (message_id, uid, uid))
                
                if cursor.rowcount > 0:
                    conn.commit()
                    logger.debug(f"Message {message_id} deleted successfully")
                    return True
                else:
                    logger.warning(f"Message {message_id} not found or access denied")
                    return False
        except Exception as e:
            logger.error(f"Error deleting message {message_id}: {e}")
            return False
    
    def list_user_secrets(self, uid: str, page: int = 1, per_page: int = 10) -> Dict[str, Any]:
        """List user's owned secrets with pagination"""
        try:
            current_time = int(time.time())
            offset = (page - 1) * per_page
            
            logger.debug(f"Listing secrets for uid: {uid}, current_time: {current_time}")
            
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                # Debug: Check all messages for this uid
                cursor.execute("SELECT id, uid, ttl FROM messages WHERE uid = ?", (uid,))
                all_user_messages = cursor.fetchall()
                logger.debug(f"All messages for uid {uid}: {all_user_messages}")
                
                # Get total count
                cursor.execute("""
                    SELECT COUNT(*) FROM messages 
                    WHERE uid = ? AND (ttl > ? OR ttl = 9999999999)
                """, (uid, current_time))
                total = cursor.fetchone()[0]
                logger.debug(f"Total count for uid {uid}: {total}")
                
                # Get paginated results
                cursor.execute("""
                    SELECT id, custom_name, ttl, created_at 
                    FROM messages 
                    WHERE uid = ? AND (ttl > ? OR ttl = 9999999999)
                    ORDER BY created_at DESC
                    LIMIT ? OFFSET ?
                """, (uid, current_time, per_page, offset))
                
                secrets = []
                for row in cursor.fetchall():
                    row = dict(row)
                    # Calculate time remaining with smart formatting
                    time_remaining = calculate_time_remaining(row['ttl'], current_time)
                    
                    secrets.append({
                        "id": row['id'],
                        "custom_name": row['custom_name'] or "",
                        "days_remaining": time_remaining["value"],
                        "time_remaining_display": time_remaining["display"],
                        "time_remaining_type": time_remaining["type"]
                    })
                
                logger.debug(f"Found {len(secrets)} secrets for uid {uid}")
                
                return {
                    "secrets": secrets,
                    "page": page,
                    "per_page": per_page,
                    "total": total,
                    "has_more": (offset + per_page) < total
                }
        except Exception as e:
            logger.error(f"Error listing user secrets: {e}")
            return {"secrets": [], "page": page, "per_page": per_page, "total": 0, "has_more": False}
    
    def list_pending_secrets(self, creator_uid: str, page: int = 1, per_page: int = 10) -> Dict[str, Any]:
        """List user's pending (unclaimed) secrets with pagination"""
        try:
            current_time = int(time.time())
            offset = (page - 1) * per_page
            
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                # Get total count
                cursor.execute("""
                    SELECT COUNT(*) FROM messages 
                    WHERE creator_uid = ? AND uid = '' AND (ttl > ? OR ttl = 9999999999)
                """, (creator_uid, current_time))
                total = cursor.fetchone()[0]
                
                # Get paginated results
                cursor.execute("""
                    SELECT id, custom_name, ttl, created_at 
                    FROM messages 
                    WHERE creator_uid = ? AND uid = '' AND (ttl > ? OR ttl = 9999999999)
                    ORDER BY created_at DESC
                    LIMIT ? OFFSET ?
                """, (creator_uid, current_time, per_page, offset))
                
                secrets = []
                for row in cursor.fetchall():
                    row = dict(row)
                    # Calculate time remaining with smart formatting
                    time_remaining = calculate_time_remaining(row['ttl'], current_time)
                    
                    secrets.append({
                        "id": row['id'],
                        "custom_name": row['custom_name'] or "",
                        "days_remaining": time_remaining["value"],
                        "time_remaining_display": time_remaining["display"],
                        "time_remaining_type": time_remaining["type"]
                    })
                
                return {
                    "secrets": secrets,
                    "page": page,
                    "per_page": per_page,
                    "total": total,
                    "has_more": (offset + per_page) < total
                }
        except Exception as e:
            logger.error(f"Error listing pending secrets: {e}")
            return {"secrets": [], "page": page, "per_page": per_page, "total": 0, "has_more": False}
    
    def cleanup_expired_messages(self, cleanup_days: int = 50) -> int:
        """Remove expired messages and messages older than cleanup_days"""
        try:
            current_time = int(time.time())
            cutoff_time = current_time - (cleanup_days * 24 * 60 * 60)
            
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    DELETE FROM messages 
                    WHERE (ttl < ? AND ttl != 9999999999) OR created_at < ?
                """, (current_time, cutoff_time))
                
                deleted_count = cursor.rowcount
                conn.commit()
                logger.info(f"Cleanup completed. Deleted {deleted_count} expired messages")
                return deleted_count
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
            return 0
