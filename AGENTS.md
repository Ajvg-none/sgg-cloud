# AGENTS.md – SGG Cloud

Sistema de Garantías para ópticas. Monorepo sin tooling compartido: `backend/` y `frontend/` son paquetes independientes.

## Stack

| Capa | Tecnología | Notas |
|------|-----------|-------|
| Backend | Express 5 + Prisma v7 + PostgreSQL | CommonJS (`require`), sin TypeScript |
| Frontend | React 19 + Vite 8 + Tailwind 3 | ESM, sin TypeScript, Zustand, React Router v7 |
| ERP externo | GesVision REST API | `app.gesvision.com`, credenciales en `.env` |
| Impresión | QZ Tray (cliente local del lab) + `qz-tray` npm en frontend | RAW ESC/POS vía WebSocket local; certificados/permisos configurados en QZ Tray |
| Logs | Winston + daily rotate | `backend/logs/` |

## Comandos

```bash
# Backend (puerto 3000)
cd backend
npm run dev              # nodemon src/server.js
npm run start            # node src/server.js (producción)
npm run prisma:generate  # npx prisma generate
npm run prisma:migrate   # npx prisma migrate dev
npx prisma db seed       # seed de labs, stores, usuarios

# Frontend (puerto 5173)
cd frontend
npm run dev              # vite
npm run build            # vite build
npm run lint             # oxlint (sin typecheck)
npm run preview          # vite preview (build servido)
```

No hay comandos de test reales. `backend/test.js` es un script manual contra el login y creación de garantías.

## Prisma v7 — Patrón obligatorio

Cada archivo que usa BD crea su propia conexión con el patrón driver adapter. No hay singleton compartido:

```js
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
```

El proyecto tiene Prisma skills instaladas (`backend/skills-lock.json`).

## Arquitectura

```
backend/src/
  server.js          — entrypoint, registra rutas y cron
  config/            — database.js (pool pg), logger.js (winston), gesvision.js
  routes/            — auth, store, lab, admin
  controllers/       — lógica de cada ruta
  middleware/
    auth.js          — JWT (Bearer token, adjunta req.user)
    role.js          — requireRole(['ADMIN','TIENDA',...])
  services/
    syncService.js   — consulta GesVision y guarda en OrderCache
  legacy/            — CÓDIGO LEGADO: NO REESCRIBIR
    gesvisionApi.js  — cliente HTTP a GesVision
    fetchAndMapOrder.js — mapea datos crudos de orden
    lensware.js      — genera contenido VCA (formato Lensware)
    printer.js       — tickets ESC/POS (escpos, Bixolon)
  cron/
    orphanCleanup.js — cada 5 min, resetea PROCESSING → PENDING
```

### Roles y autenticación

| Rol | Ruta base | Auth | UI |
|-----|----------|------|-----|
| `ADMIN` | `/api/admin/*` | JWT + `requireRole(['ADMIN'])` | `/admin` |
| `TIENDA` | `/api/store/*` | JWT + `requireRole(['TIENDA'])` | `/store` |
| `LABORATORIO` | `/api/lab/*` | JWT + `requireRole(['LABORATORIO','ADMIN'])` | `/lab` |

### Flujo de garantía (impresión con QZ Tray)

1. Tienda consulta orden en GesVision (`GET /api/store/order/:n`)
2. Tienda crea garantía (`POST /api/store/warranties`) → status `PENDING`
3. Lab abre el dashboard y pulsa "Procesar" sobre una garantía PENDING
4. Frontend: `connectQZ()` → `GET /api/lab/ticket-buffer/:id` (backend genera buffer ESC/POS base64 + datos VCA) → `printRawData(printerName, base64)` imprime con QZ Tray → `writeVCAFile()` (opcional) → `POST /api/lab/warranties/:id/complete` → status `COMPLETED`
5. Cron limpia garantías atascadas en PROCESSING >5min → vuelta a `PENDING`

> **Nota:** el antiguo agente de impresión (polling `/api/agent/*`, X-API-Key) fue **retirado**. El backend ya no imprime ni envía tickets a agentes; solo genera el buffer y el frontend lo imprime vía QZ Tray.

### Convenciones del proyecto

- **Backend es CommonJS**: usa `require()`/`module.exports`, NO `import`/`export`
- **Frontend es ESM**: usa `import`/`export`
- **Legacy code**: `backend/src/legacy/` es código portado del sistema en producción. No reescribir la lógica interna. Solo adaptar para recibir parámetros externos (URLs, credenciales) en vez de depender de variables de entorno fijas.
- **Winston logger**: usar `logger.info()`/`logger.error()` etc. No `console.log`. Importar desde `../config/logger`.
- **Multer memoryStorage**: los uploads de CSV van a memoria (10MB max), no a disco.
- **bcrypt para passwords**: usar `bcrypt.compare()`/`bcrypt.hash()`.
- **Tailwind custom colors**: usar `opticolor-red`, `opticolor-gray-*` (definidos en `tailwind.config.js`).
- **Oxlint**: único linter del frontend. Config en `.oxlintrc.json`. Solo reglas react/rules-of-hooks y react/only-export-components.
- **No hay typecheck** en ningún paquete.

## Prerrequisitos de ejecución

1. PostgreSQL corriendo con BD `sistema_garantias`
2. Copiar/crear `backend/.env` con `DATABASE_URL`, `JWT_SECRET`, credenciales GesVision
3. `cd backend && npm install && npm run prisma:generate && npx prisma db push && npx prisma db seed`
4. `cd frontend && npm install`
5. Ejecutar backend y frontend en terminales separadas

## Advertencias

- **El `.env` del backend contiene credenciales reales de producción de GesVision.** No commitear a repositorios públicos. Rotar si esto fue expuesto.
- El archivo `backend/.gitignore` NO excluye `.env` — las credenciales están commiteadas actualmente.
- No hay tests automatizados. Cualquier cambio en auth, garantías o legacy debe probarse manualmente con `backend/test.js` o curl.
- `frontend/src/store/` está vacío — Zustand se importa pero no hay stores creados aún.
