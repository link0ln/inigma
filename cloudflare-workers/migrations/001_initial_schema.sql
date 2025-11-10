-- Initial database schema for Inigma
-- Migration: 001_initial_schema.sql
-- Date: 2025-11-10

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    ttl INTEGER NOT NULL,
    uid TEXT NOT NULL DEFAULT '',
    encrypted_message TEXT NOT NULL,
    iv TEXT NOT NULL,
    salt TEXT NOT NULL,
    custom_name TEXT DEFAULT '',
    creator_uid TEXT DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Create basic indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_messages_uid ON messages(uid);
CREATE INDEX IF NOT EXISTS idx_messages_creator_uid ON messages(creator_uid);
CREATE INDEX IF NOT EXISTS idx_messages_ttl ON messages(ttl);
