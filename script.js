// ═══════════════════════════════════════════════════════════════════════════
// 🎯 TECNOMANIA! - SISTEMA DE INVENTARIO - FRONTEND v4.0
// ═══════════════════════════════════════════════════════════════════════════
// Login + token auth · Settings runtime · Edit/Delete · Historial
// Reportes por fecha · Export Excel · PWA · Toasts · Modales · Tema · Atajos
// Fecha: 2026-05-19
// ═══════════════════════════════════════════════════════════════════════════

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ ⚙️ CONFIGURACIÓN RUNTIME (localStorage con fallback default)              │
// └─────────────────────────────────────────────────────────────────────────┘

const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzkVru9nZZgcafdJ0apo3SyhufnvquMeiSmhpTfC_saF0zanGbASOYuHi2gUFpAX1FS/exec';

const Config = {
    get scriptUrl() { return localStorage.getItem('tm_script_url') || DEFAULT_SCRIPT_URL; },
    set scriptUrl(v) { localStorage.setItem('tm_script_url', v); },
    get spreadsheetId() { return localStorage.getItem('tm_spreadsheet_id') || ''; },
    set spreadsheetId(v) { localStorage.setItem('tm_spreadsheet_id', v); },
    get token() { return localStorage.getItem('tm_token') || ''; },
    set token(v) { v ? localStorage.setItem('tm_token', v) : localStorage.removeItem('tm_token'); },
    get usuario() { return localStorage.getItem('tm_usuario') || ''; },
    set usuario(v) { v ? localStorage.setItem('tm_usuario', v) : localStorage.removeItem('tm_usuario'); },
    get theme() { return localStorage.getItem('tm_theme') || 'dark'; },
    set theme(v) { localStorage.setItem('tm_theme', v); document.documentElement.setAttribute('data-theme', v); }
};

let productDataCache = {};
let materialDataCache = {};
let resumenFinancieroChart, tendenciasChart, materialesChart;

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ 🔌 HTTP WRAPPER (auto-inyecta token, maneja unauthorized)                │
// └─────────────────────────────────────────────────────────────────────────┘

async function apiGet(action, params = {}) {
    const url = new URL(Config.scriptUrl);
    url.searchParams.set('action', action);
    url.searchParams.set('token', Config.token);
    Object.entries(params).forEach(([k, v]) => v !== undefined && v !== null && url.searchParams.set(k, v));
    try {
        const r = await fetch(url.toString());
        const j = await r.json();
        if (j.status === 'unauthorized') { handleSessionExpired(); }
        return j;
    } catch (e) {
        return { status: 'error', message: `Error de conexión: ${e.message}` };
    }
}

