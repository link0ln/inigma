-- D1 database initialization for Inigma
-- Run these statements to create the tables in your D1 database

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

-- Indexes to optimize queries
CREATE INDEX IF NOT EXISTS idx_messages_uid ON messages(uid);
CREATE INDEX IF NOT EXISTS idx_messages_creator_uid ON messages(creator_uid);
CREATE INDEX IF NOT EXISTS idx_messages_ttl ON messages(ttl);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
