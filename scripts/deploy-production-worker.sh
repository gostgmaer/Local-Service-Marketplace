#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

ENV_FILE="docker.env"
REAL_SEED_FILE=""
SKIP_MIGRATIONS=false
NO_BUILD=false
SKIP_BOOTSTRAP_USERS=false

SERVICES=(
  postgres
  redis
  identity-service
  marketplace-service
  payment-service
  comms-service
  oversight-service
  api-gateway
)

usage() {
  cat <<'EOF'
Usage:
  ./scripts/deploy-production-worker.sh [options]

Options:
  --env-file <path>         Environment file (default: docker.env)
  --real-seed-file <path>   SQL file with real production data to import
  --skip-migrations         Skip running database migrations
  --skip-bootstrap-users    Skip creating minimal admin users
  --no-build                Skip image build (faster redeploy)
  -h, --help                Show this help

Notes:
  - This script deploys Level 3 (workers) using explicit service names.
  - This script NEVER runs sample/fake seeders.
  - Minimal bootstrap users are created after infra is healthy.
  - Current schema supports role values: customer, provider, admin.
    SUPER_ADMIN user is created with role=admin.
  - If --real-seed-file is provided, it must be an SQL file and is applied via psql.
EOF
}

info() { printf '[INFO] %s\n' "$*"; }
warn() { printf '[WARN] %s\n' "$*"; }
error() { printf '[ERROR] %s\n' "$*" >&2; }