async function apiPost(action, data = {}) {
    try {
        const r = await fetch(Config.scriptUrl, {
            method: 'POST',
            body: JSON.stringify({ action, token: Config.token, ...data }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        const j = await r.json();
        if (j.status === 'unauthorized') { handleSessionExpired(); }
        return j;
    } catch (e) {
        return { status: 'error', message: `Error de conexión: ${e.message}` };
    }
}

function handleSessionExpired() {
    Config.token = '';
    Config.usuario = '';
    showLogin();
    toast('warning', 'Sesión expirada', 'Por favor inicia sesión nuevamente.');
}

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ 🚀 BOOTSTRAP                                                              │
// └─────────────────────────────────────────────────────────────────────────┘

document.addEventListener('DOMContentLoaded', () => {
    // Aplicar tema persistido
    document.documentElement.setAttribute('data-theme', Config.theme);

    if (!Config.token) {
        showLogin();
    } else {
        bootApp();
    }

    setupLoginForm();
    setupThemeToggle();
    setupKeyboardShortcuts();
    setupModals();
    setupPWA();
});

function bootApp() {
    document.getElementById('loginOverlay').style.display = 'none';
    document.querySelector('.dashboard-container').style.display = 'flex';
    document.getElementById('currentUserDisplay').textContent = Config.usuario;
    setupNavigation();
    setupForms();
    setupSettings();
    setupReportes();
    loadInitialData();
}

function showLogin() {
    document.getElementById('loginOverlay').style.display = 'flex';
    document.querySelector('.dashboard-container').style.display = 'none';
}

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ 🔐 LOGIN                                                                  │
// └─────────────────────────────────────────────────────────────────────────┘

function setupLoginForm() {
    const configLink = document.getElementById('loginConfigLink');
    if (configLink) {
        configLink.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('login_script_url').value = Config.scriptUrl;
            openModal('loginConfigModal');
        });
    }
    const saveUrlBtn = document.getElementById('login_save_url');
    const testUrlBtn = document.getElementById('login_test_url');
    if (saveUrlBtn) {
        saveUrlBtn.addEventListener('click', () => {
            const newUrl = document.getElementById('login_script_url').value.trim();
            if (!newUrl.startsWith('https://script.google.com/')) {
                return toast('error', 'URL inválida', 'Debe iniciar con https://script.google.com/');
            }
            Config.scriptUrl = newUrl;
            toast('success', 'URL guardada', 'Intenta iniciar sesión ahora.');
            closeModal('loginConfigModal');
        });
    }
    if (testUrlBtn) {
        testUrlBtn.addEventListener('click', async () => {
            const original = Config.scriptUrl;
            const testUrl = document.getElementById('login_script_url').value.trim();
            Config.scriptUrl = testUrl;
            const r = await apiGet('ping');
            Config.scriptUrl = original;
            if (r.status === 'success') {
                toast('success', `Backend v${r.version} OK`, 'La URL responde correctamente.');
            } else {
                toast('error', 'Sin respuesta', r.message || 'El Apps Script no respondió o aún no tiene el endpoint ping (¿es v4?)');
            }
        });
    }

    const form = document.getElementById('loginForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const usuario = document.getElementById('loginUsuario').value.trim();
        const password = document.getElementById('loginPassword').value;
        const btn = document.getElementById('loginBtn');
        const errEl = document.getElementById('loginError');
        errEl.textContent = '';
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Iniciando...';

        const data = await apiPost('validarLogin', { usuario, password });

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Iniciar Sesión';

        if (data.status === 'success') {
            Config.token = data.token;
            Config.usuario = data.usuario;
            toast('success', '¡Bienvenida!', data.message);
            bootApp();
        } else {
            errEl.innerHTML = `<i class="fas fa-times-circle"></i> ${data.message || 'Credenciales inválidas'}`;
        }
    });
}

async function handleLogout() {
    if (!confirm('¿Cerrar sesión?')) return;
    await apiPost('logout', { token: Config.token });
    Config.token = '';
    Config.usuario = '';
    showLogin();
    toast('info', 'Sesión cerrada', 'Hasta luego!');
}

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ 🍞 TOAST NOTIFICATIONS                                                    │
// └─────────────────────────────────────────────────────────────────────────┘

function toast(type, title, message, duration = 4000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const icons = { success: 'check-circle', error: 'times-circle', warning: 'exclamation-triangle', info: 'info-circle' };
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `
        <i class="fas fa-${icons[type] || 'info-circle'}"></i>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            ${message ? `<div class="toast-message">${message}</div>` : ''}
        </div>
        <button class="toast-close" aria-label="Cerrar">&times;</button>
    `;
    container.appendChild(el);
    el.querySelector('.toast-close').addEventListener('click', () => removeToast(el));
    requestAnimationFrame(() => el.classList.add('show'));
    if (duration > 0) setTimeout(() => removeToast(el), duration);
}

function removeToast(el) {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
}

// Compat: mantener displayStatus para código existente, pero también usa toast
function displayStatus(elementId, type, message) {
    const el = document.getElementById(elementId);
    if (el) {
        el.className = `status-message ${type}`;
        el.textContent = message;
        el.style.display = 'block';
        setTimeout(() => el.style.display = 'none', 5000);
    }
    const titleMap = { success: 'Éxito', error: 'Error', warning: 'Atención', info: 'Info' };
    toast(type, titleMap[type] || 'Notificación', message);
}

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ 🪟 MODALES                                                                │
// └─────────────────────────────────────────────────────────────────────────┘

function setupModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal.id);
        });
        const closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) closeBtn.addEventListener('click', () => closeModal(modal.id));
    });
}

function openModal(id) {
    const m = document.getElementById(id);
    if (m) { m.classList.add('active'); document.body.style.overflow = 'hidden'; }
}

function closeModal(id) {
    const m = document.getElementById(id);
    if (m) { m.classList.remove('active'); document.body.style.overflow = ''; }
}

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ 🌓 TEMA CLARO/OSCURO                                                      │
// └─────────────────────────────────────────────────────────────────────────┘

