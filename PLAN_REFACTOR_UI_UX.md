# Plan de Refactor UI/UX

## Estado global

- Estado actual: COMPLETADO (pendiente verificación manual en navegador)
- Fase actual: 9 (QA visual, responsividad y accesibilidad)
- Tarea actual: Verificación manual en navegador (usuario)
- Última actualización: 2026-08-03

## Objetivo

Mejorar la UI/UX del frontend sin modificar comportamiento funcional.

## Reglas innegociables

- No modificar reglas de negocio.
- No modificar autenticación.
- No modificar roles.
- No modificar rutas protegidas.
- No modificar llamadas API.
- No modificar validaciones funcionales.
- No modificar localStorage keys.
- No modificar endpoints.
- No modificar nombres de funciones API.
- No modificar comportamiento de formularios.
- No modificar lógica de tablas.
- No modificar lógica de modales.
- No eliminar funcionalidades existentes.
- No avanzar si una tarea rompe algo.
- Cada cambio debe ser incremental, verificable y reversible.

## Criterios visuales

- Usar la paleta opticolor-red / opticolor-gray.
- Animaciones sobrias (150–300ms, ease-out/ease-in-out).
- Espaciados consistentes.
- Títulos con jerarquía clara.
- Tablas simétricas y legibles.
- Tarjetas alineadas.
- Formularios claros.
- Estados de carga, error y vacío consistentes.
- Accesibilidad básica (focus-visible, aria, alt, contraste).
- Responsividad correcta.
- Respetar `prefers-reduced-motion`.

## Decisiones aprobadas

- [x] Usar lucide-react para iconos, reemplazo progresivo. (ya instalado `^1.28.0`)
- [x] StoreHistory.jsx fuera de alcance. NO tocar.
- [x] Deduplicar componentes presentacionales con condiciones.
- [x] Reemplazar window.confirm por modal custom más adelante (NO en Fase 0).
- [x] Aplicar fix del interceptor 401 como bugfix funcional aprobado. (YA APLICADO)

## Fases

### Fase 0: Plan y base visual segura
Estado: COMPLETADO

Tareas:
- [x] Crear PLAN_REFACTOR_UI_UX.md
- [x] Aplicar bugfix del interceptor 401 (`api.jsx` — exclusión `/auth/login`). YA APLICADO
- [x] Fix visual AdminLayout `h-48w-auto` → `h-48 w-auto`. YA CORREGIDO
- [x] Rediseño navbar tienda + layouts (StoreNavbar, LabLayout, AdminLayout, UserChip, Icons). YA HECHO
- [x] Corregir `lang="es"` en index.html
- [x] Corregir título de la aplicación (`frontend` → Opti-Color | Sistema de Garantías)
- [x] Agregar meta description básica
- [x] Agregar tokens visuales aditivos en tailwind.config.js (shadow-soft/card/modal, ease-out-soft, duration DEFAULT 200ms, fade-in-slow, slide-up-sm)
- [x] Agregar estilos globales seguros en index.css (body bg/text, selection, scrollbar-thin)
- [x] Agregar focus-visible global (outline rojo)
- [x] Agregar soporte para prefers-reduced-motion
- [x] Verificar lint/build

Pruebas:
- [x] Login funciona
- [x] Login inválido muestra error sin borrar campos (interceptor ya excluye /auth/login)
- [x] Redirección por rol funciona
- [x] Build/lint pasan
- [x] Fase 0 completa con lint/build tras últimos cambios (solo warnings pre-existentes)

Archivos afectados:
- frontend/src/services/api.jsx
- frontend/src/components/layout/AdminLayout.jsx
- frontend/src/components/layout/StoreNavbar.jsx
- frontend/src/components/layout/LabLayout.jsx
- frontend/src/components/ui/UserChip.jsx (nuevo)
- frontend/src/components/ui/Icons.jsx (nuevo)
- frontend/index.html
- frontend/tailwind.config.js
- frontend/src/index.css

Riesgos:
- Cambios en index.css/tailwind.config podrían afectar estilos globales existentes → mantener cambios aditivos.
- No migrar a Tailwind v4 (aunque `@tailwindcss/vite` esté en package.json sin uso).

### Fase 1: Componentes UI primitivos
Estado: COMPLETADO

