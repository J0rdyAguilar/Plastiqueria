import React, { useEffect, useMemo, useState } from "react";
import {
  Wallet,
  Search,
  RefreshCw,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  CreditCard,
  Banknote,
  Building2,
  UserRound,
  CalendarDays,
  ReceiptText,
  Eye,
  PlusCircle,
  Loader2,
  X,
} from "lucide-react";
import { cuotasApi } from "../lib/cuotas";

function money(n) {
  return `Q${Number(n || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function formatDateOnly(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString();
}

function getEstadoTone(estado) {
  if (estado === "pagado") {
    return {
      bg: "#ecfdf5",
      color: "#047857",
      border: "#a7f3d0",
      label: "Pagado",
    };
  }

  if (estado === "parcial") {
    return {
      bg: "#eff6ff",
      color: "#1d4ed8",
      border: "#bfdbfe",
      label: "Parcial",
    };
  }

  return {
    bg: "#fff7ed",
    color: "#c2410c",
    border: "#fdba74",
    label: "Pendiente",
  };
}

function getOrigenLabel(value) {
  if (value === "venta_tienda") return "Venta tienda";
  if (value === "venta_rutero") return "Venta rutero";
  return value || "—";
}

function getMetodoPagoLabel(value) {
  if (value === "tarjeta") return "Tarjeta";
  if (value === "transferencia") return "Transferencia";
  if (value === "deposito") return "Depósito";
  return "Efectivo";
}

function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  return [];
}

function getMeta(payload) {
  return {
    current_page:
      payload?.current_page ?? payload?.data?.current_page ?? 1,
    last_page:
      payload?.last_page ?? payload?.data?.last_page ?? 1,
    per_page:
      payload?.per_page ?? payload?.data?.per_page ?? 20,
    total:
      payload?.total ?? payload?.data?.total ?? 0,
  };
}

function getErrorMessage(err, fallback = "Ocurrió un error") {
  const data = err?.response?.data;

  if (data?.errors && typeof data.errors === "object") {
    const firstKey = Object.keys(data.errors)[0];
    const firstVal = firstKey ? data.errors[firstKey] : null;

    if (Array.isArray(firstVal) && firstVal[0]) return firstVal[0];
    if (typeof firstVal === "string" && firstVal.trim()) return firstVal;
  }

  if (typeof data?.message === "string" && data.message.trim()) {
    return data.message;
  }

  if (typeof err?.message === "string" && err.message.trim()) {
    return err.message;
  }

  return fallback;
}

export default function Cuotas() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0,
  });

  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const [origenTipo, setOrigenTipo] = useState("");
  const [soloPendientes, setSoloPendientes] = useState(1);

  const [loading, setLoading] = useState(true);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [loadingAbono, setLoadingAbono] = useState(false);

  const [detalleOpen, setDetalleOpen] = useState(false);
  const [abonoOpen, setAbonoOpen] = useState(false);

  const [cuotaDetalle, setCuotaDetalle] = useState(null);
  const [cuotaSeleccionada, setCuotaSeleccionada] = useState(null);

  const [abonoForm, setAbonoForm] = useState({
    monto: "",
    metodo_pago: "efectivo",
    referencia_pago: "",
    observaciones: "",
  });

  useEffect(() => {
    cargarCuotas(1);
  }, []);

  async function cargarCuotas(page = meta.current_page || 1) {
    try {
      setLoading(true);

      const resp = await cuotasApi.list({
        q,
        estado,
        origen_tipo: origenTipo,
        solo_pendientes: soloPendientes,
        page,
        per_page: 20,
      });

      setRows(extractRows(resp));
      setMeta(getMeta(resp));
    } catch (error) {
      console.error("ERROR CARGANDO CUOTAS:", error);
      alert(getErrorMessage(error, "No se pudo cargar la lista de cuotas."));
    } finally {
      setLoading(false);
    }
  }

  async function handleBuscar(e) {
    e?.preventDefault?.();
    await cargarCuotas(1);
  }

  async function handleResetFiltros() {
    setQ("");
    setEstado("");
    setOrigenTipo("");
    setSoloPendientes(1);

    try {
      setLoading(true);

      const resp = await cuotasApi.list({
        q: "",
        estado: "",
        origen_tipo: "",
        solo_pendientes: 1,
        page: 1,
        per_page: 20,
      });

      setRows(extractRows(resp));
      setMeta(getMeta(resp));
    } catch (error) {
      console.error("ERROR RESETEANDO FILTROS:", error);
      alert(getErrorMessage(error, "No se pudo recargar la lista."));
    } finally {
      setLoading(false);
    }
  }

  async function abrirDetalle(row) {
    try {
      setDetalleOpen(true);
      setLoadingDetalle(true);
      setCuotaDetalle(null);

      const resp = await cuotasApi.show(row.id);
      const data = resp?.data || resp;
      setCuotaDetalle(data);
    } catch (error) {
      console.error("ERROR DETALLE CUOTA:", error);
      alert(getErrorMessage(error, "No se pudo cargar el detalle."));
      setDetalleOpen(false);
    } finally {
      setLoadingDetalle(false);
    }
  }

  function abrirAbono(row) {
    setCuotaSeleccionada(row);
    setAbonoForm({
      monto: row?.monto_por_cuota ? String(row.monto_por_cuota) : "",
      metodo_pago: "efectivo",
      referencia_pago: "",
      observaciones: "",
    });
    setAbonoOpen(true);
  }

  async function guardarAbono() {
    if (!cuotaSeleccionada?.id) {
      alert("No se encontró la cuota seleccionada.");
      return;
    }

    if (!abonoForm.monto || Number(abonoForm.monto) <= 0) {
      alert("Ingresa un monto válido.");
      return;
    }

    try {
      setLoadingAbono(true);

      await cuotasApi.abonar(cuotaSeleccionada.id, {
        monto: Number(abonoForm.monto),
        metodo_pago: abonoForm.metodo_pago,
        referencia_pago: abonoForm.referencia_pago.trim() || null,
        observaciones: abonoForm.observaciones.trim() || null,
      });

      alert("Abono registrado correctamente.");
      setAbonoOpen(false);
      setCuotaSeleccionada(null);

      await cargarCuotas(meta.current_page || 1);

      if (detalleOpen && cuotaDetalle?.id === cuotaSeleccionada.id) {
        await abrirDetalle({ id: cuotaSeleccionada.id });
      }
    } catch (error) {
      console.error("ERROR ABONANDO CUOTA:", error);
      alert(getErrorMessage(error, "No se pudo registrar el abono."));
    } finally {
      setLoadingAbono(false);
    }
  }

  const resumen = useMemo(() => {
    const activos = rows.filter((r) =>
      ["pendiente", "parcial"].includes(String(r.estado || ""))
    );

    const totalPendiente = activos.reduce(
      (acc, r) => acc + Number(r.saldo_pendiente || 0),
      0
    );

    const totalAbonado = rows.reduce(
      (acc, r) => acc + Number(r.total_abonado || 0),
      0
    );

    const vencidas = activos.filter((r) => {
      if (!r.proximo_vencimiento) return false;
      const d = new Date(r.proximo_vencimiento);
      if (Number.isNaN(d.getTime())) return false;
      return d.getTime() < Date.now();
    }).length;

    return {
      activos: activos.length,
      totalPendiente,
      totalAbonado,
      vencidas,
    };
  }, [rows]);

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
            position: "relative",
            overflow: "hidden",
            borderRadius: 28,
            padding: "30px 28px",
            background:
              "linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.96) 45%, rgba(59,130,246,0.88) 100%)",
            boxShadow: "0 20px 60px rgba(15,23,42,0.20)",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 20,
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
                <Wallet size={16} />
                Control de créditos y cobros
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
                Cuotas
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
                Administra ventas a crédito, consulta saldo pendiente,
                próximos vencimientos y registra abonos que ingresan a caja.
              </p>
            </div>

            <button
              type="button"
              onClick={() => cargarCuotas(meta.current_page || 1)}
              style={{
                border: "none",
                borderRadius: 16,
                height: 48,
                padding: "0 18px",
                background: "rgba(255,255,255,0.14)",
                color: "#fff",
                fontWeight: 800,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
            >
              <RefreshCw size={18} />
              Recargar
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
          }}
        >
          <ResumenCard
            icon={<Wallet size={18} />}
            title="Créditos activos"
            value={String(resumen.activos)}
          />
          <ResumenCard
            icon={<Clock3 size={18} />}
            title="Saldo pendiente"
            value={money(resumen.totalPendiente)}
          />
          <ResumenCard
            icon={<CheckCircle2 size={18} />}
            title="Total abonado"
            value={money(resumen.totalAbonado)}
          />
          <ResumenCard
            icon={<AlertTriangle size={18} />}
            title="Vencidas"
            value={String(resumen.vencidas)}
          />
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.84)",
            borderRadius: 28,
            padding: 24,
            border: "1px solid rgba(148,163,184,0.18)",
            boxShadow: "0 18px 45px rgba(15,23,42,0.08)",
          }}
        >
          <form
            onSubmit={handleBuscar}
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr 1fr auto auto",
              gap: 14,
              alignItems: "end",
            }}
          >
            <div>
              <label style={labelStyle}>Buscar</label>
              <div style={{ position: "relative" }}>
                <Search
                  size={18}
                  style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#64748b",
                  }}
                />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Cliente, teléfono, ID cuota..."
                  style={{
                    ...inputStyle,
                    paddingLeft: 42,
                  }}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Estado</label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                style={inputStyle}
              >
                <option value="">Todos</option>
                <option value="pendiente">Pendiente</option>
                <option value="parcial">Parcial</option>
                <option value="pagado">Pagado</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Origen</label>
              <select
                value={origenTipo}
                onChange={(e) => setOrigenTipo(e.target.value)}
                style={inputStyle}
              >
                <option value="">Todos</option>
                <option value="venta_tienda">Venta tienda</option>
                <option value="venta_rutero">Venta rutero</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Vista</label>
              <select
                value={soloPendientes}
                onChange={(e) => setSoloPendientes(Number(e.target.value))}
                style={inputStyle}
              >
                <option value={1}>Solo pendientes</option>
                <option value={0}>Todas</option>
              </select>
            </div>

            <button type="submit" style={primaryButtonStyle}>
              <Search size={18} />
              Buscar
            </button>

            <button
              type="button"
              onClick={handleResetFiltros}
              style={secondaryButtonStyle}
            >
              <RefreshCw size={18} />
              Limpiar
            </button>
          </form>
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.84)",
            borderRadius: 28,
            padding: 24,
            border: "1px solid rgba(148,163,184,0.18)",
            boxShadow: "0 18px 45px rgba(15,23,42,0.08)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
              marginBottom: 18,
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  color: "#0f172a",
                  fontSize: 24,
                  fontWeight: 800,
                }}
              >
                Listado de cuotas
              </h2>
              <p
                style={{
                  margin: "6px 0 0",
                  color: "#64748b",
                  fontSize: 14,
                }}
              >
                Total registros: {meta.total}
              </p>
            </div>
          </div>

          {loading ? (
            <div style={loaderWrapStyle}>
              <Loader2 size={20} className="spin-icon" />
              Cargando cuotas...
            </div>
          ) : rows.length === 0 ? (
            <div style={emptyWrapStyle}>
              <Wallet size={30} />
              <div>No se encontraron cuotas.</div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>ID</th>
                    <th style={thStyle}>Cliente</th>
                    <th style={thStyle}>Sucursal</th>
                    <th style={thStyle}>Origen</th>
                    <th style={thStyle}>Crédito</th>
                    <th style={thStyle}>Abonado</th>
                    <th style={thStyle}>Saldo</th>
                    <th style={thStyle}>Plan</th>
                    <th style={thStyle}>Próximo pago</th>
                    <th style={thStyle}>Estado</th>
                    <th style={thStyle}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const tone = getEstadoTone(row.estado);

                    return (
                      <tr key={row.id}>
                        <td style={tdStyle}>#{row.id}</td>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 800, color: "#0f172a" }}>
                            {row.cliente_nombre || "Sin cliente"}
                          </div>
                          <div style={tdMutedStyle}>
                            {row.cliente_telefono || "Sin teléfono"}
                          </div>
                        </td>
                        <td style={tdStyle}>{row.ubicacion_nombre || "—"}</td>
                        <td style={tdStyle}>
                          {getOrigenLabel(row.origen_tipo)} #{row.origen_id}
                        </td>
                        <td style={tdStyle}>{money(row.total_credito)}</td>
                        <td style={tdStyle}>{money(row.total_abonado)}</td>
                        <td style={tdStyle}>{money(row.saldo_pendiente)}</td>
                        <td style={tdStyle}>
                          <div>{row.numero_cuotas || 1} cuota(s)</div>
                          <div style={tdMutedStyle}>
                            {row.frecuencia_pago || "mensual"} ·{" "}
                            {money(row.monto_por_cuota || 0)}
                          </div>
                        </td>
                        <td style={tdStyle}>
                          {formatDateOnly(row.proximo_vencimiento)}
                        </td>
                        <td style={tdStyle}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: "8px 12px",
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 800,
                              border: `1px solid ${tone.border}`,
                              background: tone.bg,
                              color: tone.color,
                            }}
                          >
                            {tone.label}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => abrirDetalle(row)}
                              style={miniDarkButtonStyle}
                            >
                              <Eye size={16} />
                              Ver
                            </button>

                            {row.estado !== "pagado" ? (
                              <button
                                type="button"
                                onClick={() => abrirAbono(row)}
                                style={miniGreenButtonStyle}
                              >
                                <PlusCircle size={16} />
                                Abonar
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div
            style={{
              marginTop: 18,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ color: "#64748b", fontSize: 14 }}>
              Página {meta.current_page} de {meta.last_page}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => cargarCuotas(Math.max(1, meta.current_page - 1))}
                disabled={meta.current_page <= 1}
                style={{
                  ...secondaryButtonStyle,
                  opacity: meta.current_page <= 1 ? 0.5 : 1,
                  cursor: meta.current_page <= 1 ? "not-allowed" : "pointer",
                }}
              >
                Anterior
              </button>

              <button
                type="button"
                onClick={() =>
                  cargarCuotas(
                    Math.min(meta.last_page || 1, meta.current_page + 1)
                  )
                }
                disabled={meta.current_page >= meta.last_page}
                style={{
                  ...secondaryButtonStyle,
                  opacity: meta.current_page >= meta.last_page ? 0.5 : 1,
                  cursor:
                    meta.current_page >= meta.last_page
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      </div>

      {detalleOpen && (
        <ModalShell onClose={() => setDetalleOpen(false)} title="Detalle de cuota">
          {loadingDetalle ? (
            <div style={loaderWrapStyle}>
              <Loader2 size={20} className="spin-icon" />
              Cargando detalle...
            </div>
          ) : !cuotaDetalle ? (
            <div style={emptyWrapStyle}>No se pudo cargar el detalle.</div>
          ) : (
            <div style={{ display: "grid", gap: 16 }}>
              <div style={detalleGridStyle}>
                <InfoCard
                  icon={<UserRound size={16} />}
                  title="Cliente"
                  value={cuotaDetalle.cliente_nombre || "—"}
                  subtitle={cuotaDetalle.cliente_telefono || ""}
                />
                <InfoCard
                  icon={<Building2 size={16} />}
                  title="Sucursal"
                  value={cuotaDetalle.ubicacion_nombre || "—"}
                />
                <InfoCard
                  icon={<ReceiptText size={16} />}
                  title="Origen"
                  value={`${getOrigenLabel(cuotaDetalle.origen_tipo)} #${
                    cuotaDetalle.origen_id
                  }`}
                />
                <InfoCard
                  icon={<CalendarDays size={16} />}
                  title="Próximo vencimiento"
                  value={formatDateOnly(cuotaDetalle.proximo_vencimiento)}
                />
                <InfoCard
                  icon={<Wallet size={16} />}
                  title="Crédito"
                  value={money(cuotaDetalle.total_credito)}
                />
                <InfoCard
                  icon={<CheckCircle2 size={16} />}
                  title="Abonado"
                  value={money(cuotaDetalle.total_abonado)}
                />
                <InfoCard
                  icon={<AlertTriangle size={16} />}
                  title="Saldo pendiente"
                  value={money(cuotaDetalle.saldo_pendiente)}
                />
                <InfoCard
                  icon={<Clock3 size={16} />}
                  title="Plan"
                  value={`${cuotaDetalle.numero_cuotas || 1} cuota(s)`}
                  subtitle={`${cuotaDetalle.frecuencia_pago || "mensual"} · ${money(
                    cuotaDetalle.monto_por_cuota || 0
                  )}`}
                />
              </div>

              <div
                style={{
                  borderRadius: 20,
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  padding: 18,
                }}
              >
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: "#0f172a",
                    marginBottom: 14,
                  }}
                >
                  Historial de abonos
                </div>

                {!Array.isArray(cuotaDetalle.abonos) ||
                cuotaDetalle.abonos.length === 0 ? (
                  <div style={emptyWrapStyle}>Esta cuota aún no tiene abonos.</div>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    {cuotaDetalle.abonos.map((abono) => (
                      <div
                        key={abono.id}
                        style={{
                          borderRadius: 16,
                          border: "1px solid #e2e8f0",
                          background: "#f8fafc",
                          padding: 14,
                          display: "grid",
                          gap: 6,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            flexWrap: "wrap",
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 800,
                              color: "#0f172a",
                            }}
                          >
                            Abono #{abono.id}
                          </div>
                          <div
                            style={{
                              fontWeight: 900,
                              color: "#16a34a",
                            }}
                          >
                            {money(abono.monto)}
                          </div>
                        </div>

                        <div style={tdMutedStyle}>
                          Fecha: {formatDate(abono.fecha_pago)}
                        </div>
                        <div style={tdMutedStyle}>
                          Método: {getMetodoPagoLabel(abono.metodo_pago)}
                        </div>
                        <div style={tdMutedStyle}>
                          Usuario: {abono.usuario_nombre || "—"}
                        </div>
                        {abono.referencia_pago ? (
                          <div style={tdMutedStyle}>
                            Referencia: {abono.referencia_pago}
                          </div>
                        ) : null}
                        {abono.observaciones ? (
                          <div style={tdMutedStyle}>
                            Observaciones: {abono.observaciones}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </ModalShell>
      )}

      {abonoOpen && (
        <ModalShell
          onClose={() => setAbonoOpen(false)}
          title={`Abonar cuota #${cuotaSeleccionada?.id || ""}`}
        >
          <div style={{ display: "grid", gap: 14 }}>
            <div style={abonoResumenStyle}>
              <div>
                <div style={abonoResumenLabelStyle}>Cliente</div>
                <div style={abonoResumenValueStyle}>
                  {cuotaSeleccionada?.cliente_nombre || "—"}
                </div>
              </div>

              <div>
                <div style={abonoResumenLabelStyle}>Saldo pendiente</div>
                <div style={abonoResumenValueStyle}>
                  {money(cuotaSeleccionada?.saldo_pendiente || 0)}
                </div>
              </div>

              <div>
                <div style={abonoResumenLabelStyle}>Cuota sugerida</div>
                <div style={abonoResumenValueStyle}>
                  {money(cuotaSeleccionada?.monto_por_cuota || 0)}
                </div>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Monto</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={abonoForm.monto}
                onChange={(e) =>
                  setAbonoForm((p) => ({ ...p, monto: e.target.value }))
                }
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Método de pago</label>
              <select
                value={abonoForm.metodo_pago}
                onChange={(e) =>
                  setAbonoForm((p) => ({
                    ...p,
                    metodo_pago: e.target.value,
                  }))
                }
                style={inputStyle}
              >
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
                <option value="deposito">Depósito</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Referencia de pago</label>
              <input
                type="text"
                value={abonoForm.referencia_pago}
                onChange={(e) =>
                  setAbonoForm((p) => ({
                    ...p,
                    referencia_pago: e.target.value,
                  }))
                }
                placeholder="Ej. Boleta, transferencia, depósito..."
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Observaciones</label>
              <textarea
                rows={3}
                value={abonoForm.observaciones}
                onChange={(e) =>
                  setAbonoForm((p) => ({
                    ...p,
                    observaciones: e.target.value,
                  }))
                }
                style={textareaStyle}
                placeholder="Detalle del abono..."
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                marginTop: 6,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() => setAbonoOpen(false)}
                style={secondaryButtonStyle}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={guardarAbono}
                disabled={loadingAbono}
                style={{
                  ...primaryButtonStyle,
                  opacity: loadingAbono ? 0.8 : 1,
                  cursor: loadingAbono ? "not-allowed" : "pointer",
                }}
              >
                {loadingAbono ? (
                  <>
                    <Loader2 size={18} className="spin-icon" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <PlusCircle size={18} />
                    Registrar abono
                  </>
                )}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      <style>
        {`
          .spin-icon {
            animation: spin 1s linear infinite;
          }

          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }

          @media (max-width: 1100px) {
            div[style*="grid-template-columns: repeat(4, 1fr)"] {
              grid-template-columns: 1fr 1fr !important;
            }

            form[style*="grid-template-columns: 2fr 1fr 1fr 1fr auto auto"] {
              grid-template-columns: 1fr 1fr !important;
            }
          }

          @media (max-width: 700px) {
            section[style] {
              padding: 16px !important;
            }

            div[style*="grid-template-columns: repeat(4, 1fr)"] {
              grid-template-columns: 1fr !important;
            }

            form[style*="grid-template-columns: 2fr 1fr 1fr 1fr auto auto"] {
              grid-template-columns: 1fr !important;
            }
          }
        `}
      </style>
    </section>
  );
}

