// ═══════════════════════════════════════════════════════════════════════════
// 📦 SISTEMA DE INVENTARIO TECNOMANIA! - APPS SCRIPT BACKEND v4.0
// ═══════════════════════════════════════════════════════════════════════════
// Versión: 4.0 PRODUCTION (auth, historial, edit/delete, reportes fecha)
// Fecha: 2026-05-19
// ═══════════════════════════════════════════════════════════════════════════

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ 🔧 CONFIGURACIÓN                                                          │
// └─────────────────────────────────────────────────────────────────────────┘

const SPREADSHEET_ID = "1uL94fk5zTXslA7IWdgfcU9j1Tlty5f2dTgxYoGJVOJI";

// Credenciales del único usuario admin. Para cambiar password:
// 1. Calcula SHA-256 de la nueva password (ej: en https://emn178.github.io/online-tools/sha256.html)
// 2. Reemplaza ADMIN_PASS_HASH abajo. NO guardes el plaintext en código.
const ADMIN_USER = "Zoemiriam";
// SHA-256 de "dereck123"
const ADMIN_PASS_HASH = "06d6451fc894644780e43fbadfdd2d73f1b21515fd48bff357c5290c56b8cdeb";
const TOKEN_TTL_SECONDS = 86400; // 24h

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ 📋 NOMBRES DE PESTAÑAS                                                   │
// └─────────────────────────────────────────────────────────────────────────┘

const HOJA_CATEGORIAS = "Categorias";
const HOJA_PRODUCTOS = "Productos";
const HOJA_COMPRAS = "Compras";
const HOJA_VENTAS = "Ventas";
const HOJA_MATERIALES = "Materiales";
const HOJA_COMPRAS_MATERIALES = "ComprasMateriales";
const HOJA_VENTAS_MATERIALES = "VentasMateriales";
const HOJA_RESUMEN = "resumen_diario";
const HOJA_HISTORIAL = "Historial"; // ← NUEVO v4

const CATEGORIAS_HEADERS = ["id", "nombre"];
const PRODUCTOS_HEADERS = ["id", "nombre", "código", "categoría", "precio_compra", "precio_venta", "stock", "fecha_creado"];
const COMPRAS_HEADERS = ["id", "producto_id", "cantidad", "precio_compra", "fecha", "proveedor"];
const VENTAS_HEADERS = ["id", "producto_id", "cantidad", "precio_venta", "fecha", "cliente"];
const MATERIALES_HEADERS = ["id", "nombre", "tipo", "precio_kg", "descripcion"];
const COMPRAS_MATERIALES_HEADERS = ["id", "material_id", "peso_gramos", "peso_kg", "precio_kg", "total_pagado", "proveedor", "fecha"];
const VENTAS_MATERIALES_HEADERS = ["id", "material_id", "peso_gramos", "peso_kg", "precio_kg", "total_cobrado", "cliente", "fecha"];
const RESUMEN_HEADERS = ["fecha", "total_ventas", "total_compras", "ganancia", "productos_vendidos"];
const HISTORIAL_HEADERS = ["timestamp", "usuario", "accion", "entidad", "entidad_id", "antes_json", "despues_json"];

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ 🔑 UTILIDADES                                                             │
// └─────────────────────────────────────────────────────────────────────────┘

function getSpreadsheet() {
    try {
        return SpreadsheetApp.openById(SPREADSHEET_ID);
    } catch (error) {
        throw new Error(`No se pudo abrir la hoja de cálculo. ID: ${SPREADSHEET_ID}. ${error.message}`);
    }
}

function generateUniqueAppId() {
    const timestamp = new Date().getTime().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `id-${timestamp}${random}`.toUpperCase();
}

function sha256(str) {
    const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str, Utilities.Charset.UTF_8);
    return bytes.map(b => ('0' + (b < 0 ? b + 256 : b).toString(16)).slice(-2)).join('');
}

function findRowByColumn(sheet, columnIndex, value) {
    try {
        const data = sheet.getDataRange().getValues();
        const target = String(value || '').toLowerCase();
        for (let i = 1; i < data.length; i++) {
            if (String(data[i][columnIndex] || '').toLowerCase() === target) {
                return { rowData: data[i], rowIndex: i };
            }
        }
        return { rowData: null, rowIndex: -1 };
    } catch (error) {
        Logger.log(`Error findRowByColumn: ${error}`);
        return { rowData: null, rowIndex: -1 };
    }
}

function findProductRow(sheetProductos, productoId) {
    return findRowByColumn(sheetProductos, 0, productoId);
}

