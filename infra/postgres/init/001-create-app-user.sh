#!/bin/sh
set -eu

: "${APP_DATABASE_USER:?APP_DATABASE_USER is required}"
: "${APP_DATABASE_PASSWORD:?APP_DATABASE_PASSWORD is required}"

case "${APP_DATABASE_USER}" in
  *[!a-zA-Z0-9_]*) echo 'APP_DATABASE_USER contains invalid characters' >&2; exit 1 ;;
esac

psql --set=ON_ERROR_STOP=1 --username "${POSTGRES_USER}" --dbname "${POSTGRES_DB}" \
  --set=app_user="${APP_DATABASE_USER}" --set=app_password="${APP_DATABASE_PASSWORD}" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'app_user', :'app_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'app_user') \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), :'app_user') \gexec
GRANT USAGE ON SCHEMA public TO :"app_user";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO :"app_user";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO :"app_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"app_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO :"app_user";
SELECT format('ALTER ROLE %I SET statement_timeout = %L', :'app_user', '15s') \gexec
SQL
