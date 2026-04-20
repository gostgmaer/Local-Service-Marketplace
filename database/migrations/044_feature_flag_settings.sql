-- Migration 044: Add feature-flag settings to system_settings
-- These replace the scattered NEXT_PUBLIC_* and comms-service env vars so
-- all feature toggles are controlled from the admin panel at runtime.
-- ON CONFLICT DO NOTHING preserves any values already set by an admin.

INSERT INTO system_settings (key, value, description, type) VALUES
  ('notifications_enabled',           'false', 'Master switch: enable the notification system (in-app bell, email, SMS, push)', 'boolean'),
  ('in_app_notifications_enabled',    'false', 'Enable real-time in-app notification bell and feed for users', 'boolean'),
  ('push_notifications_enabled',      'false', 'Enable browser/FCM push notification delivery (requires Firebase credentials)', 'boolean'),
  ('email_notifications_enabled',     'true',  'Enable email notification delivery via the email-service', 'boolean'),
  ('sms_notifications_enabled',       'false', 'Enable SMS notification delivery via the sms-service', 'boolean'),
  ('messaging_enabled',               'false', 'Enable the messaging/chat feature (shows Messages nav link and /dashboard/messages route)', 'boolean'),
  ('whatsapp_enabled',                'false', 'Enable WhatsApp notification delivery (requires WHATSAPP_PROVIDER + credentials in comms-service)', 'boolean'),
  ('notification_preferences_enabled','false', 'Allow users to manage their own notification channel preferences', 'boolean'),
  ('device_tracking_enabled',         'false', 'Enable device registration for push notifications', 'boolean')
ON CONFLICT (key) DO NOTHING;