function findMaterialRow(sheetMateriales, materialId) {
    return findRowByColumn(sheetMateriales, 0, materialId);
}

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ 🔐 AUTENTICACIÓN POR TOKEN                                                │
// └─────────────────────────────────────────────────────────────────────────┘

function generateToken() {
    return Utilities.getUuid() + '-' + new Date().getTime().toString(36);
}

function validarLogin(data) {
    const usuario = String(data.usuario || '').trim();
    const password = String(data.password || '');

    if (usuario !== ADMIN_USER) {
        return { status: "error", message: "Usuario o contraseña incorrectos." };
    }
    if (sha256(password) !== ADMIN_PASS_HASH) {
        return { status: "error", message: "Usuario o contraseña incorrectos." };
    }

    const token = generateToken();
    CacheService.getScriptCache().put(`tok:${token}`, usuario, TOKEN_TTL_SECONDS);
    return {
        status: "success",
        message: `Bienvenida ${usuario}!`,
        token: token,
        usuario: usuario,
        expiresIn: TOKEN_TTL_SECONDS
    };
}

function validateToken(token) {
    if (!token) return null;
    const user = CacheService.getScriptCache().get(`tok:${token}`);
    return user; // null si expirado/inválido
}

function logout(data) {
    const token = data.token;
    if (token) CacheService.getScriptCache().remove(`tok:${token}`);
    return { status: "success", message: "Sesión cerrada." };
}

// Endpoints públicos (no requieren token): validarLogin, ping
// El resto requiere token válido.
const PUBLIC_ACTIONS = new Set(['validarLogin', 'ping']);

function requireAuth(action, token) {
    if (PUBLIC_ACTIONS.has(action)) return { ok: true, usuario: null };
    const usuario = validateToken(token);
    if (!usuario) {
        return { ok: false, response: { status: "unauthorized", message: "Sesión expirada o inválida. Inicia sesión nuevamente." } };
    }
    return { ok: true, usuario: usuario };
}

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ 📜 HISTORIAL / AUDITORÍA                                                  │
// └─────────────────────────────────────────────────────────────────────────┘

function registrarAuditoria(usuario, accion, entidad, entidadId, antes, despues) {
    try {
        const ss = getSpreadsheet();
        let sheet = ss.getSheetByName(HOJA_HISTORIAL);
        if (!sheet) {
            sheet = ss.insertSheet(HOJA_HISTORIAL);
            sheet.getRange(1, 1, 1, HISTORIAL_HEADERS.length).setValues([HISTORIAL_HEADERS]);
            sheet.setFrozenRows(1);
        }
        sheet.appendRow([
            new Date(),
            usuario || 'system',
            accion,
            entidad,
            entidadId || '',
            antes ? JSON.stringify(antes) : '',
            despues ? JSON.stringify(despues) : ''
        ]);
    } catch (e) {
        Logger.log(`Error registrando auditoría: ${e}`);
    }
}

function getHistorial(query) {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(HOJA_HISTORIAL);
    if (!sheet || sheet.getLastRow() < 2) {
        return { status: "success", data: [], message: "Sin historial todavía." };
    }
    const all = sheet.getDataRange().getValues();
    const headers = all[0];
    const rows = all.slice(1).reverse(); // Más reciente primero
    const limit = parseInt(query && query.limit) || 200;
    const result = rows.slice(0, limit).map(r => {
        const entry = {};
        headers.forEach((h, i) => entry[h] = r[i]);
        return entry;
    });
    return { status: "success", data: result };
}

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ 🌐 ENDPOINT GET                                                           │
// └─────────────────────────────────────────────────────────────────────────┘

