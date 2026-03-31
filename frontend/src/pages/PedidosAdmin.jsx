import React, { useEffect, useMemo, useState } from "react";
import { pedidosAdminApi } from "../lib/pedidosAdmin";
import { notify } from "../lib/notify";
import { usuariosApi } from "../lib/usuarios";

function money(n) {
  return `Q ${Number(n || 0).toFixed(2)}`;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const PRESENTACIONES = [
  "unidad",
  "docena",
  "fardo",
  "paquete",
  "caja",
  "bolsa",
  "millar",
];

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
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    textTransform: "capitalize",
    whiteSpace: "nowrap",
  };

  switch (estado) {
    case "pendiente_revision":
      return { ...base, background: "#fff7ed", color: "#9a3412" };
    case "aprobado":
      return { ...base, background: "#ecfeff", color: "#155e75" };
    case "preparando":
      return { ...base, background: "#ecfdf5", color: "#166534" };
    case "en_ruta":
      return { ...base, background: "#eff6ff", color: "#1d4ed8" };
    case "entregado":
      return { ...base, background: "#f3f4f6", color: "#374151" };
    default:
      return { ...base, background: "#eef2ff", color: "#3730a3" };
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

function mapDetalleToLinea(d) {
  const cantidadReal = num(d.cantidad);
  const cantidadBase = num(d.cantidad_base);
  const precio = num(d.precio_unitario);

  return {
    id: d.id,
    producto_id: d.producto_id,
    producto_nombre: d.producto_nombre,
    presentacion: d.presentacion || "unidad",
    cantidad: cantidadReal > 0 ? cantidadReal : cantidadBase,
    cantidad_base: cantidadBase > 0 ? cantidadBase : (cantidadReal > 0 ? cantidadReal : 0),
    precio_unitario: precio,
    subtotal: num(d.subtotal) || (cantidadReal > 0 ? cantidadReal : cantidadBase) * precio,
    es_monto_variable: !!d.es_monto_variable,
    sugeridos: [precio, precio + 2, precio + 5],
  };
}

export default function PedidosAdmin() {
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

  async function loadPedidos(selectedId = null) {
    try {
      setLoading(true);

      const res = await pedidosAdminApi.list({
        q,
        estado,
        page: 1,
        per_page: 50,
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
          setPedidoActivo(null);
          setObservaciones("");
          setRuteroId("");
          setLineasEdit([]);
        }
      } else if (!pedidoActivo && nuevosItems.length > 0) {
        seleccionarPedido(nuevosItems[0]);
      } else if (nuevosItems.length === 0) {
        setPedidoActivo(null);
        setObservaciones("");
        setRuteroId("");
        setLineasEdit([]);
      }
    } catch (err) {
      console.error(err);
      notify.error(err, "No se pudieron cargar los pedidos.");
    } finally {
      setLoading(false);
    }
  }

  async function loadRuteros() {
    try {
      setLoadingRuteros(true);
      const res = await usuariosApi.ruteros();
      setRuteros(res?.data || []);
    } catch (err) {
      console.error(err);
      notify.error(err, "No se pudieron cargar los ruteros.");
    } finally {
      setLoadingRuteros(false);
    }
  }

  useEffect(() => {
    loadPedidos();
    loadRuteros();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function seleccionarPedido(item) {
    setPedidoActivo(item);
    setObservaciones(item?.observaciones || "");
    setRuteroId(item?.rutero_id || "");
    setLineasEdit((item?.detalles || []).map(mapDetalleToLinea));
  }

  function setLinea(id, changes) {
    setLineasEdit((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;

        const next = { ...l, ...changes };

        next.cantidad = Math.max(0, num(next.cantidad));
        next.cantidad_base = Math.max(0, num(next.cantidad_base));
        next.precio_unitario = Math.max(0, num(next.precio_unitario));
        next.subtotal = num(next.cantidad) * num(next.precio_unitario);

        return next;
      })
    );
  }

  const total = useMemo(() => {
    return lineasEdit.reduce((acc, item) => acc + num(item.subtotal), 0);
  }, [lineasEdit]);

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

  async function guardarCambios() {
    if (!pedidoActivo) return;

    try {
      setSaving(true);

      await pedidosAdminApi.actualizar(pedidoActivo.id, {
        observaciones,
        detalles: buildDetallesPayload(),
      });

      await loadPedidos(pedidoActivo.id);
      notify.success("Pedido actualizado correctamente.");
    } catch (err) {
      console.error(err);
      notify.error(err, "No se pudo actualizar el pedido.");
    } finally {
      setSaving(false);
    }
  }

  async function aprobarPedido() {
    if (!pedidoActivo) return;

    try {
      setSaving(true);

      await pedidosAdminApi.actualizar(pedidoActivo.id, {
        observaciones,
        detalles: buildDetallesPayload(),
      });

      await pedidosAdminApi.aprobar(pedidoActivo.id, {
        observaciones,
        detalles: buildDetallesPayload(),
      });

      notify.success("Pedido aprobado correctamente.");
      await loadPedidos(pedidoActivo.id);
    } catch (err) {
      console.error(err);
      notify.error(err, "No se pudo aprobar el pedido.");
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
      notify.error(err, "No se pudo actualizar el pedido.");
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
      notify.error(err, "No se pudo asignar el rutero.");
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
      notify.error(err, "No se pudo actualizar el pedido.");
    } finally {
      setSaving(false);
    }
  }

  function imprimirTicket() {
    if (!pedidoActivo) {
      notify.error("Selecciona un pedido para imprimir.");
      return;
    }

    const detalles = lineasEdit.length > 0 ? lineasEdit : pedidoActivo?.detalles || [];
    const totalTicket =
      lineasEdit.length > 0
        ? total
        : (pedidoActivo?.detalles || []).reduce((acc, d) => acc + num(d.subtotal), 0);

    const html = `
      <!doctype html>
      <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>Ticket Pedido #${pedidoActivo.id}</title>
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
            <div class="subtitle">Ticket de pedido</div>
          </div>

          <div class="box">
            <div class="row"><span class="label">Pedido:</span><strong>#${pedidoActivo.id}</strong></div>
            <div class="row"><span class="label">Fecha:</span><strong>${formatDate(
              pedidoActivo.creado_en
            )}</strong></div>
            <div class="row"><span class="label">Estado:</span><strong>${estadoLabel(
              pedidoActivo.estado
            )}</strong></div>
            <div class="row"><span class="label">Cliente:</span><strong>${
              pedidoActivo.cliente_nombre || "—"
            }</strong></div>
            <div class="row"><span class="label">Vendedor:</span><strong>${
              pedidoActivo.vendedor_nombre || "—"
            }</strong></div>
            <div class="row"><span class="label">Rutero:</span><strong>${
              pedidoActivo.rutero?.nombre ||
              pedidoActivo.rutero_nombre ||
              "Sin asignar"
            }</strong></div>
          </div>

          <div>
            ${detalles
              .map(
                (d) => `
              <div class="line-item">
                <div class="prod">${d.producto_nombre || `Producto #${d.producto_id}`}</div>
                <div class="row">
                  <span class="muted">${num(d.cantidad)} x ${d.presentacion || "unidad"}</span>
                  <strong>${money(d.precio_unitario)}</strong>
                </div>
                <div class="row">
                  <span class="muted">Subtotal</span>
                  <strong>${money(d.subtotal)}</strong>
                </div>
              </div>
            `
              )
              .join("")}
          </div>

          ${
            observaciones
              ? `
            <div class="box">
              <div style="font-size:12px;font-weight:700;margin-bottom:4px;">Observaciones</div>
              <div style="font-size:12px;">${String(observaciones)
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")}</div>
            </div>
          `
              : ""
          }

          <div class="totals">
            <div class="total-row">
              <span>Total</span>
              <span>${money(totalTicket)}</span>
            </div>
          </div>

          <div class="footer">
            Impreso el ${new Date().toLocaleString()}<br/>
            Gracias por su pedido
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
      notify.error("El navegador bloqueó la ventana de impresión.");
      return;
    }

    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h2>Pedidos Admin</h2>
          <p className="muted">
            Revisión, aprobación, preparación y asignación de rutero
          </p>
        </div>
      </header>

      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "1.28fr 1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        <div>
          <div className="card pad" style={leftCardStyle}>
            <div style={toolbarWrapStyle}>
              <div style={toolbarGridStyle}>
                <input
                  type="text"
                  placeholder="Buscar por cliente o vendedor"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  style={inputStyle}
                  disabled={loading || saving}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") loadPedidos();
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
                  onClick={() => loadPedidos()}
                  style={primaryBtn}
                  disabled={loading || saving}
                >
                  {loading ? <InlineLoader /> : "Buscar"}
                </button>
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
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
                              ? "0 10px 25px rgba(15, 23, 42, 0.10)"
                              : "0 4px 14px rgba(15, 23, 42, 0.04)",
                          cursor: saving ? "not-allowed" : "pointer",
                          opacity: saving ? 0.7 : 1,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: 12,
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: 800,
                                fontSize: 16,
                                color: "#0f172a",
                                marginBottom: 6,
                              }}
                            >
                              Pedido #{item.id}
                            </div>

                            <div className="muted" style={{ marginBottom: 3 }}>
                              Cliente: {item.cliente_nombre || "—"}
                            </div>
                            <div className="muted" style={{ marginBottom: 3 }}>
                              Vendedor: {item.vendedor_nombre || "—"}
                            </div>
                            <div className="muted">
                              Rutero:{" "}
                              {item.rutero?.nombre ||
                                item.rutero_nombre ||
                                "Sin asignar"}
                            </div>
                          </div>

                          <div
                            style={{
                              textAlign: "right",
                              display: "grid",
                              gap: 8,
                              justifyItems: "end",
                              flexShrink: 0,
                            }}
                          >
                            <div style={badgeStyle(item.estado)}>
                              {estadoLabel(item.estado)}
                            </div>
                            <div
                              style={{
                                fontWeight: 900,
                                fontSize: 20,
                                color: "#0f172a",
                              }}
                            >
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
          <div className="card pad">
            <h3 style={{ marginTop: 0 }}>Detalle del pedido</h3>

            {!pedidoActivo ? (
              <div className="muted">Selecciona un pedido para ver su detalle.</div>
            ) : saving ? (
              <ModalLoader text="Procesando pedido..." />
            ) : (
              <>
                <div style={{ display: "grid", gap: 10 }}>
                  <div>
                    <b>Cliente:</b> {pedidoActivo.cliente_nombre}
                  </div>
                  <div>
                    <b>Vendedor:</b> {pedidoActivo.vendedor_nombre}
                  </div>
                  <div>
                    <b>Rutero:</b>{" "}
                    {pedidoActivo.rutero?.nombre ||
                      pedidoActivo.rutero_nombre ||
                      "Sin asignar"}
                  </div>
                  <div>
                    <b>Estado:</b>{" "}
                    <span style={badgeStyle(pedidoActivo.estado)}>
                      {estadoLabel(pedidoActivo.estado)}
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <label className="muted" style={{ display: "block", marginBottom: 6 }}>
                    Observaciones
                  </label>
                  <textarea
                    rows={3}
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    style={{ ...inputStyle, resize: "vertical" }}
                    disabled={saving}
                  />
                </div>

                <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                  {lineasEdit.map((l) => (
                    <div
                      key={l.id}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        padding: 12,
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{l.producto_nombre}</div>

                      <div
                        style={{
                          marginTop: 10,
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr 1fr",
                          gap: 10,
                        }}
                      >
                        <div>
                          <label
                            className="muted"
                            style={{ display: "block", marginBottom: 6 }}
                          >
                            Presentación
                          </label>
                          <select
                            value={l.presentacion}
                            onChange={(e) =>
                              setLinea(l.id, { presentacion: e.target.value })
                            }
                            style={inputStyle}
                            disabled={saving}
                          >
                            {PRESENTACIONES.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label
                            className="muted"
                            style={{ display: "block", marginBottom: 6 }}
                          >
                            Cantidad
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={l.cantidad}
                            onChange={(e) =>
                              setLinea(l.id, {
                                cantidad: num(e.target.value),
                              })
                            }
                            style={inputStyle}
                            disabled={saving}
                          />
                        </div>

                        <div>
                          <label
                            className="muted"
                            style={{ display: "block", marginBottom: 6 }}
                          >
                            Precio
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={l.precio_unitario}
                            onChange={(e) =>
                              setLinea(l.id, {
                                precio_unitario: num(e.target.value),
                              })
                            }
                            style={inputStyle}
                            disabled={saving}
                          />
                        </div>
                      </div>

                      <div style={{ marginTop: 10 }}>
                        <label
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={!!l.es_monto_variable}
                            onChange={(e) =>
                              setLinea(l.id, {
                                es_monto_variable: e.target.checked,
                              })
                            }
                            disabled={saving}
                          />
                          <span>Habilitar monto variable</span>
                        </label>
                      </div>

                      <div style={{ marginTop: 10 }}>
                        <div className="muted" style={{ marginBottom: 6 }}>
                          Precios sugeridos
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {l.sugeridos.map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() =>
                                setLinea(l.id, {
                                  precio_unitario: p,
                                  es_monto_variable: true,
                                })
                              }
                              style={suggestBtn}
                              disabled={saving}
                            >
                              {money(p)}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div style={{ marginTop: 10, fontWeight: 800 }}>
                        Subtotal: {money(l.subtotal)}
                      </div>
                    </div>
                  ))}
                </div>

                <hr
                  style={{
                    margin: "14px 0",
                    border: 0,
                    borderTop: "1px solid #eee",
                  }}
                />

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontWeight: 800,
                    fontSize: 18,
                  }}
                >
                  <span>Total</span>
                  <span>{money(total)}</span>
                </div>

                <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                  <div
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
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
                          style={{ ...primaryBtn, marginTop: 8, width: "100%" }}
                          disabled={saving || loadingRuteros}
                        >
                          {saving ? "Asignando..." : "Asignar rutero"}
                        </button>
                      </>
                    )}
                  </div>

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

                  <button onClick={imprimirTicket} disabled={saving} style={printBtn}>
                    Imprimir ticket
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const leftCardStyle = {
  borderRadius: 20,
  padding: 16,
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

const listWrapStyle = {
  display: "grid",
  gap: 12,
  maxHeight: "calc(100vh - 320px)",
  minHeight: 220,
  overflowY: "auto",
  paddingRight: 4,
};

const pedidoItemStyle = {
  borderRadius: 16,
  padding: 16,
  background:
    "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(248,250,252,1) 100%)",
  transition: "all .18s ease",
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

const inputStyle = {
  width: "100%",
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: "10px 12px",
  outline: "none",
  background: "#fff",
};

const primaryBtn = {
  border: 0,
  background: "#111827",
  color: "#fff",
  borderRadius: 10,
  padding: "12px 14px",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryBtn = {
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  borderRadius: 10,
  padding: "12px 14px",
  fontWeight: 700,
  cursor: "pointer",
};

const printBtn = {
  border: "1px solid #0f766e",
  background: "#ecfeff",
  color: "#134e4a",
  borderRadius: 10,
  padding: "12px 14px",
  fontWeight: 700,
  cursor: "pointer",
};

const suggestBtn = {
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  borderRadius: 8,
  padding: "8px 10px",
  cursor: "pointer",
  fontWeight: 700,
};