import React, { useEffect, useMemo, useState } from "react";
import {
  Wallet,
  Store,
  ShieldCheck,
  Clock3,
  CircleDollarSign,
  RefreshCw,
  Lock,
  Unlock,
  Landmark,
  AlertTriangle,
  CheckCircle2,
  ReceiptText,
} from "lucide-react";
import { api } from "../lib/api";
import { getSession } from "../lib/auth";
import { useNavigate } from "react-router-dom";
import { notify } from "../lib/notify";

function formatBackendError(err) {
  const data = err?.data || err?.response?.data;

  if (data?.errors && typeof data.errors === "object") {
    const lines = [];
    for (const [k, arr] of Object.entries(data.errors)) {
      if (Array.isArray(arr)) arr.forEach((m) => lines.push(`${k}: ${m}`));
    }
    if (lines.length) return lines.join("\n");
  }

  return data?.message || err?.message || "Ocurrió un error";
}

function money(n) {
  const x = Number(n ?? 0);
  if (Number.isNaN(x)) return "—";
  return `Q${x.toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function normalizeRole(role) {
  const x = String(role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  if (x === "cajero") return "caja";
  if (x === "superadmin") return "super_admin";
  return x;
}

export default function Caja() {
  const nav = useNavigate();
  const me = getSession()?.user || {};

  const usuarioNombre = me?.nombre || me?.usuario || "—";
  const usuarioRol = normalizeRole(me?.rol || me?.role || "");
  const ubicacionIdSesion = Number(me?.ubicacion_id || 0) || null;

  const ubicacionNombreSesion =
    me?.ubicacion?.nombre ||
    me?.sucursal?.nombre ||
    me?.ubicacion_nombre ||
    me?.nombre_ubicacion ||
    "Sucursal asignada";

  const [ubicacionId] = useState(ubicacionIdSesion);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [actual, setActual] = useState(null);
  const [historial, setHistorial] = useState([]);

  const [notasAbrir, setNotasAbrir] = useState("Apertura");
  const [efectivoInicial, setEfectivoInicial] = useState(100);

  const [notasCerrar, setNotasCerrar] = useState("Cierre");
  const [efectivoFinal, setEfectivoFinal] = useState(100);

  const [openedOnce, setOpenedOnce] = useState(false);

  const hasUbicacion = !!ubicacionId;
  const isAbierta = !!actual && !actual?.cerrado_en;

  const nombreSucursal =
    actual?.ubicacion?.nombre ||
    historial?.[0]?.ubicacion?.nombre ||
    ubicacionNombreSesion ||
    (hasUbicacion ? `Sucursal #${ubicacionId}` : "No asignada");

  async function load(showToastError = false) {
    if (!ubicacionId) {
      setActual(null);
      setHistorial([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const r1 = await api.cajaActual({ ubicacion_id: Number(ubicacionId) });
      const cajaActual = r1?.data || null;
      setActual(cajaActual);

      const r2 = await api.cajaHistorial({
        ubicacion_id: Number(ubicacionId),
        per_page: 20,
      });

      const raw = Array.isArray(r2)
        ? r2
        : Array.isArray(r2?.data)
        ? r2.data
        : [];

      setHistorial(raw);

      if (cajaActual && !openedOnce) {
        setOpenedOnce(true);
      }
    } catch (err) {
      const message = formatBackendError(err);

      if (err?.status === 401 || err?.response?.status === 401) {
        notify.error("Tu sesión venció. Vuelve a iniciar sesión.");
        nav("/login", { replace: true });
        return;
      }

      if (showToastError) {
        notify.error(message, "No se pudo cargar la caja");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ubicacionId]);

  useEffect(() => {
    if (actual?.efectivo_inicial != null && !isAbierta) {
      setEfectivoInicial(actual.efectivo_inicial);
    }
  }, [actual, isAbierta]);

  useEffect(() => {
    if (actual?.efectivo_inicial != null && isAbierta) {
      setEfectivoFinal(actual.efectivo_inicial);
    }
  }, [actual, isAbierta]);

  const resumen = useMemo(() => {
    if (!actual) return null;

    return {
      id: actual.id,
      abierto_en: actual.abierto_en,
      cerrado_en: actual.cerrado_en,
      efectivo_inicial: Number(actual.efectivo_inicial ?? 0),
      efectivo_final:
        actual.efectivo_final != null ? Number(actual.efectivo_final) : null,
      notas: actual.notas,
      ubicacion: actual.ubicacion ?? null,
    };
  }, [actual]);

  const cajaEsperada = useMemo(() => {
    if (!resumen) return 0;
    return Number(resumen.efectivo_inicial ?? 0);
  }, [resumen]);

  const cajaContada = useMemo(() => {
    if (!isAbierta) {
      return Number(resumen?.efectivo_final ?? 0);
    }
    return Number(efectivoFinal || 0);
  }, [isAbierta, resumen, efectivoFinal]);

  const diferencia = useMemo(() => {
    return cajaContada - cajaEsperada;
  }, [cajaContada, cajaEsperada]);

  const estadoCajaLabel = loading
    ? "Cargando…"
    : isAbierta
    ? "Caja abierta"
    : "Caja cerrada";

  async function abrirCaja(e) {
    e.preventDefault();
    if (!ubicacionId) {
      notify.error("El usuario no tiene una sucursal asignada.");
      return;
    }

    setBusy(true);

    try {
      await notify.promise(
        api.cajaAbrir({
          ubicacion_id: Number(ubicacionId),
          efectivo_inicial: Number(efectivoInicial),
          notas: (notasAbrir || "").trim() || null,
        }),
        {
          loading: "Abriendo caja...",
          success: "Caja abierta correctamente",
          error: "No se pudo abrir la caja",
        }
      );

      await load(false);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  async function cerrarCaja(e) {
    e.preventDefault();
    if (!ubicacionId) {
      notify.error("El usuario no tiene una sucursal asignada.");
      return;
    }

    setBusy(true);

    try {
      await notify.promise(
        api.cajaCerrar({
          ubicacion_id: Number(ubicacionId),
          efectivo_final: Number(efectivoFinal),
          notas: (notasCerrar || "").trim() || null,
        }),
        {
          loading: "Cerrando caja...",
          success: "Caja cerrada correctamente",
          error: "No se pudo cerrar la caja",
        }
      );

      await load(false);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ minHeight: "100%", padding: 28 }}>
      <div
        style={{
          maxWidth: 1340,
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
              "linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.96) 45%, rgba(59,130,246,0.82) 100%)",
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
                Caja premium por sucursal
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
                Caja
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
                Gestión de apertura, cierre y control operativo de caja ligado a
                la sucursal del usuario actual.
              </p>
            </div>

            <div
              style={{
                minWidth: 280,
                borderRadius: 24,
                padding: "18px 20px",
                background: "rgba(255,255,255,0.10)",
                border: "1px solid rgba(255,255,255,0.14)",
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ color: "rgba(255,255,255,0.72)", fontSize: 13 }}>
                Sesión activa
              </div>
              <div
                style={{
                  color: "#fff",
                  fontWeight: 900,
                  fontSize: 22,
                  letterSpacing: "-0.03em",
                }}
              >
                {usuarioNombre}
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.78)",
                  fontSize: 14,
                }}
              >
                Rol: {usuarioRol || "—"}
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.78)",
                  fontSize: 14,
                }}
              >
                Sucursal asignada: {hasUbicacion ? nombreSucursal : "No asignada"}
              </div>
            </div>
          </div>
        </div>

        {!hasUbicacion ? (
          <div
            style={{
              borderRadius: 22,
              padding: 20,
              background: "#fff7ed",
              border: "1px solid #fdba74",
              color: "#9a3412",
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
            }}
          >
            <AlertTriangle size={20} />
            <div>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>
                Este usuario no tiene sucursal asignada
              </div>
              <div style={{ lineHeight: 1.6 }}>
                Para operar la caja, el usuario debe tener una ubicación
                vinculada en la base de datos.
              </div>
            </div>
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
          }}
        >
          <MetricCard
            icon={<Store size={20} />}
            title="Sucursal actual"
            value={hasUbicacion ? nombreSucursal : "—"}
            subtitle="Tomada desde la sesión"
          />
          <MetricCard
            icon={isAbierta ? <Unlock size={20} /> : <Lock size={20} />}
            title="Estado"
            value={estadoCajaLabel}
            subtitle={isAbierta ? "Operación habilitada" : "Pendiente de apertura"}
            accent={isAbierta ? "green" : "slate"}
          />
          <MetricCard
            icon={<Landmark size={20} />}
            title="Base de caja"
            value={money(cajaEsperada)}
            subtitle="Monto inicial/esperado"
          />
          <MetricCard
            icon={<CircleDollarSign size={20} />}
            title="Diferencia"
            value={money(diferencia)}
            subtitle="Contado vs esperado"
            accent={
              Number(diferencia) === 0
                ? "green"
                : Number(diferencia) > 0
                ? "blue"
                : "red"
            }
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.05fr 0.95fr",
            gap: 24,
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.82)",
              borderRadius: 28,
              padding: 24,
              border: "1px solid rgba(148,163,184,0.18)",
              boxShadow: "0 18px 45px rgba(15,23,42,0.08)",
              display: "grid",
              gap: 18,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 24,
                    fontWeight: 800,
                    color: "#0f172a",
                  }}
                >
                  Caja actual
                </h2>
                <p
                  style={{
                    margin: "6px 0 0",
                    color: "#64748b",
                    fontSize: 14,
                  }}
                >
                  Resumen operativo de la caja asociada a esta sucursal.
                </p>
              </div>

              <button
                type="button"
                onClick={() => load(true)}
                disabled={loading || busy || !hasUbicacion}
                style={{
                  ...secondaryButtonStyle,
                  opacity: loading || busy || !hasUbicacion ? 0.6 : 1,
                  cursor:
                    loading || busy || !hasUbicacion ? "not-allowed" : "pointer",
                }}
              >
                <RefreshCw size={16} />
                Refrescar
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 14,
              }}
            >
              <InfoPanel
                icon={<Clock3 size={16} />}
                title="Apertura"
                value={resumen?.abierto_en ? formatDate(resumen.abierto_en) : "—"}
              />
              <InfoPanel
                icon={<ShieldCheck size={16} />}
                title="Cierre"
                value={resumen?.cerrado_en ? formatDate(resumen.cerrado_en) : "—"}
              />
              <InfoPanel
                icon={<Wallet size={16} />}
                title="Efectivo inicial"
                value={resumen ? money(resumen.efectivo_inicial) : "—"}
              />
              <InfoPanel
                icon={<ReceiptText size={16} />}
                title="Efectivo final"
                value={
                  resumen?.efectivo_final != null
                    ? money(resumen.efectivo_final)
                    : isAbierta
                    ? money(efectivoFinal)
                    : "—"
                }
              />
            </div>

            <div
              style={{
                borderRadius: 22,
                padding: 18,
                background:
                  "linear-gradient(180deg, rgba(248,250,252,0.95) 0%, rgba(241,245,249,0.95) 100%)",
                border: "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  alignItems: "center",
                  flexWrap: "wrap",
                  marginBottom: 12,
                }}
              >
                <div style={{ fontWeight: 800, color: "#0f172a" }}>
                  Estado operativo
                </div>

                {loading ? (
                  <span style={badgeStyle("slate")}>Cargando…</span>
                ) : isAbierta ? (
                  <span style={badgeStyle("green")}>Abierta</span>
                ) : (
                  <span style={badgeStyle("gray")}>Cerrada</span>
                )}
              </div>

              <div
                style={{
                  color: "#475569",
                  lineHeight: 1.7,
                  fontSize: 14,
                }}
              >
                <div>
                  <strong>ID de caja:</strong> {resumen?.id ?? "—"}
                </div>
                <div>
                  <strong>Sucursal:</strong> {nombreSucursal}
                </div>
                <div>
                  <strong>Notas:</strong> {resumen?.notas || "Sin observaciones"}
                </div>
                <div>
                  <strong>Diferencia actual:</strong> {money(diferencia)}
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.82)",
              borderRadius: 28,
              padding: 24,
              border: "1px solid rgba(148,163,184,0.18)",
              boxShadow: "0 18px 45px rgba(15,23,42,0.08)",
              display: "grid",
              gap: 18,
              alignContent: "start",
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 24,
                  fontWeight: 800,
                  color: "#0f172a",
                }}
              >
                Operaciones
              </h2>
              <p
                style={{
                  margin: "6px 0 0",
                  color: "#64748b",
                  fontSize: 14,
                }}
              >
                Apertura y cierre de caja con mejor control visual.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              <form
                onSubmit={abrirCaja}
                style={{
                  borderRadius: 22,
                  padding: 18,
                  border: "1px solid #dbeafe",
                  background:
                    "linear-gradient(180deg, rgba(239,246,255,0.95) 0%, rgba(219,234,254,0.85) 100%)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "center",
                    marginBottom: 14,
                  }}
                >
                  <div style={{ fontWeight: 800, color: "#0f172a" }}>
                    Abrir caja
                  </div>
                  {isAbierta ? (
                    <span style={badgeStyle("green")}>Activa</span>
                  ) : (
                    <span style={badgeStyle("blue")}>Lista</span>
                  )}
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Notas</label>
                  <input
                    value={notasAbrir}
                    onChange={(e) => setNotasAbrir(e.target.value)}
                    placeholder="Apertura"
                    disabled={busy || loading || isAbierta || !hasUbicacion}
                    style={inputStyle}
                  />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Efectivo inicial</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={efectivoInicial}
                    onChange={(e) => setEfectivoInicial(e.target.value)}
                    disabled={busy || loading || isAbierta || !hasUbicacion}
                    style={inputStyle}
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy || loading || isAbierta || !hasUbicacion}
                  style={{
                    ...primaryButtonStyle,
                    width: "100%",
                    opacity:
                      busy || loading || isAbierta || !hasUbicacion ? 0.6 : 1,
                    cursor:
                      busy || loading || isAbierta || !hasUbicacion
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {busy ? "Procesando..." : "Abrir caja"}
                </button>

                {isAbierta ? (
                  <p style={hintStyle}>
                    Ya existe una caja abierta para esta sucursal.
                  </p>
                ) : null}
              </form>

              <form
                onSubmit={cerrarCaja}
                style={{
                  borderRadius: 22,
                  padding: 18,
                  border: "1px solid #fecaca",
                  background:
                    "linear-gradient(180deg, rgba(255,241,242,0.95) 0%, rgba(254,226,226,0.80) 100%)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "center",
                    marginBottom: 14,
                  }}
                >
                  <div style={{ fontWeight: 800, color: "#0f172a" }}>
                    Cerrar caja
                  </div>
                  {!isAbierta ? (
                    <span style={badgeStyle("gray")}>Sin caja</span>
                  ) : (
                    <span style={badgeStyle("red")}>Pendiente</span>
                  )}
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Notas</label>
                  <input
                    value={notasCerrar}
                    onChange={(e) => setNotasCerrar(e.target.value)}
                    placeholder="Cierre"
                    disabled={busy || loading || !isAbierta || !hasUbicacion}
                    style={inputStyle}
                  />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Efectivo contado al cierre</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={efectivoFinal}
                    onChange={(e) => setEfectivoFinal(e.target.value)}
                    disabled={busy || loading || !isAbierta || !hasUbicacion}
                    style={inputStyle}
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy || loading || !isAbierta || !hasUbicacion}
                  style={{
                    ...dangerButtonStyle,
                    width: "100%",
                    opacity:
                      busy || loading || !isAbierta || !hasUbicacion ? 0.6 : 1,
                    cursor:
                      busy || loading || !isAbierta || !hasUbicacion
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {busy ? "Procesando..." : "Cerrar caja"}
                </button>

                {!isAbierta ? (
                  <p style={hintStyle}>No hay una caja abierta para cerrar.</p>
                ) : (
                  <p style={hintStyle}>
                    Esperado: {money(cajaEsperada)} · Contado:{" "}
                    {money(efectivoFinal)} · Diferencia: {money(diferencia)}
                  </p>
                )}
              </form>
            </div>
          </div>
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.82)",
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
              marginBottom: 16,
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 24,
                  fontWeight: 800,
                  color: "#0f172a",
                }}
              >
                Historial
              </h2>
              <p
                style={{
                  margin: "6px 0 0",
                  color: "#64748b",
                  fontSize: 14,
                }}
              >
                Últimos movimientos de apertura y cierre para la sucursal actual.
              </p>
            </div>

            <div
              style={{
                padding: "10px 14px",
                borderRadius: 999,
                background: "#eff6ff",
                color: "#1d4ed8",
                fontWeight: 700,
                fontSize: 13,
                border: "1px solid #bfdbfe",
              }}
            >
              {loading ? "Cargando…" : `${historial.length} registro(s)`}
            </div>
          </div>

          <div
            style={{
              overflowX: "auto",
              borderRadius: 22,
              border: "1px solid #e2e8f0",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 900,
                background: "#fff",
              }}
            >
              <thead>
                <tr
                  style={{
                    background:
                      "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
                  }}
                >
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>Sucursal</th>
                  <th style={thStyle}>Apertura</th>
                  <th style={thStyle}>Cierre</th>
                  <th style={thStyle}>Inicial</th>
                  <th style={thStyle}>Final</th>
                  <th style={thStyle}>Notas</th>
                  <th style={thStyle}>Estado</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={emptyTdStyle}>
                      Cargando…
                    </td>
                  </tr>
                ) : historial.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={emptyTdStyle}>
                      Sin registros.
                    </td>
                  </tr>
                ) : (
                  historial.map((c) => {
                    const abierta = !c.cerrado_en;
                    const nombreSucursalFila =
                      c?.ubicacion?.nombre ||
                      nombreSucursal ||
                      (c?.ubicacion_id ? `Sucursal #${c.ubicacion_id}` : "—");

                    return (
                      <tr key={c.id} style={{ borderTop: "1px solid #eef2f7" }}>
                        <td style={tdStyle}>{c.id}</td>
                        <td style={tdStyle}>{nombreSucursalFila}</td>
                        <td style={tdStyle}>{formatDate(c.abierto_en)}</td>
                        <td style={tdStyle}>{formatDate(c.cerrado_en)}</td>
                        <td style={tdStyle}>
                          <span style={pillStyle}>{money(c.efectivo_inicial)}</span>
                        </td>
                        <td style={tdStyle}>
                          {c.efectivo_final != null ? (
                            <span style={pillStyle}>{money(c.efectivo_final)}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td style={tdStyle}>{c.notas || "—"}</td>
                        <td style={tdStyle}>
                          {abierta ? (
                            <span style={badgeStyle("green")}>Abierta</span>
                          ) : (
                            <span style={badgeStyle("gray")}>Cerrada</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style>
        {`
          @media (max-width: 1100px) {
            div[style*="grid-template-columns: repeat(4, 1fr)"] {
              grid-template-columns: 1fr 1fr !important;
            }

            div[style*="grid-template-columns: 1.05fr 0.95fr"] {
              grid-template-columns: 1fr !important;
            }
          }

          @media (max-width: 860px) {
            div[style*="grid-template-columns: 1fr 1fr"] {
              grid-template-columns: 1fr !important;
            }
          }

          @media (max-width: 640px) {
            section[style] {
              padding: 16px !important;
            }

            div[style*="grid-template-columns: repeat(4, 1fr)"] {
              grid-template-columns: 1fr !important;
            }
          }

          input:focus {
            outline: none;
            border-color: #60a5fa !important;
            box-shadow: 0 0 0 4px rgba(96,165,250,0.18);
          }
        `}
      </style>
    </section>
  );
}

function MetricCard({ icon, title, value, subtitle, accent = "blue" }) {
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
    red: {
      bg: "linear-gradient(180deg, #fef2f2 0%, #fee2e2 100%)",
      border: "#fecaca",
      iconBg: "#dc2626",
    },
    slate: {
      bg: "linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)",
      border: "#cbd5e1",
      iconBg: "#334155",
    },
  };

  const tone = accents[accent] || accents.blue;

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

      <div
        style={{
          color: "#64748b",
          fontSize: 13,
          marginBottom: 6,
        }}
      >
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

      <div
        style={{
          color: "#64748b",
          fontSize: 13,
        }}
      >
        {subtitle}
      </div>
    </div>
  );
}

function InfoPanel({ icon, title, value }) {
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
    red: {
      background: "#fee2e2",
      color: "#b91c1c",
      border: "#fecaca",
    },
    blue: {
      background: "#dbeafe",
      color: "#1d4ed8",
      border: "#bfdbfe",
    },
    slate: {
      background: "#e2e8f0",
      color: "#334155",
      border: "#cbd5e1",
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

const hintStyle = {
  margin: "10px 0 0",
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.6,
};

const pillStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 92,
  padding: "8px 12px",
  borderRadius: 999,
  background: "#f1f5f9",
  color: "#0f172a",
  fontWeight: 800,
  fontSize: 13,
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
  boxShadow: "0 14px 28px rgba(37,99,235,0.25)",
};

const dangerButtonStyle = {
  height: 52,
  border: "none",
  borderRadius: 16,
  padding: "0 20px",
  background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
  color: "#fff",
  fontWeight: 800,
  fontSize: 15,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  boxShadow: "0 14px 28px rgba(239,68,68,0.22)",
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

const emptyTdStyle = {
  padding: "28px 20px",
  textAlign: "center",
  color: "#64748b",
};