function doGet(e) {
    const action = e.parameter.action;
    const query = e.parameter.query;
    const sheetName = e.parameter.sheetName;
    const token = e.parameter.token;
    const dateFrom = e.parameter.from;
    const dateTo = e.parameter.to;

    let result;

    try {
        const auth = requireAuth(action, token);
        if (!auth.ok) {
            return ContentService.createTextOutput(JSON.stringify(auth.response))
                   .setMimeType(ContentService.MimeType.JSON);
        }

        switch(action) {
            case "ping":
                result = { status: "success", message: "pong", version: "4.0" };
                break;
            case "iniciar":
                result = iniciarBaseDeDatos();
                if (result.status === "success") registrarAuditoria(auth.usuario, "iniciar_db", "sistema", "", null, null);
                break;
            case "resetear":
                const beforeReset = { sheets: getSpreadsheet().getSheets().map(s => s.getName()) };
                result = resetearBaseDeDatos();
                if (result.status === "success") registrarAuditoria(auth.usuario, "resetear_db", "sistema", "", beforeReset, null);
                break;
            case "getCategorias": result = getCategorias(); break;
            case "buscarProducto": result = buscarProducto(query); break;
            case "getInventario": result = getInventario(); break;
            case "getMateriales": result = getMateriales(); break;
            case "buscarMaterial": result = buscarMaterial(query); break;
            case "getInventarioMateriales": result = getInventarioMateriales(); break;
            case "getResumenDiario": result = getResumenDiario(); break;
            case "getMetricasMateriales": result = getMetricasMateriales(); break;
            case "getHistorial": result = getHistorial({ limit: e.parameter.limit }); break;
            case "getReporteFecha":
                result = getReporteFecha(sheetName, dateFrom, dateTo);
                break;
            case "exportarBackupCompleto":
                result = exportarBackupCompleto();
                if (result.status === "success") registrarAuditoria(auth.usuario, "backup_completo", "sistema", "", null, { sheets: Object.keys(result.data) });
                break;
            case "getData":
                result = sheetName ? getData(sheetName) : { status: "error", message: "Falta sheetName" };
                break;
            default:
                result = { status: "error", message: `Acción GET '${action}' no válida.` };
        }
    } catch (error) {
        result = { status: "error", message: `Error en doGet: ${error.message}`, stack: error.stack };
        Logger.log(`Error crítico doGet: ${error}`);
    }

    return ContentService.createTextOutput(JSON.stringify(result))
           .setMimeType(ContentService.MimeType.JSON);
}

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ 🌐 ENDPOINT POST                                                          │
// └─────────────────────────────────────────────────────────────────────────┘

function doPost(e) {
    try {
        if (!e.postData || !e.postData.contents) {
            return jsonOut({ status: "error", message: "No se recibieron datos." });
        }
        const requestData = JSON.parse(e.postData.contents);
        const action = requestData.action;
        const token = requestData.token;

        const auth = requireAuth(action, token);
        if (!auth.ok) return jsonOut(auth.response);
        const usuario = auth.usuario;

        let result;
        switch(action) {
            case "validarLogin":
                result = validarLogin(requestData);
                if (result.status === "success") registrarAuditoria(result.usuario, "login", "sistema", "", null, null);
                break;
            case "logout":
                result = logout(requestData);
                break;
            case "agregarCategoria":
                result = agregarCategoria(requestData);
                if (result.status === "success") registrarAuditoria(usuario, "agregar_categoria", "categoria", result.id || requestData.nombre, null, requestData);
                break;
            case "agregarProducto":
                result = agregarProducto(requestData);
                if (result.status === "success") registrarAuditoria(usuario, "agregar_producto", "producto", result.id, null, requestData);
                break;
            case "editarProducto":
                result = editarProducto(requestData, usuario);
                break;
            case "eliminarProducto":
                result = eliminarProducto(requestData, usuario);
                break;
            case "registrarTransaccion":
                result = registrarTransaccion(requestData);
                if (result.status === "success") registrarAuditoria(usuario, requestData.type, requestData.type, requestData.producto_id, null, requestData);
                break;
            case "agregarMaterial":
                result = agregarMaterial(requestData);
                if (result.status === "success") registrarAuditoria(usuario, "agregar_material", "material", result.data && result.data.id, null, requestData);
                break;
            case "registrarCompraMaterial":
                result = registrarCompraMaterial(requestData);
                if (result.status === "success") registrarAuditoria(usuario, "compra_material", "material", requestData.material_id, null, requestData);
                break;
            case "registrarVentaMaterial":
                result = registrarVentaMaterial(requestData);
                if (result.status === "success") registrarAuditoria(usuario, "venta_material", "material", requestData.material_id, null, requestData);
                break;
            case "restaurarBackup":
                result = restaurarBackup(requestData);
                if (result.status === "success") registrarAuditoria(usuario, "restaurar_backup", "sistema", "", null, { sheets_restored: Object.keys(requestData.backup || {}) });
                break;
            default:
                result = { status: "error", message: `Acción POST '${action}' no reconocida.` };
        }
        return jsonOut(result);
    } catch (error) {
        return jsonOut({ status: "error", message: `Error POST: ${error.message}`, stack: error.stack });
    }
}

function jsonOut(obj) {
    return ContentService.createTextOutput(JSON.stringify(obj))
           .setMimeType(ContentService.MimeType.JSON);
}

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ 📂 CATEGORÍAS                                                             │
// └─────────────────────────────────────────────────────────────────────────┘

