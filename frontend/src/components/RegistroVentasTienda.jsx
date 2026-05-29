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
  BadgeDollarSign,
  Package2,
  DollarSign,
  XCircle,
  Clock3,
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

function normalizeRows(resp) {
  if (Array.isArray(resp?.data)) return resp.data;
  if (Array.isArray(resp?.data?.data)) return resp.data.data;
  if (Array.isArray(resp?.ventas)) return resp.ventas;
  if (Array.isArray(resp?.rows)) return resp.rows;
  return [];
}

function normalizeEstado(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

function isVentaRechazada(venta) {
  const estado = normalizeEstado(venta?.estado);
  const montoVariable = normalizeEstado(venta?.monto_variable_estado);
  return estado === "rechazada" || estado === "rechazado" || montoVariable === "rechazado";
}

function isVentaPendiente(venta) {
  const estado = normalizeEstado(venta?.estado);
  const montoVariable = normalizeEstado(venta?.monto_variable_estado);
  return estado === "pendiente_revision" || montoVariable === "pendiente";
}

function prettyEstado(value) {
  const estado = normalizeEstado(value);
  const map = {
    completada: "Completada",
    confirmada: "Confirmada",
    pendiente_revision: "Pendiente revisión",
    rechazada: "Rechazada",
    rechazado: "Rechazada",
    cancelada: "Cancelada",
  };
  return map[estado] || value || "—";
}

function estadoBadgeKind(venta) {
  if (isVentaRechazada(venta)) return "red";
  if (isVentaPendiente(venta)) return "orange";
  return "green";
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
    estado: "",
    ubicacion_id: "",
    solo_mias: 0,
    page: 1,
    per_page: 30,
  });

  async function load() {
    try {
      setLoading(true);
      const resp = await ventasTienda.list(filters);
      const ventas = normalizeRows(resp);
      setRows(ventas);
    } catch (error) {
      console.error("ERROR CARGANDO REGISTRO:", error);
      alert(
        error?.response?.data?.message ||
          "No se pudo cargar el registro de ventas."
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const ventasValidas = useMemo(() => {
    return rows.filter((item) => !isVentaRechazada(item));
  }, [rows]);

  const totalDia = useMemo(() => {
    return ventasValidas.reduce((acc, item) => acc + Number(item.total || 0), 0);
  }, [ventasValidas]);

  const totalEfectivo = useMemo(() => {
    return ventasValidas
      .filter((item) => String(item.metodo_pago || "").toLowerCase() === "efectivo")
      .reduce((acc, item) => acc + Number(item.total || 0), 0);
  }, [ventasValidas]);

  const totalTarjeta = useMemo(() => {
    return ventasValidas
      .filter((item) => String(item.metodo_pago || "").toLowerCase() === "tarjeta")
      .reduce((acc, item) => acc + Number(item.total || 0), 0);
  }, [ventasValidas]);

  const totalGanancia = useMemo(() => {
    return ventasValidas.reduce(
      (acc, item) => acc + Number(item.ganancia_total || 0),
      0
    );
  }, [ventasValidas]);

  const ventasRechazadas = useMemo(() => {
    return rows.filter((item) => isVentaRechazada(item)).length;
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
      estado: "",
      ubicacion_id: "",
      solo_mias: 0,
      page: 1,
    }));
  }

  return (
    <section style={{ minHeight: "100%", padding: 28 }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", display: "grid", gap: 24 }}>
        <div style={heroStyle}>
          <div style={heroContentStyle}>
            <div>
              <div style={heroChipStyle}>
                <ReceiptText size={16} />
                Registro de ventas
              </div>

              <h1 style={heroTitleStyle}>Cuadre del día</h1>

              <p style={heroTextStyle}>
                Aquí puedes ver las ventas del período. Las ventas rechazadas se muestran en rojo y no suman a los totales.
              </p>
            </div>

            <button type="button" onClick={resetHoy} style={heroButtonStyle}>
              <RefreshCw size={18} />
              Hoy
            </button>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={filterGridStyle}>
            <div>
              <label style={labelStyle}>Desde</label>
              <input
                type="date"
                value={filters.fecha_desde}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, fecha_desde: e.target.value, page: 1 }))
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
                  setFilters((prev) => ({ ...prev, fecha_hasta: e.target.value, page: 1 }))
                }
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Método pago</label>
              <select
                value={filters.metodo_pago}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, metodo_pago: e.target.value, page: 1 }))
                }
                style={inputStyle}
              >
                <option value="">Todos</option>
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="cuotas">Crédito</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Estado</label>
              <select
                value={filters.estado}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, estado: e.target.value, page: 1 }))
                }
                style={inputStyle}
              >
                <option value="">Todos</option>
                <option value="completada">Completada</option>
                <option value="confirmada">Confirmada</option>
                <option value="pendiente_revision">Pendiente revisión</option>
                <option value="rechazada">Rechazada</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Sucursal</label>
              <select
                value={filters.ubicacion_id}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, ubicacion_id: e.target.value, page: 1 }))
                }
                style={inputStyle}
              >
                <option value="">Todas</option>
                <option value="1">Tienda 1</option>
                <option value="2">Tienda 2</option>
              </select>
            </div>

            <button type="button" onClick={load} style={primaryButtonStyle}>
              <RefreshCw size={18} />
              Actualizar
            </button>
          </div>
        </div>

        <div style={metricsGridStyle}>
          <MetricCard
            icon={<ReceiptText size={18} />}
            title="Total vendido"
            value={money(totalDia)}
            subtitle={`${ventasValidas.length} venta(s) cobradas`}
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
          <MetricCard
            icon={<BadgeDollarSign size={18} />}
            title="Ganancia"
            value={money(totalGanancia)}
            subtitle={ventasRechazadas > 0 ? `${ventasRechazadas} rechazada(s) no suman` : "Ganancia estimada"}
            accent="emerald"
          />
        </div>

        <div style={cardStyle}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={sectionTitleStyle}>Ventas del período</h2>
            <p style={sectionTextStyle}>
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
                const rechazada = isVentaRechazada(venta);

                return (
                  <div
                    key={venta.id}
                    style={{
                      border: rechazada ? "1px solid #fecaca" : "1px solid #e2e8f0",
                      borderRadius: 24,
                      overflow: "hidden",
                      background: rechazada
                        ? "linear-gradient(180deg, #fff7f7 0%, #ffffff 100%)"
                        : "#fff",
                      boxShadow: rechazada
                        ? "0 14px 30px rgba(239,68,68,0.08)"
                        : "none",
                    }}
                  >
                    <div style={{ padding: 20, display: "grid", gap: 16 }}>
                      <div style={rowTopStyle}>
                        <div>
                          <div style={ventaNumberStyle}>Venta #{venta.id}</div>
                          <div style={ventaTotalStyle}>{money(venta.total)}</div>
                          {rechazada ? (
                            <div style={rejectedNoteStyle}>
                              <XCircle size={14} />
                              Venta rechazada: no suma a caja ni ganancia.
                            </div>
                          ) : isVentaPendiente(venta) ? (
                            <div style={pendingNoteStyle}>
                              <Clock3 size={14} />
                              Pendiente de aprobación.
                            </div>
                          ) : null}
                        </div>

                        <div style={badgesWrapStyle}>
                          <span style={badgeStyle(estadoBadgeKind(venta))}>
                            {prettyEstado(venta.estado)}
                          </span>
                          <span
                            style={badgeStyle(
                              String(venta.metodo_pago || "").toLowerCase() === "efectivo"
                                ? "green"
                                : "blue"
                            )}
                          >
                            {venta.metodo_pago || "—"}
                          </span>
                          {rechazada ? (
                            <span style={badgeStyle("red")}>No contabilizada</span>
                          ) : (
                            <span style={badgeStyle("emerald")}>
                              Ganancia {money(venta.ganancia_total)}
                            </span>
                          )}
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

                      <div style={infoGridStyle}>
                        <InfoCard icon={<CalendarDays size={16} />} title="Fecha" value={formatDate(venta.creado_en)} />
                        <InfoCard
                          icon={<User size={16} />}
                          title="Vendedor"
                          value={venta.usuario_nombre || venta.usuario?.nombre || venta.usuario?.usuario || "—"}
                        />
                        <InfoCard
                          icon={<Store size={16} />}
                          title="Sucursal"
                          value={venta.ubicacion_nombre || venta.ubicacion?.nombre || "—"}
                        />
                        <InfoCard
                          icon={<CreditCard size={16} />}
                          title="Cliente"
                          value={venta.nombre_comprador || venta.cliente?.nombre || "Consumidor final"}
                        />
                      </div>
                    </div>

                    {isOpen ? (
                      <div style={detailPanelStyle}>
                        <div style={detailTitleStyle}>
                          <ShoppingBag size={18} />
                          Productos vendidos
                        </div>

                        {Array.isArray(venta.detalles) && venta.detalles.length > 0 ? (
                          <div style={{ display: "grid", gap: 14 }}>
                            {venta.detalles.map((d, idx) => (
                              <div key={`${venta.id}-${idx}`} style={detailCardStyle}>
                                <div style={detailCardTopStyle}>
                                  <div>
                                    <div style={productNameStyle}>
                                      {d.producto_nombre || d.producto?.nombre || "Producto"}
                                    </div>
                                    <div style={productMetaStyle}>
                                      ID: {d.producto_id} · Presentación: {d.presentacion || "—"}
                                    </div>
                                  </div>

                                  <div style={badgesWrapStyle}>
                                    <span style={badgeStyle("blue")}>Cantidad {d.cantidad}</span>
                                    {!rechazada && (
                                      <span style={badgeStyle("emerald")}>Ganancia {money(d.ganancia_total)}</span>
                                    )}
                                  </div>
                                </div>

                                <div style={detailMiniGridStyle}>
                                  <DetailMiniCard icon={<Package2 size={16} />} title="Presentación" value={d.presentacion || "—"} />
                                  <DetailMiniCard icon={<DollarSign size={16} />} title="Precio costo" value={money(d.precio_costo)} />
                                  <DetailMiniCard icon={<DollarSign size={16} />} title="Precio venta" value={money(d.precio_unitario)} />
                                  <DetailMiniCard icon={<BadgeDollarSign size={16} />} title="Ganancia unitaria" value={rechazada ? "No aplica" : money(d.ganancia_unitaria)} />
                                  <DetailMiniCard
                                    icon={<BadgeDollarSign size={16} />}
                                    title="Subtotal / Ganancia"
                                    value={`${money(d.subtotal)} / ${rechazada ? "No aplica" : money(d.ganancia_total)}`}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={emptyBoxStyle}>Esta venta no tiene detalles para mostrar.</div>
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
          @media (max-width: 1100px) {
            div[style*="grid-template-columns: repeat(4, 1fr)"] {
              grid-template-columns: 1fr 1fr !important;
            }
            div[style*="grid-template-columns: repeat(5, 1fr)"] {
              grid-template-columns: 1fr 1fr !important;
            }
          }

          @media (max-width: 900px) {
            div[style*="grid-template-columns: 1fr 1fr 1fr 1fr 1fr auto"] {
              grid-template-columns: 1fr 1fr !important;
            }
          }

          @media (max-width: 640px) {
            section[style] { padding: 16px !important; }
            div[style*="grid-template-columns: repeat(4, 1fr)"] {
              grid-template-columns: 1fr !important;
            }
            div[style*="grid-template-columns: repeat(5, 1fr)"] {
              grid-template-columns: 1fr !important;
            }
            div[style*="grid-template-columns: 1fr 1fr 1fr 1fr 1fr auto"] {
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
    emerald: {
      bg: "linear-gradient(180deg, #ecfdf5 0%, #bbf7d0 100%)",
      border: "#86efac",
      iconBg: "#15803d",
    },
    slate: {
      bg: "linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)",
      border: "#cbd5e1",
      iconBg: "#334155",
    },
  };

  const tone = accents[accent] || accents.slate;

  return (
    <div style={{ borderRadius: 24, padding: 18, background: tone.bg, border: `1px solid ${tone.border}`, boxShadow: "0 12px 28px rgba(15,23,42,0.06)" }}>
      <div style={{ width: 42, height: 42, borderRadius: 14, display: "grid", placeItems: "center", background: tone.iconBg, color: "#fff", marginBottom: 14 }}>
        {icon}
      </div>
      <div style={{ color: "#64748b", fontSize: 13, marginBottom: 6 }}>{title}</div>
      <div style={{ color: "#0f172a", fontWeight: 900, fontSize: 24, letterSpacing: "-0.03em", marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ color: "#64748b", fontSize: 13 }}>{subtitle}</div>
    </div>
  );
}

function InfoCard({ icon, title, value }) {
  return (
    <div style={{ padding: 16, borderRadius: 18, background: "#fff", border: "1px solid #e2e8f0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#64748b", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
        {icon}
        {title}
      </div>
      <div style={{ color: "#0f172a", fontWeight: 800, fontSize: 15, lineHeight: 1.5, wordBreak: "break-word" }}>
        {value}
      </div>
    </div>
  );
}

function DetailMiniCard({ icon, title, value }) {
  return (
    <div style={{ padding: 14, borderRadius: 16, background: "#fff", border: "1px solid #e2e8f0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#64748b", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
        {icon}
        {title}
      </div>
      <div style={{ color: "#0f172a", fontWeight: 800, fontSize: 14, lineHeight: 1.4, wordBreak: "break-word" }}>
        {value}
      </div>
    </div>
  );
}

function badgeStyle(kind) {
  const map = {
    green: { background: "#dcfce7", color: "#166534", border: "#bbf7d0" },
    gray: { background: "#f1f5f9", color: "#334155", border: "#cbd5e1" },
    blue: { background: "#dbeafe", color: "#1d4ed8", border: "#bfdbfe" },
    emerald: { background: "#ecfdf5", color: "#166534", border: "#86efac" },
    orange: { background: "#ffedd5", color: "#9a3412", border: "#fed7aa" },
    red: { background: "#fee2e2", color: "#991b1b", border: "#fecaca" },
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

const heroStyle = {
  borderRadius: 28,
  padding: "30px 28px",
  background:
    "linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.96) 45%, rgba(59,130,246,0.84) 100%)",
  boxShadow: "0 20px 60px rgba(15,23,42,0.20)",
  border: "1px solid rgba(255,255,255,0.10)",
};

const heroContentStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  alignItems: "center",
  flexWrap: "wrap",
};

const heroChipStyle = {
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
};

const heroTitleStyle = {
  margin: 0,
  color: "#fff",
  fontSize: "clamp(28px, 4vw, 40px)",
  fontWeight: 800,
  letterSpacing: "-0.03em",
};

const heroTextStyle = {
  margin: "10px 0 0",
  color: "rgba(255,255,255,0.78)",
  fontSize: 15,
  maxWidth: 760,
  lineHeight: 1.6,
};

const heroButtonStyle = {
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
};

const cardStyle = {
  background: "rgba(255,255,255,0.88)",
  borderRadius: 28,
  padding: 24,
  border: "1px solid rgba(148,163,184,0.18)",
  boxShadow: "0 18px 45px rgba(15,23,42,0.08)",
};

const filterGridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr auto",
  gap: 14,
  alignItems: "end",
};

const metricsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 16,
};

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

const emptyBoxStyle = {
  borderRadius: 22,
  border: "1px dashed #cbd5e1",
  padding: "36px 20px",
  textAlign: "center",
  color: "#64748b",
  background:
    "linear-gradient(180deg, rgba(248,250,252,0.95) 0%, rgba(241,245,249,0.95) 100%)",
};

const sectionTitleStyle = {
  margin: 0,
  fontSize: 24,
  fontWeight: 800,
  color: "#0f172a",
};

const sectionTextStyle = {
  margin: "6px 0 0",
  color: "#64748b",
  fontSize: 14,
};

const rowTopStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
  alignItems: "center",
};

const ventaNumberStyle = {
  fontSize: 13,
  fontWeight: 700,
  color: "#64748b",
  marginBottom: 6,
};

const ventaTotalStyle = {
  fontSize: 24,
  fontWeight: 900,
  color: "#0f172a",
  letterSpacing: "-0.03em",
};

const rejectedNoteStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  marginTop: 8,
  color: "#b91c1c",
  fontSize: 13,
  fontWeight: 800,
};

const pendingNoteStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  marginTop: 8,
  color: "#9a3412",
  fontSize: 13,
  fontWeight: 800,
};

const badgesWrapStyle = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const infoGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 14,
};

const detailPanelStyle = {
  borderTop: "1px solid #e2e8f0",
  background: "#f8fafc",
  padding: 20,
};

const detailTitleStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 14,
  fontWeight: 800,
  color: "#0f172a",
};

const detailCardStyle = {
  borderRadius: 20,
  border: "1px solid #e2e8f0",
  background: "#fff",
  padding: 18,
};

const detailCardTopStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center",
  marginBottom: 14,
};

const productNameStyle = {
  fontWeight: 900,
  fontSize: 18,
  color: "#0f172a",
};

const productMetaStyle = {
  fontSize: 13,
  color: "#64748b",
  marginTop: 4,
};

const detailMiniGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
  gap: 14,
};
