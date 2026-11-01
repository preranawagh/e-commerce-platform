# syntax=docker/dockerfile:1
# Build from the bcp-dr/ root so the root .dockerignore keeps any local
# frontend/.env (which may point at localhost) out of the production build:
#   docker build -f frontend/Dockerfile -t cloudresilience/frontend .

FROM node:24.22-alpine AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Runs as uid 101 and listens on 8080 (no root, no privileged port).
FROM nginxinc/nginx-unprivileged:1.30-alpine
# Pick up Alpine security fixes released after the base image was built.
USER root
RUN apk upgrade --no-cache
USER 101
ENV NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1 \
    USER_SERVICE_URL=http://user-service:3001 \
    PRODUCT_SERVICE_URL=http://product-service:3002 \
    INVENTORY_SERVICE_URL=http://inventory-service:3003 \
    ORDER_SERVICE_URL=http://order-service:3004 \
    NOTIFICATION_SERVICE_URL=http://notification-service:3005
COPY frontend/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz > /dev/null || exit 1