function getCategorias() {
    return getData(HOJA_CATEGORIAS);
}

function agregarCategoria(data) {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(HOJA_CATEGORIAS);
    if (!sheet) return { status: "error", message: `Pestaña '${HOJA_CATEGORIAS}' no existe.` };
    const newId = generateUniqueAppId();
    try {
        sheet.appendRow([newId, data.nombre]);
        return { status: "success", message: `Categoría '${data.nombre}' agregada.`, id: newId };
    } catch (e) {
        return { status: "error", message: `Error: ${e.message}` };
    }
}

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ 📦 PRODUCTOS                                                              │
// └─────────────────────────────────────────────────────────────────────────┘

function getInventario() {
    return getData(HOJA_PRODUCTOS);
}

function buscarProducto(query) {
    const data = getData(HOJA_PRODUCTOS);
    if (data.status !== 'success') return data;
    const lowerQuery = String(query || '').toLowerCase().trim();
    if (lowerQuery.length === 0) return { status: "warning", message: "Especifique ID, Código o Nombre." };
    const results = data.data.filter(p =>
        String(p.id || '').toLowerCase().includes(lowerQuery) ||
        String(p.código || '').toLowerCase().includes(lowerQuery) ||
        String(p.nombre || '').toLowerCase().includes(lowerQuery)
    );
    if (results.length > 0) {
        return { status: "success", data: results, message: `${results.length} coincidencias.` };
    }
    return { status: "warning", message: "Producto no encontrado." };
}

function agregarProducto(data) {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(HOJA_PRODUCTOS);
    if (!sheet) return { status: "error", message: `Pestaña '${HOJA_PRODUCTOS}' no existe.` };
    const newId = generateUniqueAppId();
    try {
        sheet.appendRow([newId, data.nombre, data.codigo, data.categoria,
            parseFloat(data.precio_compra), parseFloat(data.precio_venta),
            parseInt(data.stock), new Date()]);
        return { status: "success", message: `Producto '${data.nombre}' registrado.`, id: newId };
    } catch (e) {
        return { status: "error", message: `Error: ${e.message}` };
    }
}

function editarProducto(data, usuario) {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(HOJA_PRODUCTOS);
    if (!sheet) return { status: "error", message: `Pestaña no existe.` };

    const { rowData, rowIndex } = findProductRow(sheet, data.id);
    if (rowIndex === -1) return { status: "error", message: `Producto ID ${data.id} no encontrado.` };

    const antes = {
        id: rowData[0], nombre: rowData[1], codigo: rowData[2], categoria: rowData[3],
        precio_compra: rowData[4], precio_venta: rowData[5], stock: rowData[6]
    };
    const despues = {
        id: data.id,
        nombre: data.nombre || rowData[1],
        codigo: data.codigo || rowData[2],
        categoria: data.categoria || rowData[3],
        precio_compra: data.precio_compra !== undefined ? parseFloat(data.precio_compra) : rowData[4],
        precio_venta: data.precio_venta !== undefined ? parseFloat(data.precio_venta) : rowData[5],
        stock: data.stock !== undefined ? parseInt(data.stock) : rowData[6]
    };

    try {
        const row = rowIndex + 1;
        sheet.getRange(row, 2).setValue(despues.nombre);
        sheet.getRange(row, 3).setValue(despues.codigo);
        sheet.getRange(row, 4).setValue(despues.categoria);
        sheet.getRange(row, 5).setValue(despues.precio_compra);
        sheet.getRange(row, 6).setValue(despues.precio_venta);
        sheet.getRange(row, 7).setValue(despues.stock);

        registrarAuditoria(usuario, "editar_producto", "producto", data.id, antes, despues);
        return { status: "success", message: `Producto '${despues.nombre}' actualizado.` };
    } catch (e) {
        return { status: "error", message: `Error: ${e.message}` };
    }
}

function eliminarProducto(data, usuario) {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(HOJA_PRODUCTOS);
    if (!sheet) return { status: "error", message: `Pestaña no existe.` };

    const { rowData, rowIndex } = findProductRow(sheet, data.id);
    if (rowIndex === -1) return { status: "error", message: `Producto ID ${data.id} no encontrado.` };

    const antes = {
        id: rowData[0], nombre: rowData[1], codigo: rowData[2], categoria: rowData[3],
        precio_compra: rowData[4], precio_venta: rowData[5], stock: rowData[6]
    };

    try {
        sheet.deleteRow(rowIndex + 1);
        registrarAuditoria(usuario, "eliminar_producto", "producto", data.id, antes, null);
        return { status: "success", message: `Producto '${antes.nombre}' eliminado.` };
    } catch (e) {
        return { status: "error", message: `Error: ${e.message}` };
    }
}

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ 💰 TRANSACCIONES (COMPRAS/VENTAS)                                         │
// └─────────────────────────────────────────────────────────────────────────┘

