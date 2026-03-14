-- Migration: Add name field to users table
-- Date: 2026-03-14
-- Description: Add name column to store user's full name or display name

-- Add name column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;

-- Update existing users to have a default name based on email (optional)
UPDATE users SET name = split_part(email, '@', 1) WHERE name IS NULL;

-- Add comment
COMMENT ON COLUMN users.name IS 'User full name or display name';
