# syntax=docker/dockerfile:1

# Mock de los proveedores externos (servicios y recargas). Sólo lo consume el
# backend por la red interna de Docker: nunca se publica a internet.

FROM node:22-slim AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force


FROM node:22-slim AS runtime

ENV NODE_ENV=production
ENV PORT=4000

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

USER node

EXPOSE 4000

# /health está declarado antes del middleware de API key (app.js), así que el
# chequeo no necesita credenciales.
HEALTHCHECK --interval=60s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:4000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "src/server.js"]