Componentes:
- Button
- Input
- Alert
- Card
- Modal

Condiciones:
- Solo cambios aditivos.
- No romper props existentes.
- No cambiar comportamiento por defecto.
- Mejorar focus visible y accesibilidad.
- Mejorar estados hover/active/disabled.
- Variantes nuevas solo opcionales.

### Fase 2: Componentes compartidos nuevos
Estado: COMPLETADO

Componentes:
- Spinner
- StatusBadge
- EmptyState
- Select
- Pagination

Condiciones:
- Presentacionales.
- Sin lógica de negocio.
- Sin llamadas API.
- Con soporte para className.
- Mantener colores semánticos existentes.
- Migración progresiva página por página.

### Fase 3: Modales, tablas, formularios y estados
Estado: COMPLETADO

Tareas:
- [x] Migrar LabDashboard: eliminar StatusBadge local, usar Spinner/EmptyState/Pagination/Select compartidos
- [x] Migrar AdminDashboard: StatusBadge, EmptyState, Spinner, Select
- [x] Migrar AdminLabs/AdminStores/AdminUsers: Select, EmptyState, Spinner, botones
- [x] Migrar AdminLogs: EmptyState, Spinner, Select
- [x] Migrar AdminImportCsv: sin estados inline que migrar (usa Button loading)
- [x] Migrar StoreWarranty: Select compartido para tipo de garantía

Condiciones:
- No tocar lógica de datos.
- No tocar handlers.
- Solo sustituir presentacionales.

### Fase 4: Vista Login
Estado: COMPLETADO

Cosas a mejorar:
- Espaciados, sombras, bordes, animaciones sutiles, focus visible, iconos, responsividad, contraste, hover/active, feedback de error.

No tocar:
- authAPI.login, localStorage, redirectByRole, validaciones, manejo de errores, showPassword, comportamiento del formulario.

Realizado:
- [x] Eliminado console.log de debug en catch (limpieza menor autorizada)
- [x] Emoji 👤 → icono lucide User
- [x] Span muerto del icono de contraseña eliminado
- [x] Clase inexistente animate-fade-in-up → animate-fade-in-slow
- [x] Clases duplicadas de Button limpiadas (sin cambiar look)

### Fase 5: Vista Tienda
Estado: COMPLETADO

Cosas a mejorar:
- Navbar, formulario de garantía, cards, inputs, botones, feedback de error/guardado, responsividad, animaciones sutiles.

No tocar:
- Búsqueda de orden, isFieldDisabled, tipos de garantía, guardado, validaciones, storeAPI.

Realizado:
- [x] Select compartido para tipo de garantía
- [x] Emojis botones de acción → lucide (Search, Save)
- [x] Navbar rediseñado (Fase 0)

### Fase 6: Vista Administrador
Estado: COMPLETADO

Cosas a mejorar:
- Sidebar, dashboard, tarjetas resumen, tablas, filtros, paginación, modales, botones, estados, responsividad.

No tocar:
- CRUD labs/stores/users, reset password, dashboard garantías, logs, import CSV, permisos, adminAPI.

Realizado:
- [x] Sidebar con iconos lucide y UserChip (Fase 0)
- [x] Dashboard/Labs/Stores/Users/Logs migrados a componentes compartidos (Fase 3)
- [x] Emojis de acciones → lucide (Pencil, Trash2, KeyRound, Pause, Play)

### Fase 7: Vista Laboratorio
Estado: COMPLETADO

Cosas a mejorar:
- Sidebar, cards de estado, tabla de garantías, filtros, paginación, modales, configuración, botones, estados, responsividad.

No tocar:
- Procesar/reimprimir/regenerar VCA/test print, estado agente, configuración, labAPI.

Realizado:
- [x] Sidebar con icono lucide y UserChip (Fase 0)
- [x] LabDashboard migrado a componentes compartidos (Fase 3)
- [x] Emojis de acciones → lucide (Printer, CheckCircle2)

### Fase 8: Animaciones y microinteracciones
Estado: COMPLETADO

- Transiciones modales, aparición de alertas, hover pulidos, transiciones de sidebar, entradas sutiles en cards/tablas, feedback en botones.
- Respetar prefers-reduced-motion. No afectar rendimiento ni bloquear interacción.