function registrarTransaccion(data) {
    const ss = getSpreadsheet();
    const isCompra = data.type === "compra";
    const sheet = ss.getSheetByName(isCompra ? HOJA_COMPRAS : HOJA_VENTAS);
    const sheetProductos = ss.getSheetByName(HOJA_PRODUCTOS);
    if (!sheet || !sheetProductos) return { status: "error", message: "Pestañas necesarias no existen." };

    const { rowData, rowIndex } = findProductRow(sheetProductos, data.producto_id);
    if (rowIndex === -1) return { status: "error", message: `Producto ID ${data.producto_id} no encontrado.` };

    const stockColIndex = 6, precioCompraColIndex = 4, precioVentaColIndex = 5;
    const cantidad = parseInt(data.cantidad);
    const precio = parseFloat(data.precio);
    let stockActual = parseFloat(rowData[stockColIndex]) || 0;
    let nuevoStock;

    if (!isCompra) {
        if (stockActual < cantidad) return { status: "warning", message: `Stock insuficiente. Hay ${stockActual} unidades.` };
        nuevoStock = stockActual - cantidad;
    } else {
        nuevoStock = stockActual + cantidad;
    }

    try {
        sheet.appendRow([generateUniqueAppId(), data.producto_id, cantidad, precio, new Date(), data.extra_data || '']);
        sheet.getRange(rowIndex + 1, stockColIndex + 1).setValue(nuevoStock);

        if (isCompra && precio !== parseFloat(rowData[precioCompraColIndex])) {
            sheetProductos.getRange(rowIndex + 1, precioCompraColIndex + 1).setValue(precio);
        } else if (!isCompra && precio !== parseFloat(rowData[precioVentaColIndex])) {
            sheetProductos.getRange(rowIndex + 1, precioVentaColIndex + 1).setValue(precio);
        }

        return { status: "success", message: `${isCompra ? 'Compra' : 'Venta'} registrada. Stock: ${nuevoStock}.` };
    } catch (e) {
        return { status: "error", message: `Error: ${e.message}` };
    }
}

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ ♻️ MATERIALES RECICLABLES                                                  │
// └─────────────────────────────────────────────────────────────────────────┘

function getMateriales() { return getData(HOJA_MATERIALES); }
function getInventarioMateriales() { return getData(HOJA_MATERIALES); }

function buscarMaterial(query) {
    const data = getData(HOJA_MATERIALES);
    if (data.status !== 'success') return data;
    const lowerQuery = String(query || '').toLowerCase().trim();
    if (lowerQuery.length === 0) return { status: "warning", message: "Especifique ID o Nombre." };
    const results = data.data.filter(m =>
        String(m.id || '').toLowerCase().includes(lowerQuery) ||
        String(m.nombre || '').toLowerCase().includes(lowerQuery)
    );
    return results.length > 0
        ? { status: "success", data: results, message: `${results.length} coincidencias.` }
        : { status: "warning", message: "Material no encontrado." };
}

function agregarMaterial(data) {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(HOJA_MATERIALES);
    if (!sheet) return { status: "error", message: `Pestaña '${HOJA_MATERIALES}' no existe.` };
    const newId = generateUniqueAppId();
    try {
        sheet.appendRow([newId, data.nombre, data.tipo, parseFloat(data.precio_kg), data.descripcion || '']);
        return { status: "success", message: `Material '${data.nombre}' agregado.`, data: { id: newId } };
    } catch (e) {
        return { status: "error", message: `Error: ${e.message}` };
    }
}

function registrarCompraMaterial(data) {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(HOJA_COMPRAS_MATERIALES);
    const sheetMateriales = ss.getSheetByName(HOJA_MATERIALES);
    if (!sheet || !sheetMateriales) return { status: "error", message: "Pestañas no existen." };

    const { rowData, rowIndex } = findMaterialRow(sheetMateriales, data.material_id);
    if (rowIndex === -1) return { status: "error", message: `Material ID ${data.material_id} no encontrado.` };

    const pesoGramos = parseFloat(data.peso_gramos);
    const pesoKg = pesoGramos / 1000;
    const precioKg = parseFloat(data.precio_kg);
    const total = pesoKg * precioKg;

    try {
        sheet.appendRow([generateUniqueAppId(), data.material_id, pesoGramos, pesoKg, precioKg, total, data.proveedor || '', new Date()]);
        return { status: "success", message: `Compra registrada. Total: $${total.toFixed(2)}` };
    } catch (e) {
        return { status: "error", message: `Error: ${e.message}` };
    }
}

