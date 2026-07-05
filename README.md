# PasajeYá — Frontend

Aplicación web SPA para buscar y comparar precios de vuelos nacionales del Perú, crear
alertas de precio y gestionar el perfil de usuario. Consume la API REST del
[backend PasajeYá](../pasaje-ya-backend).

> Proyecto académico — Universidad Tecnológica del Perú (UTP), Ciclo 6, curso **Integrador de Sistemas Software**.

---

## 📋 Tabla de contenidos

- [Cuadro de accesos y rutas](#-cuadro-de-accesos-y-rutas)
- [Tecnologías utilizadas](#-tecnologías-utilizadas)
- [Arquitectura](#-arquitectura)
- [Requisitos previos](#-requisitos-previos)
- [Puesta en marcha](#-puesta-en-marcha)
- [Pruebas (Testing)](#-pruebas-testing)

---

## 🔐 Cuadro de accesos y rutas

El acceso se controla con **`authGuard`**, que valida la presencia y vigencia del JWT
emitido por el backend. Los permisos por rol (`usuario_free`, `usuario_premium`, `admin`)
provienen del token y se corresponden con los definidos en el
[`script.sql` del backend](../pasaje-ya-backend/src/main/resources/script.sql).

| Ruta | Componente | ¿Requiere sesión? | Notas por rol |
|---|---|:---:|---|
| `/` | Home | ❌ Público | Búsqueda de vuelos |
| `/auth` | Auth | ❌ Público | Login / registro |
| `/resultados` | Resultados | ❌ Público | Listado de vuelos encontrados |
| `/detalle/:id` | Detalle | ❌ Público | Detalle y tarifas de un vuelo |
| `/dashboard` | Dashboard | ✅ `authGuard` | Requiere sesión iniciada |
| `/alertas` | Alertas | ✅ `authGuard` | `free`: máx. 3 · `premium`: ilimitadas |
| `/perfil` | Perfil | ✅ `authGuard` | Datos del usuario y suscripción |
| `**` | — | — | Redirige a `/` |

> Los **reportes Excel/PDF** de alertas y la **predicción extendida (15 días)** son
> funciones **premium**: el backend responde con error si un `usuario_free` las solicita, y
> el frontend muestra el **modal de upgrade** (`upgrade-modal`).

### Usuarios de prueba (semilla del backend)

Los tres comparten la misma contraseña de prueba: **`Marco1415@`**
(definida en el `script.sql`):

| Email | Contraseña | Rol | Plan |
|---|---|:---:|---|
| `admin@pasajeya.com.pe` | `Marco1415@` | `admin` | — |
| `enrique.pdg@gmail.com` | `Marco1415@` | `usuario_free` | Free |
| `renrique_prada@hotmail.com` | `Marco1415@` | `usuario_premium` | Premium Anual |

---

## 🛠 Tecnologías utilizadas

| Categoría | Tecnología | Versión |
|---|---|---|
| Framework | Angular (standalone components) | 21.2 |
| Lenguaje | TypeScript | 5.9 |
| Programación reactiva | RxJS | 7.8 |
| Autenticación | JWT (token en `localStorage`) + HTTP interceptor | — |
| Build / CLI | Angular CLI + `@angular/build` | 21.2 |
| **Pruebas** | **Vitest** + jsdom | 4.0 / 28.0 |
| Formato de código | Prettier | 3.8 |
| Gestor de paquetes | npm | 10.9.3 |

---

## 🏗 Arquitectura

Estructura basada en **componentes standalone** y lazy loading de rutas:

```
src/app/
├── core/
│   ├── guards/         → authGuard (protege rutas, valida expiración del JWT)
│   ├── interceptors/   → auth.interceptor (adjunta el Bearer token a cada petición)
│   ├── services/       → auth, vuelo, aeropuerto, alerta, perfil, modales
│   └── models/         → interfaces (vuelo, alerta)
├── features/           → páginas: home, auth, dashboard, resultados,
│                          detalle, alertas, perfil
├── shared/components/  → navbar, footer, calendario, modales (login, upgrade, confirm)
├── app.routes.ts       → definición de rutas + guards
└── app.config.ts       → providers globales (router, http, interceptor)
```

- **`auth.interceptor`** adjunta automáticamente el JWT (`Authorization: Bearer <token>`)
  a las peticiones al backend.
- **`authGuard`** protege las rutas privadas y **redirige a `/auth`** si no hay token o si
  el JWT ya expiró (decodifica el claim `exp`).

---

## ✅ Requisitos previos

- **Node.js** (compatible con Angular 21)
- **npm 10.9.3**
- El [backend PasajeYá](../pasaje-ya-backend) corriendo en `http://localhost:8080`

---

## 🚀 Puesta en marcha

```bash
# 1. Instalar dependencias
npm install

# 2. Servidor de desarrollo
npm start          # equivale a: ng serve
```

La aplicación queda disponible en `http://localhost:4200/` y recarga automáticamente al
guardar cambios.

```bash
# Compilar para producción
npm run build      # artefactos en dist/
```

---

## 🧪 Pruebas (Testing)

Las pruebas unitarias se ejecutan con **Vitest** (sobre jsdom):

```bash
npm test           # equivale a: ng test
```

Los archivos de prueba usan la extensión `.spec.ts` (por ejemplo,
[`src/app/app.spec.ts`](src/app/app.spec.ts)) y se ubican junto al código que verifican.

---

<p align="center"><sub>PasajeYá · Proyecto académico UTP 2026 · Curso Integrador de Sistemas Software</sub></p>
