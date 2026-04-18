import React, { useEffect, useMemo, useState } from "react";
import { pedidosAdminApi } from "../lib/pedidosAdmin";
import { notify } from "../lib/notify";
import { usuariosApi } from "../lib/usuarios";
import { getSession } from "../lib/auth";

function money(n) {
  return `Q ${Number(n || 0).toFixed(2)}`;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function InlineLoader() {
  return (
    <div className="mini-loader-wrap" aria-label="Cargando">
      <span className="mini-loader"></span>
    </div>
  );
}

function TableLoader() {
  return (
    <div className="table-loader-wrap" aria-label="Cargando">
      <div className="table-loader-ring"></div>
    </div>
  );
}

function ModalLoader({ text = "Cargando..." }) {
  return (
    <div className="modal-loader-wrap" aria-label={text}>
      <div className="modal-loader-ring"></div>
      <div className="modal-loader-text">{text}</div>
    </div>
  );
}

function badgeStyle(estado) {
  const base = {
    display: "inline-block",
    padding: "6px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    textTransform: "capitalize",
    whiteSpace: "nowrap",
    border: "1px solid transparent",
  };

  switch (estado) {
    case "pendiente_revision":
      return {
        ...base,
        background: "#fff7ed",
        color: "#9a3412",
        borderColor: "#fed7aa",
      };
    case "aprobado":
      return {
        ...base,
        background: "#ecfeff",
        color: "#155e75",
        borderColor: "#a5f3fc",
      };
    case "preparando":
      return {
        ...base,
        background: "#ecfdf5",
        color: "#166534",
        borderColor: "#bbf7d0",
      };
    case "en_ruta":
      return {
        ...base,
        background: "#eff6ff",
        color: "#1d4ed8",
        borderColor: "#bfdbfe",
      };
    case "entregado":
      return {
        ...base,
        background: "#f3f4f6",
        color: "#374151",
        borderColor: "#d1d5db",
      };
    default:
      return {
        ...base,
        background: "#eef2ff",
        color: "#3730a3",
        borderColor: "#c7d2fe",
      };
  }
}

function estadoLabel(estado) {
  return String(estado || "").replaceAll("_", " ");
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
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
  const raw = String(value || "").toLowerCase().trim();
  if (!raw) return "No especificado";
  if (raw === "tarjeta") return "Tarjeta";
  if (raw === "cuotas" || raw === "credito" || raw === "crédito") return "Crédito";
  if (raw === "efectivo") return "Efectivo";
  return raw.replaceAll("_", " ");
}

function getMonthRange(year, month) {
  const y = Number(year);
  const m = Number(month);

  if (!y || !m) {
    return { fecha_desde: "", fecha_hasta: "" };
  }

  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);

  const fecha_desde = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  const fecha_hasta = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;

  return { fecha_desde, fecha_hasta };
}

function mapDetalleToLinea(d) {
  const cantidadReal = num(d.cantidad);
  const cantidadBase = num(d.cantidad_base);
  const cantidad = cantidadReal > 0 ? cantidadReal : cantidadBase;

  const precioCosto = num(d.precio_costo);
  const precioVenta = num(d.precio_unitario);
  const subtotal = num(d.subtotal) || cantidad * precioVenta;
  const gananciaUnitaria = num(d.ganancia_unitaria) || precioVenta - precioCosto;
  const gananciaTotal = num(d.ganancia_total) || gananciaUnitaria * cantidad;

  return {
    id: d.id,
    producto_id: d.producto_id,
    producto_nombre: d.producto_nombre,
    producto_sku: d.producto_sku,
    presentacion: d.presentacion || "unidad",
    cantidad,
    cantidad_base: cantidadBase > 0 ? cantidadBase : cantidadReal > 0 ? cantidadReal : 0,
    precio_costo: precioCosto,
    precio_unitario: precioVenta,
    subtotal,
    ganancia_unitaria: gananciaUnitaria,
    ganancia_total: gananciaTotal,
    es_monto_variable: !!d.es_monto_variable,
  };
}

function totalPedido(item) {
  const directo = num(item?.total);
  if (directo > 0) return directo;

  const detalles = Array.isArray(item?.detalles) ? item.detalles : [];
  return detalles.reduce((acc, d) => {
    const subtotal = num(d?.subtotal);
    if (subtotal > 0) return acc + subtotal;

    const cantidad = num(d?.cantidad) || num(d?.cantidad_base);
    const precio = num(d?.precio_unitario);
    return acc + cantidad * precio;
  }, 0);
}

function gananciaPedido(item) {
  const directa = num(item?.ganancia_total);
  if (directa !== 0) return directa;

  const detalles = Array.isArray(item?.detalles) ? item.detalles : [];
  return detalles.reduce((acc, d) => {
    const gt = num(d?.ganancia_total);
    if (gt !== 0) return acc + gt;

    const cantidad = num(d?.cantidad) || num(d?.cantidad_base);
    const venta = num(d?.precio_unitario);
    const costo = num(d?.precio_costo);
    return acc + (venta - costo) * cantidad;
  }, 0);
}

