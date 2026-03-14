-- Unsubscribe table for email preferences
CREATE TABLE IF NOT EXISTS unsubscribe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email VARCHAR(255) NOT NULL,
  reason VARCHAR(500),
  unsubscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_unsubscribe_user_id ON unsubscribe(user_id);
CREATE INDEX IF NOT EXISTS idx_unsubscribe_email ON unsubscribe(email);

-- Add column to notifications table to track if user has unsubscribed (optional)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS unsubscribed BOOLEAN DEFAULT FALSE;
