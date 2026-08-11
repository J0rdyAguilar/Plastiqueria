function money(value) {
  return `Q${Number(value || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return new Date().toLocaleString();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function safeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getMetodoPagoLabel(value) {
  if (value === "tarjeta") return "Tarjeta";
  if (value === "cuotas") return "Crédito";
  return "Efectivo";
}

export function imprimirTicketVenta({
  venta = null,
  items = [],
  total = 0,
  metodoPago = "",
  nombreComprador = "",
  clienteNombre = "",
  saldoPendiente = 0,
  printWindow = null,
}) {
  // Para pedidos enviados a Caja, la fecha oficial es la del cobro/finalización.
  // Las ventas directas conservan la fecha de creación que ya usaba el ticket.
  const fecha =
    venta?.cobrado_en ||
    venta?.creado_en ||
    venta?.fecha ||
    venta?.created_at ||
    new Date().toISOString();

  const codigo = venta?.codigo || venta?.id || `VT-${new Date().getTime()}`;

  const html = `
    <!doctype html>
    <html lang="es">
    <head>
      <meta charset="utf-8" />
      <title>Ticket venta #${safeHtml(codigo)}</title>
      <style>
        * { box-sizing: border-box; }
        html, body {
          margin: 0;
          padding: 0;
          background: #ffffff;
          color: #111827;
          font-family: Arial, Helvetica, sans-serif;
        }
        body { padding: 12px; }
        .ticket { width: 80mm; margin: 0 auto; }
        .center { text-align: center; }
        .title { font-size: 20px; font-weight: 800; margin-bottom: 2px; }
        .subtitle { font-size: 12px; color: #4b5563; margin-bottom: 10px; }
        .box {
          border-top: 1px dashed #9ca3af;
          border-bottom: 1px dashed #9ca3af;
          padding: 8px 0;
          margin: 8px 0;
        }
        .row {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          margin: 4px 0;
          font-size: 12px;
        }
        .label { color: #4b5563; }
        .line-item {
          padding: 7px 0;
          border-bottom: 1px dashed #d1d5db;
        }
        .prod {
          font-size: 13px;
          font-weight: 700;
          margin-bottom: 4px;
        }
        .muted {
          color: #6b7280;
          font-size: 11px;
        }
        .totals {
          margin-top: 10px;
          border-top: 2px solid #111827;
          padding-top: 8px;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          font-size: 18px;
          font-weight: 800;
        }
        .footer {
          margin-top: 14px;
          text-align: center;
          font-size: 11px;
          color: #6b7280;
        }
        @media print {
          body { padding: 0; }
          .ticket { width: 80mm; }
        }
      </style>
    </head>
    <body>
      <div class="ticket">
        <div class="center">
          <div class="title">PLASTIMAX</div>
          <div class="subtitle">Ticket de venta</div>
        </div>

        <div class="box">
          <div class="row"><span class="label">Venta:</span><strong>#${safeHtml(codigo)}</strong></div>
          <div class="row"><span class="label">Fecha:</span><strong>${safeHtml(formatDate(fecha))}</strong></div>
          <div class="row"><span class="label">Comprador:</span><strong>${safeHtml(nombreComprador || clienteNombre || "Consumidor final")}</strong></div>
          <div class="row"><span class="label">Pago:</span><strong>${safeHtml(getMetodoPagoLabel(metodoPago))}</strong></div>
          ${
            metodoPago === "cuotas"
              ? `
                <div class="row"><span class="label">Saldo pendiente:</span><strong>${safeHtml(
                  money(saldoPendiente || total)
                )}</strong></div>
              `
              : ""
          }
        </div>

        <div>
          ${items
            .map(
              (d) => `
            <div class="line-item">
              <div class="prod">${safeHtml(
                `${d.nombre || d.producto_nombre || "Producto"}${
                  d.presentacion ? ` - ${d.presentacion}` : ""
                }`
              )}</div>
              <div class="row">
                <span class="muted">${safeHtml(
                  Number(d.cantidad || 0)
                )} x ${safeHtml(money(d.precio_unitario))}</span>
                <strong>${safeHtml(
                  money(
                    d.subtotal ??
                      Number(d.cantidad || 0) * Number(d.precio_unitario || 0)
                  )
                )}</strong>
              </div>
            </div>
          `
            )
            .join("")}
        </div>

        <div class="totals">
          <div class="total-row">
            <span>Total</span>
            <span>${safeHtml(money(total))}</span>
          </div>
        </div>

        <div class="footer">
          Impreso el ${safeHtml(new Date().toLocaleString())}<br/>
          Gracias por su compra
        </div>
      </div>

      <script>
        window.onload = function() {
          window.print();
          window.onafterprint = function() {
            window.close();
          };
        };
      </script>
    </body>
    </html>
  `;

  const win = printWindow || window.open("", "_blank", "width=420,height=760");
  if (!win) {
    alert("El navegador bloqueó la ventana de impresión.");
    return false;
  }

  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}
