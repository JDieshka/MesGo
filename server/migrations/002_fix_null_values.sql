-- Fix NULL values in existing chats
-- This migration updates existing chats that have NULL name or avatar

UPDATE chats 
SET name = 'Private Chat' 
WHERE name IS NULL;

UPDATE chats 
SET avatar = '💬' 
WHERE avatar IS NULL;

-- Add NOT NULL constraints to prevent future NULL values
ALTER TABLE chats 
ALTER COLUMN name SET DEFAULT 'Private Chat',
ALTER COLUMN avatar SET DEFAULT '💬';
