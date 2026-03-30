import React, { useEffect, useMemo, useState } from "react";
import { stockApi } from "../lib/stock";
import { ubicacionesApi } from "../lib/ubicaciones";
import { getSession } from "../lib/auth";

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
      isLow: true,
    };
  }

  if (n <= 10) {
    return {
      bg: "#fff7ed",
      color: "#9a3412",
      border: "#fed7aa",
      label: "Bajo",
      isLow: true,
    };
  }

  return {
    bg: "#ecfdf5",
    color: "#166534",
    border: "#bbf7d0",
    label: "Disponible",
    isLow: false,
  };
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

function normalizeRole(roleValue) {
  return String(roleValue || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

export default function Stock() {
  const session = getSession();
  const user = session?.user || {};

  const rawRole = user?.role || user?.rol || "";
  const normalizedRole = normalizeRole(rawRole);
  const isSuperAdmin = normalizedRole === "superadmin";

  const userUbicacionId = String(
    user?.ubicacion_id || user?.sucursal_id || user?.ubicacionId || ""
  );

  const [q, setQ] = useState("");
  const [ubicacionId, setUbicacionId] = useState("");
  const [ubicaciones, setUbicaciones] = useState([]);

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);

  const [page, setPage] = useState(1);
  const [perPage] = useState(20);

  const [loading, setLoading] = useState(false);
  const [loadingUbicaciones, setLoadingUbicaciones] = useState(true);
  const [error, setError] = useState("");

  const [soloAlertas, setSoloAlertas] = useState(false);
  const [mostrarPanelAlertas, setMostrarPanelAlertas] = useState(false);

  async function loadUbicaciones() {
    try {
      setLoadingUbicaciones(true);
      setError("");

      const res = await ubicacionesApi.list({ per_page: 200, activa: 1 });
      const arr = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];

      if (isSuperAdmin) {
        setUbicaciones(arr);

        if (arr.length > 0) {
          setUbicacionId((prev) => prev || String(arr[0].id));
        } else {
          setUbicacionId("");
        }
        return;
      }

      const propia = arr.find((u) => String(u.id) === userUbicacionId);

      if (propia) {
        setUbicaciones([propia]);
        setUbicacionId(String(propia.id));
      } else {
        setUbicaciones([]);
        setUbicacionId(userUbicacionId || "");
      }
    } catch (e) {
      console.error(e);
      setError("No se pudieron cargar las ubicaciones.");
      setUbicaciones([]);
      setUbicacionId("");
    } finally {
      setLoadingUbicaciones(false);
    }
  }

  async function load(p = page, forcedUbicacionId = ubicacionId) {
    if (!forcedUbicacionId) {
      setItems([]);
      setMeta({
        current_page: 1,
        last_page: 1,
        total: 0,
      });
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await stockApi.list({
        q,
        ubicacion_id: forcedUbicacionId,
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
      console.error(e);
      setItems([]);
      setMeta({
        current_page: 1,
        last_page: 1,
        total: 0,
      });
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
      load(1, ubicacionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ubicacionId]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (ubicacionId) {
        setPage(1);
        load(1, ubicacionId);
      }
    }, 300);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const resumen = useMemo(() => {
    const totalFilas = items.length;
    const totalCantidad = items.reduce((acc, it) => acc + Number(it.cantidad || 0), 0);
    const agotados = items.filter((it) => Number(it.cantidad || 0) <= 0).length;
    const bajos = items.filter((it) => Number(it.cantidad || 0) > 0 && Number(it.cantidad || 0) <= 10).length;
    const alertas = items.filter((it) => Number(it.cantidad || 0) <= 10).length;

    return { totalFilas, totalCantidad, agotados, bajos, alertas };
  }, [items]);

  const itemsFiltrados = useMemo(() => {
    if (!soloAlertas) return items;
    return items.filter((it) => Number(it.cantidad || 0) <= 10);
  }, [items, soloAlertas]);

  const listaAlertas = useMemo(() => {
    return items
      .filter((it) => Number(it.cantidad || 0) <= 10)
      .sort((a, b) => Number(a.cantidad || 0) - Number(b.cantidad || 0));
  }, [items]);

  const canPrev = (meta?.current_page || 1) > 1 && !soloAlertas;
  const canNext = (meta?.current_page || 1) < (meta?.last_page || 1) && !soloAlertas;

  return (
    <div className="page">
      <div
        style={{
          marginBottom: 18,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ marginBottom: 6 }}>Inventario</h2>
          <div className="muted">Stock por presentación y por ubicación</div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            className="btn"
            type="button"
            onClick={() => {
              setSoloAlertas((prev) => !prev);
              setMostrarPanelAlertas(true);
            }}
            style={{
              borderRadius: 12,
              fontWeight: 800,
              background: soloAlertas ? "#fff7ed" : "#ffffff",
              color: soloAlertas ? "#9a3412" : "#0f172a",
              border: soloAlertas ? "1px solid #fdba74" : "1px solid #e5e7eb",
              boxShadow: soloAlertas
                ? "0 10px 24px rgba(249, 115, 22, 0.12)"
                : "0 8px 20px rgba(15, 23, 42, 0.05)",
            }}
          >
            {soloAlertas ? "Ver todo el inventario" : `Alerta stock (${resumen.alertas})`}
          </button>

          <button
            className="btn"
            type="button"
            onClick={() => setMostrarPanelAlertas((prev) => !prev)}
            style={{
              borderRadius: 12,
              fontWeight: 800,
            }}
          >
            {mostrarPanelAlertas ? "Ocultar alertas" : "Mostrar alertas"}
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div style={miniCard}>
          <div className="muted" style={{ fontSize: 12 }}>
            Filas visibles
          </div>
          <div style={miniValue}>
            {loading ? <InlineLoader /> : soloAlertas ? itemsFiltrados.length : resumen.totalFilas}
          </div>
        </div>

        <div style={miniCard}>
          <div className="muted" style={{ fontSize: 12 }}>
            Cantidad total
          </div>
          <div style={miniValue}>
            {loading ? <InlineLoader /> : formatNumber(resumen.totalCantidad)}
          </div>
        </div>

        <div style={miniCard}>
          <div className="muted" style={{ fontSize: 12 }}>
            Stock bajo
          </div>
          <div style={miniValue}>{loading ? <InlineLoader /> : resumen.bajos}</div>
        </div>

        <div style={miniCard}>
          <div className="muted" style={{ fontSize: 12 }}>
            Agotados
          </div>
          <div style={miniValue}>{loading ? <InlineLoader /> : resumen.agotados}</div>
        </div>
      </div>

      {mostrarPanelAlertas && (
        <div
          className="card"
          style={{
            marginBottom: 16,
            borderRadius: 18,
            padding: 16,
            border: "1px solid #fed7aa",
            background:
              "linear-gradient(135deg, rgba(255,247,237,1) 0%, rgba(255,255,255,1) 100%)",
            boxShadow: "0 18px 40px rgba(249, 115, 22, 0.08)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 12,
            }}
          >
            <div>
              <h3 style={{ margin: 0, color: "#9a3412" }}>Alerta de stock</h3>
              <div className="muted" style={{ marginTop: 4 }}>
                Productos con existencia baja o agotada en esta sucursal
              </div>
            </div>

            <div
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                background: "#fff",
                border: "1px solid #fdba74",
                color: "#9a3412",
                fontWeight: 800,
              }}
            >
              {resumen.alertas} alerta{resumen.alertas === 1 ? "" : "s"}
            </div>
          </div>

          {loading ? (
            <TableLoader />
          ) : listaAlertas.length === 0 ? (
            <div
              style={{
                padding: 16,
                borderRadius: 14,
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                color: "#166534",
                fontWeight: 700,
              }}
            >
              Todo bien, no hay productos con stock bajo en esta sucursal.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 12,
              }}
            >
              {listaAlertas.map((it) => {
                const badge = getStockBadge(it.cantidad);

                return (
                  <div
                    key={`alerta-${it.id}`}
                    style={{
                      background: "#fff",
                      border: `1px solid ${badge.border}`,
                      borderRadius: 16,
                      padding: 14,
                      boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "start",
                        gap: 10,
                        marginBottom: 10,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 900,
                            color: "#0f172a",
                            fontSize: 15,
                            lineHeight: 1.2,
                          }}
                        >
                          {it.producto_nombre || "-"}
                        </div>
                        <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
                          SKU: {it.producto_sku || "-"}
                        </div>
                        <div className="muted" style={{ marginTop: 2, fontSize: 13 }}>
                          Presentación: {it.presentacion || "-"}
                        </div>
                      </div>

                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "6px 10px",
                          borderRadius: 999,
                          background: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`,
                          fontWeight: 800,
                          fontSize: 12,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {badge.label}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "center",
                        paddingTop: 10,
                        borderTop: "1px solid #f1f5f9",
                      }}
                    >
                      <div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          Cantidad actual
                        </div>
                        <div
                          style={{
                            fontSize: 24,
                            fontWeight: 900,
                            color: badge.color,
                            marginTop: 2,
                          }}
                        >
                          {formatNumber(it.cantidad)}
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div className="muted" style={{ fontSize: 12 }}>
                          Cantidad base
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>
                          {formatNumber(it.cantidad_base)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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

            {loadingUbicaciones ? (
              <ModalLoader text="Cargando ubicaciones..." />
            ) : isSuperAdmin ? (
              <select
                value={ubicacionId}
                onChange={(e) => {
                  setUbicacionId(e.target.value);
                  setPage(1);
                }}
                disabled={loading || loadingUbicaciones || ubicaciones.length === 0}
              >
                {ubicaciones.length === 0 ? (
                  <option value="">No hay sucursales disponibles</option>
                ) : (
                  ubicaciones.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre} ({u.tipo})
                    </option>
                  ))
                )}
              </select>
            ) : (
              <input
                value={
                  ubicaciones[0]
                    ? `${ubicaciones[0].nombre} (${ubicaciones[0].tipo})`
                    : "Sucursal asignada"
                }
                disabled
                readOnly
              />
            )}
          </div>

          <div className="field">
            <label>Buscar producto o presentación</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nombre, SKU, ID o presentación..."
              disabled={loadingUbicaciones || !ubicacionId}
            />
          </div>

          <div className="field">
            <label>&nbsp;</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                className="btn"
                onClick={() => load(1, ubicacionId)}
                disabled={loading || loadingUbicaciones || !ubicacionId}
              >
                {loading ? <InlineLoader /> : "Buscar"}
              </button>

              <button
                className="btn"
                type="button"
                onClick={() => {
                  setQ("");
                  setSoloAlertas(false);
                  setPage(1);
                  load(1, ubicacionId);
                }}
                disabled={loading || loadingUbicaciones || !ubicacionId}
              >
                Limpiar
              </button>
            </div>
          </div>
        </div>

        {soloAlertas && (
          <div
            style={{
              marginBottom: 14,
              padding: "12px 14px",
              borderRadius: 14,
              background: "#fff7ed",
              border: "1px solid #fdba74",
              color: "#9a3412",
              fontWeight: 700,
            }}
          >
            Mostrando solo productos con alerta de stock bajo o agotado.
          </div>
        )}

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
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ padding: 0 }}>
                    <TableLoader />
                  </td>
                </tr>
              ) : itemsFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ padding: 18 }} className="muted">
                    {soloAlertas
                      ? "No hay productos con alerta de stock."
                      : "No hay productos para mostrar."}
                  </td>
                </tr>
              ) : (
                itemsFiltrados.map((it) => {
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
                })
              )}
            </tbody>
          </table>
        </div>

        {meta && !soloAlertas && (
          <div
            className="row between mt"
            style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #e5e7eb" }}
          >
            <div className="muted">
              {loading ? (
                <InlineLoader />
              ) : (
                <>
                  Página {meta.current_page} de {meta.last_page} · Total {meta.total}
                </>
              )}
            </div>

            <div className="row gap">
              <button
                className="btn"
                disabled={!canPrev || loading}
                onClick={() => {
                  const p = page - 1;
                  setPage(p);
                  load(p, ubicacionId);
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
                  load(p, ubicacionId);
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
  minHeight: 32,
  display: "flex",
  alignItems: "center",
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