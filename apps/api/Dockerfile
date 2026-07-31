FROM node:24.18.0-alpine3.24 AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/domain/package.json packages/domain/package.json
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY tsconfig.base.json ./
COPY apps/api apps/api
COPY packages/contracts packages/contracts
COPY packages/database packages/database
COPY packages/domain packages/domain
RUN pnpm --filter @torkout/contracts build \
  && pnpm --filter @torkout/domain build \
  && pnpm --filter @torkout/database build \
  && pnpm --filter @torkout/api build \
  && pnpm --filter @torkout/api deploy --prod --legacy /prod/api

FROM node:24.18.0-alpine3.24 AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /prod/api ./
RUN rm -rf \
    /opt/yarn-* \
    /usr/local/bin/corepack \
    /usr/local/bin/npm \
    /usr/local/bin/npx \
    /usr/local/bin/pnpm \
    /usr/local/bin/pnpx \
    /usr/local/bin/yarn \
    /usr/local/bin/yarnpkg \
    /usr/local/lib/node_modules/corepack \
    /usr/local/lib/node_modules/npm \
  && find node_modules/.pnpm -path '*/@esbuild/*/bin/esbuild' -delete
# Um volume nomeado herda dono e modo deste diretório ao ser criado vazio. Sem o
# preparo aqui, o volume nasce como root e a API, que roda sem privilégio, não
# consegue gravar as fotos de evolução.
RUN mkdir -p /var/lib/torkout/object-storage \
  && chown -R node:node /var/lib/torkout
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 CMD wget -q -O - http://127.0.0.1:3000/health/ready || exit 1
CMD ["node", "dist/server.js"]
