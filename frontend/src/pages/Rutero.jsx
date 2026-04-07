import React, { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { getSession } from "../lib/auth";
import { ruteroApi } from "../lib/rutero";

function money(n) {
  return `Q ${Number(n || 0).toFixed(2)}`;
}

function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString();
}

function estadoClase(estado) {
  switch ((estado || "").toLowerCase()) {
    case "entregado":
      return "rt-badge rt-badge--success";
    case "en_ruta":
      return "rt-badge rt-badge--info";
    case "preparando":
      return "rt-badge rt-badge--warning";
    case "aprobado":
      return "rt-badge rt-badge--purple";
    default:
      return "rt-badge";
  }
}

export default function Rutero() {
  const session = getSession();
  const me = session?.user || {};

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pedidos, setPedidos] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  async function cargarPedidos() {
    try {
      setError("");
      setLoading(true);

      const res = await ruteroApi.misPedidos({ soloActivos: true });
      const lista = Array.isArray(res?.data) ? res.data : [];

      setPedidos(lista);

      if (lista.length > 0) {
        setSelectedId((prev) => prev ?? lista[0].id);
      } else {
        setSelectedId(null);
      }
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Error al cargar pedidos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarPedidos();
  }, []);

  const pedidosFiltrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return pedidos;

    return pedidos.filter((p) => {
      const cliente = (p?.cliente_nombre || "").toLowerCase();
      const codigo = String(p?.codigo || p?.id || "").toLowerCase();
      const ruta = (p?.ruta_nombre || "").toLowerCase();
      const zona = (p?.zona_nombre || "").toLowerCase();

      return (
        cliente.includes(term) ||
        codigo.includes(term) ||
        ruta.includes(term) ||
        zona.includes(term)
      );
    });
  }, [pedidos, q]);

  const pedidoSeleccionado = useMemo(() => {
    return pedidos.find((p) => p.id === selectedId) || pedidosFiltrados[0] || null;
  }, [pedidos, pedidosFiltrados, selectedId]);

  async function handleEntregado() {
    if (!pedidoSeleccionado || saving) return;

    const ok = window.confirm(
      `¿Marcar como entregado el pedido #${pedidoSeleccionado.id}?`
    );
    if (!ok) return;

    try {
      setSaving(true);
      await ruteroApi.entregar(pedidoSeleccionado.id);

      const nuevos = pedidos.map((p) =>
        p.id === pedidoSeleccionado.id
          ? {
              ...p,
              estado: "entregado",
              entregado_en: new Date().toISOString(),
            }
          : p
      );

      const activos = nuevos.filter((p) => p.id !== pedidoSeleccionado.id);
      setPedidos(activos);
      setSelectedId(activos[0]?.id ?? null);
    } catch (e) {
      alert(e?.response?.data?.message || e?.message || "No se pudo marcar como entregado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout>
      <div className="rutero-page">
        <div className="rutero-top">
          <div>
            <div className="rutero-chip">Panel rutero</div>
            <h1 className="rutero-title">Pedidos para entrega</h1>
            <p className="rutero-subtitle">
              Sesión: <strong>{me?.nombre || me?.usuario || "Rutero"}</strong>
              {me?.ubicacion_id ? ` · Sucursal #${me.ubicacion_id}` : ""}
            </p>
          </div>

          <button className="rt-btn rt-btn--dark" onClick={cargarPedidos} disabled={loading}>
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        </div>

        {error ? <div className="rt-alert">{error}</div> : null}

        <div className="rutero-grid">
          <section className="rt-card">
            <div className="rt-card-head">
              <h2>Mis pedidos asignados</h2>
              <span>{pedidosFiltrados.length} pedido(s)</span>
            </div>

            <div className="rt-search-wrap">
              <input
                className="rt-input"
                type="text"
                placeholder="Buscar por cliente, código, ruta o zona..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <div className="rt-list">
              {loading ? (
                <div className="rt-empty">Cargando pedidos...</div>
              ) : pedidosFiltrados.length === 0 ? (
                <div className="rt-empty">No tienes pedidos asignados para entregar.</div>
              ) : (
                pedidosFiltrados.map((pedido) => (
                  <button
                    key={pedido.id}
                    type="button"
                    className={`rt-order-card ${
                      pedidoSeleccionado?.id === pedido.id ? "is-active" : ""
                    }`}
                    onClick={() => setSelectedId(pedido.id)}
                  >
                    <div className="rt-order-main">
                      <div>
                        <h3>Pedido #{pedido.id}</h3>
                        <p>Cliente: {pedido?.cliente_nombre || "Consumidor final"}</p>
                        <p>Ruta: {pedido?.ruta_nombre || "Sin ruta"}</p>
                        <p>Zona: {pedido?.zona_nombre || "Sin zona"}</p>
                      </div>

                      <div className="rt-order-side">
                        <span className={estadoClase(pedido.estado)}>{pedido.estado || "—"}</span>
                        <strong>{money(pedido.total)}</strong>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <aside className="rt-card">
            <div className="rt-card-head">
              <h2>Detalle del pedido</h2>
            </div>

            {!pedidoSeleccionado ? (
              <div className="rt-empty">Selecciona un pedido para ver el detalle.</div>
            ) : (
              <div className="rt-detail">
                <div className="rt-detail-top">
                  <div>
                    <h3>Pedido #{pedidoSeleccionado.id}</h3>
                    <p><strong>Cliente:</strong> {pedidoSeleccionado?.cliente_nombre || "Consumidor final"}</p>
                    <p><strong>Vendedor:</strong> {pedidoSeleccionado?.vendedor_nombre || "—"}</p>
                    <p><strong>Ruta:</strong> {pedidoSeleccionado?.ruta_nombre || "—"}</p>
                    <p><strong>Zona:</strong> {pedidoSeleccionado?.zona_nombre || "—"}</p>
                    <p><strong>Sucursal:</strong> {pedidoSeleccionado?.ubicacion_nombre || pedidoSeleccionado?.ubicacion_id || "—"}</p>
                    <p><strong>Fecha pedido:</strong> {fmtDate(pedidoSeleccionado?.creado_en)}</p>
                  </div>

                  <span className={estadoClase(pedidoSeleccionado.estado)}>
                    {pedidoSeleccionado.estado || "—"}
                  </span>
                </div>

                <div className="rt-box">
                  <label>Observaciones</label>
                  <div className="rt-note">
                    {pedidoSeleccionado?.observaciones?.trim() || "Sin observaciones"}
                  </div>
                </div>

                <div className="rt-box">
                  <label>Productos</label>
                  <div className="rt-items">
                    {(pedidoSeleccionado?.detalles || []).length === 0 ? (
                      <div className="rt-empty-mini">Este pedido no tiene detalle.</div>
                    ) : (
                      pedidoSeleccionado.detalles.map((item) => (
                        <div className="rt-item-row" key={item.id}>
                          <div>
                            <strong>{item?.producto_nombre || "Producto"}</strong>
                            <p>
                              Cantidad: {item.cantidad} {item?.presentacion || ""}
                            </p>
                          </div>
                          <div className="rt-item-price">{money(item.subtotal || 0)}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rt-total">
                  <span>Total</span>
                  <strong>{money(pedidoSeleccionado.total)}</strong>
                </div>

                <button
                  className="rt-btn rt-btn--success"
                  onClick={handleEntregado}
                  disabled={
                    saving ||
                    !pedidoSeleccionado ||
                    String(pedidoSeleccionado.estado).toLowerCase() === "entregado"
                  }
                >
                  {saving ? "Guardando..." : "Marcar como entregado"}
                </button>
              </div>
            )}
          </aside>
        </div>
      </div>
    </Layout>
  );
}