-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create service_categories table
CREATE TABLE IF NOT EXISTS service_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create service_requests table
CREATE TABLE IF NOT EXISTS service_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  category_id UUID NOT NULL REFERENCES service_categories(id) ON DELETE RESTRICT,
  location_id UUID,
  description TEXT NOT NULL,
  budget DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create service_request_search table for full-text search
CREATE TABLE IF NOT EXISTS service_request_search (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  search_vector TSVECTOR,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_service_requests_user_id ON service_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_category_id ON service_requests(category_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);
CREATE INDEX IF NOT EXISTS idx_service_requests_created_at ON service_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_service_request_search_request_id ON service_request_search(request_id);
CREATE INDEX IF NOT EXISTS idx_service_request_search_search_vector ON service_request_search USING GIN(search_vector);

-- Insert default categories
INSERT INTO service_categories (name) VALUES
  ('Plumbing'),
  ('Electrical'),
  ('Cleaning'),
  ('Moving'),
  ('Painting'),
  ('Carpentry'),
  ('Landscaping'),
  ('HVAC'),
  ('Pest Control'),
  ('General Handyman')
ON CONFLICT (name) DO NOTHING;
