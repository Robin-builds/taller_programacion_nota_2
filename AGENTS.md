
# 🤖 AGENTS.md — Contexto Persistente del Proyecto
**Pegar al inicio de CADA sesión de implementación.**
**Última actualización:** Mayo 2026 — Fase 10 completa (gestión de usuarios)

---

## ⚙️ COMANDOS

```bash
# En Windows usar gradlew.bat (NO ./gradlew — es script Unix)
gradlew.bat assembleDebug         # build APK debug
gradlew.bat installDebug          # instalar en dispositivo
gradlew.bat test                  # unit tests
gradlew.bat connectedAndroidTest  # tests instrumentados
gradlew.bat lint                  # lint
gradlew.bat clean                 # limpiar build
```

---

## 🎯 PROYECTO

**Nombre:** StockFlow (package: `cl.stockflow.warehouse`)
**Tipo:** Micro-SaaS de inventario para pequeñas empresas chilenas
**Estado:** Fases 0–10 completas. Siguiente: Fase 7 (Pulido UI).

---

## 🛠️ STACK EXACTO (no asumir versiones)

```
Kotlin:              2.0.21
AGP:                 8.13.2
JDK:                 11
Min SDK:             27 (Android 8.1)
Target SDK:          36 (Android 16)
Compile SDK:         36
Compose BOM:         2024.09.00
KSP:                 2.0.21-1.0.28
Room:                2.6.1
Hilt:                2.50 + hilt-navigation-compose:1.1.0 + hilt-work:1.2.0
Navigation Compose:  2.7.6
Supabase BOM:        1.4.6  (postgrest-kt, realtime-kt, auth-kt)
Ktor Client:         2.3.7  (ktor-client-android)
Coroutines:          1.7.3 + kotlinx-coroutines-test:1.7.3
Lifecycle:           2.7.0
Activity Compose:    1.8.1
WorkManager:         work-runtime-ktx:2.9.1
Gson:                2.10.1
mockk:               1.13.12  (testImplementation)
```

---

## 🏗️ ARQUITECTURA

**Patrón:** Clean Architecture

```
ui/
  auth/         → LoginScreen, RegistroScreen, AuthViewModel
  dashboard/    → DashboardScreen
  productos/    → ProductosListScreen, ProductoViewModel
  movimientos/  → MovimientosScreen, MovimientoViewModel
  alertas/      → AlertasScreen, AlertasViewModel
  bodegas/      → BodegasScreen, BodegaViewModel
  atributos/    → AtributosScreen, AtributoViewModel
  usuarios/     → UsuariosScreen, UsuariosViewModel
domain/
  model/        → SesionUsuario, Usuario, Bodega, Producto, AtributoTemplate, Rol, TipoAtributo
data/
  local/
    entity/     → 9 entidades Room (incluye AuthSessionEntity, AtributoTemplateEntity, ProductoAtributoEntity)
    dao/        → 10 DAOs
    AppDatabase.kt  (versión 6)
    DateConverters.kt
  remote/       → SupabaseClient
  sync/         → SyncWorker, PullWorker, SyncTrigger, PullTrigger, SyncPayloads, PullDtos
  repository/   → AuthRepository, ProductoRepository, MovimientoRepository,
                   BodegaRepository, UsuarioRepository, AtributoRepository
di/             → DatabaseModule
```

**Multi-tenancy:** JWT custom claims (`empresa_id` en `app_metadata`)
→ RLS en Supabase filtra por empresa automáticamente
→ El código Kotlin NO filtra manualmente por empresa_id

**Roles:** Enum `Rol` (`ADMIN`, `OPERADOR`) — control de acceso solo en UI/Android, no en RLS
→ `rol` persiste en `AuthSessionEntity` (leído de tabla `usuarios` en login)
→ Solo ADMIN puede crear/eliminar bodegas y atributos; OPERADOR solo selecciona bodega activa
→ El primer usuario de cada empresa es ADMIN (asignado por RPC `registrar_empresa`)

**Auth:** Supabase Auth — Token + `empresa_id` + `bodega_id` guardados en Room (`auth_sessions`)
→ Al abrir app: si hay sesión en Room → Dashboard, si no → Login
→ Registro vía RPC `registrar_empresa` (SECURITY DEFINER): empresa + usuario ADMIN + bodega "Bodega Principal"
→ `checkSession()` valida `expires_at`; si expiró → limpia Room → re-login (refresh JWT es deuda técnica)