function ResumenCard({ icon, title, value }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.84)",
        borderRadius: 22,
        padding: 18,
        border: "1px solid rgba(148,163,184,0.18)",
        boxShadow: "0 18px 45px rgba(15,23,42,0.08)",
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 14,
          display: "grid",
          placeItems: "center",
          background: "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)",
          color: "#1d4ed8",
          marginBottom: 12,
        }}
      >
        {icon}
      </div>

      <div
        style={{
          color: "#64748b",
          fontSize: 13,
          fontWeight: 700,
          marginBottom: 6,
        }}
      >
        {title}
      </div>

      <div
        style={{
          color: "#0f172a",
          fontSize: 24,
          fontWeight: 900,
          letterSpacing: "-0.03em",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ModalShell({ title, children, onClose }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.55)",
        display: "grid",
        placeItems: "center",
        padding: 20,
        zIndex: 2000,
      }}
    >
      <div
        style={{
          width: "min(920px, 100%)",
          maxHeight: "90vh",
          overflow: "auto",
          borderRadius: 26,
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          boxShadow: "0 30px 90px rgba(15,23,42,0.28)",
        }}
      >
        <div
          style={{
            padding: "18px 20px",
            borderBottom: "1px solid #eef2f7",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              fontSize: 20,
              fontWeight: 900,
              color: "#0f172a",
            }}
          >
            {title}
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              background: "#fff",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              color: "#334155",
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

