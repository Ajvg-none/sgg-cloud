FROM node:22-slim AS frontend-builder
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:22-slim
WORKDIR /app

# 1. Copiar TODO el backend (incluyendo prisma/schema.prisma) ANTES de instalar
COPY backend/ ./backend/

WORKDIR /app/backend

# 2. Ahora instalar dependencias. El postinstall (prisma generate) ya encontrará el schema
RUN npm ci --omit=dev

# 3. Copiar el frontend construido (dist) a la ubicación que espera server.js
COPY --from=frontend-builder /build/frontend/dist ./../frontend/dist

EXPOSE 3000
CMD ["node", "src/server.js"]