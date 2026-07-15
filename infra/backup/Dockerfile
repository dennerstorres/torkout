FROM postgres:18.4-alpine3.24

RUN apk add --no-cache aws-cli
COPY --chmod=0555 infra/backup/backup.sh /usr/local/bin/torkout-backup
USER postgres
ENTRYPOINT ["/usr/local/bin/torkout-backup"]
