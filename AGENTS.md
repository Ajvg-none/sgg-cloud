# AGENTS.md – SGG Cloud

Sistema de Garantías para ópticas. Monorepo sin tooling compartido: `backend/` y `frontend/` son paquetes independientes.

## Stack

| Capa | Tecnología | Notas |
|------|-----------|-------|
| Backend | Express 5 + Prisma v7 + PostgreSQL | CommonJS (`require`), sin TypeScript |
| Frontend | React 19 + Vite 8 + Tailwind 3 | ESM, sin TypeScript, Zustand, React Router v7 |
| ERP externo | GesVision REST API | `app.gesvision.com`, credenciales en `.env` |
| Impresión | QZ Tray (cliente local del lab) + `qz-tray` npm en frontend | RAW ESC/POS vía WebSocket local; **firma digital SHA512** vía `/api/qz/*` para impresión silenciosa |
| VCA | Agente local del lab (polling `/api/agent/*` con API key) | El backend genera el contenido; el agente escribe el `.vca` en la ruta de red |
| Logs | Winston + winston-daily-rotate-file (rotación diaria, 14d) | `backend/logs/sgg-*.log`; retención configurable con `LOG_RETENTION_DAYS` |

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

## Prisma v7 — Patrón de conexión

La mayoría de los archivos que usan BD crean su propia conexión con el patrón driver adapter:

```js
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
```

Excepción: `config/prisma.js` exporta un singleton compartido usado por `routes/agentRoutes.js` y `middleware/labApiKey.js`.

El proyecto tiene Prisma skills instaladas (`backend/skills-lock.json`).

## Arquitectura

```
backend/src/
  server.js          — entrypoint, registra rutas y cron
  config/            — prisma.js (singleton), logger.js (winston daily rotate), gesvision.js
  routes/            — auth, store, lab, admin, agent (agente VCA)
  controllers/       — lógica de cada ruta
  middleware/
    auth.js          — JWT (Bearer token, adjunta req.user)
    role.js          — requireRole(['ADMIN','TIENDA',...])
    labApiKey.js     — API key para el agente local de VCA
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

### Flujo de garantía

**Impresión del ticket (QZ Tray desde el frontend):**

1. Tienda consulta orden en GesVision (`GET /api/store/order/:n`)
2. Tienda crea garantía (`POST /api/store/warranties`) → status `PENDING` → se imprime **solo el formato A4** en el navegador (la tienda NO imprime el ticket tickera)
3. Lab abre el dashboard y pulsa "Procesar" sobre una garantía PENDING
4. Frontend: `connectQZ()` → `GET /api/lab/ticket-buffer/:id` (backend genera buffer ESC/POS base64) → `printRawData(printerName, base64)` imprime con QZ Tray → `POST /api/lab/warranties/:id/complete` → status `COMPLETED`
5. Cron limpia garantías atascadas en PROCESSING >5min → vuelta a `PENDING`

> El ticket-buffer **ya no genera ni devuelve datos VCA**. No usar `qz.file.write` desde el navegador.

**Firma digital QZ Tray (impresión silenciosa, sin diálogos):**

- Credenciales en `backend/keys/` (`qz-private-key.pem`, `qz-cert.pem`, `qz-cert.crt`); generarlas con `cd backend && npm run qz:genkeys`. Rutas configurables con `QZ_PRIVATE_KEY_PATH` / `QZ_CERT_PATH`. **La carpeta `keys/` está gitignoreada — no commitear la clave privada.**
- Frontend (`services/qzprintService.js`): `setCertificatePromise` + `setSignaturePromise(SHA512)` consumen `GET /api/qz/certificate` y `GET /api/qz/sign?request=...`
- Para que un PC imprima sin diálogos: confiar el certificado UNA vez — QZ Tray → icono bandeja → Advanced → **Site Manager** → arrastrar `qz-cert.crt` (alternativa: copiarlo como `C:\Program Files\QZ Tray\override.crt` y reiniciar QZ Tray)
- Cambio de computadora = instalar QZ Tray + repetir ese paso; la clave privada nunca sale del servidor
- Si faltan credenciales en el servidor, todo sigue funcionando pero QZ Tray vuelve a preguntar en cada impresión

**Entrega del archivo VCA (agente local):**

1. Un agente en la red del lab autentica con su API key (`x-lab-api-key` o `Authorization: Bearer <apiKey>`)
2. Polling `GET /api/agent/vca/pending` → backend genera el contenido `.vca` (legacy/lensware) para garantías con `vcaDeliveredAt = null`
3. El agente escribe el archivo en la ruta de red configurada (`lab.vcaNetworkPath`)
4. Confirmación `POST /api/agent/vca/:warrantyId/delivered` → se marca `vcaDeliveredAt`

### Convenciones del proyecto

- **Backend es CommonJS**: usa `require()`/`module.exports`, NO `import`/`export`
- **Frontend es ESM**: usa `import`/`export`
- **Legacy code**: `backend/src/legacy/` es código portado del sistema en producción. No reescribir la lógica interna. Solo adaptar para recibir parámetros externos (URLs, credenciales) en vez de depender de variables de entorno fijas.
- **Winston logger**: usar `logger.info()`/`logger.error()` etc. No `console.log`. Importar desde `../config/logger`.
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
- `frontend/src/store/warrantyFormStore.js` (Zustand) mantiene el estado del formulario "Nueva Garantía" entre navegación de tabs de tienda.