**Decisiones críticas:**
- `PRAGMA foreign_keys = OFF` — Room es caché offline-first; integridad la garantiza Supabase (evita error 787)
- `MovimientoEntity.nota`: nullable en DB, obligatoria en repositorio. Excepción: stock inicial en `ProductoRepository.crear()` usa `nota = "Stock inicial"` directo al DAO — **no crear dependencia circular con MovimientoRepository**
- `precio: Int` en toda la cadena (CLP sin decimales). `ProductoDto.precio: Double` tolera `20000.00` de PostgREST → `.toInt()` en `toEntity()`
- `*Entity` nunca sale de la capa `data/` — la UI solo conoce objetos de dominio
- `ProductoConStock` se mantiene como tipo interno de Room (JOIN); `.toDomain()` es el puente
- `Bodega.esActiva` lo setea `BodegaRepository` — nunca la UI ni el ViewModel
- `Usuario.rol` se lee de `AuthSessionEntity` (login value) — no de `UsuarioEntity` (pull value, puede divergir)
- MVP de atributos: solo tipo `TEXT` — `NUMBER` y `DATE` existen en enum pero no en UI
- `UsuarioRepository.eliminar/cambiarRol` usan REST directo (Ktor PATCH/DELETE) sin pasar por SyncWorker — operaciones síncronas críticas que no admiten cola offline

---

## 🗄️ MODELO DE DATOS (9 entidades, 5 niveles)

```
Nivel 0: EmpresaEntity
Nivel 1: UsuarioEntity, BodegaEntity, ProveedorEntity, AtributoTemplateEntity  (FK → empresa)
Nivel 2: ProductoEntity                                                          (FK → empresa + bodega)
Nivel 3: MovimientoEntity (FK → producto) — INMUTABLE
         ProductoAtributoEntity (FK → producto + template) — PK compuesta
Nivel 4: SyncEntity
```

**Regla crítica de stock** — nunca almacenar, siempre calcular:
```sql
SELECT COALESCE(SUM(cantidad), 0) FROM movimientos WHERE producto_id = :id
```

**Campos obligatorios en TODAS las entidades:**
```kotlin
val synced: Boolean = false
val synced_at: Date? = null
val created_at: Date = Date()
val updated_at: Date = Date()
```

---

## 🔐 PATRÓN DE ERRORES

```kotlin
// Repository → Result<T> | ViewModel → StateFlow<UiState> | UI → observa, nunca llama suspend directo
sealed class UiState<out T> {
    object Loading : UiState<Nothing>()
    data class Success<T>(val data: T) : UiState<T>()
    data class Error(val message: String) : UiState<Nothing>()
}
```

---

## 📐 CONVENCIONES

```
Variables:   español (nombre_producto, no productName)
Comentarios: español
Commits:     inglés semántico (feat:, fix:, refactor:)
Logs:        Timber (no Log.d)
Tablas SQL:  plural minúsculas (empresas, productos, movimientos)
PKs:         String UUID (viene de Supabase)
```

---

## 📁 DOCUMENTACIÓN DE REFERENCIA

