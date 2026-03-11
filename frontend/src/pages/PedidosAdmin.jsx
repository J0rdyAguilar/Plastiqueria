import React, { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { pedidosAdminApi } from "../lib/pedidosAdmin";

function money(n) {
  return `Q ${Number(n || 0).toFixed(2)}`;
}

function estadoBadgeStyle(estado) {
  const base = {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
  };

  switch (estado) {
    case "pendiente_revision":
      return { ...base, background: "#fff3cd", color: "#856404" };
    case "aprobado":
      return { ...base, background: "#d1ecf1", color: "#0c5460" };
    case "preparando":
      return { ...base, background: "#d4edda", color: "#155724" };
    case "entregado":
      return { ...base, background: "#e2e3e5", color: "#383d41" };
    default:
      return { ...base, background: "#f3f4f6", color: "#111827" };
  }
}

export default function PedidosAdmin() {
  const [loading, setLoading] = useState(true);
  const [accionando, setAccionando] = useState(false);
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);

  const [pedidoActivo, setPedidoActivo] = useState(null);

  async function loadPedidos() {
    try {
      setLoading(true);
      setError("");

      const res = await pedidosAdminApi.list({
        q,
        estado,
        page: 1,
        per_page: 50,
      });

      setItems(res?.data || []);
      setMeta(res?.meta || null);
    } catch (err) {
      console.error(err);
      setError("No se pudieron cargar los pedidos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPedidos();
  }, []);

  async function handleBuscar(e) {
    e?.preventDefault?.();
    loadPedidos();
  }

  async function handleAprobar(id) {
    try {
      setAccionando(true);
      await pedidosAdminApi.aprobar(id);
      await loadPedidos();
      if (pedidoActivo?.id === id) {
        setPedidoActivo((prev) => ({ ...prev, estado: "aprobado" }));
      }
      alert("Pedido aprobado.");
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "No se pudo aprobar el pedido.");
    } finally {
      setAccionando(false);
    }
  }

  async function handlePreparar(id) {
    try {
      setAccionando(true);
      await pedidosAdminApi.preparar(id);
      await loadPedidos();
      if (pedidoActivo?.id === id) {
        setPedidoActivo((prev) => ({ ...prev, estado: "preparando" }));
      }
      alert("Pedido marcado como preparando.");
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "No se pudo cambiar el estado.");
    } finally {
      setAccionando(false);
    }
  }

  async function handleEntregar(id) {
    try {
      setAccionando(true);
      await pedidosAdminApi.entregar(id);
      await loadPedidos();
      if (pedidoActivo?.id === id) {
        setPedidoActivo((prev) => ({ ...prev, estado: "entregado" }));
      }
      alert("Pedido entregado.");
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "No se pudo marcar como entregado.");
    } finally {
      setAccionando(false);
    }
  }

  function handleImprimir() {
    window.print();
  }

  const detalles = useMemo(() => {
    return pedidoActivo?.detalles || pedidoActivo?.items || [];
  }, [pedidoActivo]);

  return (
    
      <div className="page">
        <header className="topbar">
          <div>
            <h2>Pedidos Admin</h2>
            <p className="muted">Revisión, aprobación y preparación de pedidos</p>
          </div>
        </header>

        {error ? (
          <div className="card pad" style={{ marginTop: 12, border: "1px solid #f5c2c7" }}>
            <div style={{ color: "#842029", fontWeight: 600 }}>{error}</div>
          </div>
        ) : null}

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, alignItems: "start" }}>
          <div style={{ display: "grid", gap: 16 }}>
            <form className="card pad" onSubmit={handleBuscar}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 220px 120px", gap: 12 }}>
                <input
                  type="text"
                  placeholder="Buscar por cliente, vendedor o código..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  style={inputStyle}
                />

                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Todos los estados</option>
                  <option value="pendiente_revision">Pendiente revisión</option>
                  <option value="aprobado">Aprobado</option>
                  <option value="preparando">Preparando</option>
                  <option value="entregado">Entregado</option>
                </select>

                <button type="submit" style={primaryBtn}>
                  Buscar
                </button>
              </div>
            </form>

            <div className="card pad">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>Listado de pedidos</h3>
                <div className="muted">
                  {meta?.total != null ? `${meta.total} registros` : ""}
                </div>
              </div>

              {loading ? (
                <div className="muted">Cargando pedidos...</div>
              ) : items.length === 0 ? (
                <div className="muted">No hay pedidos.</div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {items.map((item) => {
                    const id = item.id || item.pedido_id;
                    const cliente = item.cliente_nombre || item.cliente?.nombre || "—";
                    const vendedor = item.vendedor_nombre || item.vendedor?.nombre || item.usuario?.nombre || "—";
                    const total = item.total || 0;
                    const estadoActual = item.estado || "—";

                    return (
                      <div
                        key={id}
                        onClick={() => setPedidoActivo(item)}
                        style={{
                          border: pedidoActivo?.id === id ? "2px solid #111827" : "1px solid #e5e7eb",
                          borderRadius: 12,
                          padding: 14,
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                          <div>
                            <div style={{ fontWeight: 700 }}>
                              Pedido #{id}
                            </div>
                            <div className="muted" style={{ fontSize: 13 }}>
                              Cliente: {cliente}
                            </div>
                            <div className="muted" style={{ fontSize: 13 }}>
                              Vendedor: {vendedor}
                            </div>
                          </div>

                          <div style={{ textAlign: "right" }}>
                            <div style={estadoBadgeStyle(estadoActual)}>{estadoActual}</div>
                            <div style={{ fontWeight: 700, marginTop: 8 }}>{money(total)}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gap: 16, position: "sticky", top: 12 }}>
            <div className="card pad">
              <h3 style={{ marginTop: 0 }}>Detalle del pedido</h3>

              {!pedidoActivo ? (
                <div className="muted">Selecciona un pedido para ver su detalle.</div>
              ) : (
                <>
                  <div style={{ display: "grid", gap: 10 }}>
                    <div>
                      <div className="muted" style={{ fontSize: 13 }}>Pedido</div>
                      <div style={{ fontWeight: 700 }}>#{pedidoActivo.id}</div>
                    </div>

                    <div>
                      <div className="muted" style={{ fontSize: 13 }}>Cliente</div>
                      <div style={{ fontWeight: 600 }}>
                        {pedidoActivo.cliente_nombre || pedidoActivo.cliente?.nombre || "—"}
                      </div>
                    </div>

                    <div>
                      <div className="muted" style={{ fontSize: 13 }}>Vendedor</div>
                      <div style={{ fontWeight: 600 }}>
                        {pedidoActivo.vendedor_nombre || pedidoActivo.vendedor?.nombre || pedidoActivo.usuario?.nombre || "—"}
                      </div>
                    </div>

                    <div>
                      <div className="muted" style={{ fontSize: 13 }}>Estado</div>
                      <div style={estadoBadgeStyle(pedidoActivo.estado)}>{pedidoActivo.estado}</div>
                    </div>

                    <div>
                      <div className="muted" style={{ fontSize: 13 }}>Observaciones</div>
                      <div style={{ fontWeight: 500 }}>
                        {pedidoActivo.observaciones || pedidoActivo.nota || "Sin observaciones"}
                      </div>
                    </div>
                  </div>

                  <hr style={{ margin: "14px 0", border: 0, borderTop: "1px solid #eee" }} />

                  <div style={{ display: "grid", gap: 10, maxHeight: 280, overflow: "auto" }}>
                    {detalles.length === 0 ? (
                      <div className="muted">
                        Este endpoint aún no está devolviendo el detalle. Si quieres, te adapto el backend para que lo envíe.
                      </div>
                    ) : (
                      detalles.map((d, i) => (
                        <div
                          key={d.id || i}
                          style={{
                            border: "1px solid #eee",
                            borderRadius: 10,
                            padding: 10,
                          }}
                        >
                          <div style={{ fontWeight: 700 }}>
                            {d.producto_nombre || d.producto?.nombre || `Producto #${d.producto_id}`}
                          </div>
                          <div className="muted" style={{ fontSize: 13 }}>
                            {d.presentacion || "unidad"} · Cantidad base: {d.cantidad_base}
                          </div>
                          <div className="muted" style={{ fontSize: 13 }}>
                            Precio: {money(d.precio_unitario)} · Subtotal: {money(d.subtotal)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <hr style={{ margin: "14px 0", border: 0, borderTop: "1px solid #eee" }} />

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 800, fontSize: 18 }}>
                    <span>Total</span>
                    <span>{money(pedidoActivo.total || 0)}</span>
                  </div>

                  <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                    <button
                      type="button"
                      disabled={accionando}
                      onClick={() => handleAprobar(pedidoActivo.id)}
                      style={primaryBtn}
                    >
                      Aprobar
                    </button>

                    <button
                      type="button"
                      disabled={accionando}
                      onClick={() => handlePreparar(pedidoActivo.id)}
                      style={secondaryBtn}
                    >
                      Marcar preparando
                    </button>

                    <button
                      type="button"
                      disabled={accionando}
                      onClick={() => handleEntregar(pedidoActivo.id)}
                      style={secondaryBtn}
                    >
                      Marcar entregado
                    </button>

                    <button
                      type="button"
                      onClick={handleImprimir}
                      style={printBtn}
                    >
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
  cursor: "pointer",
  fontWeight: 700,
};

const secondaryBtn = {
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  borderRadius: 10,
  padding: "12px 14px",
  cursor: "pointer",
  fontWeight: 700,
};

const printBtn = {
  border: "1px solid #0f766e",
  background: "#ecfeff",
  color: "#134e4a",
  borderRadius: 10,
  padding: "12px 14px",
  cursor: "pointer",
  fontWeight: 700,
};