function setupThemeToggle() {
    const btn = document.getElementById('themeToggleBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
        Config.theme = Config.theme === 'dark' ? 'light' : 'dark';
        btn.innerHTML = `<i class="fas fa-${Config.theme === 'dark' ? 'sun' : 'moon'}"></i>`;
        toast('info', 'Tema cambiado', `Modo ${Config.theme === 'dark' ? 'oscuro' : 'claro'} activado.`, 2000);
    });
    btn.innerHTML = `<i class="fas fa-${Config.theme === 'dark' ? 'sun' : 'moon'}"></i>`;
}

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ ⌨️ ATAJOS DE TECLADO                                                       │
// └─────────────────────────────────────────────────────────────────────────┘

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.target.matches('input,textarea,select')) return;
        if (e.ctrlKey || e.metaKey) {
            const map = {
                '1': 'dashboard', '2': 'inventario', '3': 'productos',
                '4': 'compras', '5': 'ventas', '6': 'resumenes',
                'h': 'historial', ',': 'configuracion'
            };
            if (map[e.key]) { e.preventDefault(); navigateTo(map[e.key]); }
            if (e.key === 'k') { e.preventDefault(); focusGlobalSearch(); }
        }
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.active').forEach(m => closeModal(m.id));
        }
    });
}

function focusGlobalSearch() {
    const activeSection = document.querySelector('.content-section.active');
    if (!activeSection) return;
    const input = activeSection.querySelector('input[type="text"], input[type="search"]');
    if (input) input.focus();
}

function navigateTo(sectionId) {
    const link = document.querySelector(`.sidebar-nav a[data-section="${sectionId}"]`);
    if (link) link.click();
}

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ 🧭 NAVEGACIÓN                                                              │
// └─────────────────────────────────────────────────────────────────────────┘

function setupNavigation() {
    const links = document.querySelectorAll('.sidebar-nav a');
    const sections = document.querySelectorAll('.main-content .content-section');
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-section');
            links.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            sections.forEach(s => s.classList.toggle('active', s.id === targetId));

            if (targetId === 'dashboard') handleLoadDashboard();
            else if (targetId === 'inventario') document.getElementById('cargarInventarioBtn').click();
            else if (targetId === 'historial') cargarHistorial();
        });
    });

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
}

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ 📥 CARGA INICIAL                                                          │
// └─────────────────────────────────────────────────────────────────────────┘

async function loadInitialData() {
    const data = await apiGet('getCategorias');
    if (data.status === 'success') populateCategories(data.data);
    else populateCategories([]);
}

function populateCategories(categories) {
    const select = document.getElementById('p_categoria');
    const editSelect = document.getElementById('edit_p_categoria');
    [select, editSelect].forEach(s => {
        if (!s) return;
        s.innerHTML = '';
        if (categories.length === 0) {
            s.innerHTML = '<option value="" disabled selected>No hay categorías</option>';
            return;
        }
        s.innerHTML = '<option value="" disabled selected>Seleccione una categoría</option>';
        categories.forEach(cat => {
            const name = cat.nombre || `(ID ${cat.id})`;
            s.innerHTML += `<option value="${name}">${name}</option>`;
        });
    });

    const lista = document.getElementById('listaCategorias');
    if (lista) {
        if (categories.length === 0) {
            lista.innerHTML = '<li>No hay categorías.</li>';
        } else {
            lista.innerHTML = categories.map(c =>
                `<li><strong>${c.nombre || '(sin nombre)'}</strong><br><small>${c.id}</small></li>`
            ).join('');
        }
    }
}

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ 🎛️ FORMS PRINCIPALES                                                       │
// └─────────────────────────────────────────────────────────────────────────┘

