# Tecnomania! — Sistema de Inventario v4.0

App de inventario para compra/venta de productos y materiales. Frontend en GitHub Pages, backend en Google Apps Script, datos en Google Sheets.

## Demo

https://mizasnegras.github.io/Tecnomania/

## Features v4.0 (producción)

- 🔐 **Login con token** (usuario único `Zoemiriam`, password hash en backend)
- ⚙️ **Configuración runtime**: cambiar URL Apps Script y Spreadsheet ID desde la app, sin tocar código
- 💾 **Backup completo** descargable (JSON + Excel multi-hoja) y restore desde archivo
- 📜 **Historial de cambios** (auditoría) — cada insert/edit/delete queda registrado
- ✏️ **Editar / eliminar productos** desde la tabla de inventario (modal)
- 📅 **Reportes por rango de fechas** (compras/ventas con totales)
- 📊 **Export Excel** en cualquier tabla (SheetJS)
- 📱 **PWA** instalable + Service Worker offline
- 🍞 **Toast notifications** + 🌓 **toggle tema** claro/oscuro + ⌨️ **atajos teclado**

## Stack

- Frontend (este repo): HTML + CSS + JS vanilla, Chart.js, SheetJS, Font Awesome
- Backend: Google Apps Script (código NO incluido en este repo por contener hash de password admin — vive en el editor Apps Script del owner)
- DB: Google Sheets

## Estructura

```
index.html         — UI completa
script.js          — Lógica frontend, auth, fetch al Apps Script
estilo.css         — Estilos (incluye tema oscuro/claro)
manifest.json      — PWA manifest
service-worker.js  — Cache estáticos + fallback offline
icon-*.svg         — Iconos PWA
```

El archivo `sg.js` (backend) **NO está en el repo**. Está custodiado por el owner en el editor Apps Script. Para clonar la arquitectura en otra cuenta, contactar al owner.

## Setup (nueva instalación)

Esta app ya está configurada para conectar al backend Apps Script de `mizasnegras`. Si quieres usar otra cuenta Google:

1. Pide al owner el código `sg.js` y un nuevo `SPREADSHEET_ID` + Apps Script Web app URL deployada con `Who has access: Anyone`.
2. Abre la app → `Configuración → Conexión a Google` → pega la nueva URL del Apps Script y guarda.
3. `Configuración → Iniciar Base de Datos` crea las pestañas necesarias.

## Migrar datos desde cuenta vieja

1. Inicia sesión en la app conectada a la cuenta vieja.
2. `Configuración → Descargar Backup Completo`. Esto descarga un JSON con todos los datos + un Excel multi-hoja.
3. Cambia la URL del Apps Script a la nueva cuenta (paso 5 de Setup).
4. `Configuración → Iniciar Base de Datos` (crea pestañas vacías en el nuevo Sheet).
5. `Configuración → Seleccionar archivo JSON de backup` y selecciona el archivo descargado.

## Credenciales por defecto

- Usuario: `Zoemiriam`
- Password: `dereck123`

(Cambiable via `generarHashPassword()` en Apps Script)

## Atajos de teclado

| Combinación | Acción |
|---|---|
| `Ctrl + 1..6` | Navegar Dashboard/Inventario/Productos/Compras/Ventas/Resúmenes |
| `Ctrl + H` | Historial |
| `Ctrl + ,` | Configuración |
| `Ctrl + K` | Foco en búsqueda |
| `Esc` | Cerrar modal |

## Versionado

- **v3.0** (2026-01) — Versión original
- **v4.0** (2026-05-19) — Producción: auth, historial, edit/delete, reportes fecha, PWA, backup
