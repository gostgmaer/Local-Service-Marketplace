-- Create user_activity_logs table
CREATE TABLE IF NOT EXISTS user_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action VARCHAR(255) NOT NULL,
  metadata JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for user_activity_logs
CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_action ON user_activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON user_activity_logs(created_at);

-- Create daily_metrics table
CREATE TABLE IF NOT EXISTS daily_metrics (
  date DATE PRIMARY KEY,
  total_users INTEGER NOT NULL DEFAULT 0,
  total_requests INTEGER NOT NULL DEFAULT 0,
  total_jobs INTEGER NOT NULL DEFAULT 0,
  total_payments INTEGER NOT NULL DEFAULT 0
);

-- Create index for daily_metrics
CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_metrics(date);

-- Note: In production, these tables may reference other service tables
-- For cross-service analytics, use APIs instead of direct database joins