function setupForms() {
    document.getElementById('iniciarDBBtn').addEventListener('click', () => handleConfigAction('iniciar'));
    document.getElementById('resetDBBtn').addEventListener('click', () => {
        if (confirm("¡ADVERTENCIA! ¿Resetear TODA la base de datos? Esto es irreversible.")) {
            handleConfigAction('resetear');
        }
    });

    document.getElementById('categoriaForm').addEventListener('submit', (e) => handlePostAction(e, 'agregarCategoria', 'statusCategoria'));
    document.getElementById('productoForm').addEventListener('submit', (e) => handlePostAction(e, 'agregarProducto', 'statusProducto'));

    document.getElementById('co_query').addEventListener('input', (e) => handleQueryFilter(e.target.value, 'co'));
    document.getElementById('v_query').addEventListener('input', (e) => handleQueryFilter(e.target.value, 'v'));

    document.getElementById('compraForm').addEventListener('submit', (e) => handleTransactionPost(e, 'compra'));
    document.getElementById('ventaForm').addEventListener('submit', (e) => handleTransactionPost(e, 'venta'));

    document.getElementById('resumenVentasBtn').addEventListener('click', () => loadSummary('Ventas'));
    document.getElementById('resumenComprasBtn').addEventListener('click', () => loadSummary('Compras'));

    document.getElementById('cargarInventarioBtn').addEventListener('click', loadInventario);
    document.getElementById('cargarDatosGraficosBtn').addEventListener('click', handleLoadDashboard);
    document.getElementById('calcularResumenBtn').addEventListener('click', calcularResumenFinanciero);

    // Edición producto modal
    document.getElementById('editProductForm').addEventListener('submit', handleEditProductSubmit);

    // Export Excel
    document.querySelectorAll('[data-export-excel]').forEach(btn => {
        btn.addEventListener('click', () => exportTableToExcel(btn.dataset.exportExcel));
    });
}

async function handleConfigAction(action) {
    displayStatus('statusConfig', 'info', `Ejecutando "${action}"...`);
    const data = await apiGet(action);
    displayStatus('statusConfig', data.status === 'success' ? 'success' : 'error', data.message);
}

async function handlePostAction(e, action, statusId) {
    e.preventDefault();
    const form = e.target;
    const payload = { action };
    if (action === 'agregarCategoria') {
        payload.nombre = document.getElementById('c_nombre').value;
    } else if (action === 'agregarProducto') {
        payload.nombre = document.getElementById('p_nombre').value;
        payload.codigo = document.getElementById('p_codigo').value;
        payload.categoria = document.getElementById('p_categoria').value;
        payload.precio_compra = document.getElementById('p_precio_compra').value;
        payload.precio_venta = document.getElementById('p_precio_venta').value;
        payload.stock = document.getElementById('p_stock').value;
    }
    const data = await apiPost(action, payload);
    displayStatus(statusId, data.status === 'success' ? 'success' : 'error', data.message);
    if (data.status === 'success') {
        form.reset();
        if (action === 'agregarCategoria') loadInitialData();
    }
}

async function handleQueryFilter(query, prefix) {
    const detailDiv = document.getElementById(`${prefix}_product_details`);
    const submitBtn = document.getElementById(`${prefix}_submit_btn`);
    const productoIdInput = document.getElementById(`${prefix}_producto_id`);

    if (query.trim().length < 2) {
        detailDiv.classList.add('hidden');
        submitBtn.disabled = true;
        productoIdInput.value = '';
        return;
    }

    if (productDataCache[query]) {
        displayProductDetails(productDataCache[query], prefix);
        return;
    }

    const data = await apiGet('buscarProducto', { query });
    if (data.status === 'success' && data.data && data.data.length > 0) {
        productDataCache[query] = data.data[0];
        displayProductDetails(data.data[0], prefix);
    } else {
        detailDiv.innerHTML = '<p style="color: var(--warning-color);">⚠️ Producto no encontrado.</p>';
        detailDiv.classList.remove('hidden');
        submitBtn.disabled = true;
        productoIdInput.value = '';
    }
}

function displayProductDetails(product, prefix) {
    const detailDiv = document.getElementById(`${prefix}_product_details`);
    const submitBtn = document.getElementById(`${prefix}_submit_btn`);
    const productoIdInput = document.getElementById(`${prefix}_producto_id`);
    const precioInput = document.getElementById(`${prefix}_precio_${prefix === 'co' ? 'compra' : 'venta'}`);

    detailDiv.innerHTML = `
        <strong><i class="fas fa-cube"></i> ${product.nombre}</strong> (Código: ${product.código})<br>
        <small>Categoría: ${product.categoría} | Stock: <strong>${product.stock}</strong></small><br>
        <small>P. Compra: $${parseFloat(product.precio_compra).toFixed(2)} | P. Venta: $${parseFloat(product.precio_venta).toFixed(2)}</small>
    `;
    detailDiv.classList.remove('hidden');
    productoIdInput.value = product.id;
    submitBtn.disabled = false;

    const sugerido = prefix === 'co' ? product.precio_compra : product.precio_venta;
    if (precioInput && !precioInput.value) precioInput.value = parseFloat(sugerido).toFixed(2);
}