function registrarVentaMaterial(data) {
    const ss = getSpreadsheet();
    const sheetVentas = ss.getSheetByName(HOJA_VENTAS_MATERIALES);
    const sheetCompras = ss.getSheetByName(HOJA_COMPRAS_MATERIALES);
    const sheetMateriales = ss.getSheetByName(HOJA_MATERIALES);
    if (!sheetVentas || !sheetCompras || !sheetMateriales) return { status: "error", message: "Pestañas no existen." };

    const { rowData, rowIndex } = findMaterialRow(sheetMateriales, data.material_id);
    if (rowIndex === -1) return { status: "error", message: `Material no encontrado.` };

    const stockActual = calcularStockMaterial(data.material_id, sheetCompras, sheetVentas);
    const pesoGramos = parseFloat(data.peso_gramos);
    const pesoKg = pesoGramos / 1000;

    if (stockActual < pesoKg) return { status: "warning", message: `Stock insuficiente. Hay ${stockActual.toFixed(3)} kg.` };

    const precioKg = parseFloat(data.precio_kg);
    const total = pesoKg * precioKg;

    try {
        sheetVentas.appendRow([generateUniqueAppId(), data.material_id, pesoGramos, pesoKg, precioKg, total, data.cliente || '', new Date()]);
        return { status: "success", message: `Venta registrada. Total: $${total.toFixed(2)}. Restante: ${(stockActual - pesoKg).toFixed(3)} kg.` };
    } catch (e) {
        return { status: "error", message: `Error: ${e.message}` };
    }
}

function calcularStockMaterial(materialId, sheetCompras, sheetVentas) {
    let comprado = 0, vendido = 0;
    if (sheetCompras.getLastRow() > 1) {
        const d = sheetCompras.getDataRange().getValues();
        for (let i = 1; i < d.length; i++) {
            if (String(d[i][1]) === String(materialId)) comprado += parseFloat(d[i][3]) || 0;
        }
    }
    if (sheetVentas.getLastRow() > 1) {
        const d = sheetVentas.getDataRange().getValues();
        for (let i = 1; i < d.length; i++) {
            if (String(d[i][1]) === String(materialId)) vendido += parseFloat(d[i][3]) || 0;
        }
    }
    return comprado - vendido;
}

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ 📊 MÉTRICAS Y REPORTES                                                    │
// └─────────────────────────────────────────────────────────────────────────┘

function getResumenDiario() { return getData(HOJA_RESUMEN); }

function getMetricasMateriales() {
    const ss = getSpreadsheet();
    const sM = ss.getSheetByName(HOJA_MATERIALES);
    const sC = ss.getSheetByName(HOJA_COMPRAS_MATERIALES);
    const sV = ss.getSheetByName(HOJA_VENTAS_MATERIALES);
    if (!sM || !sC || !sV) return { status: "error", message: "Pestañas no existen." };

    try {
        let totalInvertido = 0, totalVendido = 0, valorInventario = 0;
        const stockPorMaterial = {};
        const comprasPorTipo = {};

        if (sC.getLastRow() > 1) {
            sC.getDataRange().getValues().slice(1).forEach(r => totalInvertido += parseFloat(r[5]) || 0);
        }
        if (sV.getLastRow() > 1) {
            sV.getDataRange().getValues().slice(1).forEach(r => totalVendido += parseFloat(r[5]) || 0);
        }
        if (sM.getLastRow() > 1) {
            sM.getDataRange().getValues().slice(1).forEach(r => {
                const id = r[0], tipo = r[2], precio = parseFloat(r[3]) || 0;
                const stock = calcularStockMaterial(id, sC, sV);
                stockPorMaterial[id] = { nombre: r[1], tipo, stock, precioKg: precio };
                valorInventario += stock * precio;
                if (!comprasPorTipo[tipo]) comprasPorTipo[tipo] = 0;
            });
        }

        let materialMasComprado = null, maxStock = 0;
        for (const id in stockPorMaterial) {
            if (stockPorMaterial[id].stock > maxStock) {
                maxStock = stockPorMaterial[id].stock;
                materialMasComprado = stockPorMaterial[id].nombre;
            }
        }
        if (sC.getLastRow() > 1) {
            sC.getDataRange().getValues().slice(1).forEach(r => {
                const id = r[1];
                if (stockPorMaterial[id]) {
                    const tipo = stockPorMaterial[id].tipo;
                    comprasPorTipo[tipo] = (comprasPorTipo[tipo] || 0) + 1;
                }
            });
        }

        return {
            status: "success",
            data: {
                totalInvertido, totalVendido,
                ganancia: totalVendido - totalInvertido,
                valorInventario,
                materialMasComprado: materialMasComprado || "N/A",
                comprasPorTipo
            }
        };
    } catch (error) {
        return { status: "error", message: `Error: ${error.message}` };
    }
}