`C:\Users\Windows 11\Documents\dev\manegenet_inventory_MSaas_v0.0.1\documentacion\`

```
03_DEFINITION_OF_DONE.md      → Checklist por feature (LEER antes de cada fase)
04_GIT_WORKFLOW.md             → Ramas, commits semánticos, releases
05_SYNC_ALGORITHM_DETAILED.md → Algoritmo offline-first
IMPLEMENTATION_PLAN.md         → Plan de sesiones atómicas
DEVELOPMENT_LOG.md             → Estado actual del proyecto
HUECOS_Y_SOLUCIONES.md        → Decisiones y problemas resueltos
```

---

## 📊 ESTADO ACTUAL

```
FASE 0 (Setup):                       ✅ Completa
FASE 1 (Auth):                        ✅ Completa
FASE 2 (Productos CRUD):              ✅ Completa
FASE 3 (Movimientos):                 ✅ Completa
FASE 4 (Alertas):                     ✅ Completa
FASE 5A (Sync push):                  ✅ Completa — validada en dispositivo físico
FASE 5B (Sync pull):                  ✅ Completa — validada en dispositivo físico (2 cuentas)
FASE 6 (Multi-bodega + Roles):        ✅ Completa — validada en dispositivo físico
FASE 7 (Pulido UI):                   ☐ Pendiente
FASE 8 S1-S5 (Dom. rico + Atributos): ✅ Completa — 50 unit tests verdes
FASE 9 S1 (Config. atributos UI):     ✅ Completa — validada en dispositivo físico
FASE 9 S2 (Form. producto atributos): ✅ Completa — 4 unit tests verdes — validada
FASE 9 S3 (Sync push atributos):      ✅ Completa — validada en dispositivo físico
FASE 9 S4 (Pull atributos):           ✅ Completa — validada en 2 dispositivos (sync demostrado)
FASE 10 S1 (Reg. usuario en empresa): ✅ Completa — Edge Function deployada + AuthRepository
FASE 10 S2 (UsuariosScreen ADMIN):    ✅ Completa — validada en 2 dispositivos físicos
FASE 7 (Pulido UI):                   ☐ Pendiente
WHATSAPP (Notif.):                    ☐ Pendiente — requiere aprobación Meta
```

**Tests unitarios acumulados:** 50/50 verdes
→ Fase 8 S1: Usuario (12) · S2: Bodega (9) · S3+S4: Producto (14) · S5: Atributos (10) · Fase 9 S2: Form (4) + ExampleUnit (1)

**Rama activa:** `dev-rich-domain`
**Último commit:** feat: Phase 10 S2 — UsuariosScreen for ADMIN user management

---

## 🗺️ ROADMAP — Fase 9 ✅ Completa

**Objetivo:** UI completa para atributos personalizables — logrado.

---

### S2 — Formulario de producto con atributos dinámicos ✅

**Qué hace:** Al crear/editar un producto, mostrar un campo por cada `AtributoTemplate` de la empresa. Al guardar, persistir valores en `ProductoAtributoEntity`.

**Archivos a modificar:**
- `data/repository/ProductoRepository.kt`
  - `crear(..., atributos: Map<String, String> = emptyMap())` — tras crear producto, llama `productoAtributoDao.upsertAll()`
  - `actualizar(..., atributos: Map<String, String> = emptyMap())` — igual
- `ui/productos/ProductoViewModel.kt`
  - Inyectar `AtributoRepository`
  - `FormState` agrega `templates: List<AtributoTemplate>` y `atributos: Map<String, String>`
  - `cargarAtributos(productoId)` — pre-llena valores al abrir edición
  - Pasar `atributos` al `crear/actualizar` del repositorio
- `ui/productos/ProductosListScreen.kt` (dialog crear/editar)
  - Cargar templates al abrir dialog
  - Renderizar un `OutlinedTextField` por template (solo tipo TEXT en MVP)
  - Marcar obligatorios con asterisco; bloquear guardado si obligatorio vacío

**Tests:** `ProductoAtributosFormTest` — crear con atributos, editar pre-llena valores, obligatorio vacío no guarda.
**DoD:** Crear producto con atributos → visibles en detalle. Editar → campos pre-llenados correctamente.
**Commit:** `feat: Phase 9 S2 — product form with dynamic attribute fields`

---

### S3 — Sync push para atributos ✅

**Qué hace:** `AtributoRepository.crear/eliminar` encola en `SyncEntity`. `SyncWorker` procesa contra tablas `atributo_templates` y `producto_atributos` en Supabase.

**Prerequisito:** Tablas `atributo_templates` y `producto_atributos` creadas en Supabase (migración SQL manual).
**Commit:** `feat: Phase 9 S3 — sync push for atributo_templates and producto_atributos`

---

### S4 — Pull para atributos ✅

**Qué hace:** Extiende `PullWorker` con GET a `atributo_templates` y `producto_atributos`; `upsertAll` en sus DAOs.

**Prerequisito:** S3 completo (tablas en Supabase con datos reales).
**Commit:** `feat: Phase 9 S4 — pull worker extended for attribute tables`

---

## 🗺️ ROADMAP — Fase 10: Gestión de usuarios

**Objetivo:** ADMIN puede registrar usuarios adicionales (OPERADOR) en su empresa sin depender de otra cuenta.

**Restricción técnica:** Supabase Admin API no está disponible en el cliente mobile → se usa **Edge Function** con `SUPABASE_SERVICE_ROLE_KEY` server-side.
**Por qué NO RPC:** Insertar en `auth.users` directamente no setea `app_metadata.empresa_id` → JWT del nuevo usuario no tiene `empresa_id` → RLS falla silenciosamente.

---

### S1 — Edge Function `registrar-usuario-empresa` ✅

**Edge Function desplegada:** `supabase/functions/registrar-usuario-empresa/index.ts`

**Flujo:**
1. ADMIN logueado llama `AuthRepository.registrarUsuarioEnEmpresa(email, password, nombre)`
2. Ktor POST a `/functions/v1/registrar-usuario-empresa` con JWT del ADMIN como Bearer
3. Edge Function: verifica ADMIN rol → `admin.createUser()` con `app_metadata: { empresa_id }` → INSERT en `public.usuarios` → rollback si INSERT falla
4. Retorna `{ user_id }` al Android

**Android implementado:**
- `AuthRepository.registrarUsuarioEnEmpresa(email, password, nombre): Result<String>` — llama Edge Function via Ktor
- `AuthViewModel.registrarUsuarioEnEmpresa(email, password, nombre, onResult)` — wrapper con estado Loading

**DoD:**
```
✅ ADMIN puede registrar un OPERADOR desde UsuariosScreen
✅ El OPERADOR registrado puede hacer login inmediatamente
✅ El OPERADOR ve el inventario de la empresa del ADMIN (RLS correcto via app_metadata)
✅ El OPERADOR NO puede crear/eliminar bodegas ni atributos (control de rol en UI)
✅ Si email ya existe → error claro desde Edge Function
✅ Si INSERT falla → rollback automático (no quedan usuarios huérfanos)
✅ Validación física: ADMIN registra OPERADOR, OPERADOR hace login en segundo dispositivo
```
**Commit:** `feat: Phase 10 S1 — register-user Edge Function + AuthRepository`

---

### S2 — UsuariosScreen (ADMIN) ✅

**Qué hace:** ADMIN ve la lista de usuarios de su empresa y puede registrar nuevos, cambiarles el rol o eliminarlos.

**Archivos creados:**
- `ui/usuarios/UsuariosScreen.kt` + `UsuariosViewModel.kt`

**Archivos modificados:**
- `data/repository/UsuarioRepository.kt` — `observarUsuariosDeEmpresa()`, `eliminar()`, `cambiarRol()`, `insertarLocal()`
- `DashboardScreen.kt` — botón "Gestionar usuarios" visible solo para ADMIN
- `MainActivity.kt` — ruta `usuarios`

**DoD:** ✅ validado en 2 dispositivos físicos
**Commit:** `feat: Phase 10 S2 — UsuariosScreen for ADMIN user management`

---

## 🗺️ Features futuras

| Feature | Prerequisito | Notas clave |
|---|---|---|
| 📷 Escaneo QR/barcode | ninguno | ML Kit Barcode; integra en campo SKU del form de producto |
| 💬 WhatsApp notif. | Sync + aprobación Meta | Edge Function en Supabase; cero impacto código Android |
| 🗂️ Selección masiva | ninguno | Multi-select en `ProductosListScreen`; útil para transferencias entre bodegas |
| 🌐 Dashboard web | Sync completo | Next.js + Supabase JS; misma RLS, sin trabajo backend adicional |
| 🔄 JWT refresh | deuda técnica | Refresh token con cliente Supabase; actualmente logout forzado al expirar |

---

## 🧪 Últimas pruebas físicas

| Fase | Dispositivo / resultado | Bugs encontrados |
|---|---|---|
| 5B Sync pull final | Samsung S25 FE, 2 cuentas ✅ | Plugin serialización, precio Double→Int, Room FK migration (todos resueltos) |
| 8 S3+S4 Producto dom. | productos ✅ movimientos ✅ alertas ✅ bodegas ✅ | ninguno |
| 8 S5 Atributos infra. | Room v5→v6 ✅ inventario existente ✅ | ninguno |
| 9 S1 Config. atributos | ADMIN ✅ OPERADOR ✅ crear/eliminar ✅ | ninguno |
| 9 S2 Form. producto atributos | crear con atributos ✅ editar pre-llena ✅ obligatorio bloquea ✅ | ninguno |
| 9 S3 Sync push atributos | template crea/elimina en Supabase ✅ valores producto sincronizan ✅ | ninguno |
| 10 S2 UsuariosScreen | ADMIN registra OPERADOR ✅ OPERADOR login ✅ rol UI correcto ✅ cambiar rol ✅ eliminar ✅ | ninguno |

---

## ✅ INSTRUCCIONES PARA Codex

1. **No asumir** nada que no esté en este archivo o en los contratos pegados
2. **Un archivo por sesión** — si el scope crece, parar y preguntar
3. **Respetar nombres** — español para variables, inglés para commits
4. **No filtrar por empresa_id** en código Kotlin — RLS lo hace
5. **Stock siempre por query** — nunca campo mutable en ProductoEntity
6. **Si hay duda sobre un contrato** — preguntar antes de asumir
7. **Validación física obligatoria entre fases** — sugerir pruebas en dispositivo, esperar confirmación antes de proponer la siguiente fase; BUILD SUCCESSFUL no es suficiente