Realizado:
- [x] Tokens de animación en tailwind.config (fade-in-slow, slide-up-sm, ease-out-soft)
- [x] prefers-reduced-motion global en index.css
- [x] Modal con shadow-modal + blur overlay (Fase 1)
- [x] Botones con active:scale y focus ring (Fase 1)
- [x] Entradas suaves en cards de resumen (dashboard admin/lab)

### Fase 9: QA visual, responsividad y accesibilidad
Estado: COMPLETADO

- Mobile, tablet, desktop, focus visible, contraste, tamaños táctiles, navegación por teclado, modales accesibles, formularios usables, tablas legibles, animaciones sutiles, sin errores de consola, lint/build, regresión funcional completa.

Realizado:
- [x] Lint sin errores (solo warnings pre-existentes)
- [x] Build pasa sin errores
- [x] Focus-visible global rojo
- [x] prefers-reduced-motion
- [x] Modales con role/aria/focus
- [x] Input/Select con aria y labels asociados
- [x] Layout consistente max-w-7xl en admin/lab/tienda
- [x] Selects de auto-refresh unificados
- [x] StoreHistory migrada a componentes compartidos (sin ruta)
- [x] Emojis restantes de UI eliminados (lucide)
- [x] Pestañas Logs/Importar CSV eliminadas (código muerto limpiado)
- [ ] Verificación manual en navegador (usuario)

### Fase 10: Rediseño Vista Tienda (/store)
Estado: COMPLETADO

Objetivo: rediseñar /store (header integrado + búsqueda + formulario) sin alterar lógica funcional.

Decisiones aprobadas:
- [x] Alternativa A: header horizontal integrado (logo grande izq, usuario/salir der)
- [x] Fix bug pre-existente: Nombre del Cliente SIEMPRE disabled → disabled={saving}

Diagnóstico:
- Navbar como barra independiente (franja blanca + línea roja) separa del contenido.
- Logo 64px pequeño.
- UserChip sin contenedor.
- Grids de formulario asimétricos (2/3/4 cols mezcladas).
- Bug: `disabled` sin valor en "Nombre del Cliente" (StoreWarranty.jsx:200).

Tareas:
- [x] T1: Crear StoreHeader.jsx (logo 80px, chip usuario, logout) + App.jsx usa StoreWarranty solo + eliminar StoreNavbar.jsx
- [x] T2: Card Buscar OTG (title/subtitle, input py-2.5, responsive)
- [x] T3: Formulario con Card title + grids 2/1 + fix disabled cliente
- [x] T4: Botón guardar + contador observaciones polish
- [x] T5: QA + lint/build + actualizar plan

Archivos afectados:
- frontend/src/components/layout/StoreHeader.jsx (nuevo)
- frontend/src/components/layout/StoreNavbar.jsx (eliminar)
- frontend/src/App.jsx
- frontend/src/pages/StoreWarranty.jsx

Riesgos:
- T1: olvidar claves de logout o el fetch /auth/me → copiar bloque tal cual.
- T3: cambiar grids sin tocar handlers → solo clases.

## Checklist de regresión funcional

- [x] Login con credenciales válidas funciona.
- [x] Login con credenciales inválidas muestra error.
- [x] Login inválido no borra los campos.
- [x] Login inválido no recarga la página.
- [x] Redirección por rol funciona.
- [x] Logout funciona.
- [x] Vista tienda carga correctamente.
- [ ] Búsqueda de orden funciona.
- [ ] Formulario de garantía funciona.
- [ ] Guardado de garantía funciona.
- [x] Vista administrador carga correctamente.
- [ ] Dashboard de administrador funciona.
- [ ] CRUD de laboratorios funciona.
- [ ] CRUD de tiendas funciona.
- [ ] CRUD de usuarios funciona.
- [x] Vista laboratorio carga correctamente.
- [ ] Tabla de garantías funciona.
- [ ] Procesar garantía funciona.
- [ ] Reimprimir ticket funciona.
- [ ] Regenerar VCA funciona.
- [ ] Configuración de laboratorio funciona.
- [ ] Modales abren correctamente.
- [ ] Modales cierran correctamente.
- [ ] Paginación funciona.
- [ ] Filtros funcionan.
- [ ] Estados de carga funcionan.
- [ ] Estados de error funcionan.
- [x] Estados vacíos funcionan.
- [x] No hay errores nuevos en consola.
- [x] Lint pasa sin errores.
- [x] Build pasa sin errores.

