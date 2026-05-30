# StoreFlow 📦

**StoreFlow** es una aplicación móvil Android de gestión de inventario pensada para pequeñas empresas chilenas. Permite controlar stock, movimientos de productos y múltiples bodegas desde el celular, con sincronización en la nube en tiempo real.

---

## ¿Qué problema resuelve?

Las pequeñas empresas suelen gestionar su inventario en hojas de Excel o incluso en papel, lo que genera errores, pérdidas y falta de visibilidad. StoreFlow ofrece una solución simple, rápida y accesible desde cualquier dispositivo Android.

---

## Funcionalidades principales

| Feature | Descripción |
|---|---|
| 🔐 Autenticación | Login y registro de empresa con Supabase Auth |
| 📦 Productos | CRUD completo con SKU, precio, descripción y stock en tiempo real |
| 📷 Escaneo QR/Barcode | Escaneo de código de barras para buscar o crear productos |
| 📊 Movimientos | Registro de entradas, salidas y transferencias entre bodegas |
| 🏭 Multi-bodega | Gestión de múltiples bodegas por empresa |
| 🚨 Alertas de stock | Notificaciones cuando un producto cae bajo el mínimo definido |
| 👥 Gestión de usuarios | El ADMIN puede registrar operadores en su empresa |
| 🌐 Dashboard web | Panel de control en la web con exportación CSV |
| ☀️🌙🌑 Temas | Modo claro, oscuro y negro — persiste entre sesiones |
| 📤 Compartir inventario | Exporta y comparte el stock por WhatsApp o cualquier app |
| 🔄 Sync offline-first | Los cambios se guardan localmente y sincronizan al recuperar conexión |

---

## Stack tecnológico

```
Lenguaje:       Kotlin 2.0.21
UI:             Jetpack Compose (BOM 2024.09.00)
Arquitectura:   Clean Architecture + MVVM
Base de datos:  Room 2.6.1 (local) + Supabase PostgreSQL (nube)
Auth:           Supabase GoTrue (JWT)
Sync:           WorkManager 2.9.1
DI:             Hilt 2.50
Navegación:     Navigation Compose 2.7.6
HTTP:           Ktor Client 2.3.7
Min SDK:        27 (Android 8.1)
Target SDK:     36 (Android 16)
```

---

## Arquitectura del proyecto

```
StoreFlow/
├── app/src/main/java/cl/storeflow/warehouse/
│   ├── ui/                 # Pantallas y ViewModels (Compose)
│   │   ├── auth/           # Login, Registro
│   │   ├── dashboard/      # Pantalla principal
│   │   ├── productos/      # Lista y formulario de productos
│   │   ├── movimientos/    # Registro de movimientos
│   │   ├── bodegas/        # Gestión de bodegas
│   │   ├── alertas/        # Alertas de stock bajo
│   │   ├── usuarios/       # Gestión de usuarios (solo ADMIN)
│   │   ├── atributos/      # Atributos personalizados de productos
│   │   └── configuracion/  # Tema, soporte, dashboard web
│   ├── domain/
│   │   └── model/          # Entidades de dominio (Producto, Bodega, Usuario…)
│   ├── data/
│   │   ├── local/          # Room: entidades, DAOs, AppDatabase
│   │   ├── remote/         # Cliente Supabase
│   │   ├── repository/     # Repositorios (puente local ↔ remoto)
│   │   └── sync/           # SyncWorker y PullWorker (offline-first)
│   └── di/                 # Módulos Hilt
└── supabase/
    └── functions/          # Edge Functions (registro de usuarios)
```

---

## Multi-tenancy y seguridad

- Cada empresa tiene su propio espacio de datos aislado mediante **Row Level Security (RLS)** en Supabase.
- El `empresa_id` viaja en el JWT como `app_metadata` — el código Kotlin **nunca filtra por empresa** manualmente.
- Roles disponibles: `ADMIN` (gestión completa) y `OPERADOR` (solo consulta y movimientos).

---

## Cómo correr el proyecto

### Requisitos

- Android Studio Hedgehog o superior
- JDK 11
- Dispositivo o emulador con Android 8.1+ (API 27)

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/Robin-builds/taller_programacion_nota_2.git
cd taller_programacion_nota_2

# 2. Crear el archivo local.properties con la ruta del SDK
echo "sdk.dir=C\:\\Users\\TuUsuario\\AppData\\Local\\Android\\Sdk" > local.properties

# 3. Build y run desde Android Studio
# o desde terminal (Windows):
gradlew.bat assembleDebug
gradlew.bat installDebug
```

> **Nota:** La app apunta a un proyecto Supabase ya configurado. Para conectar tu propio backend, edita `SUPABASE_URL` y `SUPABASE_ANON_KEY` en `data/remote/SupabaseClient.kt`.

---

## Dashboard web

El panel web está disponible en producción:

🔗 **https://stockflow-web-eight.vercel.app**

Stack: Next.js · TypeScript · Tailwind CSS · Supabase JS

Funcionalidades: resumen de inventario, listado de productos y movimientos, filtro por bodega, exportación CSV.

---

## Tests

```bash
# Unit tests (50 tests — todos verdes)
gradlew.bat test

# Tests instrumentados (requiere dispositivo/emulador)
gradlew.bat connectedAndroidTest
```

Cobertura por módulo: modelos de dominio, repositorios, formulario de atributos.

---

## Estado del proyecto

El proyecto tiene **Fases 0–10 completas** y validadas en dispositivo físico (Samsung S25 FE).

Ver historial detallado de implementación en [`CLAUDE.md`](./CLAUDE.md).

---

## Autor

**Robin** — [@Robin-builds](https://github.com/Robin-builds)