async function handleTransactionPost(e, type) {
    e.preventDefault();
    const prefix = type === 'compra' ? 'co' : 'v';
    const statusId = type === 'compra' ? 'statusCompra' : 'statusVenta';
    const payload = {
        action: 'registrarTransaccion',
        type,
        producto_id: document.getElementById(`${prefix}_producto_id`).value,
        cantidad: document.getElementById(`${prefix}_cantidad`).value,
        precio: document.getElementById(`${prefix}_precio_${type === 'compra' ? 'compra' : 'venta'}`).value,
        extra_data: document.getElementById(`${prefix}_${type === 'compra' ? 'proveedor' : 'cliente'}`).value
    };
    const data = await apiPost('registrarTransaccion', payload);
    displayStatus(statusId, data.status === 'success' ? 'success' : 'warning', data.message);
    if (data.status === 'success') {
        e.target.reset();
        document.getElementById(`${prefix}_product_details`).classList.add('hidden');
        document.getElementById(`${prefix}_submit_btn`).disabled = true;
        productDataCache = {};
    }
}

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ 📦 INVENTARIO (con Edit/Delete)                                            │
// └─────────────────────────────────────────────────────────────────────────┘

async function loadInventario() {
    const statusEl = 'statusInventario';
    const statusNode = document.getElementById(statusEl);
    displayStatusInline(statusEl, 'info', 'Cargando inventario...');
    const data = await apiGet('getInventario');
    const tbody = document.getElementById('inventarioTableBody');

    if (data.status === 'success' && data.data) {
        if (statusNode) statusNode.style.display = 'none';
        if (data.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:2rem;">No hay productos registrados.</td></tr>';
            return;
        }
        const stockBajo = 5;
        tbody.innerHTML = data.data.map(p => {
            const stock = parseInt(p.stock);
            const stockColor = stock <= 0 ? 'var(--danger-color)' : (stock <= stockBajo ? 'var(--warning-color)' : 'inherit');
            return `<tr data-id="${p.id}">
                <td><small>${p.id}</small></td>
                <td>${p.nombre}</td>
                <td>${p.código}</td>
                <td>${p.categoría}</td>
                <td style="color: ${stockColor}; font-weight: bold;">${stock}</td>
                <td>$${parseFloat(p.precio_venta).toFixed(2)}</td>
                <td>
                    <button class="btn-icon btn-edit" title="Editar" data-edit="${p.id}"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon btn-delete" title="Eliminar" data-delete="${p.id}"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        }).join('');

        tbody.querySelectorAll('[data-edit]').forEach(btn => {
            btn.addEventListener('click', () => openEditProduct(btn.dataset.edit, data.data));
        });
        tbody.querySelectorAll('[data-delete]').forEach(btn => {
            btn.addEventListener('click', () => deleteProduct(btn.dataset.delete, data.data));
        });
        toast('success', 'Inventario cargado', `${data.data.length} productos`);
    } else {
        if (statusNode) statusNode.style.display = 'none';
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: var(--warning-color);">${data.message || 'Sin datos'}</td></tr>`;
    }
}

function displayStatusInline(id, type, msg) {
    const el = document.getElementById(id);
    if (el) {
        el.className = `status-message ${type}`;
        el.textContent = msg;
        el.style.display = 'block';
    }
}

function openEditProduct(id, allProducts) {
    const p = allProducts.find(x => x.id === id);
    if (!p) return toast('error', 'Producto no encontrado');
    document.getElementById('edit_p_id').value = p.id;
    document.getElementById('edit_p_nombre').value = p.nombre;
    document.getElementById('edit_p_codigo').value = p.código;
    document.getElementById('edit_p_categoria').value = p.categoría;
    document.getElementById('edit_p_precio_compra').value = p.precio_compra;
    document.getElementById('edit_p_precio_venta').value = p.precio_venta;
    document.getElementById('edit_p_stock').value = p.stock;
    openModal('editProductModal');
}

async function handleEditProductSubmit(e) {
    e.preventDefault();
    const payload = {
        action: 'editarProducto',
        id: document.getElementById('edit_p_id').value,
        nombre: document.getElementById('edit_p_nombre').value,
        codigo: document.getElementById('edit_p_codigo').value,
        categoria: document.getElementById('edit_p_categoria').value,
        precio_compra: document.getElementById('edit_p_precio_compra').value,
        precio_venta: document.getElementById('edit_p_precio_venta').value,
        stock: document.getElementById('edit_p_stock').value
    };
    const data = await apiPost('editarProducto', payload);
    if (data.status === 'success') {
        toast('success', 'Producto actualizado', data.message);
        closeModal('editProductModal');
        loadInventario();
    } else {
        toast('error', 'Error', data.message);
    }
}

async function deleteProduct(id, allProducts) {
    const p = allProducts.find(x => x.id === id);
    const nombre = p ? p.nombre : id;
    if (!confirm(`¿Eliminar producto "${nombre}"? Esta acción es irreversible.`)) return;

    const data = await apiPost('eliminarProducto', { action: 'eliminarProducto', id });
    if (data.status === 'success') {
        toast('success', 'Producto eliminado', data.message);
        loadInventario();
    } else {
        toast('error', 'Error', data.message);
    }
}

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ 📊 DASHBOARD                                                              │
// └─────────────────────────────────────────────────────────────────────────┘

async function handleLoadDashboard() {
    const [ventas, compras] = await Promise.all([
        apiGet('getData', { sheetName: 'Ventas' }),
        apiGet('getData', { sheetName: 'Compras' })
    ]);

    const totalVentas = (ventas.data || []).reduce((s, v) => s + (parseFloat(v.cantidad) * parseFloat(v.precio_venta) || 0), 0);
    const totalCompras = (compras.data || []).reduce((s, c) => s + (parseFloat(c.cantidad) * parseFloat(c.precio_compra) || 0), 0);
    const ganancia = totalVentas - totalCompras;

    document.getElementById('totalVentas').textContent = `$${totalVentas.toFixed(2)}`;
    document.getElementById('totalCompras').textContent = `$${totalCompras.toFixed(2)}`;
    document.getElementById('totalGanancias').textContent = `$${ganancia.toFixed(2)}`;
    document.getElementById('totalGastos').textContent = `$${totalCompras.toFixed(2)}`;

    renderDashboardChart(totalVentas, totalCompras, ganancia);
}

function renderDashboardChart(v, c, g) {
    const ctx = document.getElementById('resumenFinancieroChart');
    if (!ctx) return;
    if (resumenFinancieroChart) resumenFinancieroChart.destroy();
    resumenFinancieroChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Ventas', 'Compras', 'Ganancia'],
            datasets: [{
                label: 'Resumen Financiero ($)',
                data: [v, c, g],
                backgroundColor: ['rgba(34, 197, 94, 0.7)', 'rgba(239, 68, 68, 0.7)', 'rgba(139, 92, 246, 0.7)']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

async function calcularResumenFinanciero() {
    displayStatus('statusDashboard', 'info', 'Recalculando resumen financiero...');
    await handleLoadDashboard();
    displayStatus('statusDashboard', 'success', 'Resumen actualizado.');
}

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ 📋 RESÚMENES                                                              │
// └─────────────────────────────────────────────────────────────────────────┘

async function loadSummary(sheetName) {
    displayStatus('statusResumen', 'info', `Cargando ${sheetName}...`);
    const data = await apiGet('getData', { sheetName });
    renderResumenTable(data, sheetName);
}

function renderResumenTable(data, label) {
    const table = document.getElementById('resumenTable');
    const tbody = document.getElementById('resumenTableBody');
    const thead = table.querySelector('thead');
    if (data.status !== 'success' || !data.data || data.data.length === 0) {
        displayStatus('statusResumen', 'warning', `Sin datos en ${label}.`);
        table.classList.add('hidden');
        return;
    }
    const headers = Object.keys(data.data[0]);
    thead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
    tbody.innerHTML = data.data.map(r =>
        `<tr>${headers.map(h => `<td>${formatCellValue(r[h])}</td>`).join('')}</tr>`
    ).join('');
    table.classList.remove('hidden');
    table.dataset.label = label;
    displayStatus('statusResumen', 'success', `${data.data.length} registros en ${label}.`);
}

function formatCellValue(v) {
    if (v == null || v === '') return '';
    if (v instanceof Date || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v))) {
        try { return new Date(v).toLocaleString('es-MX'); } catch { return v; }
    }
    if (typeof v === 'number' && !Number.isInteger(v)) return v.toFixed(2);
    return v;
}

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ 📅 REPORTES POR RANGO DE FECHA                                             │
// └─────────────────────────────────────────────────────────────────────────┘

function setupReportes() {
    const form = document.getElementById('reporteFechaForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const sheetName = document.getElementById('reporte_sheet').value;
        const from = document.getElementById('reporte_from').value;
        const to = document.getElementById('reporte_to').value;
        if (!from || !to) return toast('warning', 'Faltan fechas', 'Selecciona rango de fechas.');

        const data = await apiGet('getReporteFecha', { sheetName, from, to });
        renderReporteFecha(data, sheetName);
    });
}

function renderReporteFecha(data, sheetName) {
    const result = document.getElementById('reporteResultado');
    if (data.status !== 'success') {
        result.innerHTML = `<p class="status-message error">${data.message}</p>`;
        return;
    }
    if (data.data.length === 0) {
        result.innerHTML = `<p class="status-message warning">Sin registros en el rango.</p>`;
        return;
    }
    const headers = Object.keys(data.data[0]);
    const totalText = data.meta && data.meta.totalAmount ? `<div class="reporte-total">💵 Total: <strong>$${data.meta.totalAmount.toFixed(2)}</strong> en ${data.meta.count} registros</div>` : '';
    result.innerHTML = `
        ${totalText}
        <div style="overflow-x:auto;">
        <table class="data-table" id="reporteTable" data-label="${sheetName}_${data.meta.from}_${data.meta.to}">
            <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>${data.data.map(r => `<tr>${headers.map(h => `<td>${formatCellValue(r[h])}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
        </div>
        <button class="btn primary-btn" data-export-excel="reporteTable" style="margin-top:1rem;">
            <i class="fas fa-file-excel"></i> Exportar Excel
        </button>
    `;
    result.querySelector('[data-export-excel]').addEventListener('click', () => exportTableToExcel('reporteTable'));
}

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ 📜 HISTORIAL DE CAMBIOS                                                    │
// └─────────────────────────────────────────────────────────────────────────┘

async function cargarHistorial() {
    const tbody = document.getElementById('historialTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Cargando...</td></tr>';
    const data = await apiGet('getHistorial', { limit: 200 });
    if (data.status !== 'success' || !data.data || data.data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Sin actividad registrada.</td></tr>';
        return;
    }
    tbody.innerHTML = data.data.map(h => `
        <tr>
            <td>${formatCellValue(h.timestamp)}</td>
            <td>${h.usuario}</td>
            <td><span class="badge badge-${h.accion.includes('eliminar') ? 'danger' : (h.accion.includes('editar') ? 'warning' : 'info')}">${h.accion}</span></td>
            <td>${h.entidad}</td>
            <td><small>${h.entidad_id}</small></td>
            <td><button class="btn-icon" data-detail='${escapeAttr(JSON.stringify({antes: h.antes_json, despues: h.despues_json}))}'><i class="fas fa-eye"></i></button></td>
        </tr>
    `).join('');
    tbody.querySelectorAll('[data-detail]').forEach(btn => {
        btn.addEventListener('click', () => {
            const d = JSON.parse(btn.dataset.detail);
            document.getElementById('historialDetailContent').innerHTML = `
                <h4>Antes:</h4><pre>${d.antes || '(sin datos)'}</pre>
                <h4>Después:</h4><pre>${d.despues || '(sin datos)'}</pre>
            `;
            openModal('historialDetailModal');
        });
    });
}

function escapeAttr(s) { return s.replace(/'/g, '&#39;').replace(/"/g, '&quot;'); }

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ 📊 EXPORT EXCEL (SheetJS)                                                  │
// └─────────────────────────────────────────────────────────────────────────┘

function exportTableToExcel(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return toast('error', 'Tabla no encontrada');
    if (typeof XLSX === 'undefined') return toast('error', 'SheetJS no cargado');

    const ws = XLSX.utils.table_to_sheet(table);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Datos');
    const label = table.dataset.label || tableId;
    const filename = `tecnomania_${label}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
    toast('success', 'Excel exportado', filename);
}

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ ⚙️ SETTINGS RUNTIME                                                        │
// └─────────────────────────────────────────────────────────────────────────┘

function setupSettings() {
    const scriptUrlInput = document.getElementById('settings_script_url');
    const spreadsheetIdInput = document.getElementById('settings_spreadsheet_id');
    const saveBtn = document.getElementById('settings_save');
    const testBtn = document.getElementById('settings_test');
    const backupBtn = document.getElementById('settings_backup');
    const restoreInput = document.getElementById('settings_restore_input');

    if (backupBtn) backupBtn.addEventListener('click', descargarBackupCompleto);
    if (restoreInput) restoreInput.addEventListener('change', (e) => restaurarBackupDesdeArchivo(e.target.files[0]));

    if (!scriptUrlInput) return;

    scriptUrlInput.value = Config.scriptUrl;
    spreadsheetIdInput.value = Config.spreadsheetId;

    saveBtn.addEventListener('click', () => {
        const newUrl = scriptUrlInput.value.trim();
        const newSid = spreadsheetIdInput.value.trim();
        if (!newUrl.startsWith('https://script.google.com/')) {
            return toast('error', 'URL inválida', 'Debe iniciar con https://script.google.com/');
        }
        Config.scriptUrl = newUrl;
        Config.spreadsheetId = newSid;
        toast('success', 'Configuración guardada', 'Los cambios aplicarán a las próximas operaciones.');
    });

    testBtn.addEventListener('click', async () => {
        const original = Config.scriptUrl;
        const testUrl = scriptUrlInput.value.trim();
        Config.scriptUrl = testUrl;
        const r = await apiGet('ping');
        Config.scriptUrl = original; // revert por si test falla
        if (r.status === 'success') {
            toast('success', 'Conexión OK', `Backend v${r.version} respondió.`);
        } else {
            toast('error', 'Conexión falló', r.message || 'Sin respuesta');
        }
    });
}

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ 💾 BACKUP COMPLETO / RESTORE                                              │
// └─────────────────────────────────────────────────────────────────────────┘

async function descargarBackupCompleto() {
    toast('info', 'Generando backup', 'Descargando todas las pestañas...');
    const data = await apiGet('exportarBackupCompleto');
    if (data.status !== 'success') return toast('error', 'Error', data.message);

    const filename = `tecnomania_backup_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
    const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('success', 'Backup descargado', filename);

    // También ofrecer descarga como Excel multi-hoja
    if (typeof XLSX !== 'undefined') {
        const wb = XLSX.utils.book_new();
        Object.entries(data.data.data).forEach(([sheetName, sheetData]) => {
            if (!sheetData.headers || sheetData.headers.length === 0) return;
            const aoa = [sheetData.headers, ...sheetData.rows];
            const ws = XLSX.utils.aoa_to_sheet(aoa);
            XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31)); // Excel sheet name max 31 chars
        });
        const xlsxName = filename.replace('.json', '.xlsx');
        XLSX.writeFile(wb, xlsxName);
        toast('success', 'Backup Excel descargado', xlsxName);
    }
}

async function restaurarBackupDesdeArchivo(file) {
    if (!file) return;
    if (!confirm(`¿Restaurar backup desde "${file.name}"? Esto SOBREESCRIBIRÁ los datos actuales. Asegúrate de tener tu backup ACTUAL descargado primero.`)) return;

    try {
        const text = await file.text();
        const backup = JSON.parse(text);
        if (!backup.data) return toast('error', 'Archivo inválido', 'No tiene estructura de backup válida.');

        toast('info', 'Restaurando', `${Object.keys(backup.data).length} pestañas...`);
        const result = await apiPost('restaurarBackup', { backup });
        if (result.status === 'success') {
            toast('success', 'Backup restaurado', result.message, 8000);
            loadInventario();
            loadInitialData();
        } else {
            toast('error', 'Error restaurando', result.message);
        }
    } catch (e) {
        toast('error', 'Error', `No se pudo leer el archivo: ${e.message}`);
    }
}

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ 📱 PWA + SERVICE WORKER                                                    │
// └─────────────────────────────────────────────────────────────────────────┘

function setupPWA() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js').catch(err => {
            console.warn('SW register failed:', err);
        });
    }
    let installPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        installPrompt = e;
        const btn = document.getElementById('pwaInstallBtn');
        if (btn) {
            btn.style.display = 'inline-flex';
            btn.addEventListener('click', () => {
                installPrompt.prompt();
                installPrompt.userChoice.then(c => {
                    if (c.outcome === 'accepted') toast('success', 'App instalada');
                    btn.style.display = 'none';
                    installPrompt = null;
                });
            });
        }
    });
}