function imprimirTicketPedido({ pedido = null, items = [], total = 0 }) {
  const fecha =
    pedido?.creado_en ||
    pedido?.fecha ||
    pedido?.created_at ||
    new Date().toISOString();

  const codigo =
    pedido?.codigo ||
    pedido?.correlativo ||
    pedido?.id ||
    `PD-${new Date().getTime()}`;

  const cliente =
    pedido?.cliente_nombre ||
    pedido?.cliente?.nombre ||
    pedido?.nombre_cliente ||
    "Consumidor final";

  const vendedor =
    pedido?.vendedor_nombre ||
    pedido?.vendedor?.nombre ||
    "—";

  const sucursal =
    pedido?.ubicacion_nombre ||
    pedido?.ubicacion?.nombre ||
    "—";

  const rutero =
    pedido?.rutero?.nombre ||
    pedido?.rutero_nombre ||
    "Sin asignar";

  const estado = estadoLabel(pedido?.estado || "pendiente");
  const metodoPago = getMetodoPagoLabel(
    pedido?.metodo_pago || pedido?.forma_pago || pedido?.tipo_pago || ""
  );
  const observaciones = pedido?.observaciones || "";

  const html = `
    <!doctype html>
    <html lang="es">
    <head>
      <meta charset="utf-8" />
      <title>Ticket pedido #${safeHtml(codigo)}</title>
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
        .obs {
          margin-top: 10px;
          padding-top: 8px;
          border-top: 1px dashed #d1d5db;
          font-size: 12px;
          color: #374151;
          line-height: 1.45;
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
          <div class="subtitle">Ticket de pedido</div>
        </div>

        <div class="box">
          <div class="row"><span class="label">Pedido:</span><strong>#${safeHtml(codigo)}</strong></div>
          <div class="row"><span class="label">Fecha:</span><strong>${safeHtml(formatDate(fecha))}</strong></div>
          <div class="row"><span class="label">Cliente:</span><strong>${safeHtml(cliente)}</strong></div>
          <div class="row"><span class="label">Vendedor:</span><strong>${safeHtml(vendedor)}</strong></div>
          <div class="row"><span class="label">Sucursal:</span><strong>${safeHtml(sucursal)}</strong></div>
          <div class="row"><span class="label">Rutero:</span><strong>${safeHtml(rutero)}</strong></div>
          <div class="row"><span class="label">Estado:</span><strong>${safeHtml(estado)}</strong></div>
          <div class="row"><span class="label">Pago:</span><strong>${safeHtml(metodoPago)}</strong></div>
        </div>

        <div>
          ${items
            .map(
              (d) => `
            <div class="line-item">
              <div class="prod">${safeHtml(
                `${d.producto_nombre || d.nombre || "Producto"}${
                  d.presentacion ? ` - ${d.presentacion}` : ""
                }`
              )}</div>
              <div class="row">
                <span class="muted">${safeHtml(
                  Number(d.cantidad || 0)
                )} x ${safeHtml(money(d.precio_unitario))}</span>
                <strong>${safeHtml(
                  money(
                    Number(d.subtotal || 0) ||
                      Number(d.cantidad || 0) * Number(d.precio_unitario || 0)
                  )
                )}</strong>
              </div>
              <div class="muted">SKU: ${safeHtml(d.producto_sku || "—")}</div>
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

        ${
          observaciones
            ? `
          <div class="obs">
            <strong>Observaciones:</strong><br/>
            ${safeHtml(observaciones)}
          </div>
        `
            : ""
        }

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

  const win = window.open("", "_blank", "width=420,height=760");
  if (!win) {
    alert("El navegador bloqueó la ventana de impresión.");
    return;
  }

  win.document.open();
  win.document.write(html);
  win.document.close();
}

