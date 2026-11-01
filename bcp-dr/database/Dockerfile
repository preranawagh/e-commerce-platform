# syntax=docker/dockerfile:1
# One-shot migration + seed image (Docker Compose `migrate` service; later the
# Kubernetes migration Job). Build from the bcp-dr/ root:
#   docker build -f database/Dockerfile -t cloudresilience/migrate .
#
# Default command applies pending migrations and seeders, then exits.
# Other commands: `migrate`, `seed`, `undo` (see database/runSetup.js).

FROM node:24.22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:24.22-alpine
# npm and corepack are build-time tools; removing them keeps their bundled
# dependencies (and those dependencies' CVEs) out of the runtime image.
RUN apk add --no-cache tini \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY package.json ./
COPY database/ database/
USER node
ENTRYPOINT ["/sbin/tini", "--", "node", "database/runSetup.js"]
CMD ["setup"]
