-- =====================================================
-- EXTENSIONS
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- USERS & AUTHENTICATION
-- =====================================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password_hash TEXT,
  role TEXT NOT NULL,
  email_verified BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  refresh_token TEXT,
  ip_address TEXT,
  user_agent TEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  token TEXT UNIQUE,
  expires_at TIMESTAMP
);

CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  token TEXT UNIQUE,
  expires_at TIMESTAMP
);

CREATE TABLE login_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT,
  ip_address TEXT,
  success BOOLEAN,
  created_at TIMESTAMP DEFAULT now()
);

-- =====================================================
-- SOCIAL AUTH
-- =====================================================

CREATE TABLE social_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  provider TEXT,
  provider_user_id TEXT,
  access_token TEXT,
  refresh_token TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- =====================================================
-- DEVICE TRACKING
-- =====================================================

CREATE TABLE user_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  device_id TEXT,
  device_type TEXT,
  os TEXT,
  last_seen TIMESTAMP
);

-- =====================================================
-- PROVIDERS
-- =====================================================

CREATE TABLE providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  business_name TEXT,
  description TEXT,
  rating DECIMAL,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE provider_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID REFERENCES providers(id),
  category_id UUID
);

CREATE TABLE provider_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID REFERENCES providers(id),
  day_of_week INT,
  start_time TIME,
  end_time TIME
);

-- =====================================================
-- SERVICE CATEGORIES
-- =====================================================

CREATE TABLE service_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- =====================================================
-- LOCATIONS
-- =====================================================

CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  city TEXT,
  state TEXT,
  country TEXT,
  latitude DECIMAL,
  longitude DECIMAL
);

-- =====================================================
-- SERVICE REQUESTS
-- =====================================================

CREATE TABLE service_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  category_id UUID REFERENCES service_categories(id),
  location_id UUID REFERENCES locations(id),
  description TEXT,
  budget INT,
  status TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- =====================================================
-- PROPOSALS
-- =====================================================

CREATE TABLE proposals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID REFERENCES service_requests(id),
  provider_id UUID REFERENCES providers(id),
  price INT,
  message TEXT,
  status TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- =====================================================
-- JOBS
-- =====================================================

CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID REFERENCES service_requests(id),
  provider_id UUID REFERENCES providers(id),
  status TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- =====================================================
-- PAYMENTS
-- =====================================================

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id),
  amount INT,
  currency TEXT,
  status TEXT,
  transaction_id TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE payment_webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gateway TEXT,
  payload JSONB,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE refunds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID REFERENCES payments(id),
  amount INT,
  status TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- =====================================================
-- REVIEWS
-- =====================================================

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id),
  user_id UUID REFERENCES users(id),
  provider_id UUID REFERENCES providers(id),
  rating INT,
  comment TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- =====================================================
-- MESSAGES
-- =====================================================

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id),
  sender_id UUID REFERENCES users(id),
  message TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- =====================================================
-- NOTIFICATIONS
-- =====================================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  type TEXT,
  message TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE notification_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notification_id UUID REFERENCES notifications(id),
  channel TEXT,
  status TEXT
);

-- =====================================================
-- FAVORITES
-- =====================================================

CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  provider_id UUID REFERENCES providers(id)
);

-- =====================================================
-- ATTACHMENTS
-- =====================================================

CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT,
  entity_id UUID,
  file_url TEXT
);

-- =====================================================
-- COUPONS
-- =====================================================

CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE,
  discount_percent INT,
  expires_at TIMESTAMP
);

CREATE TABLE coupon_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coupon_id UUID REFERENCES coupons(id),
  user_id UUID REFERENCES users(id),
  used_at TIMESTAMP DEFAULT now()
);

-- =====================================================
-- DISPUTES
-- =====================================================

CREATE TABLE disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id),
  opened_by UUID REFERENCES users(id),
  reason TEXT,
  status TEXT
);

-- =====================================================
-- AUDIT LOGS
-- =====================================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  action TEXT,
  entity TEXT,
  entity_id UUID,
  created_at TIMESTAMP DEFAULT now()
);

-- =====================================================
-- USER ACTIVITY
-- =====================================================

CREATE TABLE user_activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  action TEXT,
  metadata JSONB,
  ip_address TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- =====================================================
-- EVENTS
-- =====================================================

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT,
  payload JSONB,
  created_at TIMESTAMP DEFAULT now()
);

-- =====================================================
-- BACKGROUND JOBS
-- =====================================================

CREATE TABLE background_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_type TEXT,
  payload JSONB,
  status TEXT,
  attempts INT DEFAULT 0
);

-- =====================================================
-- RATE LIMITING
-- =====================================================

CREATE TABLE rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT,
  request_count INT,
  window_start TIMESTAMP
);

-- =====================================================
-- FEATURE FLAGS
-- =====================================================

CREATE TABLE feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN,
  rollout_percentage INT DEFAULT 100
);

-- =====================================================
-- DAILY METRICS
-- =====================================================

CREATE TABLE daily_metrics (
  date DATE PRIMARY KEY,
  total_users INT,
  total_requests INT,
  total_jobs INT,
  total_payments INT
);

-- =====================================================
-- SEARCH INDEX
-- =====================================================

CREATE TABLE service_request_search (
  request_id UUID PRIMARY KEY,
  category TEXT,
  location TEXT,
  description TEXT
);

-- =====================================================
-- SYSTEM SETTINGS
-- =====================================================

CREATE TABLE system_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);