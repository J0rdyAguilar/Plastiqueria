import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
} from "recharts";
import { dashboardApi } from "../lib/dashboard";
import { ubicacionesApi } from "../lib/ubicaciones";
import { getSession } from "../lib/auth";
import { notify } from "../lib/notify";

function money(n) {
  return `Q ${Number(n || 0).toFixed(2)}`;
}

function num(n) {
  const value = Number(n || 0);
  return Number.isFinite(value) ? value : 0;
}

function getRole(session) {
  const role = (session?.user?.role || session?.user?.rol || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  return role === "superadmin" ? "super_admin" : role;
}

function getInitials(text = "") {
  return text
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase())
    .join("");
}

function normalizeTopProductos(items = []) {
  return Array.isArray(items)
    ? items.map((item, index) => ({
        rank: index + 1,
        producto_id: item?.producto_id,
        nombre: item?.nombre || "Sin nombre",
        sku: item?.sku || "—",
        total_vendido: num(item?.total_vendido),
      }))
    : [];
}

function normalizeIngresosSucursal(items = []) {
  return Array.isArray(items)
    ? items.map((item, index) => ({
        rank: index + 1,
        ubicacion_id: item?.ubicacion_id,
        nombre: item?.nombre || "Sucursal",
        total_ingresos: num(item?.total_ingresos),
      }))
    : [];
}

function MiniLoader() {
  return (
    <div style={loaderBoxStyle}>
      <div style={loaderSpinnerStyle} />
      <div style={loaderTextStyle}>Cargando dashboard...</div>
    </div>
  );
}

function EmptyBlock({ text }) {
  return <div style={emptyStyle}>{text}</div>;
}

function CustomTooltip({ active, payload, label, moneyMode = false }) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div style={tooltipStyle}>
      {label ? <div style={tooltipTitleStyle}>{label}</div> : null}
      {payload.map((entry, index) => (
        <div key={`${entry?.dataKey || "item"}-${index}`} style={tooltipRowStyle}>
          <span>{entry.name}:</span>
          <strong>
            {moneyMode ? money(entry.value) : Number(entry.value || 0)}
          </strong>
        </div>
      ))}
    </div>
  );
}

