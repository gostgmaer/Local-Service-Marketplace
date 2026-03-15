-- Fix for missing provider_services table
-- Run this if you don't want to reapply entire schema

CREATE TABLE IF NOT EXISTS provider_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES service_categories(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_provider_services_provider_id ON provider_services(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_services_category_id ON provider_services(category_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_services_unique ON provider_services(provider_id, category_id);

SELECT 'provider_services table created successfully!' as result;
