FROM node:24.18.0-alpine3.24 AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/domain/package.json packages/domain/package.json
RUN pnpm install --frozen-lockfile
COPY apps/web apps/web
COPY packages/contracts packages/contracts
COPY packages/domain packages/domain
RUN pnpm --filter @torkout/contracts build \
  && pnpm --filter @torkout/domain build \
  && pnpm --filter @torkout/web build

FROM nginxinc/nginx-unprivileged:1.29.4-alpine AS runtime
USER root
RUN apk upgrade --no-cache
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
# Fora de `conf.d/`, que é incluído automaticamente dentro de `http`: ali estes cabeçalhos voltariam
# a valer para tudo, inclusive para as respostas repassadas da API.
COPY apps/web/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 CMD wget -q -O - http://127.0.0.1:8080/health/live || exit 1
