#!/bin/sh
set -eu

: "${BACKUP_BUCKET:?BACKUP_BUCKET is required}"
: "${BACKUP_PREFIX:?BACKUP_PREFIX is required}"
: "${PGDATABASE:?PGDATABASE is required}"
: "${PGHOST:?PGHOST is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"
: "${PGUSER:?PGUSER is required}"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
archive="/tmp/torkout-${timestamp}.dump"
checksum="${archive}.sha256"
destination="s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}/daily/$(basename "${archive}")"

umask 077
pg_dump --format=custom --no-owner --no-acl --file="${archive}"
sha256sum "${archive}" > "${checksum}"
aws s3 cp "${archive}" "${destination}" --sse AES256 --only-show-errors
aws s3 cp "${checksum}" "${destination}.sha256" --sse AES256 --only-show-errors
rm -f "${archive}" "${checksum}"
printf 'backup_uploaded timestamp=%s\n' "${timestamp}"
