// ═══════════════════════════════════════════════════════════════════════════
// 🧾 TICKET DE VENTA — núcleo compartido (app + preview)
// ═══════════════════════════════════════════════════════════════════════════
// Expone: construirTicketHTML(t) y imprimirTicketVenta(t)
// t = { producto, codigo, cantidad, precio, cliente }
// ═══════════════════════════════════════════════════════════════════════════

function _ticketEsc(s) {
    return String(s).replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

// Devuelve SOLO el contenido interno del ticket (sin <html>/<head>), reutilizable
// para previsualizar inline y para la ventana de impresión.
function construirTicketHTML(t) {
    const esc = _ticketEsc;
    const money = (n) => '$' + Number(n).toFixed(2);
    const total = (Number(t.cantidad) || 0) * (Number(t.precio) || 0);
    const fecha = new Date();
    const fechaStr = fecha.toLocaleString('es-DO', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
    const folio = 'TM-' + fecha.getTime().toString().slice(-8);
    const vendedor = (typeof Config !== 'undefined' && Config.usuario) ? Config.usuario : 'N/D';

    return `
  <div class="tk-center tk-big tk-b">TECNOMANIA!</div>
  <div class="tk-center">Ticket de Venta</div>
  <hr>
  <table>
    <tr><td>Folio:</td><td class="tk-r tk-b">${esc(folio)}</td></tr>
    <tr><td>Fecha:</td><td class="tk-r">${esc(fechaStr)}</td></tr>
    <tr><td>Cliente:</td><td class="tk-r">${esc(t.cliente || 'Consumidor Final')}</td></tr>
    <tr><td>Atendió:</td><td class="tk-r">${esc(vendedor)}</td></tr>
  </table>
  <hr>
  <table>
    <tr class="tk-b"><td>Producto</td><td class="tk-r">Importe</td></tr>
    <tr><td colspan="2">${esc(t.producto)}${t.codigo ? ' (' + esc(t.codigo) + ')' : ''}</td></tr>
    <tr><td>${Number(t.cantidad) || 0} x ${money(t.precio)}</td><td class="tk-r">${money(total)}</td></tr>
  </table>
  <hr>
  <table>
    <tr class="tk-total"><td>TOTAL</td><td class="tk-r">${money(total)}</td></tr>
  </table>
  <hr>
  <div class="tk-center tk-foot">¡Gracias por su compra!<br>Conserve este ticket</div>`;
}

const _TICKET_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; color: #000; background: #fff;
         width: 80mm; padding: 6mm 4mm; font-size: 12px; line-height: 1.4; }
  .tk-center { text-align: center; }
  .tk-b { font-weight: bold; }
  .tk-big { font-size: 16px; }
  hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1px 0; vertical-align: top; }
  td.tk-r { text-align: right; }
  .tk-total td { font-weight: bold; font-size: 14px; padding-top: 4px; }
  .tk-foot { margin-top: 10px; font-size: 11px; }
  @media print { body { width: auto; } }`;

function imprimirTicketVenta(t) {
    const inner = construirTicketHTML(t);
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">` +
        `<title>Ticket de Venta</title><style>${_TICKET_CSS}</style></head>` +
        `<body>${inner}</body></html>`;

    // Imprimimos desde un <iframe> oculto en la MISMA página (no usa window.open),
    // así el navegador NO lo bloquea como ventana emergente aunque se llame
    // después de un await (la petición al backend rompe el gesto del usuario).
    const old = document.getElementById('tm-ticket-frame');
    if (old) old.remove();

    const frame = document.createElement('iframe');
    frame.id = 'tm-ticket-frame';
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    frame.srcdoc = html;

    frame.onload = () => {
        try {
            const win = frame.contentWindow;
            win.focus();
            win.print();
        } catch (e) {
            if (typeof toast === 'function') {
                toast('warning', 'No se pudo imprimir', e.message);
            } else {
                alert('No se pudo abrir el diálogo de impresión: ' + e.message);
            }
        }
        // Quitamos el iframe tras dar tiempo a que el diálogo de impresión lo lea.
        setTimeout(() => frame.remove(), 1000);
    };

    document.body.appendChild(frame);
}
