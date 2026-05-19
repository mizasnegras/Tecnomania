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

- Frontend: HTML + CSS + JS vanilla, Chart.js, SheetJS, Font Awesome
- Backend: Google Apps Script (sg.js)
- DB: Google Sheets

## Setup (nueva cuenta Google)

1. **Crear Spreadsheet** en la nueva cuenta de Google. Copia el ID (parte de la URL entre `/d/` y `/edit`).
2. **Abrir Apps Script** desde el menú `Extensions → Apps Script`. Pega el contenido de `sg.js`. Cambia la constante `SPREADSHEET_ID` por la del nuevo Sheet.
3. **(Opcional) cambiar contraseña**:
   - Corre la función `generarHashPassword()` desde el editor Apps Script con tu nueva password.
   - Copia el hash que aparece en el log y reemplaza `ADMIN_PASS_HASH`.
4. **Deploy**: botón "Deploy" → "New deployment" → tipo "Web app". Execute as: `Me`. Who has access: `Anyone`. Click Deploy. Copia la URL del Web app.
5. **Configurar app**: abre la app, inicia sesión, ve a `Configuración → Conexión a Google`, pega la nueva URL del Apps Script y guarda.
6. **Iniciar DB**: `Configuración → Iniciar Base de Datos` crea las pestañas necesarias.

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