function InfoCard({ icon, title, value, subtitle = "" }) {
  return (
    <div
      style={{
        borderRadius: 18,
        border: "1px solid #e2e8f0",
        background: "#fff",
        padding: 14,
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
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>

      {subtitle ? (
        <div
          style={{
            marginTop: 4,
            color: "#64748b",
            fontSize: 13,
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </div>
  );
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

const textareaStyle = {
  width: "100%",
  borderRadius: 16,
  border: "1px solid #dbe2ea",
  background: "#f8fafc",
  padding: "12px 14px",
  fontSize: 15,
  color: "#0f172a",
  boxSizing: "border-box",
  resize: "vertical",
};

const primaryButtonStyle = {
  height: 52,
  border: "none",
  borderRadius: 16,
  padding: "0 18px",
  background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
  color: "#fff",
  fontWeight: 800,
  fontSize: 15,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  boxShadow: "0 14px 28px rgba(37,99,235,0.25)",
};

const secondaryButtonStyle = {
  height: 52,
  border: "1px solid #dbe2ea",
  borderRadius: 16,
  padding: "0 18px",
  background: "#fff",
  color: "#0f172a",
  fontWeight: 800,
  fontSize: 15,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
};

const miniDarkButtonStyle = {
  height: 38,
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "0 12px",
  background: "#fff",
  color: "#0f172a",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

const miniGreenButtonStyle = {
  height: 38,
  border: "none",
  borderRadius: 12,
  padding: "0 12px",
  background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
  color: "#fff",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

const tableStyle = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  minWidth: 1150,
};

const thStyle = {
  textAlign: "left",
  padding: "14px 14px",
  background: "#f8fafc",
  color: "#334155",
  fontSize: 13,
  fontWeight: 800,
  borderBottom: "1px solid #e2e8f0",
};

const tdStyle = {
  padding: "14px 14px",
  borderBottom: "1px solid #eef2f7",
  fontSize: 14,
  color: "#334155",
  verticalAlign: "middle",
};

const tdMutedStyle = {
  fontSize: 12,
  color: "#64748b",
  marginTop: 4,
};

const loaderWrapStyle = {
  minHeight: 220,
  borderRadius: 22,
  border: "1px dashed #cbd5e1",
  background:
    "linear-gradient(180deg, rgba(248,250,252,0.95) 0%, rgba(241,245,249,0.95) 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  color: "#334155",
  fontWeight: 800,
};

const emptyWrapStyle = {
  minHeight: 180,
  borderRadius: 22,
  border: "1px dashed #cbd5e1",
  background:
    "linear-gradient(180deg, rgba(248,250,252,0.95) 0%, rgba(241,245,249,0.95) 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  color: "#64748b",
  fontWeight: 700,
  textAlign: "center",
  padding: 20,
};

const detalleGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 14,
};

const abonoResumenStyle = {
  borderRadius: 18,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  padding: 16,
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 14,
};

const abonoResumenLabelStyle = {
  fontSize: 12,
  color: "#64748b",
  fontWeight: 700,
  marginBottom: 6,
};

const abonoResumenValueStyle = {
  fontSize: 16,
  color: "#0f172a",
  fontWeight: 800,
};