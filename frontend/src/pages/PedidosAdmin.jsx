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
      return { ...base, background: "#fff7ed", color: "#9a3412", borderColor: "#fed7aa" };
    case "aprobado":
      return { ...base, background: "#ecfeff", color: "#155e75", borderColor: "#a5f3fc" };
    case "preparando":
      return { ...base, background: "#ecfdf5", color: "#166534", borderColor: "#bbf7d0" };
    case "en_ruta":
      return { ...base, background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" };
    case "entregado":
      return { ...base, background: "#f3f4f6", color: "#374151", borderColor: "#d1d5db" };
    default:
      return { ...base, background: "#eef2ff", color: "#3730a3", borderColor: "#c7d2fe" };
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
  const cantidad = cantidadReal > 0 ? cantidadReal : cantidadBase;

  const precioCosto = num(d.precio_costo);
  const precioVenta = num(d.precio_unitario);
  const subtotal = num(d.subtotal) || cantidad * precioVenta;
  const gananciaUnitaria = num(d.ganancia_unitaria) || (precioVenta - precioCosto);
  const gananciaTotal = num(d.ganancia_total) || (gananciaUnitaria * cantidad);

  return {
    id: d.id,
    producto_id: d.producto_id,
    producto_nombre: d.producto_nombre,
    producto_sku: d.producto_sku,
    presentacion: d.presentacion || "unidad",
    cantidad,
    cantidad_base: cantidadBase > 0 ? cantidadBase : (cantidadReal > 0 ? cantidadReal : 0),
    precio_costo: precioCosto,
    precio_unitario: precioVenta,
    subtotal,
    ganancia_unitaria: gananciaUnitaria,
    ganancia_total: gananciaTotal,
    es_monto_variable: !!d.es_monto_variable,
  };
}

export default function PedidosAdmin() {
  const session = getSession();
  const me = session?.user || {};
  const rol = String(me?.rol || me?.role || "").toLowerCase();
  const isSuperAdmin = rol === "super_admin" || rol === "superadmin";

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

  async function loadPedidos(selectedId = null) {
    try {
      setLoading(true);

      const res = await pedidosAdminApi.list({
        q,
        estado,
        ubicacion_id: isSuperAdmin ? ubicacionFiltro : "",
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
      notify.error("No se pudieron cargar los pedidos.");
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
      notify.error("No se pudieron cargar los ruteros.");
    } finally {
      setLoadingRuteros(false);
    }
  }

  useEffect(() => {
    loadPedidos();
    loadRuteros();
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

  const totalGanancia = useMemo(() => {
    return lineasEdit.reduce((acc, item) => acc + num(item.ganancia_total), 0);
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
                            <div style={pedidoTitleStyle}>
                              Pedido #{item.id}
                            </div>

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
                            <div style={pedidoGainMiniStyle}>
                              Ganancia: {money(item.ganancia_total)}
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

                <div style={totalsPanelStyle}>
                  <div style={totalsItemStyle}>
                    <span style={summaryLabelStyle}>Total venta</span>
                    <strong style={{ fontSize: 28, color: "#0f172a" }}>{money(total)}</strong>
                  </div>

                  <div style={totalsItemGreenStyle}>
                    <span style={summaryLabelStyle}>Ganancia estimada</span>
                    <strong style={{ fontSize: 26, color: "#166534" }}>{money(totalGanancia)}</strong>
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

                          <div style={gainPillStyle}>
                            Ganancia total: {money(l.ganancia_total)}
                          </div>
                        </div>

                        <div style={lineGridStyle}>
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
                            <label className="muted" style={fieldLabelStyle}>Precio costo</label>
                            <input
                              type="number"
                              value={l.precio_costo}
                              style={{ ...inputStyle, background: "#f8fafc" }}
                              disabled
                            />
                          </div>

                          <div>
                            <label className="muted" style={fieldLabelStyle}>Ganancia unitaria</label>
                            <input
                              type="number"
                              value={l.ganancia_unitaria}
                              style={{ ...inputStyle, background: "#f8fafc" }}
                              disabled
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

                          <div>
                            <label className="muted" style={fieldLabelStyle}>Ganancia total</label>
                            <input
                              type="number"
                              value={l.ganancia_total}
                              style={{
                                ...inputStyle,
                                background: "#ecfdf5",
                                color: "#166534",
                                fontWeight: 700,
                              }}
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
    </div>
  );
}

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

const pedidoItemStyle = {
  borderRadius: 18,
  padding: 16,
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  transition: "all .18s ease",
};

const pedidoItemTopStyle = {
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
  background: "linear-gradient(180deg, rgba(248,250,252,0.85) 0%, rgba(255,255,255,1) 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "column",
  gap: 8,
  color: "#64748b",
  textAlign: "center",
  padding: 24,
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

const totalsPanelStyle = {
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

const totalsItemGreenStyle = {
  borderRadius: 18,
  padding: 18,
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
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

const lineGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
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

const inputStyle = {
  width: "100%",
  border: "1px solid #d1d5db",
  borderRadius: 12,
  padding: "11px 12px",
  outline: "none",
  background: "#fff",
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