const MONTHS = [
  { value: "1", label: "Enero" },
  { value: "2", label: "Febrero" },
  { value: "3", label: "Marzo" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Mayo" },
  { value: "6", label: "Junio" },
  { value: "7", label: "Julio" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
];

export default function PedidosAdmin() {
  const session = getSession();
  const me = session?.user || {};
  const rol = String(me?.rol || me?.role || "").toLowerCase();
  const isSuperAdmin = rol === "super_admin" || rol === "superadmin";

  const today = new Date();

  const [vista, setVista] = useState("pedidos");
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("pendiente_revision");
  const [items, setItems] = useState([]);
  const [pedidoActivo, setPedidoActivo] = useState(null);
  const [lineasEdit, setLineasEdit] = useState([]);
  const [observaciones, setObservaciones] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingRuteros, setLoadingRuteros] = useState(true);
  const [ruteros, setRuteros] = useState([]);
  const [ruteroId, setRuteroId] = useState("");
  const [ubicacionFiltro, setUbicacionFiltro] = useState("");
  const [mesFiltro, setMesFiltro] = useState(String(today.getMonth() + 1));
  const [anioFiltro, setAnioFiltro] = useState(String(today.getFullYear()));
  const [registroModalOpen, setRegistroModalOpen] = useState(false);

  async function loadPedidos(selectedId = null, customView = null) {
    try {
      setLoading(true);

      const vistaActual = customView || vista;
      const isRegistro = vistaActual === "registro";

      const { fecha_desde, fecha_hasta } = isRegistro
        ? getMonthRange(anioFiltro, mesFiltro)
        : { fecha_desde: "", fecha_hasta: "" };

      const res = await pedidosAdminApi.list({
        q,
        estado,
        ubicacion_id: isSuperAdmin ? ubicacionFiltro : "",
        fecha_desde,
        fecha_hasta,
        page: 1,
        per_page: 200,
      });

      const nuevosItems = res?.data || [];
      setItems(nuevosItems);

      const idBuscado = selectedId ?? pedidoActivo?.id ?? null;

      if (idBuscado) {
        const actualizado = nuevosItems.find((p) => p.id === idBuscado);

        if (actualizado) {
          setPedidoActivo(actualizado);
          setObservaciones(actualizado?.observaciones || "");
          setRuteroId(actualizado?.rutero_id || "");
          setLineasEdit((actualizado?.detalles || []).map(mapDetalleToLinea));
        } else if (nuevosItems.length > 0) {
          seleccionarPedido(nuevosItems[0]);
        } else {
          limpiarDetalle();
        }
      } else if (!pedidoActivo && nuevosItems.length > 0) {
        seleccionarPedido(nuevosItems[0]);
      } else if (nuevosItems.length === 0) {
        limpiarDetalle();
      }
    } catch (err) {
      console.error(err);
      notify.error("No se pudieron cargar los pedidos.");
    } finally {
      setLoading(false);
    }
  }

  function limpiarDetalle() {
    setPedidoActivo(null);
    setObservaciones("");
    setRuteroId("");
    setLineasEdit([]);
  }

  async function loadRuteros() {
    try {
      setLoadingRuteros(true);
      const res = await usuariosApi.ruteros();
      setRuteros(res?.data || []);
    } catch (err) {
      console.error(err);
      notify.error("No se pudieron cargar los ruteros.");
    } finally {
      setLoadingRuteros(false);
    }
  }

  useEffect(() => {
    loadRuteros();
  }, []);

  useEffect(() => {
    if (vista === "pedidos" && !estado) {
      setEstado("pendiente_revision");
      return;
    }

    loadPedidos(null, vista);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista]);

  function seleccionarPedido(item) {
    setPedidoActivo(item);
    setObservaciones(item?.observaciones || "");
    setRuteroId(item?.rutero_id || "");
    setLineasEdit((item?.detalles || []).map(mapDetalleToLinea));
  }

  function abrirDetalleRegistro(item) {
    seleccionarPedido(item);
    setRegistroModalOpen(true);
  }

  function cerrarDetalleRegistro() {
    setRegistroModalOpen(false);
  }

  function setLinea(id, changes) {
    setLineasEdit((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;

        const next = { ...l, ...changes };

        next.cantidad = Math.max(0, num(next.cantidad));
        next.cantidad_base = Math.max(0, num(next.cantidad_base));
        next.precio_costo = Math.max(0, num(next.precio_costo));
        next.precio_unitario = Math.max(0, num(next.precio_unitario));

        next.subtotal = num(next.cantidad) * num(next.precio_unitario);
        next.ganancia_unitaria = num(next.precio_unitario) - num(next.precio_costo);
        next.ganancia_total = num(next.ganancia_unitaria) * num(next.cantidad);

        return next;
      })
    );
  }

  const total = useMemo(() => {
    return lineasEdit.reduce((acc, item) => acc + num(item.subtotal), 0);
  }, [lineasEdit]);

  const resumenRegistro = useMemo(() => {
    const totalPedidos = items.length;
    const totalVentas = items.reduce((acc, item) => acc + totalPedido(item), 0);
    const totalGanancias = items.reduce((acc, item) => acc + gananciaPedido(item), 0);
    const pendientes = items.filter((item) => item.estado === "pendiente_revision").length;
    const entregados = items.filter((item) => item.estado === "entregado").length;
    const aprobados = items.filter((item) => item.estado === "aprobado").length;
    const preparando = items.filter((item) => item.estado === "preparando").length;

    return {
      totalPedidos,
      totalVentas,
      totalGanancias,
      pendientes,
      entregados,
      aprobados,
      preparando,
    };
  }, [items]);

  function buildDetallesPayload() {
    return lineasEdit.map((l) => ({
      id: l.id,
      presentacion: l.presentacion,
      cantidad: Number(l.cantidad),
      cantidad_base: Number(l.cantidad_base || l.cantidad),
      precio_unitario: Number(l.precio_unitario),
      subtotal: Number(l.subtotal),
      es_monto_variable: l.es_monto_variable ? 1 : 0,
    }));
  }

  function handleImprimirTicket() {
    if (!pedidoActivo) {
      notify.error("Selecciona un pedido.");
      return;
    }

    imprimirTicketPedido({
      pedido: {
        ...pedidoActivo,
        observaciones,
      },
      items: lineasEdit,
      total,
    });
  }

  async function guardarCambios() {
    if (!pedidoActivo) {
      notify.error("Selecciona un pedido.");
      return;
    }

    try {
      setSaving(true);

      const res = await pedidosAdminApi.update(pedidoActivo.id, {
        observaciones,
        detalles: buildDetallesPayload(),
      });

      const actualizado = res?.data || null;

      if (actualizado) {
        setPedidoActivo(actualizado);
        setObservaciones(actualizado.observaciones || "");
        setRuteroId(actualizado.rutero_id || "");
        setLineasEdit((actualizado.detalles || []).map(mapDetalleToLinea));
      }

      notify.success(res?.message || "Pedido actualizado correctamente.");
      await loadPedidos(pedidoActivo.id);
    } catch (err) {
      console.error(err);
      notify.error(err?.response?.data?.message || "No se pudieron guardar los cambios.");
    } finally {
      setSaving(false);
    }
  }

  async function aprobarPedido() {
    if (!pedidoActivo) return;

    try {
      setSaving(true);

      const res = await pedidosAdminApi.aprobar(pedidoActivo.id, {
        observaciones,
        detalles: buildDetallesPayload(),
      });

      const actualizado = res?.data || null;

      if (actualizado) {
        setPedidoActivo(actualizado);
        setObservaciones(actualizado.observaciones || "");
        setRuteroId(actualizado.rutero_id || "");
        setLineasEdit((actualizado.detalles || []).map(mapDetalleToLinea));
      }

      notify.success(res?.message || "Pedido aprobado correctamente.");
      await loadPedidos(pedidoActivo.id);
    } catch (err) {
      console.error(err);
      notify.error(err?.response?.data?.message || "No se pudo aprobar el pedido.");
    } finally {
      setSaving(false);
    }
  }

  async function prepararPedido() {
    if (!pedidoActivo) return;

    try {
      setSaving(true);
      await pedidosAdminApi.preparar(pedidoActivo.id);
      notify.success("Pedido marcado como preparando.");
      await loadPedidos(pedidoActivo.id);
    } catch (err) {
      console.error(err);
      notify.error(err?.response?.data?.message || "No se pudo actualizar el pedido.");
    } finally {
      setSaving(false);
    }
  }

  async function asignarRutero() {
    if (!pedidoActivo) {
      notify.error("Selecciona un pedido.");
      return;
    }

    if (!ruteroId) {
      notify.error("Selecciona un rutero.");
      return;
    }

    try {
      setSaving(true);

      const res = await pedidosAdminApi.asignarRutero(pedidoActivo.id, {
        rutero_id: Number(ruteroId),
      });

      const pedidoActualizado = res?.pedido || null;

      if (pedidoActualizado) {
        setPedidoActivo(pedidoActualizado);
        setRuteroId(pedidoActualizado.rutero_id || "");

        setItems((prev) =>
          prev.map((item) =>
            item.id === pedidoActualizado.id ? pedidoActualizado : item
          )
        );

        setObservaciones(pedidoActualizado?.observaciones || "");
        setLineasEdit((pedidoActualizado?.detalles || []).map(mapDetalleToLinea));
      }

      notify.success(res?.message || "Rutero asignado correctamente.");
      await loadPedidos(pedidoActivo.id);
    } catch (err) {
      console.error(err);
      notify.error(err?.response?.data?.message || "No se pudo asignar el rutero.");
    } finally {
      setSaving(false);
    }
  }

  async function entregarPedido() {
    if (!pedidoActivo) return;

    try {
      setSaving(true);
      await pedidosAdminApi.entregar(pedidoActivo.id);
      notify.success("Pedido marcado como entregado.");
      await loadPedidos(pedidoActivo.id);
    } catch (err) {
      console.error(err);
      notify.error(err?.response?.data?.message || "No se pudo actualizar el pedido.");
    } finally {
      setSaving(false);
    }
  }

  function buscarVistaActual() {
    loadPedidos();
  }

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h2>Pedidos Admin</h2>
          <p className="muted">
            Revisión, aprobación, preparación, asignación y registro de pedidos
          </p>
        </div>
      </header>

      <div style={tabsWrapStyle}>
        <button
          type="button"
          onClick={() => setVista("pedidos")}
          style={vista === "pedidos" ? tabActiveStyle : tabStyle}
          disabled={loading || saving}
        >
          Pedidos
        </button>

        <button
          type="button"
          onClick={() => setVista("registro")}
          style={vista === "registro" ? tabActiveStyle : tabStyle}
          disabled={loading || saving}
        >
          Registro
        </button>
      </div>

      {vista === "pedidos" ? (
        <div style={pageGridStyle}>
          <div>
            <div className="card pad" style={leftCardStyle}>
              <div style={toolbarWrapStyle}>
                <div style={toolbarGridStyle}>
                  <input
                    type="text"
                    placeholder="Buscar por cliente, vendedor o código"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    style={inputStyle}
                    disabled={loading || saving}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") buscarVistaActual();
                    }}
                  />

                  <select
                    value={estado}
                    onChange={(e) => setEstado(e.target.value)}
                    style={inputStyle}
                    disabled={loading || saving}
                  >
                    <option value="">Todos los estados</option>
                    <option value="pendiente_revision">Pendiente revisión</option>
                    <option value="aprobado">Aprobado</option>
                    <option value="preparando">Preparando</option>
                    <option value="en_ruta">En ruta</option>
                    <option value="entregado">Entregado</option>
                  </select>

                  <button
                    onClick={buscarVistaActual}
                    style={primaryBtn}
                    disabled={loading || saving}
                  >
                    {loading ? <InlineLoader /> : "Buscar"}
                  </button>
                </div>

                {isSuperAdmin ? (
                  <div style={{ marginTop: 12 }}>
                    <input
                      type="number"
                      placeholder="Filtrar por sucursal (ID)"
                      value={ubicacionFiltro}
                      onChange={(e) => setUbicacionFiltro(e.target.value)}
                      style={inputStyle}
                      disabled={loading || saving}
                    />
                  </div>
                ) : null}
              </div>

              <div style={{ marginTop: 18 }}>
                <div style={listHeaderStyle}>
                  <h3 style={{ margin: 0 }}>Listado de pedidos</h3>
                  <div className="muted small">
                    {loading ? <InlineLoader /> : `${items.length} pedido(s)`}
                  </div>
                </div>

                {loading ? (
                  <TableLoader />
                ) : items.length === 0 ? (
                  <div style={emptyStateStyle}>
                    <div style={{ fontSize: 30 }}>📦</div>
                    <div style={{ fontWeight: 700 }}>No se encontraron pedidos</div>
                    <div style={{ fontSize: 13 }}>
                      Prueba cambiando el estado o el texto de búsqueda.
                    </div>
                  </div>
                ) : (
                  <div style={listWrapStyle}>
                    <div style={{ display: "grid", gap: 12 }}>
                      {items.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => !saving && seleccionarPedido(item)}
                          style={{
                            ...pedidoItemStyle,
                            border:
                              pedidoActivo?.id === item.id
                                ? "2px solid #111827"
                                : "1px solid #dbe1ea",
                            boxShadow:
                              pedidoActivo?.id === item.id
                                ? "0 12px 28px rgba(15, 23, 42, 0.10)"
                                : "0 6px 16px rgba(15, 23, 42, 0.05)",
                            cursor: saving ? "not-allowed" : "pointer",
                            opacity: saving ? 0.7 : 1,
                          }}
                        >
                          <div style={pedidoItemTopStyle}>
                            <div style={{ minWidth: 0 }}>
                              <div style={pedidoTitleStyle}>Pedido #{item.id}</div>

                              <div className="muted" style={{ marginBottom: 3 }}>
                                Cliente: {item.cliente_nombre || "—"}
                              </div>
                              <div className="muted" style={{ marginBottom: 3 }}>
                                Vendedor: {item.vendedor_nombre || "—"}
                              </div>
                              <div className="muted" style={{ marginBottom: 3 }}>
                                Sucursal: {item.ubicacion_nombre || "—"}
                              </div>
                              <div className="muted">
                                Rutero: {item.rutero?.nombre || item.rutero_nombre || "Sin asignar"}
                              </div>
                            </div>

                            <div style={pedidoAmountWrapStyle}>
                              <div style={badgeStyle(item.estado)}>
                                {estadoLabel(item.estado)}
                              </div>
                              <div style={pedidoAmountStyle}>
                                {money(item.total)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 16 }}>
            <div className="card pad" style={rightCardStyle}>
              <h3 style={{ marginTop: 0, marginBottom: 14 }}>Detalle del pedido</h3>

              {!pedidoActivo ? (
                <div className="muted">Selecciona un pedido para ver su detalle.</div>
              ) : saving ? (
                <ModalLoader text="Procesando pedido..." />
              ) : (
                <>
                  <div style={heroSummaryStyle}>
                    <div style={heroSummaryBlockStyle}>
                      <span style={summaryLabelStyle}>Cliente</span>
                      <strong>{pedidoActivo.cliente_nombre || "—"}</strong>
                    </div>

                    <div style={heroSummaryBlockStyle}>
                      <span style={summaryLabelStyle}>Vendedor</span>
                      <strong>{pedidoActivo.vendedor_nombre || "—"}</strong>
                    </div>

                    <div style={heroSummaryBlockStyle}>
                      <span style={summaryLabelStyle}>Sucursal</span>
                      <strong>{pedidoActivo.ubicacion_nombre || "—"}</strong>
                    </div>

                    <div style={heroSummaryBlockStyle}>
                      <span style={summaryLabelStyle}>Rutero</span>
                      <strong>
                        {pedidoActivo.rutero?.nombre ||
                          pedidoActivo.rutero_nombre ||
                          "Sin asignar"}
                      </strong>
                    </div>

                    <div style={heroSummaryBlockStyle}>
                      <span style={summaryLabelStyle}>Estado</span>
                      <div>
                        <span style={badgeStyle(pedidoActivo.estado)}>
                          {estadoLabel(pedidoActivo.estado)}
                        </span>
                      </div>
                    </div>

                    <div style={heroSummaryBlockStyle}>
                      <span style={summaryLabelStyle}>Fecha</span>
                      <strong>{formatDate(pedidoActivo.creado_en)}</strong>
                    </div>
                  </div>

                  <div style={{ marginTop: 16 }}>
                    <label className="muted" style={{ display: "block", marginBottom: 6 }}>
                      Observaciones
                    </label>
                    <textarea
                      rows={4}
                      value={observaciones}
                      onChange={(e) => setObservaciones(e.target.value)}
                      style={{ ...inputStyle, resize: "vertical", minHeight: 110 }}
                      disabled={saving}
                    />
                  </div>

                  <div style={totalsPanelSingleStyle}>
                    <div style={totalsItemStyle}>
                      <span style={summaryLabelStyle}>Total venta</span>
                      <strong style={{ fontSize: 28, color: "#0f172a" }}>{money(total)}</strong>
                    </div>
                  </div>

                  <div style={{ marginTop: 20 }}>
                    <div style={sectionTitleStyle}>Detalle comercial</div>

                    <div style={{ marginTop: 12, display: "grid", gap: 14 }}>
                      {lineasEdit.map((l) => (
                        <div key={l.id} style={lineCardStyle}>
                          <div style={lineCardHeaderStyle}>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: 18, color: "#0f172a" }}>
                                {l.producto_nombre}
                              </div>
                              <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
                                SKU: {l.producto_sku || "—"} · Presentación: {l.presentacion}
                              </div>
                            </div>
                          </div>

                          <div style={lineGridStyleSimple}>
                            <div>
                              <label className="muted" style={fieldLabelStyle}>Presentación</label>
                              <input
                                value={l.presentacion}
                                onChange={(e) => setLinea(l.id, { presentacion: e.target.value })}
                                style={inputStyle}
                                disabled={saving}
                              />
                            </div>

                            <div>
                              <label className="muted" style={fieldLabelStyle}>Cantidad</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={l.cantidad}
                                onChange={(e) => setLinea(l.id, { cantidad: num(e.target.value) })}
                                style={inputStyle}
                                disabled={saving}
                              />
                            </div>

                            <div>
                              <label className="muted" style={fieldLabelStyle}>Cantidad base</label>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={l.cantidad_base}
                                onChange={(e) =>
                                  setLinea(l.id, { cantidad_base: num(e.target.value) })
                                }
                                style={inputStyle}
                                disabled={saving}
                              />
                            </div>

                            <div>
                              <label className="muted" style={fieldLabelStyle}>Precio venta</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={l.precio_unitario}
                                onChange={(e) =>
                                  setLinea(l.id, { precio_unitario: num(e.target.value) })
                                }
                                style={inputStyle}
                                disabled={saving}
                              />
                            </div>

                            <div>
                              <label className="muted" style={fieldLabelStyle}>Subtotal</label>
                              <input
                                type="number"
                                value={l.subtotal}
                                style={{ ...inputStyle, background: "#f8fafc" }}
                                disabled
                              />
                            </div>
                          </div>

                          <div style={{ marginTop: 12 }}>
                            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <input
                                type="checkbox"
                                checked={!!l.es_monto_variable}
                                onChange={(e) =>
                                  setLinea(l.id, { es_monto_variable: e.target.checked })
                                }
                                disabled={saving}
                              />
                              <span>Habilitar monto variable</span>
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
                    <div style={actionCardStyle}>
                      <label className="muted" style={{ display: "block", marginBottom: 6 }}>
                        Asignar rutero
                      </label>

                      {loadingRuteros ? (
                        <ModalLoader text="Cargando ruteros..." />
                      ) : (
                        <>
                          <select
                            value={ruteroId}
                            onChange={(e) => setRuteroId(Number(e.target.value))}
                            style={inputStyle}
                          >
                            <option value="">Seleccionar rutero</option>
                            {ruteros.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.nombre || r.usuario || `Rutero #${r.id}`}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={asignarRutero}
                            style={{ ...primaryBtn, marginTop: 10, width: "100%" }}
                            disabled={saving || loadingRuteros}
                          >
                            {saving ? "Asignando..." : "Asignar rutero"}
                          </button>
                        </>
                      )}
                    </div>

                    <button onClick={handleImprimirTicket} disabled={saving} style={ticketBtn}>
                      Imprimir ticket
                    </button>

                    <button onClick={guardarCambios} disabled={saving} style={primaryBtn}>
                      {saving ? "Guardando..." : "Guardar cambios"}
                    </button>

                    <button onClick={aprobarPedido} disabled={saving} style={secondaryBtn}>
                      {saving ? "Procesando..." : "Aprobar pedido"}
                    </button>

                    <button onClick={prepararPedido} disabled={saving} style={secondaryBtn}>
                      {saving ? "Procesando..." : "Marcar preparando"}
                    </button>

                    <button onClick={entregarPedido} disabled={saving} style={secondaryBtn}>
                      {saving ? "Procesando..." : "Marcar entregado"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 12, display: "grid", gap: 18 }}>
          <div className="card pad" style={leftCardStyle}>
            <div style={toolbarWrapStyle}>
              <div style={toolbarRegistroGridStyle}>
                <input
                  type="text"
                  placeholder="Buscar por cliente, vendedor o código"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  style={inputStyle}
                  disabled={loading}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") buscarVistaActual();
                  }}
                />

                <select
                  value={mesFiltro}
                  onChange={(e) => setMesFiltro(e.target.value)}
                  style={inputStyle}
                  disabled={loading}
                >
                  {MONTHS.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  placeholder="Año"
                  value={anioFiltro}
                  onChange={(e) => setAnioFiltro(e.target.value)}
                  style={inputStyle}
                  disabled={loading}
                />

                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  style={inputStyle}
                  disabled={loading}
                >
                  <option value="">Todos los estados</option>
                  <option value="pendiente_revision">Pendiente revisión</option>
                  <option value="aprobado">Aprobado</option>
                  <option value="preparando">Preparando</option>
                  <option value="en_ruta">En ruta</option>
                  <option value="entregado">Entregado</option>
                </select>

                <button
                  onClick={buscarVistaActual}
                  style={primaryBtn}
                  disabled={loading}
                >
                  {loading ? <InlineLoader /> : "Buscar"}
                </button>
              </div>

              {isSuperAdmin ? (
                <div style={{ marginTop: 12 }}>
                  <input
                    type="number"
                    placeholder="Filtrar por sucursal (ID)"
                    value={ubicacionFiltro}
                    onChange={(e) => setUbicacionFiltro(e.target.value)}
                    style={inputStyle}
                    disabled={loading}
                  />
                </div>
              ) : null}
            </div>

            <div style={{ marginTop: 18 }}>
              <div style={listHeaderStyle}>
                <h3 style={{ margin: 0 }}>
                  Resumen mensual - {MONTHS.find((m) => m.value === mesFiltro)?.label || "Mes"} {anioFiltro}
                </h3>
                <div className="muted small">
                  {loading ? <InlineLoader /> : `${items.length} pedido(s)`}
                </div>
              </div>

              <div style={statsGridStyle}>
                <div style={statCardStyle}>
                  <span style={summaryLabelStyle}>Pedidos</span>
                  <strong style={statNumberStyle}>{resumenRegistro.totalPedidos}</strong>
                </div>

                <div style={statCardStyle}>
                  <span style={summaryLabelStyle}>Total vendido</span>
                  <strong style={statNumberStyle}>{money(resumenRegistro.totalVentas)}</strong>
                </div>

                <div style={statCardGreenStyle}>
                  <span style={summaryLabelStyle}>Ganancia total</span>
                  <strong style={{ ...statNumberStyle, color: "#166534" }}>
                    {money(resumenRegistro.totalGanancias)}
                  </strong>
                </div>

                <div style={statCardStyle}>
                  <span style={summaryLabelStyle}>Pendientes</span>
                  <strong style={statNumberStyle}>{resumenRegistro.pendientes}</strong>
                </div>

                <div style={statCardStyle}>
                  <span style={summaryLabelStyle}>Aprobados</span>
                  <strong style={statNumberStyle}>{resumenRegistro.aprobados}</strong>
                </div>

                <div style={statCardStyle}>
                  <span style={summaryLabelStyle}>Preparando</span>
                  <strong style={statNumberStyle}>{resumenRegistro.preparando}</strong>
                </div>

                <div style={statCardStyle}>
                  <span style={summaryLabelStyle}>Entregados</span>
                  <strong style={statNumberStyle}>{resumenRegistro.entregados}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="card pad" style={leftCardStyle}>
            <div style={listHeaderStyle}>
              <h3 style={{ margin: 0 }}>Registro de pedidos</h3>
              <div className="muted small">
                {loading ? <InlineLoader /> : `${items.length} resultado(s)`}
              </div>
            </div>

            {loading ? (
              <TableLoader />
            ) : items.length === 0 ? (
              <div style={emptyStateStyle}>
                <div style={{ fontSize: 30 }}>📊</div>
                <div style={{ fontWeight: 700 }}>No hay datos para mostrar</div>
                <div style={{ fontSize: 13 }}>
                  Intenta con otros filtros para ver el registro.
                </div>
              </div>
            ) : (
              <div style={registroWrapStyle}>
                <div style={{ display: "grid", gap: 12 }}>
                  {items.map((item) => {
                    const itemTotal = totalPedido(item);
                    const itemGanancia = gananciaPedido(item);

                    return (
                      <div
                        key={item.id}
                        onClick={() => !loading && abrirDetalleRegistro(item)}
                        style={registroItemStyle}
                      >
                        <div style={registroTopStyle}>
                          <div>
                            <div style={pedidoTitleStyle}>Pedido #{item.id}</div>
                            <div className="muted" style={{ marginBottom: 4 }}>
                              Cliente: {item.cliente_nombre || "—"}
                            </div>
                            <div className="muted" style={{ marginBottom: 4 }}>
                              Vendedor: {item.vendedor_nombre || "—"}
                            </div>
                            <div className="muted" style={{ marginBottom: 4 }}>
                              Sucursal: {item.ubicacion_nombre || "—"}
                            </div>
                            <div className="muted">
                              Fecha: {formatDate(item.creado_en)}
                            </div>
                          </div>

                          <div style={pedidoAmountWrapStyle}>
                            <div style={badgeStyle(item.estado)}>
                              {estadoLabel(item.estado)}
                            </div>
                            <div style={pedidoAmountStyle}>{money(itemTotal)}</div>
                            <div style={pedidoGainMiniStyle}>
                              Ganancia: {money(itemGanancia)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {vista === "registro" && registroModalOpen && pedidoActivo ? (
        <div style={overlayStyle} onClick={cerrarDetalleRegistro}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <div>
                <h3 style={{ margin: 0 }}>Detalle del pedido #{pedidoActivo.id}</h3>
                <div className="muted" style={{ marginTop: 4 }}>
                  Vista rápida del registro
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="button" onClick={handleImprimirTicket} style={ticketBtn}>
                  Imprimir ticket
                </button>
                <button type="button" onClick={cerrarDetalleRegistro} style={closeBtnStyle}>
                  Cerrar
                </button>
              </div>
            </div>

            <div style={modalBodyStyle}>
              <div style={heroSummaryStyle}>
                <div style={heroSummaryBlockStyle}>
                  <span style={summaryLabelStyle}>Cliente</span>
                  <strong>{pedidoActivo.cliente_nombre || "—"}</strong>
                </div>

                <div style={heroSummaryBlockStyle}>
                  <span style={summaryLabelStyle}>Vendedor</span>
                  <strong>{pedidoActivo.vendedor_nombre || "—"}</strong>
                </div>

                <div style={heroSummaryBlockStyle}>
                  <span style={summaryLabelStyle}>Sucursal</span>
                  <strong>{pedidoActivo.ubicacion_nombre || "—"}</strong>
                </div>

                <div style={heroSummaryBlockStyle}>
                  <span style={summaryLabelStyle}>Rutero</span>
                  <strong>
                    {pedidoActivo.rutero?.nombre ||
                      pedidoActivo.rutero_nombre ||
                      "Sin asignar"}
                  </strong>
                </div>

                <div style={heroSummaryBlockStyle}>
                  <span style={summaryLabelStyle}>Estado</span>
                  <div>
                    <span style={badgeStyle(pedidoActivo.estado)}>
                      {estadoLabel(pedidoActivo.estado)}
                    </span>
                  </div>
                </div>

                <div style={heroSummaryBlockStyle}>
                  <span style={summaryLabelStyle}>Fecha</span>
                  <strong>{formatDate(pedidoActivo.creado_en)}</strong>
                </div>
              </div>

              <div style={registroTotalsStyle}>
                <div style={totalsItemStyle}>
                  <span style={summaryLabelStyle}>Total venta</span>
                  <strong style={{ fontSize: 26, color: "#0f172a" }}>
                    {money(totalPedido(pedidoActivo))}
                  </strong>
                </div>

                <div style={statCardGreenStyle}>
                  <span style={summaryLabelStyle}>Ganancia del pedido</span>
                  <strong style={{ fontSize: 26, color: "#166534" }}>
                    {money(gananciaPedido(pedidoActivo))}
                  </strong>
                </div>
              </div>

              <div style={{ marginTop: 20 }}>
                <div style={sectionTitleStyle}>Detalle comercial</div>

                <div style={{ marginTop: 12, display: "grid", gap: 14 }}>
                  {lineasEdit.length === 0 ? (
                    <div style={emptyMiniStyle}>
                      Este pedido no tiene detalles para mostrar.
                    </div>
                  ) : (
                    lineasEdit.map((l) => (
                      <div key={l.id} style={lineCardStyle}>
                        <div style={lineCardHeaderStyle}>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 18, color: "#0f172a" }}>
                              {l.producto_nombre}
                            </div>
                            <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
                              SKU: {l.producto_sku || "—"} · Presentación: {l.presentacion}
                            </div>
                          </div>

                          <div style={gainPillStyle}>
                            Ganancia total: {money(l.ganancia_total)}
                          </div>
                        </div>

                        <div style={lineGridStyleRegistro}>
                          <div>
                            <label className="muted" style={fieldLabelStyle}>Presentación</label>
                            <input value={l.presentacion} style={readOnlyInputStyle} disabled />
                          </div>

                          <div>
                            <label className="muted" style={fieldLabelStyle}>Cantidad</label>
                            <input value={l.cantidad} style={readOnlyInputStyle} disabled />
                          </div>

                          <div>
                            <label className="muted" style={fieldLabelStyle}>Cantidad base</label>
                            <input value={l.cantidad_base} style={readOnlyInputStyle} disabled />
                          </div>

                          <div>
                            <label className="muted" style={fieldLabelStyle}>Precio venta</label>
                            <input value={l.precio_unitario} style={readOnlyInputStyle} disabled />
                          </div>

                          <div>
                            <label className="muted" style={fieldLabelStyle}>Precio costo</label>
                            <input value={l.precio_costo} style={readOnlyInputStyle} disabled />
                          </div>

                          <div>
                            <label className="muted" style={fieldLabelStyle}>Subtotal</label>
                            <input value={l.subtotal} style={readOnlyInputStyle} disabled />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const tabsWrapStyle = {
  display: "flex",
  gap: 10,
  marginTop: 12,
  marginBottom: 8,
};

const tabStyle = {
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  borderRadius: 12,
  padding: "11px 18px",
  fontWeight: 800,
  cursor: "pointer",
};

const tabActiveStyle = {
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  borderRadius: 12,
  padding: "11px 18px",
  fontWeight: 800,
  cursor: "pointer",
};

const pageGridStyle = {
  marginTop: 12,
  display: "grid",
  gridTemplateColumns: "1.08fr 1.22fr",
  gap: 18,
  alignItems: "start",
};

const leftCardStyle = {
  borderRadius: 22,
  padding: 16,
  background: "#ffffff",
};

const rightCardStyle = {
  borderRadius: 24,
  padding: 18,
  background: "#ffffff",
};

const toolbarWrapStyle = {
  paddingBottom: 14,
  borderBottom: "1px solid #edf1f6",
};

const toolbarGridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 220px 130px",
  gap: 12,
  alignItems: "center",
};

const toolbarRegistroGridStyle = {
  display: "grid",
  gridTemplateColumns: "1.3fr 180px 140px 220px 130px",
  gap: 12,
  alignItems: "center",
};

const listHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 12,
};

const listWrapStyle = {
  display: "grid",
  gap: 12,
  maxHeight: "calc(100vh - 280px)",
  minHeight: 220,
  overflowY: "auto",
  paddingRight: 4,
};

const registroWrapStyle = {
  display: "grid",
  gap: 12,
  maxHeight: 520,
  minHeight: 220,
  overflowY: "auto",
  paddingRight: 4,
};

const pedidoItemStyle = {
  borderRadius: 18,
  padding: 16,
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  transition: "all .18s ease",
};

const registroItemStyle = {
  borderRadius: 18,
  padding: 16,
  border: "1px solid #dbe1ea",
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  cursor: "pointer",
};

const pedidoItemTopStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
};

const registroTopStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
};

const pedidoTitleStyle = {
  fontWeight: 900,
  fontSize: 17,
  color: "#0f172a",
  marginBottom: 6,
};

const pedidoAmountWrapStyle = {
  textAlign: "right",
  display: "grid",
  gap: 8,
  justifyItems: "end",
  flexShrink: 0,
};

const pedidoAmountStyle = {
  fontWeight: 900,
  fontSize: 22,
  color: "#0f172a",
};

const pedidoGainMiniStyle = {
  fontSize: 12,
  fontWeight: 800,
  color: "#166534",
  background: "#ecfdf5",
  border: "1px solid #bbf7d0",
  borderRadius: 999,
  padding: "6px 10px",
};

const emptyStateStyle = {
  minHeight: 220,
  borderRadius: 16,
  border: "1px dashed #d4dae3",
  background:
    "linear-gradient(180deg, rgba(248,250,252,0.85) 0%, rgba(255,255,255,1) 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "column",
  gap: 8,
  color: "#64748b",
  textAlign: "center",
  padding: 24,
};

const emptyMiniStyle = {
  borderRadius: 16,
  border: "1px dashed #d4dae3",
  background: "#f8fafc",
  color: "#64748b",
  padding: 18,
};

const heroSummaryStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 12,
  padding: 14,
  borderRadius: 18,
  border: "1px solid #e5e7eb",
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
};

const heroSummaryBlockStyle = {
  display: "grid",
  gap: 4,
  padding: 8,
};

const summaryLabelStyle = {
  fontSize: 12,
  color: "#64748b",
  fontWeight: 700,
};

const totalsPanelSingleStyle = {
  marginTop: 16,
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 12,
};

const registroTotalsStyle = {
  marginTop: 16,
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const totalsItemStyle = {
  borderRadius: 18,
  padding: 18,
  border: "1px solid #e5e7eb",
  background: "#f8fafc",
  display: "grid",
  gap: 8,
};

const sectionTitleStyle = {
  fontSize: 20,
  fontWeight: 900,
  color: "#0f172a",
};

const lineCardStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 16,
  background: "#fff",
  boxShadow: "0 6px 18px rgba(15, 23, 42, 0.04)",
};

const lineCardHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
  marginBottom: 12,
};

const gainPillStyle = {
  fontSize: 13,
  fontWeight: 800,
  color: "#166534",
  background: "#ecfdf5",
  border: "1px solid #bbf7d0",
  borderRadius: 999,
  padding: "8px 12px",
};

const lineGridStyleSimple = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: 12,
};

const lineGridStyleRegistro = {
  display: "grid",
  gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
  gap: 12,
};

const fieldLabelStyle = {
  display: "block",
  marginBottom: 6,
};

const actionCardStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 14,
  background: "#fff",
};

const statsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 12,
};

const statCardStyle = {
  borderRadius: 18,
  padding: 16,
  border: "1px solid #e5e7eb",
  background: "#f8fafc",
  display: "grid",
  gap: 8,
};

const statCardGreenStyle = {
  borderRadius: 18,
  padding: 16,
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
  display: "grid",
  gap: 8,
};

const statNumberStyle = {
  fontSize: 24,
  fontWeight: 900,
  color: "#0f172a",
};

const inputStyle = {
  width: "100%",
  border: "1px solid #d1d5db",
  borderRadius: 12,
  padding: "11px 12px",
  outline: "none",
  background: "#fff",
};

const readOnlyInputStyle = {
  width: "100%",
  border: "1px solid #d1d5db",
  borderRadius: 12,
  padding: "11px 12px",
  outline: "none",
  background: "#f8fafc",
};

const primaryBtn = {
  border: 0,
  background: "#111827",
  color: "#fff",
  borderRadius: 12,
  padding: "13px 14px",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryBtn = {
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  borderRadius: 12,
  padding: "13px 14px",
  fontWeight: 800,
  cursor: "pointer",
};

const ticketBtn = {
  border: "1px solid #1d4ed8",
  background: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: 12,
  padding: "13px 14px",
  fontWeight: 800,
  cursor: "pointer",
};

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  zIndex: 9999,
};

const modalStyle = {
  width: "min(1150px, 96vw)",
  maxHeight: "90vh",
  overflowY: "auto",
  background: "#ffffff",
  borderRadius: 24,
  boxShadow: "0 30px 80px rgba(15, 23, 42, 0.30)",
  border: "1px solid #e5e7eb",
};

const modalHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: 18,
  borderBottom: "1px solid #eef2f7",
  position: "sticky",
  top: 0,
  background: "#fff",
  zIndex: 2,
};

const modalBodyStyle = {
  padding: 18,
};

const closeBtnStyle = {
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 800,
  cursor: "pointer",
};