function getReporteFecha(sheetName, dateFrom, dateTo) {
    if (!sheetName) return { status: "error", message: "Falta sheetName." };
    if (!dateFrom || !dateTo) return { status: "error", message: "Faltan fechas from/to." };

    const data = getData(sheetName);
    if (data.status !== 'success') return data;

    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    // Incluir todo el día final
    to.setHours(23, 59, 59, 999);

    const filtered = data.data.filter(row => {
        const f = row.fecha;
        if (!f) return false;
        const d = (f instanceof Date) ? f : new Date(f);
        return d >= from && d <= to;
    });

    // Agregar totales
    let totalAmount = 0;
    filtered.forEach(r => {
        const monto = parseFloat(r.total_pagado || r.total_cobrado ||
            (parseFloat(r.cantidad || 0) * parseFloat(r.precio_compra || r.precio_venta || 0))) || 0;
        totalAmount += monto;
    });

    return {
        status: "success",
        data: filtered,
        meta: {
            from: dateFrom,
            to: dateTo,
            count: filtered.length,
            totalAmount: totalAmount
        }
    };
}

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ 🔄 UTILIDAD: getData genérico                                             │
// └─────────────────────────────────────────────────────────────────────────┘

function getData(sheetName) {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2) {
        return { status: "error", message: `Pestaña '${sheetName}' vacía o no existe.` };
    }
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);

    const mapped = rows.map(row => {
        let entry = {};
        headers.forEach((h, i) => {
            let v = row[i];
            if (v === '' || v === null || v === undefined) v = '';
            else if (typeof v === 'string' && !isNaN(v) && v.trim() !== '') {
                if (h === 'código' && /[a-zA-Z]/.test(v)) v = v;
                else v = parseFloat(v);
            } else if (!(v instanceof Date) && typeof v !== 'number') {
                v = String(v);
            }
            entry[h] = v;
        });
        return entry;
    }).filter(e => Object.values(e).some(v => v !== '' && v !== null));

    return { status: "success", data: mapped };
}

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ ⚙️ CONFIGURACIÓN BASE DE DATOS                                            │
// └─────────────────────────────────────────────────────────────────────────┘

function createOrResetSheet(ss, name, headers) {
    let sheet = ss.getSheetByName(name);
    let action = "verificada";
    if (!sheet) { sheet = ss.insertSheet(name); action = "creada"; }
    sheet.clearContents();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return `'${name}' ${action}.`;
}

function iniciarBaseDeDatos() {
    const ss = getSpreadsheet();
    let msg = [];
    msg.push(createOrResetSheet(ss, HOJA_CATEGORIAS, CATEGORIAS_HEADERS));
    msg.push(createOrResetSheet(ss, HOJA_PRODUCTOS, PRODUCTOS_HEADERS));
    msg.push(createOrResetSheet(ss, HOJA_COMPRAS, COMPRAS_HEADERS));
    msg.push(createOrResetSheet(ss, HOJA_VENTAS, VENTAS_HEADERS));
    msg.push(createOrResetSheet(ss, HOJA_MATERIALES, MATERIALES_HEADERS));
    msg.push(createOrResetSheet(ss, HOJA_COMPRAS_MATERIALES, COMPRAS_MATERIALES_HEADERS));
    msg.push(createOrResetSheet(ss, HOJA_VENTAS_MATERIALES, VENTAS_MATERIALES_HEADERS));
    msg.push(createOrResetSheet(ss, HOJA_RESUMEN, RESUMEN_HEADERS));
    msg.push(createOrResetSheet(ss, HOJA_HISTORIAL, HISTORIAL_HEADERS));
    return { status: "success", message: `Base de datos inicializada: ${msg.join(" ")}` };
}