fail() {
  error "$*"
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

get_env_value() {
  local key="$1"
  local file="$2"
  grep -E "^${key}=" "$file" | tail -n1 | cut -d'=' -f2- || true
}

upsert_env_value() {
  local key="$1"
  local value="$2"
  local file="$3"
  local tmp
  tmp="$(mktemp)"

  awk -v k="$key" -v v="$value" '
    BEGIN { done = 0 }
    $0 ~ ("^" k "=") { print k "=" v; done = 1; next }
    { print }
    END { if (!done) print k "=" v }
  ' "$file" > "$tmp"

  mv "$tmp" "$file"
}

random_secret() {
  local bytes="$1"
  openssl rand -base64 "$bytes" | tr -d '\n=' | tr '/+' '_-'
}

is_placeholder_secret() {
  local value="$1"
  [[ -z "$value" ]] && return 0
  [[ "$value" == your-* ]] && return 0
  [[ "$value" == *change-this* ]] && return 0
  [[ "$value" == *change-in-production* ]] && return 0
  [[ "$value" == gateway-internal-secret-change-in-production ]] && return 0
  [[ "$value" == change-me-to-a-strong-random-secret ]] && return 0
  [[ "$value" == postgres ]] && return 0
  return 1
}

is_invalid_prod_file_service_url() {
  local value="$1"
  [[ -z "$value" ]] && return 0
  [[ "$value" == *"your-file-service"* ]] && return 0
  [[ "$value" == *"example.com"* ]] && return 0
  [[ "$value" == *"localhost"* ]] && return 0
  [[ "$value" == *"127.0.0.1"* ]] && return 0
  [[ "$value" != https://* ]] && return 0
  return 1
}

wait_for_postgres() {
  info "Waiting for PostgreSQL readiness"
  for attempt in $(seq 1 60); do
    if "${compose_cmd[@]}" exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
      info "PostgreSQL is ready"
      return 0
    fi
    sleep 2
  done

  fail "PostgreSQL did not become ready in time"
}

wait_for_redis() {
  info "Waiting for Redis readiness"
  for attempt in $(seq 1 60); do
    if "${compose_cmd[@]}" exec -T redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
      info "Redis is ready"
      return 0
    fi
    sleep 2
  done

  fail "Redis did not become ready in time"
}

ensure_base_schema() {
  info "Checking base schema"

  local has_users
  has_users="$("${compose_cmd[@]}" exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT CASE WHEN to_regclass('public.users') IS NULL THEN 0 ELSE 1 END" 2>/dev/null || true)"
  has_users="$(printf '%s' "$has_users" | tr -d '[:space:]')"

  if [[ "$has_users" == "1" ]]; then
    info "Base schema already present"
    return 0
  fi

  info "Base schema not found. Applying database/schema.sql"
  "${compose_cmd[@]}" exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    -v ON_ERROR_STOP=1 < "${ROOT_DIR}/database/schema.sql"
}

bootstrap_required_users() {
  local super_admin_email="$1"
  local super_admin_password="$2"
  local super_admin_name="$3"
  local admin_email="$4"
  local admin_password="$5"
  local admin_name="$6"

  info "Ensuring required RBAC roles exist"
  "${compose_cmd[@]}" exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO roles (id, name, display_name, description, is_system, is_active)
VALUES
  (uuid_generate_v4(), 'customer', 'Customer', 'End users who request services', true, true),
  (uuid_generate_v4(), 'provider', 'Provider', 'Service providers who offer services', true, true),
  (uuid_generate_v4(), 'admin', 'Administrator', 'Platform administrators with full access', true, true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, now()
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

UPDATE users u
SET role_id = r.id
FROM roles r
WHERE u.role = r.name
  AND u.role_id IS NULL;
SQL

  info "Creating/updating SUPER_ADMIN user (stored as role=admin)"
  "${compose_cmd[@]}" exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    -v ON_ERROR_STOP=1 \
    -v v_email="$super_admin_email" \
    -v v_password="$super_admin_password" \
    -v v_name="$super_admin_name" <<'SQL'
INSERT INTO users (
  id,
  display_id,
  email,
  name,
  password_hash,
  role,
  role_id,
  email_verified,
  status,
  timezone,
  language
)
VALUES (
  uuid_generate_v4(),
  'USR' || upper(substr(md5(lower(:'v_email')), 1, 8)),
  lower(:'v_email'),
  COALESCE(NULLIF(:'v_name', ''), 'Super Admin'),
  crypt(:'v_password', gen_salt('bf', 12)),
  'admin',
  (SELECT id FROM roles WHERE name = 'admin'),
  true,
  'active',
  'UTC',
  'en'
)
ON CONFLICT (email) DO UPDATE
SET
  role = 'admin',
  role_id = (SELECT id FROM roles WHERE name = 'admin'),
  email_verified = true,
  status = 'active',
  updated_at = now();
SQL

  if [[ -n "$admin_email" && -n "$admin_password" ]]; then
    info "Creating/updating secondary ADMIN user"
    "${compose_cmd[@]}" exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql \
      -U "$POSTGRES_USER" \
      -d "$POSTGRES_DB" \
      -v ON_ERROR_STOP=1 \
      -v v_email="$admin_email" \
      -v v_password="$admin_password" \
      -v v_name="$admin_name" <<'SQL'
INSERT INTO users (
  id,
  display_id,
  email,
  name,
  password_hash,
  role,
  role_id,
  email_verified,
  status,
  timezone,
  language
)
VALUES (
  uuid_generate_v4(),
  'USR' || upper(substr(md5(lower(:'v_email')), 1, 8)),
  lower(:'v_email'),
  COALESCE(NULLIF(:'v_name', ''), 'Admin'),
  crypt(:'v_password', gen_salt('bf', 12)),
  'admin',
  (SELECT id FROM roles WHERE name = 'admin'),
  true,
  'active',
  'UTC',
  'en'
)
ON CONFLICT (email) DO UPDATE
SET
  role = 'admin',
  role_id = (SELECT id FROM roles WHERE name = 'admin'),
  email_verified = true,
  status = 'active',
  updated_at = now();
SQL
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      [[ $# -lt 2 ]] && fail "Missing value for --env-file"
      ENV_FILE="$2"
      shift 2
      ;;
    --real-seed-file)
      [[ $# -lt 2 ]] && fail "Missing value for --real-seed-file"
      REAL_SEED_FILE="$2"
      shift 2
      ;;
    --skip-migrations)
      SKIP_MIGRATIONS=true
      shift
      ;;
    --skip-bootstrap-users)
      SKIP_BOOTSTRAP_USERS=true
      shift
      ;;
    --no-build)
      NO_BUILD=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "Unknown option: $1"
      ;;
  esac
done

[[ "$ENV_FILE" = /* ]] || ENV_FILE="${ROOT_DIR}/${ENV_FILE}"

require_cmd docker
require_cmd openssl
require_cmd awk
require_cmd grep

docker compose version >/dev/null 2>&1 || fail "Docker Compose plugin not found"

[[ -f "${ROOT_DIR}/docker-compose.yml" ]] || fail "docker-compose.yml not found"
[[ -f "${ROOT_DIR}/docker-compose.level3.yml" ]] || fail "docker-compose.level3.yml not found"
[[ -f "${ROOT_DIR}/.env.example" ]] || fail ".env.example not found"

if [[ ! -f "$ENV_FILE" ]]; then
  info "Creating ${ENV_FILE} from .env.example"
  cp "${ROOT_DIR}/.env.example" "$ENV_FILE"
fi

JWT_SECRET="$(get_env_value JWT_SECRET "$ENV_FILE")"
JWT_REFRESH_SECRET="$(get_env_value JWT_REFRESH_SECRET "$ENV_FILE")"
GATEWAY_INTERNAL_SECRET="$(get_env_value GATEWAY_INTERNAL_SECRET "$ENV_FILE")"
ENCRYPTION_KEY="$(get_env_value ENCRYPTION_KEY "$ENV_FILE")"
SESSION_SECRET="$(get_env_value SESSION_SECRET "$ENV_FILE")"

POSTGRES_USER="$(get_env_value POSTGRES_USER "$ENV_FILE")"
POSTGRES_PASSWORD="$(get_env_value POSTGRES_PASSWORD "$ENV_FILE")"
POSTGRES_DB="$(get_env_value POSTGRES_DB "$ENV_FILE")"

DATABASE_USER="$(get_env_value DATABASE_USER "$ENV_FILE")"
DATABASE_PASSWORD="$(get_env_value DATABASE_PASSWORD "$ENV_FILE")"
DATABASE_NAME="$(get_env_value DATABASE_NAME "$ENV_FILE")"

if is_placeholder_secret "$JWT_SECRET"; then
  JWT_SECRET="$(random_secret 48)"
  upsert_env_value JWT_SECRET "$JWT_SECRET" "$ENV_FILE"
fi

if is_placeholder_secret "$JWT_REFRESH_SECRET"; then
  JWT_REFRESH_SECRET="$(random_secret 48)"
  upsert_env_value JWT_REFRESH_SECRET "$JWT_REFRESH_SECRET" "$ENV_FILE"
fi

if is_placeholder_secret "$GATEWAY_INTERNAL_SECRET"; then
  GATEWAY_INTERNAL_SECRET="$(random_secret 48)"
  upsert_env_value GATEWAY_INTERNAL_SECRET "$GATEWAY_INTERNAL_SECRET" "$ENV_FILE"
fi

if is_placeholder_secret "$ENCRYPTION_KEY"; then
  ENCRYPTION_KEY="$(random_secret 64)"
  upsert_env_value ENCRYPTION_KEY "$ENCRYPTION_KEY" "$ENV_FILE"
fi

if is_placeholder_secret "$SESSION_SECRET"; then
  SESSION_SECRET="$(random_secret 32)"
  upsert_env_value SESSION_SECRET "$SESSION_SECRET" "$ENV_FILE"
fi

if [[ -z "$POSTGRES_USER" ]]; then
  POSTGRES_USER="postgres"
  upsert_env_value POSTGRES_USER "$POSTGRES_USER" "$ENV_FILE"
fi

if [[ -z "$POSTGRES_DB" ]]; then
  POSTGRES_DB="marketplace"
  upsert_env_value POSTGRES_DB "$POSTGRES_DB" "$ENV_FILE"
fi

if is_placeholder_secret "$POSTGRES_PASSWORD"; then
  POSTGRES_PASSWORD="$(random_secret 32)"
  upsert_env_value POSTGRES_PASSWORD "$POSTGRES_PASSWORD" "$ENV_FILE"
fi

if [[ -z "$DATABASE_USER" ]]; then
  DATABASE_USER="$POSTGRES_USER"
  upsert_env_value DATABASE_USER "$DATABASE_USER" "$ENV_FILE"
fi

if [[ -z "$DATABASE_NAME" ]]; then
  DATABASE_NAME="$POSTGRES_DB"
  upsert_env_value DATABASE_NAME "$DATABASE_NAME" "$ENV_FILE"
fi

if is_placeholder_secret "$DATABASE_PASSWORD"; then
  DATABASE_PASSWORD="$POSTGRES_PASSWORD"
  upsert_env_value DATABASE_PASSWORD "$DATABASE_PASSWORD" "$ENV_FILE"
fi

upsert_env_value DATABASE_HOST "postgres" "$ENV_FILE"
upsert_env_value DATABASE_PORT "5432" "$ENV_FILE"
upsert_env_value DATABASE_URL "postgresql://${DATABASE_USER}:${DATABASE_PASSWORD}@postgres:5432/${DATABASE_NAME}" "$ENV_FILE"

# Force worker-layer flags for production deploy.
upsert_env_value NODE_ENV "production" "$ENV_FILE"
upsert_env_value CACHE_ENABLED "true" "$ENV_FILE"
upsert_env_value WORKERS_ENABLED "true" "$ENV_FILE"
upsert_env_value EVENT_BUS_ENABLED "false" "$ENV_FILE"
upsert_env_value COMPOSE_PROFILES "workers" "$ENV_FILE"

# External services must not remain placeholder in production.
FILE_UPLOAD_SERVICE_URL="$(get_env_value FILE_UPLOAD_SERVICE_URL "$ENV_FILE")"
if is_invalid_prod_file_service_url "$FILE_UPLOAD_SERVICE_URL"; then
  fail "FILE_UPLOAD_SERVICE_URL is missing or placeholder in ${ENV_FILE}"
fi

SUPER_ADMIN_EMAIL="$(get_env_value SUPER_ADMIN_EMAIL "$ENV_FILE")"
SUPER_ADMIN_PASSWORD="$(get_env_value SUPER_ADMIN_PASSWORD "$ENV_FILE")"
SUPER_ADMIN_NAME="$(get_env_value SUPER_ADMIN_NAME "$ENV_FILE")"
ADMIN_EMAIL="$(get_env_value ADMIN_EMAIL "$ENV_FILE")"
ADMIN_PASSWORD="$(get_env_value ADMIN_PASSWORD "$ENV_FILE")"
ADMIN_NAME="$(get_env_value ADMIN_NAME "$ENV_FILE")"

if [[ "$SKIP_BOOTSTRAP_USERS" == false ]]; then
  [[ -n "$SUPER_ADMIN_EMAIL" ]] || fail "SUPER_ADMIN_EMAIL is required in ${ENV_FILE} for production bootstrap"
  [[ -n "$SUPER_ADMIN_PASSWORD" ]] || fail "SUPER_ADMIN_PASSWORD is required in ${ENV_FILE} for production bootstrap"
  if [[ ${#SUPER_ADMIN_PASSWORD} -lt 12 ]]; then
    fail "SUPER_ADMIN_PASSWORD must be at least 12 characters"
  fi

  if [[ -n "$ADMIN_EMAIL" && -z "$ADMIN_PASSWORD" ]]; then
    fail "ADMIN_PASSWORD is required when ADMIN_EMAIL is set"
  fi
  if [[ -z "$ADMIN_EMAIL" && -n "$ADMIN_PASSWORD" ]]; then
    fail "ADMIN_EMAIL is required when ADMIN_PASSWORD is set"
  fi
  if [[ -n "$ADMIN_PASSWORD" && ${#ADMIN_PASSWORD} -lt 12 ]]; then
    fail "ADMIN_PASSWORD must be at least 12 characters"
  fi
fi

if [[ -n "$REAL_SEED_FILE" ]]; then
  [[ "$REAL_SEED_FILE" = /* ]] || REAL_SEED_FILE="${ROOT_DIR}/${REAL_SEED_FILE}"
  [[ -f "$REAL_SEED_FILE" ]] || fail "Real seed file not found: $REAL_SEED_FILE"
  [[ "$REAL_SEED_FILE" == *.sql ]] || fail "Real seed file must be .sql"

  case "$REAL_SEED_FILE" in
    *seed.js|*seed-data.js|*run-seeder*|*seed-database*)
      fail "Sample/fake seeder inputs are blocked in production"
      ;;
  esac
fi

info "Deploying production worker stack"
compose_cmd=(
  docker compose
  --env-file "$ENV_FILE"
  -f docker-compose.yml
  -f docker-compose.level3.yml
)

up_cmd=(up -d)
if [[ "$NO_BUILD" == false ]]; then
  up_cmd+=(--build)
fi
up_cmd+=("${SERVICES[@]}")

"${compose_cmd[@]}" "${up_cmd[@]}"

# Ensure infra dependencies are healthy before schema/migration/bootstrap steps.
wait_for_postgres
wait_for_redis
ensure_base_schema

if [[ "$SKIP_MIGRATIONS" == false ]]; then
  info "Running migrations"
  MIGRATION_DATABASE_URL="postgresql://${DATABASE_USER}:${DATABASE_PASSWORD}@127.0.0.1:54321/${DATABASE_NAME}"

  docker run --rm \
    --network host \
    -e DATABASE_URL="$MIGRATION_DATABASE_URL" \
    -v "${ROOT_DIR}/database:/src:ro" \
    node:20-alpine \
    sh -c "cp -R /src /tmp/db && cd /tmp/db && npm install --omit=dev --no-audit --no-fund >/dev/null && node migrate.js up"
else
  warn "Skipping migrations (--skip-migrations)"
fi

if [[ "$SKIP_BOOTSTRAP_USERS" == false ]]; then
  bootstrap_required_users \
    "$SUPER_ADMIN_EMAIL" \
    "$SUPER_ADMIN_PASSWORD" \
    "${SUPER_ADMIN_NAME:-Super Admin}" \
    "$ADMIN_EMAIL" \
    "$ADMIN_PASSWORD" \
    "${ADMIN_NAME:-Admin}"
else
  warn "Skipping bootstrap users (--skip-bootstrap-users)"
fi

if [[ -n "$REAL_SEED_FILE" ]]; then
  info "Importing real production seed data from ${REAL_SEED_FILE}"
  "${compose_cmd[@]}" exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    -v ON_ERROR_STOP=1 < "$REAL_SEED_FILE"
else
  info "No seed import requested. Sample/fake seeders were not executed."
fi

API_GATEWAY_PORT="$(get_env_value API_GATEWAY_PORT "$ENV_FILE")"
if [[ -z "$API_GATEWAY_PORT" ]]; then
  API_GATEWAY_PORT="3700"
fi

info "Waiting for API Gateway health"
for attempt in $(seq 1 30); do
  if command -v curl >/dev/null 2>&1; then
    if curl -fsS "http://127.0.0.1:${API_GATEWAY_PORT}/health" >/dev/null 2>&1; then
      info "Gateway is healthy"
      break
    fi
  fi

  if [[ "$attempt" -eq 30 ]]; then
    warn "Gateway health check did not pass yet. Check logs with: docker compose --env-file ${ENV_FILE} logs -f api-gateway"
  else
    sleep 4
  fi
done

"${compose_cmd[@]}" ps

cat <<EOF

Deployment complete.

What this script did:
  1. Generated/validated ${ENV_FILE}
  2. Deployed Level 3 worker stack with explicit services
  3. Waited for infra readiness (PostgreSQL + Redis)
  4. Applied base schema on first run (if missing)
  5. Ran migrations (unless --skip-migrations was used)
  6. Bootstrapped required admin users (unless --skip-bootstrap-users)
  7. Did NOT run sample/fake seeders

Optional real data import:
  ./scripts/deploy-production-worker.sh --real-seed-file /absolute/path/to/real-data.sql --no-build

EOF
