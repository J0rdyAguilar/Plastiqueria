import React, { useEffect, useMemo, useState } from "react";
import { stockApi } from "../lib/stock";
import { ubicacionesApi } from "../lib/ubicaciones";

function formatNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n)
    ? n.toLocaleString("es-GT", { maximumFractionDigits: 2 })
    : "0";
}

function getStockBadge(cantidad) {
  const n = Number(cantidad || 0);

  if (n <= 0) {
    return {
      bg: "#fef2f2",
      color: "#991b1b",
      border: "#fecaca",
      label: "Agotado",
    };
  }

  if (n <= 10) {
    return {
      bg: "#fff7ed",
      color: "#9a3412",
      border: "#fed7aa",
      label: "Bajo",
    };
  }

  return {
    bg: "#ecfdf5",
    color: "#166534",
    border: "#bbf7d0",
    label: "Disponible",
  };
}

export default function Stock() {
  const [q, setQ] = useState("");
  const [ubicacionId, setUbicacionId] = useState("");
  const [ubicaciones, setUbicaciones] = useState([]);

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);

  const [page, setPage] = useState(1);
  const [perPage] = useState(20);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadUbicaciones() {
    try {
      const res = await ubicacionesApi.list({ per_page: 200, activa: 1 });
      const arr = res?.data ?? res ?? [];
      setUbicaciones(arr);

      if (!ubicacionId && arr.length) {
        setUbicacionId(String(arr[0].id));
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function load(p = page) {
    if (!ubicacionId) return;

    setLoading(true);
    setError("");

    try {
      const res = await stockApi.list({
        q,
        ubicacion_id: ubicacionId,
        page: p,
        per_page: perPage,
      });

      setItems(res?.data || []);
      setMeta({
        current_page: res?.current_page || 1,
        last_page: res?.last_page || 1,
        total: res?.total || 0,
      });
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Error cargando inventario");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUbicaciones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ubicacionId) {
      setPage(1);
      load(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ubicacionId]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (ubicacionId) {
        setPage(1);
        load(1);
      }
    }, 300);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const resumen = useMemo(() => {
    const totalFilas = items.length;
    const totalCantidad = items.reduce((acc, it) => acc + Number(it.cantidad || 0), 0);
    const agotados = items.filter((it) => Number(it.cantidad || 0) <= 0).length;

    return { totalFilas, totalCantidad, agotados };
  }, [items]);

  const canPrev = meta?.current_page > 1;
  const canNext = meta?.current_page < meta?.last_page;

  return (
    <div className="page">
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ marginBottom: 6 }}>Inventario</h2>
        <div className="muted">Stock por presentación y por ubicación</div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div style={miniCard}>
          <div className="muted" style={{ fontSize: 12 }}>Filas visibles</div>
          <div style={miniValue}>{resumen.totalFilas}</div>
        </div>

        <div style={miniCard}>
          <div className="muted" style={{ fontSize: 12 }}>Cantidad total</div>
          <div style={miniValue}>{formatNumber(resumen.totalCantidad)}</div>
        </div>

        <div style={miniCard}>
          <div className="muted" style={{ fontSize: 12 }}>Agotados</div>
          <div style={miniValue}>{resumen.agotados}</div>
        </div>
      </div>

      <div className="card" style={{ borderRadius: 18, padding: 16 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 1fr auto",
            gap: 12,
            alignItems: "end",
            marginBottom: 14,
          }}
        >
          <div className="field">
            <label>Ubicación</label>
            <select value={ubicacionId} onChange={(e) => setUbicacionId(e.target.value)}>
              {ubicaciones.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre} ({u.tipo})
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Buscar producto o presentación</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nombre, SKU, ID o presentación..."
            />
          </div>

          <div className="field">
            <label>&nbsp;</label>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={() => load(1)} disabled={loading || !ubicacionId}>
                {loading ? "Cargando..." : "Buscar"}
              </button>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setQ("");
                  setPage(1);
                  load(1);
                }}
                disabled={loading}
              >
                Limpiar
              </button>
            </div>
          </div>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            overflow: "hidden",
            background: "#fff",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={thStyle}>SKU</th>
                <th style={thStyle}>Producto</th>
                <th style={thStyle}>Presentación</th>
                <th style={thStyle}>Factor base</th>
                <th style={thStyle}>Cantidad</th>
                <th style={thStyle}>Cantidad base</th>
                <th style={thStyle}>Estado</th>
                <th style={thStyle}>Actualizado</th>
              </tr>
            </thead>

            <tbody>
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan="8" style={{ padding: 18 }} className="muted">
                    No hay productos para mostrar.
                  </td>
                </tr>
              )}

              {items.map((it) => {
                const badge = getStockBadge(it.cantidad);

                return (
                  <tr key={it.id} style={{ borderTop: "1px solid #eef2f7" }}>
                    <td style={tdStyle}>{it.producto_sku || "-"}</td>
                    <td style={tdStyleBold}>{it.producto_nombre || "-"}</td>
                    <td style={tdStyle}>{it.presentacion || "-"}</td>
                    <td style={tdStyle}>{formatNumber(it.factor_base)}</td>
                    <td style={tdStyleBold}>{formatNumber(it.cantidad)}</td>
                    <td style={tdStyle}>{formatNumber(it.cantidad_base)}</td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "6px 10px",
                          borderRadius: 999,
                          background: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`,
                          fontWeight: 700,
                          fontSize: 12,
                        }}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td style={tdStyle}>{it.actualizado_en || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {meta && (
          <div
            className="row between mt"
            style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #e5e7eb" }}
          >
            <div className="muted">
              Página {meta.current_page} de {meta.last_page} · Total {meta.total}
            </div>

            <div className="row gap">
              <button
                className="btn"
                disabled={!canPrev || loading}
                onClick={() => {
                  const p = page - 1;
                  setPage(p);
                  load(p);
                }}
              >
                Anterior
              </button>

              <button
                className="btn"
                disabled={!canNext || loading}
                onClick={() => {
                  const p = page + 1;
                  setPage(p);
                  load(p);
                }}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const miniCard = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 14,
};

const miniValue = {
  marginTop: 4,
  fontSize: 24,
  fontWeight: 900,
  color: "#0f172a",
};

const thStyle = {
  textAlign: "left",
  padding: "12px 14px",
  fontSize: 13,
  color: "#64748b",
  fontWeight: 800,
};

const tdStyle = {
  padding: "12px 14px",
  fontSize: 14,
  color: "#334155",
  verticalAlign: "middle",
};

const tdStyleBold = {
  ...tdStyle,
  fontWeight: 800,
  color: "#0f172a",
};