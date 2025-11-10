-- Composite indexes for performance optimization
-- Migration: 002_add_composite_indexes.sql
-- Date: 2025-11-10

-- Composite index for list_user_secrets query
-- Optimizes: WHERE uid = ? AND (ttl > ? OR ttl = ?) ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_messages_uid_ttl_created
ON messages(uid, ttl, created_at DESC);

-- Composite index for list_pending_secrets query
-- Optimizes: WHERE creator_uid = ? AND uid = '' AND (ttl > ? OR ttl = ?)
CREATE INDEX IF NOT EXISTS idx_messages_creator_uid_ttl
ON messages(creator_uid, uid, ttl);

-- Composite index for cleanup query
-- Optimizes: WHERE (ttl < ? AND ttl != ?) OR created_at < ?
CREATE INDEX IF NOT EXISTS idx_messages_ttl_created_cleanup
ON messages(ttl, created_at);

-- Drop old single-column indexes that are now covered by composite indexes
-- Keep idx_messages_uid as it's used for other queries
-- DROP INDEX IF EXISTS idx_messages_creator_uid;  -- Covered by idx_messages_creator_uid_ttl
-- DROP INDEX IF EXISTS idx_messages_ttl;          -- Covered by composite indexes

-- Note: Commented out drops to maintain backward compatibility
-- Cloudflare D1 is smart enough to use composite indexes even if single-column ones exist