function ProductChart({ items }) {
  if (!items.length) {
    return <EmptyBlock text="No hay productos vendidos todavía." />;
  }

  const data = items.map((item) => ({
    name: item.nombre,
    vendidos: item.total_vendido,
  }));

  return (
    <div style={{ width: "100%", height: 340 }}>
      <ResponsiveContainer>
        <BarChart data={data} barSize={42}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis
            dataKey="name"
            tick={{ fill: "#64748b", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(79,70,229,0.08)" }} />
          <Bar dataKey="vendidos" name="Vendidos" radius={[12, 12, 0, 0]} fill="#4f46e5" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function IncomeChart({ items }) {
  if (!items.length) {
    return <EmptyBlock text="No hay ingresos por sucursal para mostrar." />;
  }

  const data = items.map((item) => ({
    name: item.nombre,
    ingresos: item.total_ingresos,
  }));

  const COLORS = ["#0ea5e9", "#14b8a6", "#6366f1", "#8b5cf6", "#22c55e", "#f59e0b"];

  return (
    <div style={{ width: "100%", height: 320 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="ingresos"
            nameKey="name"
            innerRadius={58}
            outerRadius={105}
            paddingAngle={4}
            labelLine={false}
            label={({ name }) => name}
          >
            {data.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip moneyMode />} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function IncomeAreaChart({ items }) {
  if (!items.length) {
    return <EmptyBlock text="No hay información suficiente para la gráfica." />;
  }

  const data = items.map((item) => ({
    name: item.nombre,
    ingresos: item.total_ingresos,
  }));

  return (
    <div style={{ width: "100%", height: 280 }}>
      <ResponsiveContainer>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis
            dataKey="name"
            tick={{ fill: "#64748b", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip moneyMode />} />
          <Area
            type="monotone"
            dataKey="ingresos"
            stroke="#14b8a6"
            fillOpacity={1}
            fill="url(#incomeGradient)"
            strokeWidth={3}
            name="Ingresos"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Dashboard() {
  const session = getSession();
  const role = useMemo(() => getRole(session), [session]);

  const [loading, setLoading] = useState(true);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [ubicacionId, setUbicacionId] = useState("");
  const [data, setData] = useState({
    cards: {
      ingresos_hoy: 0,
      ingresos_mes: 0,
      producto_mas_vendido: null,
    },
    top_productos: [],
    ingresos_por_sucursal: [],
  });

  async function load() {
    try {
      setLoading(true);

      const selectedUbicacion = ubicacionId;

      if (role === "super_admin") {
        try {
          const ubis = await ubicacionesApi.list({ per_page: 100 });
          const rows = Array.isArray(ubis?.data)
            ? ubis.data
            : ubis?.data?.data || [];

          setUbicaciones(rows);
        } catch (e) {
          console.error("ERROR UBICACIONES:", e);
        }
      }

      const res = await dashboardApi.resumen({
        ubicacion_id: role === "super_admin" ? selectedUbicacion : "",
      });

      setData(
        res?.data || {
          cards: {
            ingresos_hoy: 0,
            ingresos_mes: 0,
            producto_mas_vendido: null,
          },
          top_productos: [],
          ingresos_por_sucursal: [],
        }
      );
    } catch (error) {
      console.error("ERROR DASHBOARD:", error);
      notify?.error?.("No se pudo cargar el dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [ubicacionId]);

  const productoTop = data?.cards?.producto_mas_vendido;
  const topProductos = normalizeTopProductos(data?.top_productos || []);
  const ingresosSucursal = normalizeIngresosSucursal(data?.ingresos_por_sucursal || []);
  const totalTopVendidos = topProductos.reduce((acc, item) => acc + item.total_vendido, 0);
  const mejorSucursal = ingresosSucursal[0] || null;

  return (
    <div style={pageStyle}>
      <div style={heroStyle}>
        <div style={heroLeftStyle}>
          <div style={eyebrowStyle}>Panel ejecutivo</div>
          <h1 style={titleStyle}>Dashboard</h1>
          <p style={subtitleStyle}>
            {role === "super_admin"
              ? "Resumen visual del sistema, ingresos y rendimiento por sucursal."
              : "Resumen visual de tu tienda asignada con ingresos y productos destacados."}
          </p>
        </div>

        <div style={heroRightStyle}>
          {role === "super_admin" && (
            <div style={filterCardStyle}>
              <label style={labelStyle}>Sucursal</label>
              <select
                value={ubicacionId}
                onChange={(e) => setUbicacionId(e.target.value)}
                style={selectStyle}
              >
                <option value="">Todas las sucursales</option>
                {ubicaciones.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <MiniLoader />
      ) : (
        <>
          <div style={statsGridStyle}>
            <div style={{ ...statCardStyle, ...statCardPrimaryStyle }}>
              <div style={statHeaderStyle}>
                <div style={statBadgeStyle}>Hoy</div>
                <div style={statIconStyle}>Q</div>
              </div>
              <div style={statLabelStyleWhite}>Ingresos de hoy</div>
              <div style={statValueWhiteStyle}>{money(data?.cards?.ingresos_hoy)}</div>
              <div style={statFootWhiteStyle}>Movimiento del día actual</div>
            </div>

            <div style={statCardStyle}>
              <div style={statHeaderStyle}>
                <div style={statBadgeSoftStyle}>Mes</div>
                <div style={statIconSoftStyle}>↗</div>
              </div>
              <div style={statLabelStyle}>Ingresos del mes</div>
              <div style={statValueStyle}>{money(data?.cards?.ingresos_mes)}</div>
              <div style={statFootStyle}>Acumulado del mes en curso</div>
            </div>

            <div style={statCardStyle}>
              <div style={statHeaderStyle}>
                <div style={statBadgeGoldStyle}>Top</div>
                <div style={statIconGoldStyle}>★</div>
              </div>
              <div style={statLabelStyle}>Producto más vendido</div>
              {productoTop ? (
                <>
                  <div style={statValueSmallStyle}>{productoTop.nombre}</div>
                  <div style={statFootStyle}>
                    SKU: {productoTop.sku || "—"} · Vendidos: {num(productoTop.total_vendido)}
                  </div>
                </>
              ) : (
                <>
                  <div style={statValueSmallStyle}>Sin datos</div>
                  <div style={statFootStyle}>Todavía no hay registros suficientes</div>
                </>
              )}
            </div>

            <div style={statCardStyle}>
              <div style={statHeaderStyle}>
                <div style={statBadgeGreenStyle}>Resumen</div>
                <div style={statIconGreenStyle}>✓</div>
              </div>
              <div style={statLabelStyle}>Top vendidos acumulados</div>
              <div style={statValueStyle}>{totalTopVendidos}</div>
              <div style={statFootStyle}>
                {mejorSucursal
                  ? `Sucursal líder: ${mejorSucursal.nombre}`
                  : "Sin información de sucursales"}
              </div>
            </div>
          </div>

          <div style={dashboardGridStyle}>
            <div style={mainColumnStyle}>
              <div style={panelStyle}>
                <div style={panelHeaderStyle}>
                  <div>
                    <h3 style={panelTitleStyle}>Top 5 productos vendidos</h3>
                    <p style={panelSubtextStyle}>
                      Ranking visual real de productos con mejor movimiento.
                    </p>
                  </div>
                </div>

                <ProductChart items={topProductos} />
              </div>

              <div style={panelStyle}>
                <div style={panelHeaderStyle}>
                  <div>
                    <h3 style={panelTitleStyle}>Vista tabular de productos</h3>
                    <p style={panelSubtextStyle}>
                      Comparación rápida para lectura detallada.
                    </p>
                  </div>
                </div>

                {topProductos.length > 0 ? (
                  <div style={{ overflowX: "auto" }}>
                    <table style={tableStyle}>
                      <thead>
                        <tr>
                          <th style={thStyle}>#</th>
                          <th style={thStyle}>Producto</th>
                          <th style={thStyle}>SKU</th>
                          <th style={thStyle}>Cantidad vendida</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topProductos.map((item) => (
                          <tr key={item.producto_id ?? item.rank} style={trStyle}>
                            <td style={tdStyle}>{item.rank}</td>
                            <td style={tdStyle}>{item.nombre}</td>
                            <td style={tdStyle}>{item.sku}</td>
                            <td style={tdStyle}>{item.total_vendido}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyBlock text="No hay productos vendidos todavía." />
                )}
              </div>
            </div>

            <div style={sideColumnStyle}>
              <div style={panelStyle}>
                <div style={panelHeaderStyle}>
                  <div>
                    <h3 style={panelTitleStyle}>Ingresos por sucursal</h3>
                    <p style={panelSubtextStyle}>
                      Comparación visual de ingresos acumulados.
                    </p>
                  </div>
                </div>

                {role === "super_admin" ? (
                  <IncomeChart items={ingresosSucursal} />
                ) : (
                  <EmptyBlock text="Este bloque está disponible para super admin." />
                )}
              </div>

              <div style={panelStyle}>
                <div style={panelHeaderStyle}>
                  <div>
                    <h3 style={panelTitleStyle}>Tendencia por sucursal</h3>
                    <p style={panelSubtextStyle}>
                      Vista comparativa simple basada en ingresos cargados.
                    </p>
                  </div>
                </div>

                {role === "super_admin" ? (
                  <IncomeAreaChart items={ingresosSucursal} />
                ) : (
                  <EmptyBlock text="Este bloque está disponible para super admin." />
                )}
              </div>

              <div style={panelStyle}>
                <div style={panelHeaderStyle}>
                  <div>
                    <h3 style={panelTitleStyle}>Resumen rápido</h3>
                    <p style={panelSubtextStyle}>
                      Indicadores principales del dashboard.
                    </p>
                  </div>
                </div>

                <div style={summaryListStyle}>
                  <div style={summaryItemStyle}>
                    <span style={summaryLabelStyle}>Ingresos hoy</span>
                    <strong style={summaryValueStyle}>{money(data?.cards?.ingresos_hoy)}</strong>
                  </div>

                  <div style={summaryItemStyle}>
                    <span style={summaryLabelStyle}>Ingresos mes</span>
                    <strong style={summaryValueStyle}>{money(data?.cards?.ingresos_mes)}</strong>
                  </div>

                  <div style={summaryItemStyle}>
                    <span style={summaryLabelStyle}>Productos listados</span>
                    <strong style={summaryValueStyle}>{topProductos.length}</strong>
                  </div>

                  <div style={summaryItemStyle}>
                    <span style={summaryLabelStyle}>Sucursal líder</span>
                    <strong style={summaryValueStyle}>
                      {mejorSucursal ? mejorSucursal.nombre : "Sin datos"}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const pageStyle = {
  padding: 24,
  background:
    "radial-gradient(circle at top left, rgba(99,102,241,0.08), transparent 24%), linear-gradient(180deg, #f8fafc 0%, #eef4ff 100%)",
  minHeight: "100vh",
};

const heroStyle = {
  display: "grid",
  gridTemplateColumns: "1.5fr 0.9fr",
  gap: 18,
  marginBottom: 22,
};

const heroLeftStyle = {
  background: "linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)",
  border: "1px solid #e2e8f0",
  borderRadius: 28,
  padding: 28,
  boxShadow: "0 18px 45px rgba(15,23,42,0.06)",
};

const heroRightStyle = {
  display: "flex",
  alignItems: "stretch",
  justifyContent: "stretch",
};

const filterCardStyle = {
  background: "linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)",
  border: "1px solid #e2e8f0",
  borderRadius: 28,
  padding: 22,
  boxShadow: "0 18px 45px rgba(15,23,42,0.06)",
  width: "100%",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
};

const eyebrowStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: 12,
  fontWeight: 800,
  color: "#4f46e5",
  background: "rgba(79,70,229,0.08)",
  border: "1px solid rgba(79,70,229,0.12)",
  borderRadius: 999,
  padding: "8px 12px",
  marginBottom: 14,
};

const titleStyle = {
  margin: 0,
  fontSize: 40,
  lineHeight: 1.05,
  fontWeight: 900,
  color: "#0f172a",
};

const subtitleStyle = {
  margin: "10px 0 0 0",
  color: "#475569",
  fontSize: 15,
  maxWidth: 700,
  lineHeight: 1.65,
};

const labelStyle = {
  fontSize: 13,
  fontWeight: 800,
  color: "#334155",
  marginBottom: 8,
};

const selectStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  padding: "12px 14px",
  fontSize: 14,
  outline: "none",
  background: "#fff",
  color: "#0f172a",
};

const statsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 18,
  marginBottom: 22,
};

const statCardStyle = {
  background: "linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)",
  borderRadius: 24,
  padding: 22,
  border: "1px solid #e2e8f0",
  boxShadow: "0 16px 45px rgba(15,23,42,0.06)",
  minHeight: 168,
};

const statCardPrimaryStyle = {
  background: "linear-gradient(135deg, #111827 0%, #1e293b 45%, #312e81 100%)",
  border: "1px solid rgba(99,102,241,0.28)",
};

const statHeaderStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 18,
};

const statBadgeStyle = {
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.16)",
  color: "#fff",
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 800,
};

const statBadgeSoftStyle = {
  background: "rgba(59,130,246,0.10)",
  border: "1px solid rgba(59,130,246,0.16)",
  color: "#2563eb",
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 800,
};

const statBadgeGoldStyle = {
  background: "rgba(245,158,11,0.12)",
  border: "1px solid rgba(245,158,11,0.18)",
  color: "#b45309",
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 800,
};

const statBadgeGreenStyle = {
  background: "rgba(16,185,129,0.12)",
  border: "1px solid rgba(16,185,129,0.18)",
  color: "#047857",
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 800,
};

const statIconStyle = {
  width: 38,
  height: 38,
  borderRadius: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(255,255,255,0.12)",
  color: "#fff",
  fontWeight: 900,
};

const statIconSoftStyle = {
  width: 38,
  height: 38,
  borderRadius: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(59,130,246,0.10)",
  color: "#2563eb",
  fontWeight: 900,
};

const statIconGoldStyle = {
  width: 38,
  height: 38,
  borderRadius: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(245,158,11,0.12)",
  color: "#b45309",
  fontWeight: 900,
};

const statIconGreenStyle = {
  width: 38,
  height: 38,
  borderRadius: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(16,185,129,0.12)",
  color: "#047857",
  fontWeight: 900,
};

const statLabelStyle = {
  fontSize: 13,
  fontWeight: 800,
  color: "#64748b",
  marginBottom: 10,
};

const statLabelStyleWhite = {
  fontSize: 13,
  fontWeight: 800,
  color: "rgba(255,255,255,0.72)",
  marginBottom: 10,
};

const statValueStyle = {
  fontSize: 34,
  fontWeight: 900,
  lineHeight: 1.1,
  color: "#0f172a",
};

const statValueWhiteStyle = {
  fontSize: 34,
  fontWeight: 900,
  lineHeight: 1.1,
  color: "#ffffff",
};

const statValueSmallStyle = {
  fontSize: 24,
  fontWeight: 900,
  lineHeight: 1.15,
  color: "#0f172a",
};

const statFootStyle = {
  marginTop: 10,
  fontSize: 13,
  color: "#64748b",
};

const statFootWhiteStyle = {
  marginTop: 10,
  fontSize: 13,
  color: "rgba(255,255,255,0.72)",
};

const dashboardGridStyle = {
  display: "grid",
  gridTemplateColumns: "1.45fr 1fr",
  gap: 18,
};

const mainColumnStyle = {
  display: "grid",
  gap: 18,
};

const sideColumnStyle = {
  display: "grid",
  gap: 18,
};

const panelStyle = {
  background: "linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)",
  borderRadius: 24,
  padding: 22,
  boxShadow: "0 16px 45px rgba(15,23,42,0.06)",
  border: "1px solid #e2e8f0",
};

const panelHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 18,
};

const panelTitleStyle = {
  margin: 0,
  fontSize: 20,
  fontWeight: 900,
  color: "#0f172a",
};

const panelSubtextStyle = {
  margin: "6px 0 0 0",
  fontSize: 13,
  color: "#64748b",
};

const summaryListStyle = {
  display: "grid",
  gap: 12,
};

const summaryItemStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: "14px 16px",
  background: "#fff",
};

const summaryLabelStyle = {
  fontSize: 13,
  color: "#64748b",
  fontWeight: 700,
};

const summaryValueStyle = {
  fontSize: 14,
  color: "#0f172a",
  fontWeight: 900,
};

const tableStyle = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
};

const thStyle = {
  textAlign: "left",
  padding: "12px 10px",
  borderBottom: "1px solid #e2e8f0",
  fontSize: 13,
  color: "#64748b",
  background: "#f8fafc",
};

const tdStyle = {
  padding: "13px 10px",
  borderBottom: "1px solid #f1f5f9",
  fontSize: 14,
  color: "#0f172a",
};

const trStyle = {
  background: "#fff",
};

const emptyStyle = {
  fontSize: 14,
  color: "#64748b",
  padding: "18px 0",
};

const loaderBoxStyle = {
  minHeight: 300,
  borderRadius: 24,
  border: "1px solid #e2e8f0",
  background: "linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 14,
  boxShadow: "0 16px 45px rgba(15,23,42,0.06)",
};

const loaderSpinnerStyle = {
  width: 44,
  height: 44,
  borderRadius: "50%",
  border: "4px solid #e2e8f0",
  borderTop: "4px solid #4f46e5",
  animation: "spin 0.8s linear infinite",
};

const loaderTextStyle = {
  fontSize: 14,
  fontWeight: 800,
  color: "#475569",
};

const tooltipStyle = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 12,
  boxShadow: "0 10px 30px rgba(15,23,42,0.10)",
};

const tooltipTitleStyle = {
  fontSize: 13,
  fontWeight: 800,
  color: "#0f172a",
  marginBottom: 6,
};

const tooltipRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  fontSize: 13,
  color: "#475569",
};