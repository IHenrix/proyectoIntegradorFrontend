# PasajeYá — Frontend

Aplicación web SPA para buscar y comparar precios de vuelos nacionales del Perú, crear
alertas de precio, gestionar el perfil de usuario y administrar el sistema completo desde un
panel de administración. Consume la API REST del
[backend PasajeYá](../pasaje-ya-backend).

> Proyecto académico — Universidad Tecnológica del Perú (UTP), Ciclo 6, curso **Integrador de Sistemas Software**.

---

## 📋 Tabla de contenidos

- [Cuadro de accesos y rutas](#-cuadro-de-accesos-y-rutas)
- [Tecnologías utilizadas](#-tecnologías-utilizadas)
- [Arquitectura](#-arquitectura)
- [Panel de administración](#-panel-de-administración)
- [Requisitos previos](#-requisitos-previos)
- [Puesta en marcha](#-puesta-en-marcha)
- [Pruebas (Testing)](#-pruebas-testing)
- [Despliegue en Railway](#-despliegue-en-railway)
- [Bitácora del despliegue real](#-bitácora-del-despliegue-real-paso-a-paso)

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
| `/alertas` | Alertas | ✅ `authGuard` | `free`: máx. 3 · `premium`: ilimitadas |
| `/perfil` | Perfil | ✅ `authGuard` | Datos del usuario y suscripción |
| `/admin` | Admin | ✅ `authGuard` | Panel completo — el backend además exige rol `admin` real vía `@PreAuthorize`, no solo tener sesión iniciada |
| `**` | — | — | Redirige a `/` |

> No existe una ruta `/dashboard` separada: sus métricas se fusionaron dentro de `Home` para
> evitar contenido duplicado entre ambas páginas.
>
> Los **reportes Excel/PDF** de alertas y la **predicción extendida (15 días)** son
> funciones **premium**: el backend responde con error si un `usuario_free` las solicita, y
> el frontend muestra el **modal de upgrade** (`upgrade-modal`).

### Usuarios de prueba (semilla del backend)

Los tres comparten la misma contraseña de prueba: **`Marco1415@`**
(definida en el `script.sql`):

| Email | Contraseña | Rol | Plan |
|---|---|:---:|---|
| `admin@pasajeya.com.pe` | `Marco1415@` | `admin` | — |
| `enrique.pdg@outlook.com` | `Marco1415@` | `usuario_free` | Free |
| `renrique_prada@hotmail.com` | `Marco1415@` | `usuario_premium` | Premium Anual |

---

## 🛠 Tecnologías utilizadas

| Categoría | Tecnología | Versión |
|---|---|---|
| Framework | Angular (standalone components + signals) | 21.2 |
| Lenguaje | TypeScript | 5.9 |
| Programación reactiva | RxJS | 7.8 |
| Gráficos (panel admin) | Chart.js + ng2-charts | 4.5 / 10.0 |
| Autenticación | JWT (token en `localStorage`) + HTTP interceptor | — |
| Build / CLI | Angular CLI + `@angular/build` | 21.2 |
| **Pruebas** | **Vitest** + jsdom | 4.0 / 28.0 |
| Formato de código | Prettier | 3.8 |
| Gestor de paquetes | npm | 10.9.3 |
| Contenedor (deploy) | Docker (multi-stage: `node:22-alpine` → `nginx:alpine`) | — |

> `ng2-charts@10` pide como peer dependency `@angular/cdk >=21`, que a su vez arrastra
> `@angular/common ^22 || ^23` — en conflicto con el Angular 21.2 real del proyecto. Por eso
> `npm install`/`npm ci` en este repo **siempre** requieren el flag `--legacy-peer-deps` (ver
> [Puesta en marcha](#-puesta-en-marcha)).

---

## 🏗 Arquitectura

Estructura basada en **componentes standalone**, signals y lazy loading de rutas:

```
src/app/
├── core/
│   ├── guards/         → authGuard (protege rutas, valida expiración del JWT)
│   ├── interceptors/   → auth.interceptor (adjunta el Bearer token a cada petición)
│   ├── services/       → auth, vuelo, aeropuerto, alerta, perfil, admin, modales
│   └── models/         → interfaces (vuelo, alerta, pagina genérica PaginaDTO<T>)
├── features/           → páginas: home, auth, resultados, detalle, alertas, perfil, admin
├── shared/components/  → navbar, footer, calendario, paginador, modales (login, upgrade, confirm)
├── app.routes.ts       → definición de rutas + guards
└── app.config.ts       → providers globales (router, http, interceptor, provideCharts)
```

- **`auth.interceptor`** adjunta automáticamente el JWT (`Authorization: Bearer <token>`)
  a las peticiones al backend.
- **`authGuard`** protege las rutas privadas y **redirige a `/auth`** si no hay token o si
  el JWT ya expiró (decodifica el claim `exp`).
- **`environments/environment.ts` / `environment.prod.ts`** definen `apiUrl` (URL base del
  backend, con sufijo `/api` ya incluido) y `recaptchaSiteKey` por entorno — compilados dentro
  del bundle en tiempo de build (Angular no puede leer variables de entorno en runtime, a
  diferencia del backend Spring Boot).

---

## 🖥 Panel de administración

El componente [`AdminComponent`](src/app/features/admin/admin.component.ts) implementa 7
pestañas, todas consumiendo endpoints bajo `/api/admin/**` (protegidos en el backend con
`@PreAuthorize("hasRole('ADMIN')")`):

1. **Dashboard** — 6 gráficos con Chart.js (usuarios por rol, activos/inactivos, suscripciones
   por estado, ingresos mensuales, evolución de precio por ruta, alertas por aerolínea). Incluye
   un botón "Simulación" que genera datos ficticios **solo en memoria del navegador** (ningún
   `HttpClient` de por medio) cuando hay muy pocos datos reales para graficar.
2. **Usuarios** — tabla con paginación server-side (`PaginaDTO<T>`) + búsqueda, modal de
   crear/editar (`usuario-modal`), activar/desactivar cuenta, cambiar rol.
3. **Historial de precios** — tabla paginada con filtros por ruta/fecha/texto + exportar a Excel.
4. **Suscripciones y pagos** — tabla paginada + búsqueda de suscripciones, vista de pagos.
5. **Reportes** — KPIs ejecutivos y gráfico comparativo mes actual vs. anterior.
6. **Exportación** — descarga de usuarios (Excel), suscripciones (Excel) y reporte ejecutivo
   (PDF), reutilizando un helper común de descarga de blobs.
7. **Job de precios** — estado real del job de captura automática de precios (última ejecución,
   próxima estimada, contador regresivo en vivo) con botón para "ejecutarlo ahora" (mockup
   visual: no dispara ninguna captura real ni escribe en la base de datos, solo demuestra el
   flujo de la UI).

El componente `PaginadorComponent` ([`shared/components/paginador`](src/app/shared/components/paginador))
es reutilizado por las 3 tablas paginadas del panel, con navegación numerada + anterior/siguiente.

---

## ✅ Requisitos previos

- **Node.js** (compatible con Angular 21)
- **npm 10.9.3**
- El [backend PasajeYá](../pasaje-ya-backend) corriendo en `http://localhost:8080`

---

## 🚀 Puesta en marcha

```bash
# 1. Instalar dependencias — SIEMPRE con --legacy-peer-deps (ver nota de ng2-charts arriba)
npm install --legacy-peer-deps

# 2. Servidor de desarrollo
npm start          # equivale a: ng serve
```

La aplicación queda disponible en `http://localhost:4200/` y recarga automáticamente al
guardar cambios.

```bash
# Compilar para producción (usa la configuración "production" de angular.json)
npm run build:prod
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

## 🚢 Despliegue en Railway

El proyecto incluye un [`Dockerfile`](Dockerfile) multi-stage y un [`nginx.conf`](nginx.conf),
listos para que Railway los detecte automáticamente sin ningún workflow ni pipeline de CI/CD
propio.

### Cómo funciona el `Dockerfile`

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps      # el flag es obligatorio, ver nota de ng2-charts arriba
COPY . .
RUN npm run build:prod             # genera dist/pasaje-ya-frontend/browser

FROM nginx:alpine
COPY --from=build /app/dist/pasaje-ya-frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
```

Primera etapa: compila el proyecto Angular con Node. Segunda etapa: sirve únicamente los
archivos estáticos ya compilados con Nginx — la imagen final no contiene Node.js ni el código
fuente, solo HTML/JS/CSS y el binario de Nginx.

### `nginx.conf` — por qué existe

```nginx
server {
    listen 8080;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

- **`listen 8080`**: Railway expone los servicios por HTTP en el puerto que el contenedor
  escuche (no necesariamente 80/443) — se usa 8080 por convención con el backend.
- **`try_files $uri $uri/ /index.html`**: es la línea crítica para cualquier SPA de Angular. Sin
  ella, refrescar el navegador estando en una ruta como `/admin` o `/detalle/12` devolvería 404
  (Nginx buscaría un archivo físico `/admin` que no existe). Con este fallback, cualquier ruta
  no encontrada como archivo se sirve como `index.html`, y el Angular Router toma el control
  desde ahí y renderiza el componente correcto.

### Variable a actualizar antes del build: `environment.prod.ts`

A diferencia del backend (que lee variables de entorno en runtime), Angular **compila** los
valores de `environment.prod.ts` dentro del bundle JS en el momento del `npm run build:prod`. No
hay forma de cambiarlos después sin repetir el build. Antes de desplegar:

```ts
export const environment = {
  production: true,
  apiUrl: 'https://<tu-backend>.up.railway.app/api',   // URL real del backend, con /api al final
  recaptchaSiteKey: '<tu-site-key-real>'                // clave pública, no es secreta
};
```

- **`apiUrl`** debe apuntar al backend ya desplegado, **incluyendo el sufijo `/api`** — todos
  los servicios Angular (`auth.service.ts`, `admin.service.ts`, etc.) construyen sus rutas
  asumiendo que ese sufijo ya viene incluido en `environment.apiUrl`.
- **`recaptchaSiteKey`** no es un secreto: Google la expone igual en el HTML del widget de
  captcha, así que no hay problema en que viaje dentro del bundle público. La contraparte
  sensible (`RECAPTCHA_SECRET`) vive solo en el backend.

### Pasos

1. Crear el servicio en Railway conectando el repositorio de GitHub del frontend (autorizando el
   acceso vía la GitHub App de Railway) — Railway detecta el `Dockerfile` automáticamente.
2. Actualizar `environment.prod.ts` con la URL real del backend ya desplegado y la site key de
   reCAPTCHA.
3. Desplegar. Railway expone una URL pública (ej. `https://pasajeya.up.railway.app`).
4. En el servicio del **backend**, configurar `FRONTEND_URL` con esta URL exacta — si no
   coincide, el navegador bloqueará las peticiones por CORS aunque el backend responda 200 (ver
   [CORS en el README del backend](../pasaje-ya-backend/README.md#cors)).

---

## 📖 Bitácora del despliegue real (paso a paso)

Continuación de la [bitácora del backend](../pasaje-ya-backend/README.md#-bitácora-del-despliegue-real-paso-a-paso):
una vez que el backend y la base de datos ya estaban en estado **Online** en Railway, se
desplegó el frontend como tercer servicio del mismo proyecto.

### 1. Crear el `Dockerfile` y `nginx.conf`

No existían antes en el repo. Se tomó como referencia el `Dockerfile`/`nginx.conf` de otro
proyecto propio (inmobiliaria) ya desplegado con éxito en Railway, adaptando únicamente el
nombre de la carpeta de salida del build (`dist/pasaje-ya-frontend/browser` en vez del nombre
del otro proyecto) y agregando `--legacy-peer-deps` al `npm ci` (necesario por el conflicto de
peer dependencies de `ng2-charts`, que el otro proyecto no tiene).

### 2. Agregar el script `build:prod` a `package.json`

El `Dockerfile` invoca `npm run build:prod`, que no existía como script — se agregó
`"build:prod": "ng build --configuration production"` junto a los scripts ya existentes.

### 3. Actualizar `environment.prod.ts` con placeholders

Como el backend todavía no estaba desplegado en ese momento, se dejó un placeholder explícito
(`https://TU_BACKEND_EN_RAILWAY_AQUI/api`) con un comentario `TODO`, para no bloquear el resto
del trabajo y recordar volver a este archivo una vez que el backend tuviera URL pública.

### 4. Conectar el repositorio como servicio en Railway

Igual que con el backend: **+ New → GitHub Repo**, autorizando el acceso la primera vez.
Railway detectó el `Dockerfile` automáticamente, sin necesitar ningún workflow ni pipeline de
CI/CD propio.

### 5. Completar `environment.prod.ts` con los valores reales

Una vez el backend quedó desplegado y con su URL pública confirmada
(`https://pasajeya-production.up.railway.app`), se actualizó:

```ts
apiUrl: 'https://pasajeya-production.up.railway.app/api'
recaptchaSiteKey: '6LdBahMtAAAAAAVzHU70oZj6JRe0Pq8Scd228RM5'
```

y se hizo un nuevo commit para que Railway reconstruyera la imagen con el valor correcto ya
"horneado" dentro del bundle compilado.

### 6. Problema — CORS bloqueado

Con los 3 servicios ya "Online", las peticiones del frontend al backend fallaban:

```
Access to XMLHttpRequest at 'https://pasajeya-production.up.railway.app/api/aeropuertos' from
origin 'https://pasajeya.up.railway.app' has been blocked by CORS policy
```

La causa y la solución (parametrizar `CorsConfig.java` en el backend para aceptar
`${app.frontend.url}` además de `localhost:4200`) están documentadas en la
[bitácora del backend, paso 8](../pasaje-ya-backend/README.md#8-tercer-problema--cors-bloqueado).
Tras redesplegar el backend con ese cambio, el frontend pudo consumir la API sin errores.

### Resultado final

Los 3 servicios del proyecto quedaron **Online**: frontend Angular servido por Nginx en
`pasajeya.up.railway.app`, backend Spring Boot en `pasajeya-production.up.railway.app`, y
PostgreSQL sembrado con el dataset reducido (`script-railway.sql`) — totalmente funcional para
la demostración del proyecto.

---

<p align="center"><sub>PasajeYá · Proyecto académico UTP 2026 · Curso Integrador de Sistemas Software</sub></p>