function resetearBaseDeDatos() {
    const ss = getSpreadsheet();
    let msg = [];
    ss.getSheets().forEach(s => {
        const n = s.getName();
        if (n !== "Hoja 1") { ss.deleteSheet(s); msg.push(`'${n}' eliminada.`); }
    });
    msg.push(createOrResetSheet(ss, HOJA_CATEGORIAS, CATEGORIAS_HEADERS));
    msg.push(createOrResetSheet(ss, HOJA_PRODUCTOS, PRODUCTOS_HEADERS));
    msg.push(createOrResetSheet(ss, HOJA_COMPRAS, COMPRAS_HEADERS));
    msg.push(createOrResetSheet(ss, HOJA_VENTAS, VENTAS_HEADERS));
    msg.push(createOrResetSheet(ss, HOJA_MATERIALES, MATERIALES_HEADERS));
    msg.push(createOrResetSheet(ss, HOJA_COMPRAS_MATERIALES, COMPRAS_MATERIALES_HEADERS));
    msg.push(createOrResetSheet(ss, HOJA_VENTAS_MATERIALES, VENTAS_MATERIALES_HEADERS));
    msg.push(createOrResetSheet(ss, HOJA_RESUMEN, RESUMEN_HEADERS));
    msg.push(createOrResetSheet(ss, HOJA_HISTORIAL, HISTORIAL_HEADERS));
    return { status: "success", message: `Base de datos reseteada: ${msg.join(" ")}` };
}

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ 💾 BACKUP COMPLETO / RESTORE                                              │
// └─────────────────────────────────────────────────────────────────────────┘

function exportarBackupCompleto() {
    try {
        const ss = getSpreadsheet();
        const backup = {
            spreadsheet_name: ss.getName(),
            spreadsheet_id: ss.getId(),
            backup_date: new Date().toISOString(),
            version: "4.0",
            data: {}
        };
        ss.getSheets().forEach(sheet => {
            const name = sheet.getName();
            if (sheet.getLastRow() < 1) {
                backup.data[name] = { headers: [], rows: [] };
                return;
            }
            const all = sheet.getDataRange().getValues();
            backup.data[name] = {
                headers: all[0],
                rows: all.slice(1).map(r => r.map(v => v instanceof Date ? v.toISOString() : v))
            };
        });
        return { status: "success", data: backup, message: `Backup completo: ${Object.keys(backup.data).length} pestañas.` };
    } catch (e) {
        return { status: "error", message: `Error backup: ${e.message}` };
    }
}

function restaurarBackup(requestData) {
    const backup = requestData.backup;
    if (!backup || !backup.data) return { status: "error", message: "Backup inválido (falta campo 'data')." };

    try {
        const ss = getSpreadsheet();
        const summary = [];

        Object.entries(backup.data).forEach(([sheetName, sheetData]) => {
            let sheet = ss.getSheetByName(sheetName);
            if (!sheet) sheet = ss.insertSheet(sheetName);
            else sheet.clearContents();

            if (sheetData.headers && sheetData.headers.length > 0) {
                sheet.getRange(1, 1, 1, sheetData.headers.length).setValues([sheetData.headers]);
                sheet.setFrozenRows(1);
            }
            if (sheetData.rows && sheetData.rows.length > 0) {
                // Convertir strings ISO de vuelta a Date
                const rows = sheetData.rows.map(r => r.map(v => {
                    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return new Date(v);
                    return v;
                }));
                sheet.getRange(2, 1, rows.length, sheetData.headers.length).setValues(rows);
            }
            summary.push(`${sheetName}: ${sheetData.rows ? sheetData.rows.length : 0} filas`);
        });

        return { status: "success", message: `Backup restaurado: ${summary.join(', ')}` };
    } catch (e) {
        return { status: "error", message: `Error restaurando: ${e.message}` };
    }
}

function testConexion() {
    try {
        const ss = getSpreadsheet();
        return {
            status: "success",
            spreadsheet: ss.getName(),
            id: ss.getId(),
            sheets: ss.getSheets().map(s => s.getName())
        };
    } catch (error) {
        return { status: "error", message: error.message };
    }
}

// Helper: generar SHA-256 de una password (correr manualmente desde Apps Script Editor)
// Logger.log(sha256('dereck123'))  → te da el hash a poner en ADMIN_PASS_HASH
function generarHashPassword() {
    const password = "dereck123"; // ← cambia esto y corre la función para obtener el hash
    Logger.log(`SHA-256 de "${password}":`);
    Logger.log(sha256(password));
}