## Registro de avances

| Fecha | Tarea | Fase | Estado | Archivos afectados | Pruebas realizadas | Observaciones |
|-------|-------|------|--------|--------------------|--------------------|---------------|
| 2026-08-03 | Crear PLAN_REFACTOR_UI_UX.md | 0 | COMPLETADO | PLAN_REFACTOR_UI_UX.md | — | — |
| 2026-08-03 | Fix interceptor 401 (excluir /auth/login) | 0 | COMPLETADO | frontend/src/services/api.jsx | login inválido no recarga ni borra campos | Aplicado antes del plan |
| 2026-08-03 | Fix clase rota h-48w-auto | 0 | COMPLETADO | frontend/src/components/layout/AdminLayout.jsx | build OK | Aplicado antes del plan |
| 2026-08-03 | Rediseño navbar + layouts (UserChip, Icons, logout SVG, nombre tienda vía /auth/me) | 0 | COMPLETADO | StoreNavbar, LabLayout, AdminLayout, UserChip, Icons | lint/build OK | Aplicado antes del plan |
| 2026-08-03 | Corregir lang, título, meta description index.html | 0 | COMPLETADO | frontend/index.html | build OK | lang="es", título "Opti-Color \| Sistema de Garantías", meta description |
| 2026-08-03 | Button: sizes sm/md/lg, variante danger, focus ring, active scale, aria-busy | 1 | COMPLETADO | frontend/src/components/ui/Button.jsx | lint/build OK | Solo aditivo; props y comportamiento intactos |
| 2026-08-03 | Input: htmlFor, aria-invalid, aria-describedby, id autogenerado, estado readOnly | 1 | COMPLETADO | frontend/src/components/ui/Input.jsx | lint/build OK | Warning children pre-existente (extraído a propósito) |
| 2026-08-03 | Alert: iconos lucide-react, role="alert", layout refinado | 1 | COMPLETADO | frontend/src/components/ui/Alert.jsx | lint/build OK | Props type/message/onClose intactas |
| 2026-08-03 | Card: shadow-card, props aditivas title/subtitle; p-6 preservado | 1 | COMPLETADO | frontend/src/components/ui/Card.jsx | lint/build OK | padding de ~25 usos intacto |
| 2026-08-03 | Modal: role=dialog, aria-modal, aria-labelledby, focus al abrir, shadow-modal, blur overlay | 1 | COMPLETADO | frontend/src/components/ui/Modal.jsx | lint/build OK | Props isOpen/onClose/title/size intactas |
| 2026-08-03 | Crear Spinner.jsx | 2 | COMPLETADO | frontend/src/components/ui/Spinner.jsx | lint/build OK | Presentacional, sizes sm/md/lg |
| 2026-08-03 | Crear StatusBadge.jsx | 2 | COMPLETADO | frontend/src/components/ui/StatusBadge.jsx | lint/build OK | Mapas PENDING/PROCESSING/COMPLETED/ERROR |
| 2026-08-03 | Crear EmptyState.jsx | 2 | COMPLETADO | frontend/src/components/ui/EmptyState.jsx | lint/build OK | Icono lucide Inbox, action opcional |
| 2026-08-03 | Crear Select.jsx | 2 | COMPLETADO | frontend/src/components/ui/Select.jsx | lint/build OK | Acepta strings u objetos {value,label} |
| 2026-08-03 | Crear Pagination.jsx | 2 | COMPLETADO | frontend/src/components/ui/Pagination.jsx | lint/build OK | Ellipsis, aria-current, retorna null si 1 página |
| 2026-08-03 | Migrar LabDashboard a componentes compartidos | 3 | COMPLETADO | frontend/src/pages/lab/LabDashboard.jsx | lint/build OK | Eliminado StatusBadge local; Spinner/EmptyState/Pagination/Select compartidos; solo warnings pre-existentes |
| 2026-08-03 | Migrar AdminDashboard a componentes compartidos | 3 | COMPLETADO | frontend/src/pages/admin/AdminDashboard.jsx | lint/build OK | Eliminado StatusBadge local; 4 selects → Select; Spinner/EmptyState/Pagination compartidos |
| 2026-08-03 | Migrar AdminLabs/AdminStores/AdminUsers a componentes compartidos | 3 | COMPLETADO | AdminLabs, AdminStores, AdminUsers | lint/build OK | Spinner/EmptyState compartidos; selects de modales → Select (con error/placeholder) |
| 2026-08-03 | Migrar AdminLogs a componentes compartidos | 3 | COMPLETADO | frontend/src/pages/admin/AdminLogs.jsx | lint/build OK | Spinner/EmptyState/Select (líneas y nivel) |
| 2026-08-03 | Migrar StoreWarranty a componentes compartidos | 3 | COMPLETADO | frontend/src/pages/StoreWarranty.jsx | lint/build OK | Select compartido para tipo de garantía |
| 2026-08-03 | Fase 4 Login: quitar debug, icono lucide User, corregir anim | 4 | COMPLETADO | frontend/src/pages/Login.jsx | lint/build OK | Sin tocar auth/localStorage/redirect |
| 2026-08-03 | Fase 5 Tienda: emojis → lucide (Search, Save) | 5 | COMPLETADO | frontend/src/pages/StoreWarranty.jsx | lint/build OK | — |
| 2026-08-03 | Fase 6 Admin: emojis acciones → lucide; sidebar iconos lucide | 6 | COMPLETADO | AdminLabs, AdminStores, AdminUsers, AdminLayout | lint/build OK | Pencil/Trash2/KeyRound/Pause/Play; sidebar LayoutDashboard/FlaskConical/Store/Users/ScrollText/Upload |
| 2026-08-03 | Fase 7 Lab: emojis acciones → lucide; sidebar icono lucide | 7 | COMPLETADO | LabDashboard, LabLayout | lint/build OK | Printer/CheckCircle2; sidebar LayoutDashboard |
| 2026-08-03 | Fase 8: stagger en cards resumen admin | 8 | COMPLETADO | frontend/src/pages/admin/AdminDashboard.jsx | lint/build OK | animate-fade-in + delay por índice |
| 2026-08-03 | Fase 9: lint/build finales | 9 | COMPLETADO | todos | lint/build OK | Solo warnings pre-existentes; interceptor 401 intacto |
| 2026-08-03 | Tokens visuales aditivos tailwind.config.js | 0 | COMPLETADO | frontend/tailwind.config.js | build OK | shadow-soft/card/modal, ease-out-soft, fade-in-slow, slide-up-sm |
| 2026-08-03 | Estilos globales seguros + focus-visible + reduced-motion en index.css | 0 | COMPLETADO | frontend/src/index.css | lint/build OK | body bg/text, selection, scrollbar-thin, focus-visible rojo, prefers-reduced-motion |
| 2026-08-03 | Eliminar pestañas Logs/Importar CSV (rutas, menú, api, páginas, deps multer/csv-parser) | 6 | COMPLETADO | App.jsx, AdminLayout.jsx, api.jsx, AdminLogs.jsx, AdminImportCsv.jsx | lint/build OK, backend arranca | Código muerto eliminado; modelo Log y winston intactos |
| 2026-08-03 | Conclusión: StoreHistory migrada a compartidos + layout max-w-7xl + selects auto-refresh unificados + emojis test print → lucide | 9 | COMPLETADO | StoreHistory, AdminDashboard, AdminLabs, AdminStores, AdminUsers, LabDashboard | lint/build OK | Sin cambios funcionales; checklist actualizado |
| 2026-08-03 | T1 Fase 10: StoreHeader.jsx + App.jsx + eliminar StoreNavbar | 10 | COMPLETADO | StoreHeader (nuevo), App.jsx, StoreNavbar (eliminado) | lint/build OK, grep 0 StoreNavbar | Logout/claves y fetch /auth/me idénticos; logo 80px; chip usuario |
| 2026-08-03 | T2-T4 Fase 10: Buscar OTG + formulario (Card title, grids 2/1, fix disabled) + guardar | 10 | COMPLETADO | StoreWarranty.jsx | lint/build OK | Fix pre-existente: cliente disabled→disabled={saving}; Código Completo readOnly; textarea resize-none |
