import React, { useEffect, useMemo, useState } from "react";
import {
  ReceiptText,
  RefreshCw,
  CalendarDays,
  CreditCard,
  Banknote,
  Store,
  User,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
} from "lucide-react";
import { ventasTienda } from "../api/ventasTienda";

function money(n) {
  return `Q${Number(n || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function RegistroVentasTienda() {
  const hoy = todayStr();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});

  const [filters, setFilters] = useState({
    fecha_desde: hoy,
    fecha_hasta: hoy,
    metodo_pago: "",
    solo_mias: 1,
    page: 1,
    per_page: 30,
  });

  async function load() {
    try {
      setLoading(true);
      const resp = await ventasTienda.list(filters);
      setRows(Array.isArray(resp?.data) ? resp.data : []);
    } catch (error) {
      console.error("ERROR CARGANDO REGISTRO:", error);
      alert(
        error?.response?.data?.message ||
          "No se pudo cargar el registro de ventas."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const totalDia = useMemo(() => {
    return rows.reduce((acc, item) => acc + Number(item.total || 0), 0);
  }, [rows]);

  const totalEfectivo = useMemo(() => {
    return rows
      .filter((item) => item.metodo_pago === "efectivo")
      .reduce((acc, item) => acc + Number(item.total || 0), 0);
  }, [rows]);

  const totalTarjeta = useMemo(() => {
    return rows
      .filter((item) => item.metodo_pago === "tarjeta")
      .reduce((acc, item) => acc + Number(item.total || 0), 0);
  }, [rows]);

  function toggleExpand(id) {
    setExpanded((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  function resetHoy() {
    setFilters((prev) => ({
      ...prev,
      fecha_desde: hoy,
      fecha_hasta: hoy,
      metodo_pago: "",
      solo_mias: 1,
      page: 1,
    }));
  }

  return (
    <section style={{ minHeight: "100%", padding: 28 }}>
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          display: "grid",
          gap: 24,
        }}
      >
        <div
          style={{
            borderRadius: 28,
            padding: "30px 28px",
            background:
              "linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.96) 45%, rgba(59,130,246,0.84) 100%)",
            boxShadow: "0 20px 60px rgba(15,23,42,0.20)",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 20,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.10)",
                  color: "#e2e8f0",
                  fontSize: 13,
                  fontWeight: 700,
                  marginBottom: 16,
                }}
              >
                <ReceiptText size={16} />
                Mi registro de ventas
              </div>

              <h1
                style={{
                  margin: 0,
                  color: "#fff",
                  fontSize: "clamp(28px, 4vw, 40px)",
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                }}
              >
                Cuadre del día
              </h1>

              <p
                style={{
                  margin: "10px 0 0",
                  color: "rgba(255,255,255,0.78)",
                  fontSize: 15,
                  maxWidth: 760,
                  lineHeight: 1.6,
                }}
              >
                Aquí puedes ver lo que vendiste hoy, separado por efectivo y tarjeta.
              </p>
            </div>

            <button
              type="button"
              onClick={resetHoy}
              style={{
                border: "1px solid rgba(255,255,255,0.16)",
                background: "rgba(255,255,255,0.12)",
                color: "#fff",
                height: 48,
                borderRadius: 16,
                padding: "0 18px",
                fontWeight: 800,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <RefreshCw size={18} />
              Hoy
            </button>
          </div>
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.88)",
            borderRadius: 28,
            padding: 24,
            border: "1px solid rgba(148,163,184,0.18)",
            boxShadow: "0 18px 45px rgba(15,23,42,0.08)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr auto",
              gap: 14,
              alignItems: "end",
            }}
          >
            <div>
              <label style={labelStyle}>Desde</label>
              <input
                type="date"
                value={filters.fecha_desde}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    fecha_desde: e.target.value,
                  }))
                }
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Hasta</label>
              <input
                type="date"
                value={filters.fecha_hasta}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    fecha_hasta: e.target.value,
                  }))
                }
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Método pago</label>
              <select
                value={filters.metodo_pago}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    metodo_pago: e.target.value,
                  }))
                }
                style={inputStyle}
              >
                <option value="">Todos</option>
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
              </select>
            </div>

            <button type="button" onClick={load} style={primaryButtonStyle}>
              <RefreshCw size={18} />
              Actualizar
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
          }}
        >
          <MetricCard
            icon={<ReceiptText size={18} />}
            title="Total vendido"
            value={money(totalDia)}
            subtitle={`${rows.length} venta(s)`}
          />
          <MetricCard
            icon={<Banknote size={18} />}
            title="Efectivo"
            value={money(totalEfectivo)}
            subtitle="Ventas cobradas en efectivo"
            accent="green"
          />
          <MetricCard
            icon={<CreditCard size={18} />}
            title="Tarjeta"
            value={money(totalTarjeta)}
            subtitle="Ventas cobradas con tarjeta"
            accent="blue"
          />
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.88)",
            borderRadius: 28,
            padding: 24,
            border: "1px solid rgba(148,163,184,0.18)",
            boxShadow: "0 18px 45px rgba(15,23,42,0.08)",
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <h2
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 800,
                color: "#0f172a",
              }}
            >
              Ventas del período
            </h2>
            <p
              style={{
                margin: "6px 0 0",
                color: "#64748b",
                fontSize: 14,
              }}
            >
              Detalle de lo vendido para cuadrar tu jornada.
            </p>
          </div>

          {loading ? (
            <div style={emptyBoxStyle}>Cargando ventas...</div>
          ) : rows.length === 0 ? (
            <div style={emptyBoxStyle}>No hay ventas registradas en este período.</div>
          ) : (
            <div style={{ display: "grid", gap: 16 }}>
              {rows.map((venta) => {
                const isOpen = !!expanded[venta.id];

                return (
                  <div
                    key={venta.id}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 24,
                      overflow: "hidden",
                      background: "#fff",
                    }}
                  >
                    <div style={{ padding: 20, display: "grid", gap: 16 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 16,
                          flexWrap: "wrap",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: "#64748b",
                              marginBottom: 6,
                            }}
                          >
                            Venta #{venta.id}
                          </div>
                          <div
                            style={{
                              fontSize: 24,
                              fontWeight: 900,
                              color: "#0f172a",
                              letterSpacing: "-0.03em",
                            }}
                          >
                            {money(venta.total)}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <span style={badgeStyle("green")}>
                            {venta.estado || "—"}
                          </span>
                          <span
                            style={badgeStyle(
                              venta.metodo_pago === "efectivo" ? "green" : "blue"
                            )}
                          >
                            {venta.metodo_pago || "—"}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleExpand(venta.id)}
                            style={secondaryButtonStyle}
                          >
                            {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            {isOpen ? "Ocultar detalle" : "Ver detalle"}
                          </button>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(4, 1fr)",
                          gap: 14,
                        }}
                      >
                        <InfoCard
                          icon={<CalendarDays size={16} />}
                          title="Fecha"
                          value={formatDate(venta.creado_en)}
                        />
                        <InfoCard
                          icon={<User size={16} />}
                          title="Vendedor"
                          value={venta.usuario?.nombre || venta.usuario?.usuario || "—"}
                        />
                        <InfoCard
                          icon={<Store size={16} />}
                          title="Sucursal"
                          value={venta.ubicacion?.nombre || "—"}
                        />
                        <InfoCard
                          icon={<CreditCard size={16} />}
                          title="Cliente"
                          value={venta.cliente?.nombre || "Consumidor final"}
                        />
                      </div>
                    </div>

                    {isOpen ? (
                      <div
                        style={{
                          borderTop: "1px solid #e2e8f0",
                          background: "#f8fafc",
                          padding: 20,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            marginBottom: 14,
                            fontWeight: 800,
                            color: "#0f172a",
                          }}
                        >
                          <ShoppingBag size={18} />
                          Productos vendidos
                        </div>

                        {Array.isArray(venta.detalles) && venta.detalles.length > 0 ? (
                          <div
                            style={{
                              overflowX: "auto",
                              borderRadius: 18,
                              border: "1px solid #e2e8f0",
                              background: "#fff",
                            }}
                          >
                            <table
                              style={{
                                width: "100%",
                                borderCollapse: "collapse",
                                minWidth: 800,
                              }}
                            >
                              <thead>
                                <tr
                                  style={{
                                    background:
                                      "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
                                  }}
                                >
                                  <th style={thStyle}>Producto</th>
                                  <th style={thStyle}>ID</th>
                                  <th style={thStyle}>Cantidad</th>
                                  <th style={thStyle}>Precio unitario</th>
                                  <th style={thStyle}>Subtotal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {venta.detalles.map((d, idx) => (
                                  <tr
                                    key={`${venta.id}-${idx}`}
                                    style={{ borderTop: "1px solid #eef2f7" }}
                                  >
                                    <td style={tdStyle}>
                                      {d.producto?.nombre || "Producto"}
                                    </td>
                                    <td style={tdStyle}>{d.producto_id}</td>
                                    <td style={tdStyle}>{d.cantidad}</td>
                                    <td style={tdStyle}>{money(d.precio_unitario)}</td>
                                    <td style={tdStyle}>{money(d.subtotal)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div style={emptyBoxStyle}>
                            Esta venta no tiene detalles para mostrar.
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style>
        {`
          @media (max-width: 980px) {
            div[style*="grid-template-columns: repeat(3, 1fr)"] {
              grid-template-columns: 1fr !important;
            }

            div[style*="grid-template-columns: repeat(4, 1fr)"] {
              grid-template-columns: 1fr 1fr !important;
            }
          }

          @media (max-width: 640px) {
            section[style] {
              padding: 16px !important;
            }

            div[style*="grid-template-columns: repeat(4, 1fr)"] {
              grid-template-columns: 1fr !important;
            }

            div[style*="grid-template-columns: 1fr 1fr 1fr auto"] {
              grid-template-columns: 1fr !important;
            }
          }

          input:focus,
          select:focus {
            outline: none;
            border-color: #60a5fa !important;
            box-shadow: 0 0 0 4px rgba(96,165,250,0.18);
          }
        `}
      </style>
    </section>
  );
}

function MetricCard({ icon, title, value, subtitle, accent = "slate" }) {
  const accents = {
    blue: {
      bg: "linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%)",
      border: "#bfdbfe",
      iconBg: "#2563eb",
    },
    green: {
      bg: "linear-gradient(180deg, #ecfdf5 0%, #d1fae5 100%)",
      border: "#a7f3d0",
      iconBg: "#059669",
    },
    slate: {
      bg: "linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)",
      border: "#cbd5e1",
      iconBg: "#334155",
    },
  };

  const tone = accents[accent] || accents.slate;

  return (
    <div
      style={{
        borderRadius: 24,
        padding: 18,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        boxShadow: "0 12px 28px rgba(15,23,42,0.06)",
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 14,
          display: "grid",
          placeItems: "center",
          background: tone.iconBg,
          color: "#fff",
          marginBottom: 14,
        }}
      >
        {icon}
      </div>

      <div style={{ color: "#64748b", fontSize: 13, marginBottom: 6 }}>
        {title}
      </div>
      <div
        style={{
          color: "#0f172a",
          fontWeight: 900,
          fontSize: 24,
          letterSpacing: "-0.03em",
          marginBottom: 4,
        }}
      >
        {value}
      </div>
      <div style={{ color: "#64748b", fontSize: 13 }}>{subtitle}</div>
    </div>
  );
}

function InfoCard({ icon, title, value }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 18,
        background: "#fff",
        border: "1px solid #e2e8f0",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: "#64748b",
          fontSize: 12,
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        {icon}
        {title}
      </div>
      <div
        style={{
          color: "#0f172a",
          fontWeight: 800,
          fontSize: 15,
          lineHeight: 1.5,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function badgeStyle(kind) {
  const map = {
    green: {
      background: "#dcfce7",
      color: "#166534",
      border: "#bbf7d0",
    },
    gray: {
      background: "#f1f5f9",
      color: "#334155",
      border: "#cbd5e1",
    },
    blue: {
      background: "#dbeafe",
      color: "#1d4ed8",
      border: "#bfdbfe",
    },
  };

  const tone = map[kind] || map.gray;

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 800,
    border: `1px solid ${tone.border}`,
    background: tone.background,
    color: tone.color,
  };
}

const labelStyle = {
  display: "block",
  marginBottom: 8,
  fontSize: 13,
  fontWeight: 700,
  color: "#334155",
};

const inputStyle = {
  width: "100%",
  height: 52,
  borderRadius: 16,
  border: "1px solid #dbe2ea",
  background: "#f8fafc",
  padding: "0 14px",
  fontSize: 15,
  color: "#0f172a",
  boxSizing: "border-box",
};

const primaryButtonStyle = {
  height: 52,
  border: "none",
  borderRadius: 16,
  padding: "0 20px",
  background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
  color: "#fff",
  fontWeight: 800,
  fontSize: 15,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
};

const secondaryButtonStyle = {
  height: 44,
  border: "1px solid #dbe2ea",
  borderRadius: 14,
  padding: "0 14px",
  background: "#fff",
  color: "#0f172a",
  fontWeight: 700,
  fontSize: 14,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  cursor: "pointer",
};

const thStyle = {
  textAlign: "left",
  padding: "16px 20px",
  fontSize: 13,
  fontWeight: 800,
  color: "#475569",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const tdStyle = {
  padding: "18px 20px",
  fontSize: 15,
  color: "#0f172a",
  verticalAlign: "middle",
};

const emptyBoxStyle = {
  borderRadius: 22,
  border: "1px dashed #cbd5e1",
  padding: "36px 20px",
  textAlign: "center",
  color: "#64748b",
  background:
    "linear-gradient(180deg, rgba(248,250,252,0.95) 0%, rgba(241,245,249,0.95) 100%)",
};