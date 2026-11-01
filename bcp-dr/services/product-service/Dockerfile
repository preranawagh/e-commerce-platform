# syntax=docker/dockerfile:1
# Build from the bcp-dr/ root (the service depends on ../../shared):
#   docker build -f services/product-service/Dockerfile -t cloudresilience/product-service .

FROM node:24.22-alpine AS deps
WORKDIR /app
# The service links @cloudresilience/shared via file:../../shared, so install
# shared's runtime dependencies first, then the service's.
COPY shared/package.json shared/package-lock.json shared/
RUN npm ci --omit=dev --prefix shared
COPY services/product-service/package.json services/product-service/package-lock.json services/product-service/
RUN npm ci --omit=dev --prefix services/product-service

FROM node:24.22-alpine
# tini runs as PID 1 so SIGTERM reaches Node even before its handler is installed.
# npm and corepack are build-time tools; removing them keeps their bundled
# dependencies (and those dependencies' CVEs) out of the runtime image.
RUN apk add --no-cache tini \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
ENV NODE_ENV=production \
    PORT=3002
WORKDIR /app
# Application files stay owned by root and read-only to the runtime user.
COPY --from=deps /app ./
COPY shared/ shared/
COPY services/product-service/src services/product-service/src
USER node
EXPOSE 3002
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" > /dev/null || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "services/product-service/src/server.js"]
