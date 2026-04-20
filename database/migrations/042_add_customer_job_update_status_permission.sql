-- Migration: Grant customers the jobs.update_status permission
-- Customers need this to mark a job as "disputed" after filing a dispute.
-- The service layer already restricts customers to only "completed" and "disputed" transitions.

INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, now()
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'customer'
  AND p.name = 'jobs.update_status'
ON CONFLICT DO NOTHING;
