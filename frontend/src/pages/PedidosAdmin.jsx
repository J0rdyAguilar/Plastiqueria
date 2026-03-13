import React, { useEffect, useMemo, useState } from "react";
import { pedidosAdminApi } from "../lib/pedidosAdmin";

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

function badgeStyle(estado) {
  const base = {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
  };

  switch (estado) {
    case "pendiente_revision":
      return { ...base, background: "#fff7ed", color: "#9a3412" };
    case "aprobado":
      return { ...base, background: "#ecfeff", color: "#155e75" };
    case "preparando":
      return { ...base, background: "#ecfdf5", color: "#166534" };
    case "entregado":
      return { ...base, background: "#f3f4f6", color: "#374151" };
    default:
      return { ...base, background: "#eef2ff", color: "#3730a3" };
  }
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

  async function loadPedidos() {
    try {
      setLoading(true);
      const res = await pedidosAdminApi.list({
        q,
        estado,
        page: 1,
        per_page: 50,
      });
      setItems(res?.data || []);
    } catch (err) {
      console.error(err);
      alert("No se pudieron cargar los pedidos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPedidos();
  }, []);

  function seleccionarPedido(item) {
    setPedidoActivo(item);
    setObservaciones(item?.observaciones || "");
    setLineasEdit(
      (item?.detalles || []).map((d) => ({
        id: d.id,
        producto_id: d.producto_id,
        producto_nombre: d.producto_nombre,
        presentacion: d.presentacion || "unidad",
        cantidad_base: num(d.cantidad_base),
        precio_unitario: num(d.precio_unitario),
        subtotal: num(d.subtotal),
        es_monto_variable: false,
        sugeridos: [
          num(d.precio_unitario),
          num(d.precio_unitario) + 2,
          num(d.precio_unitario) + 5,
        ],
      }))
    );
  }

  function setLinea(id, changes) {
    setLineasEdit((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const next = { ...l, ...changes };
        next.subtotal = num(next.cantidad_base) * num(next.precio_unitario);
        return next;
      })
    );
  }

  const total = useMemo(() => {
    return lineasEdit.reduce((acc, item) => acc + num(item.subtotal), 0);
  }, [lineasEdit]);

  async function guardarCambios() {
    if (!pedidoActivo) return;

    try {
      setSaving(true);

      await pedidosAdminApi.actualizar(pedidoActivo.id, {
        observaciones,
        detalles: lineasEdit.map((l) => ({
          id: l.id,
          presentacion: l.presentacion,
          cantidad_base: l.cantidad_base,
          precio_unitario: l.precio_unitario,
          subtotal: l.subtotal,
          es_monto_variable: l.es_monto_variable ? 1 : 0,
        })),
      });

      await loadPedidos();
      alert("Pedido actualizado correctamente.");
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "No se pudo actualizar el pedido.");
    } finally {
      setSaving(false);
    }
  }

  async function aprobarPedido() {
    if (!pedidoActivo) return;
    await guardarCambios();

    try {
      await pedidosAdminApi.aprobar(pedidoActivo.id);
      alert("Pedido aprobado.");
      await loadPedidos();
    } catch (err) {
      console.error(err);
      alert("No se pudo aprobar el pedido.");
    }
  }

  async function prepararPedido() {
    if (!pedidoActivo) return;
    try {
      await pedidosAdminApi.preparar(pedidoActivo.id);
      alert("Pedido marcado como preparando.");
      await loadPedidos();
    } catch (err) {
      console.error(err);
      alert("No se pudo cambiar el estado.");
    }
  }

  async function entregarPedido() {
    if (!pedidoActivo) return;
    try {
      await pedidosAdminApi.entregar(pedidoActivo.id);
      alert("Pedido entregado.");
      await loadPedidos();
    } catch (err) {
      console.error(err);
      alert("No se pudo cambiar el estado.");
    }
  }

  function imprimir() {
    window.print();
  }

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h2>Pedidos Admin</h2>
          <p className="muted">Revisión, aprobación y preparación de pedidos</p>
        </div>
      </header>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }}>
        <div style={{ display: "grid", gap: 16 }}>
          <div className="card pad">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 240px 140px", gap: 12 }}>
              <input
                type="text"
                placeholder="Buscar por cliente, vendedor"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                style={inputStyle}
              />

              <select value={estado} onChange={(e) => setEstado(e.target.value)} style={inputStyle}>
                <option value="">Todos los estados</option>
                <option value="pendiente_revision">Pendiente revisión</option>
                <option value="aprobado">Aprobado</option>
                <option value="preparando">Preparando</option>
                <option value="entregado">Entregado</option>
              </select>

              <button onClick={loadPedidos} style={primaryBtn}>
                Buscar
              </button>
            </div>
          </div>

          <div className="card pad">
            <h3 style={{ marginTop: 0 }}>Listado de pedidos</h3>

            {loading ? (
              <div className="muted">Cargando pedidos...</div>
            ) : items.length === 0 ? (
              <div className="muted">No hay pedidos.</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {items.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => seleccionarPedido(item)}
                    style={{
                      border: pedidoActivo?.id === item.id ? "2px solid #111827" : "1px solid #e5e7eb",
                      borderRadius: 12,
                      padding: 14,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>Pedido #{item.id}</div>
                        <div className="muted">Cliente: {item.cliente_nombre || "—"}</div>
                        <div className="muted">Vendedor: {item.vendedor_nombre || "—"}</div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div style={badgeStyle(item.estado)}>{item.estado}</div>
                        <div style={{ marginTop: 8, fontWeight: 800 }}>{money(item.total)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div className="card pad">
            <h3 style={{ marginTop: 0 }}>Detalle del pedido</h3>

            {!pedidoActivo ? (
              <div className="muted">Selecciona un pedido para ver su detalle.</div>
            ) : (
              <>
                <div style={{ display: "grid", gap: 10 }}>
                  <div><b>Cliente:</b> {pedidoActivo.cliente_nombre}</div>
                  <div><b>Vendedor:</b> {pedidoActivo.vendedor_nombre}</div>
                  <div><b>Estado:</b> <span style={badgeStyle(pedidoActivo.estado)}>{pedidoActivo.estado}</span></div>
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
                  />
                </div>

                <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                  {lineasEdit.map((l) => (
                    <div key={l.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
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
                          <label className="muted" style={{ display: "block", marginBottom: 6 }}>
                            Presentación
                          </label>
                          <select
                            value={l.presentacion}
                            onChange={(e) => setLinea(l.id, { presentacion: e.target.value })}
                            style={inputStyle}
                          >
                            {PRESENTACIONES.map((p) => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="muted" style={{ display: "block", marginBottom: 6 }}>
                            Cantidad
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={l.cantidad_base}
                            onChange={(e) => setLinea(l.id, { cantidad_base: num(e.target.value) })}
                            style={inputStyle}
                          />
                        </div>

                        <div>
                          <label className="muted" style={{ display: "block", marginBottom: 6 }}>
                            Precio
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={l.precio_unitario}
                            onChange={(e) => setLinea(l.id, { precio_unitario: num(e.target.value) })}
                            style={inputStyle}
                          />
                        </div>
                      </div>

                      <div style={{ marginTop: 10 }}>
                        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input
                            type="checkbox"
                            checked={!!l.es_monto_variable}
                            onChange={(e) => setLinea(l.id, { es_monto_variable: e.target.checked })}
                          />
                          <span>Habilitar monto variable</span>
                        </label>
                      </div>

                      <div style={{ marginTop: 10 }}>
                        <div className="muted" style={{ marginBottom: 6 }}>Precios sugeridos</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {l.sugeridos.map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setLinea(l.id, { precio_unitario: p, es_monto_variable: true })}
                              style={suggestBtn}
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

                <hr style={{ margin: "14px 0", border: 0, borderTop: "1px solid #eee" }} />

                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 18 }}>
                  <span>Total</span>
                  <span>{money(total)}</span>
                </div>

                <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                  <button onClick={guardarCambios} disabled={saving} style={primaryBtn}>
                    Guardar cambios
                  </button>

                  <button onClick={aprobarPedido} style={secondaryBtn}>
                    Aprobar pedido
                  </button>

                  <button onClick={prepararPedido} style={secondaryBtn}>
                    Marcar preparando
                  </button>

                  <button onClick={entregarPedido} style={secondaryBtn}>
                    Marcar entregado
                  </button>

                  <button onClick={imprimir} style={printBtn}>
                    Imprimir listado
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

const inputStyle = {
  width: "100%",
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: "10px 12px",
  outline: "none",
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