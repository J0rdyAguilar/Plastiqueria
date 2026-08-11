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
  ReceiptText,
  TrendingUp,
  TrendingDown,
  Building2,
  CalendarRange,
  FileText,
  Tags,
  BadgeDollarSign,
  BarChart3,
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

function extractRows(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  if (Array.isArray(response?.data?.items)) return response.data.items;
  return [];
}

function buildParams(ubicacionId, isSuperAdmin) {
  if (isSuperAdmin && !ubicacionId) return {};
  if (!ubicacionId) return {};
  return { ubicacion_id: Number(ubicacionId) };
}

function currentMonthValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

const TIPOS_EGRESO = [
  "Luz",
  "Agua",
  "Internet",
  "Alquiler",
  "Transporte",
  "Combustible",
  "Viáticos",
  "Papelería",
  "Limpieza",
  "Compra",
  "Mantenimiento",
  "Pago a proveedor",
  "Otro",
];

export default function Caja() {
  const nav = useNavigate();
  const me = getSession()?.user || {};

  const usuarioNombre = me?.nombre || me?.usuario || "—";
  const usuarioRol = normalizeRole(me?.rol || me?.role || "");
  const isSuperAdmin = usuarioRol === "super_admin";

  const ubicacionIdSesion = Number(me?.ubicacion_id || 0) || null;

  const ubicacionNombreSesion =
    me?.ubicacion?.nombre ||
    me?.sucursal?.nombre ||
    me?.ubicacion_nombre ||
    me?.nombre_ubicacion ||
    "Sucursal asignada";

  const [ubicacionId, setUbicacionId] = useState(
    isSuperAdmin ? "" : ubicacionIdSesion
  );

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [actualRaw, setActualRaw] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [ubicacionesCatalogo, setUbicacionesCatalogo] = useState([]);
  const [pedidosPendientes, setPedidosPendientes] = useState([]);
  const [pedidoCobroId, setPedidoCobroId] = useState("");
  const [metodoCobro, setMetodoCobro] = useState("efectivo");
  const [referenciaCobro, setReferenciaCobro] = useState("");
  const [numeroCuotas, setNumeroCuotas] = useState(1);
  const [frecuenciaPago, setFrecuenciaPago] = useState("mensual");
  const [fechaPrimerPago, setFechaPrimerPago] = useState("");
  const [cobrandoPedido, setCobrandoPedido] = useState(false);

  const [notasAbrir, setNotasAbrir] = useState("Apertura");
  const [efectivoInicial, setEfectivoInicial] = useState(100);

  const [notasCerrar, setNotasCerrar] = useState("Cierre");
  const [efectivoFinal, setEfectivoFinal] = useState(100);

  const [openedOnce, setOpenedOnce] = useState(false);
  const [mesFiltro, setMesFiltro] = useState(currentMonthValue());

  const [egresoTipo, setEgresoTipo] = useState("Compra");
  const [egresoConcepto, setEgresoConcepto] = useState("");
  const [egresoMonto, setEgresoMonto] = useState("");
  const [egresoReferencia, setEgresoReferencia] = useState("");
  const [egresoNotas, setEgresoNotas] = useState("");
  const [egresoModalOpen, setEgresoModalOpen] = useState(false);

  const hasUbicacion =
    isSuperAdmin ? String(ubicacionId || "").trim() !== "" : !!ubicacionId;

  const actualLista = useMemo(() => {
    if (Array.isArray(actualRaw)) return actualRaw;
    if (actualRaw && typeof actualRaw === "object") return [actualRaw];
    return [];
  }, [actualRaw]);

  const actual = useMemo(() => {
    if (Array.isArray(actualRaw)) return null;
    return actualRaw && typeof actualRaw === "object" ? actualRaw : null;
  }, [actualRaw]);

  const vistaTodasSucursales = isSuperAdmin && !hasUbicacion;

  const pedidoCobroSeleccionado = useMemo(
    () =>
      pedidosPendientes.find(
        (pedido) => String(pedido?.id) === String(pedidoCobroId)
      ) || null,
    [pedidosPendientes, pedidoCobroId]
  );

  async function fetchUbicacionesCatalogo() {
    if (!isSuperAdmin) return [];

    try {
      if (typeof api?.ubicacionesList === "function") {
        const resp = await api.ubicacionesList({
          per_page: 1000,
          activo: 1,
        });
        return extractRows(resp);
      }

      if (typeof api?.ubicaciones === "function") {
        const resp = await api.ubicaciones({
          per_page: 1000,
          activo: 1,
        });
        return extractRows(resp);
      }

      if (typeof api?.get === "function") {
        const resp = await api.get("/ubicaciones", {
          params: { per_page: 1000, activo: 1 },
        });
        return extractRows(resp);
      }

      return [];
    } catch (err) {
      console.error("No se pudieron cargar las ubicaciones:", err);
      return [];
    }
  }

  async function loadUbicaciones() {
    if (!isSuperAdmin) return;

    const rows = await fetchUbicacionesCatalogo();

    const parsed = Array.isArray(rows)
      ? rows
          .map((u) => ({
            id: Number(u?.id || 0),
            nombre:
              u?.nombre ||
              u?.descripcion ||
              u?.sucursal ||
              `Sucursal #${u?.id}`,
          }))
          .filter((u) => u.id)
      : [];

    setUbicacionesCatalogo(parsed);
  }

  const ubicacionesDisponibles = useMemo(() => {
    const map = new Map();

    if (isSuperAdmin) {
      ubicacionesCatalogo.forEach((u) => {
        const id = Number(u?.id || 0);
        if (!id) return;

        map.set(String(id), {
          id,
          nombre: u?.nombre || `Sucursal #${id}`,
        });
      });
    }

    if (ubicacionIdSesion) {
      map.set(String(ubicacionIdSesion), {
        id: Number(ubicacionIdSesion),
        nombre: ubicacionNombreSesion || `Sucursal #${ubicacionIdSesion}`,
      });
    }

    actualLista.forEach((item) => {
      const id = Number(item?.ubicacion_id || item?.ubicacion?.id || 0);
      if (!id) return;
      map.set(String(id), {
        id,
        nombre: item?.ubicacion?.nombre || `Sucursal #${id}`,
      });
    });

    historial.forEach((item) => {
      const id = Number(item?.ubicacion_id || item?.ubicacion?.id || 0);
      if (!id) return;
      map.set(String(id), {
        id,
        nombre: item?.ubicacion?.nombre || `Sucursal #${id}`,
      });
    });

    return Array.from(map.values()).sort((a, b) =>
      String(a.nombre).localeCompare(String(b.nombre))
    );
  }, [
    isSuperAdmin,
    ubicacionesCatalogo,
    actualLista,
    historial,
    ubicacionIdSesion,
    ubicacionNombreSesion,
  ]);

  const nombreSucursal =
    actual?.ubicacion?.nombre ||
    historial?.[0]?.ubicacion?.nombre ||
    ubicacionesDisponibles.find((u) => Number(u.id) === Number(ubicacionId))
      ?.nombre ||
    ubicacionNombreSesion ||
    (hasUbicacion ? `Sucursal #${ubicacionId}` : "Todas las sucursales");

  async function load(showToastError = false) {
    if (!isSuperAdmin && !ubicacionId) {
      setActualRaw(null);
      setHistorial([]);
      setPedidosPendientes([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const paramsActual = buildParams(ubicacionId, isSuperAdmin);
      const paramsHistorial = {
        ...buildParams(ubicacionId, isSuperAdmin),
        per_page: 50,
        mes: mesFiltro,
      };

      const [r1, r2, r3] = await Promise.all([
        api.cajaActual(paramsActual),
        api.cajaHistorial(paramsHistorial),
        api.ventasTiendaCajaPendientes(paramsActual),
      ]);

      const dataActual = r1?.data ?? null;
      setActualRaw(dataActual);

      const raw = extractRows(r2);
      setHistorial(raw);
      const pedidos = extractRows(r3);
      setPedidosPendientes(pedidos);

      if (
        pedidoCobroId &&
        !pedidos.some((pedido) => String(pedido?.id) === String(pedidoCobroId))
      ) {
        setPedidoCobroId("");
      }

      const cajaAbierta =
        Array.isArray(dataActual) ? dataActual.length > 0 : !!dataActual;

      if (cajaAbierta && !openedOnce) {
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

  async function cobrarPedidoPendiente() {
    if (!pedidoCobroSeleccionado) {
      notify.error("Selecciona un pedido pendiente de cobro.");
      return;
    }

    if (metodoCobro === "cuotas" && Number(numeroCuotas || 0) < 1) {
      notify.error("Indica el número de cuotas.");
      return;
    }

    try {
      setCobrandoPedido(true);

      await api.ventasTiendaCajaCobrar(pedidoCobroSeleccionado.id, {
        metodo_pago: metodoCobro,
        referencia_pago: referenciaCobro.trim() || null,
        numero_cuotas:
          metodoCobro === "cuotas" ? Number(numeroCuotas || 1) : null,
        frecuencia_pago: metodoCobro === "cuotas" ? frecuenciaPago : null,
        fecha_primer_pago:
          metodoCobro === "cuotas" && fechaPrimerPago
            ? fechaPrimerPago
            : null,
      });

      notify.success("Pedido cobrado correctamente.");
      setPedidoCobroId("");
      setMetodoCobro("efectivo");
      setReferenciaCobro("");
      setNumeroCuotas(1);
      setFrecuenciaPago("mensual");
      setFechaPrimerPago("");
      await load(false);
    } catch (err) {
      notify.error(err, "No se pudo cobrar el pedido.");
    } finally {
      setCobrandoPedido(false);
    }
  }

  useEffect(() => {
    if (isSuperAdmin) {
      loadUbicaciones();
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    load(false);
  }, [ubicacionId, isSuperAdmin, mesFiltro]);

  useEffect(() => {
    if (actual?.efectivo_inicial != null && !actual?.cerrado_en) {
      setEfectivoFinal(actual.saldo_esperado ?? actual.efectivo_inicial);
    }
  }, [actual]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") {
        setEgresoModalOpen(false);
      }
    }

    if (egresoModalOpen) {
      window.addEventListener("keydown", onKeyDown);
    }

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [egresoModalOpen]);

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

  const totalIngresos = useMemo(() => {
    return Number(actual?.total_ingresos ?? 0);
  }, [actual]);

  const totalEgresos = useMemo(() => {
    return Number(actual?.total_egresos ?? 0);
  }, [actual]);

  const cajaEsperada = useMemo(() => {
    return Number(actual?.saldo_esperado ?? 0);
  }, [actual]);

  const isAbierta = !!actual && !actual?.cerrado_en;

  const cajaContada = useMemo(() => {
    if (!isAbierta) {
      return Number(resumen?.efectivo_final ?? 0);
    }
    return Number(efectivoFinal || 0);
  }, [isAbierta, resumen, efectivoFinal]);

  const diferencia = useMemo(() => {
    return cajaContada - cajaEsperada;
  }, [cajaContada, cajaEsperada]);

  const resumenGlobal = useMemo(() => {
    const rows = actualLista;

    const sucursales = rows.length;
    const abiertas = rows.filter((x) => !x?.cerrado_en).length;
    const ingresos = rows.reduce(
      (acc, x) => acc + Number(x?.total_ingresos ?? 0),
      0
    );
    const egresos = rows.reduce(
      (acc, x) => acc + Number(x?.total_egresos ?? 0),
      0
    );
    const esperado = rows.reduce(
      (acc, x) => acc + Number(x?.saldo_esperado ?? 0),
      0
    );
    const base = rows.reduce(
      (acc, x) => acc + Number(x?.efectivo_inicial ?? 0),
      0
    );

    return {
      sucursales,
      abiertas,
      ingresos,
      egresos,
      esperado,
      base,
    };
  }, [actualLista]);

  const resumenHistorialMes = useMemo(() => {
    return historial.reduce(
      (acc, item) => {
        acc.ingresos += Number(item?.total_ingresos ?? 0);
        acc.egresos += Number(item?.total_egresos ?? 0);
        acc.inicial += Number(item?.efectivo_inicial ?? 0);
        acc.final += Number(item?.efectivo_final ?? 0);
        return acc;
      },
      { ingresos: 0, egresos: 0, inicial: 0, final: 0 }
    );
  }, [historial]);

  const movimientosActuales = useMemo(() => {
    return Array.isArray(actual?.movimientos) ? actual.movimientos : [];
  }, [actual]);

  const egresosActuales = useMemo(() => {
    return movimientosActuales.filter((m) => String(m?.tipo) === "egreso");
  }, [movimientosActuales]);

  const dashboardEgresos = useMemo(() => {
    const porTipo = {};
    let total = 0;

    egresosActuales.forEach((m) => {
      const monto = Number(m?.monto ?? 0);
      total += monto;

      const key =
        String(m?.concepto || "").trim() ||
        String(m?.referencia_tipo || "").trim() ||
        "Sin tipo";

      porTipo[key] = (porTipo[key] || 0) + monto;
    });

    const ranking = Object.entries(porTipo)
      .map(([tipo, monto]) => ({ tipo, monto }))
      .sort((a, b) => b.monto - a.monto);

    return {
      total,
      cantidad: egresosActuales.length,
      ranking,
      mayor: ranking[0] || null,
    };
  }, [egresosActuales]);

  const estadoCajaLabel = loading
    ? "Cargando…"
    : vistaTodasSucursales
    ? `${resumenGlobal.abiertas} abierta(s)`
    : isAbierta
    ? "Caja abierta"
    : "Caja cerrada";

  async function abrirCaja(e) {
    e.preventDefault();

    if (!ubicacionId) {
      notify.error("Debes seleccionar una sucursal.");
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
      notify.error("Debes seleccionar una sucursal.");
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

  function abrirModalEgreso() {
    if (!ubicacionId) {
      notify.error("Debes seleccionar una sucursal.");
      return;
    }

    if (!isAbierta) {
      notify.error("No hay una caja abierta para registrar egresos.");
      return;
    }

    setEgresoModalOpen(true);
  }

  function cerrarModalEgreso() {
    if (busy) return;
    setEgresoModalOpen(false);
  }

  async function registrarEgreso(e) {
    e.preventDefault();

    if (!ubicacionId) {
      notify.error("Debes seleccionar una sucursal.");
      return;
    }

    if (!isAbierta) {
      notify.error("No hay una caja abierta para registrar egresos.");
      return;
    }

    const monto = Number(egresoMonto || 0);
    const conceptoFinal =
      egresoTipo === "Otro"
        ? String(egresoConcepto || "").trim()
        : String(egresoTipo || "").trim();

    if (!conceptoFinal) {
      notify.error("Debes indicar el tipo o concepto del egreso.");
      return;
    }

    if (!monto || monto <= 0) {
      notify.error("El monto del egreso debe ser mayor a 0.");
      return;
    }

    setBusy(true);

    try {
      await notify.promise(
        api.cajaRegistrarEgreso({
          ubicacion_id: Number(ubicacionId),
          concepto: conceptoFinal,
          monto,
          referencia: (egresoReferencia || "").trim() || null,
          notas: (egresoNotas || "").trim() || null,
        }),
        {
          loading: "Registrando egreso...",
          success: "Egreso registrado correctamente",
          error: "No se pudo registrar el egreso",
        }
      );

      setEgresoTipo("Compra");
      setEgresoConcepto("");
      setEgresoMonto("");
      setEgresoReferencia("");
      setEgresoNotas("");
      setEgresoModalOpen(false);

      await load(false);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  function exportarPdfEgresos() {
    if (!hasUbicacion) {
      notify.error("Debes seleccionar una sucursal.");
      return;
    }

    const rows = egresosActuales;
    const total = rows.reduce((acc, row) => acc + Number(row?.monto ?? 0), 0);

    const html = `
      <html>
        <head>
          <title>Reporte de egresos</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 24px;
              color: #0f172a;
            }
            h1 {
              margin: 0 0 8px;
            }
            p {
              margin: 0 0 8px;
              color: #475569;
            }
            .meta {
              margin-bottom: 20px;
              padding: 14px;
              border: 1px solid #cbd5e1;
              border-radius: 12px;
              background: #f8fafc;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 16px;
            }
            th, td {
              border: 1px solid #cbd5e1;
              padding: 10px;
              text-align: left;
              font-size: 13px;
            }
            th {
              background: #e2e8f0;
            }
            .total {
              margin-top: 18px;
              font-weight: 700;
              font-size: 16px;
            }
          </style>
        </head>
        <body>
          <h1>Reporte de egresos</h1>
          <div class="meta">
            <p><strong>Sucursal:</strong> ${nombreSucursal}</p>
            <p><strong>Fecha:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Caja:</strong> ${resumen?.id ?? "—"}</p>
            <p><strong>Total de egresos:</strong> ${money(total)}</p>
          </div>

          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Concepto</th>
                <th>Método</th>
                <th>Monto</th>
                <th>Referencia</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              ${
                rows.length === 0
                  ? `<tr><td colspan="6">Sin egresos registrados.</td></tr>`
                  : rows
                      .map(
                        (m) => `
                    <tr>
                      <td>${m?.id ?? "—"}</td>
                      <td>${m?.concepto || "—"}</td>
                      <td>${m?.metodo_pago || "—"}</td>
                      <td>${money(m?.monto)}</td>
                      <td>${
                        m?.referencia_tipo
                          ? `${m?.referencia_tipo} ${m?.referencia_id ?? ""}`
                          : "—"
                      }</td>
                      <td>${formatDate(m?.creado_en)}</td>
                    </tr>
                  `
                      )
                      .join("")
              }
            </tbody>
          </table>

          <div class="total">Total: ${money(total)}</div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    const w = window.open("", "_blank", "width=1000,height=700");
    if (!w) {
      notify.error("El navegador bloqueó la ventana para imprimir.");
      return;
    }

    w.document.open();
    w.document.write(html);
    w.document.close();
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
                Gestión de apertura, cierre, egresos, reporte PDF y dashboard
                operativo de caja por sucursal.
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
                {vistaTodasSucursales
                  ? "Vista: Todas las sucursales"
                  : `Sucursal activa: ${
                      hasUbicacion ? nombreSucursal : "No asignada"
                    }`}
              </div>
            </div>
          </div>
        </div>

        {isSuperAdmin ? (
          <div
            style={{
              background: "rgba(255,255,255,0.82)",
              borderRadius: 24,
              padding: 18,
              border: "1px solid rgba(148,163,184,0.18)",
              boxShadow: "0 18px 45px rgba(15,23,42,0.08)",
              display: "grid",
              gap: 10,
            }}
          >
            <label style={labelStyle}>Sucursal a visualizar / operar</label>
            <select
              value={ubicacionId}
              onChange={(e) => setUbicacionId(e.target.value)}
              style={selectStyle}
            >
              <option value="">Todas las sucursales</option>
              {ubicacionesDisponibles.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>

            <div style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>
              En “Todas las sucursales” solo se muestra el resumen global. Para
              abrir, cerrar o registrar egresos, selecciona una sucursal.
            </div>
          </div>
        ) : null}

        {!isSuperAdmin && !hasUbicacion ? (
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
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: 16,
          }}
        >
          <MetricCard
            icon={
              vistaTodasSucursales ? (
                <Building2 size={20} />
              ) : (
                <Store size={20} />
              )
            }
            title={
              vistaTodasSucursales ? "Sucursales abiertas" : "Sucursal actual"
            }
            value={
              vistaTodasSucursales
                ? String(resumenGlobal.sucursales)
                : hasUbicacion
                ? nombreSucursal
                : "—"
            }
            subtitle={
              vistaTodasSucursales
                ? "Cajas activas visibles"
                : "Tomada desde sesión / selector"
            }
          />
          <MetricCard
            icon={isAbierta ? <Unlock size={20} /> : <Lock size={20} />}
            title="Estado"
            value={estadoCajaLabel}
            subtitle={
              vistaTodasSucursales
                ? "Resumen general del sistema"
                : isAbierta
                ? "Operación habilitada"
                : "Pendiente de apertura"
            }
            accent={isAbierta || vistaTodasSucursales ? "green" : "slate"}
          />
          <MetricCard
            icon={<Landmark size={20} />}
            title="Base de caja"
            value={
              vistaTodasSucursales
                ? money(resumenGlobal.base)
                : resumen
                ? money(resumen.efectivo_inicial)
                : "—"
            }
            subtitle={
              vistaTodasSucursales ? "Suma de bases abiertas" : "Monto inicial"
            }
          />
          <MetricCard
            icon={<TrendingUp size={20} />}
            title="Ingresos del día"
            value={
              vistaTodasSucursales
                ? money(resumenGlobal.ingresos)
                : money(totalIngresos)
            }
            subtitle="Ventas, abonos e ingresos"
            accent="green"
          />
          <MetricCard
            icon={<TrendingDown size={20} />}
            title="Egresos del día"
            value={
              vistaTodasSucursales
                ? money(resumenGlobal.egresos)
                : money(totalEgresos)
            }
            subtitle="Salidas registradas"
            accent="red"
          />
          <MetricCard
            icon={<CircleDollarSign size={20} />}
            title="Saldo esperado"
            value={
              vistaTodasSucursales
                ? money(resumenGlobal.esperado)
                : money(cajaEsperada)
            }
            subtitle={vistaTodasSucursales ? "Total esperado" : "Caja contable"}
            accent="blue"
          />
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
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
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
                Pedidos pendientes de cobro
              </h2>
              <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 14 }}>
                Pedidos enviados por los vendedores de tienda para ser cobrados en Caja.
              </p>
            </div>

            <span style={badgeStyle(pedidosPendientes.length ? "blue" : "gray")}>
              {pedidosPendientes.length} pendiente(s)
            </span>
          </div>

          {loading ? (
            <div style={panelEmptyStyle}>Cargando pedidos pendientes…</div>
          ) : pedidosPendientes.length === 0 ? (
            <div style={panelEmptyStyle}>No hay pedidos pendientes de cobro.</div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.15fr) minmax(320px, 0.85fr)",
                gap: 18,
                alignItems: "start",
              }}
            >
              <div style={{ display: "grid", gap: 10 }}>
                {pedidosPendientes.map((pedido) => {
                  const seleccionado =
                    String(pedidoCobroId) === String(pedido?.id);

                  return (
                    <button
                      key={pedido.id}
                      type="button"
                      onClick={() => setPedidoCobroId(String(pedido.id))}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        borderRadius: 18,
                        padding: 16,
                        border: seleccionado
                          ? "1px solid #3b82f6"
                          : "1px solid #e2e8f0",
                        background: seleccionado ? "#eff6ff" : "#f8fafc",
                        cursor: "pointer",
                        display: "grid",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          alignItems: "center",
                        }}
                      >
                        <strong style={{ color: "#0f172a", fontSize: 16 }}>
                          {pedido?.cliente_nombre || "Cliente sin nombre"}
                        </strong>
                        <strong style={{ color: "#0f172a", fontSize: 16 }}>
                          {money(pedido?.total)}
                        </strong>
                      </div>

                      <div style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>
                        Pedido #{pedido?.id} · Vendedor: {pedido?.usuario_nombre || "—"}
                        {pedido?.ubicacion_nombre
                          ? ` · ${pedido.ubicacion_nombre}`
                          : ""}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div
                style={{
                  borderRadius: 20,
                  border: "1px solid #e2e8f0",
                  padding: 18,
                  background: "#f8fafc",
                  display: "grid",
                  gap: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <BadgeDollarSign size={20} />
                  <strong style={{ color: "#0f172a" }}>Registrar cobro</strong>
                </div>

                {pedidoCobroSeleccionado ? (
                  <>
                    <div style={{ color: "#475569", fontSize: 14, lineHeight: 1.7 }}>
                      <div>
                        <strong>Cliente:</strong>{" "}
                        {pedidoCobroSeleccionado.cliente_nombre || "—"}
                      </div>
                      <div>
                        <strong>Total:</strong> {money(pedidoCobroSeleccionado.total)}
                      </div>
                    </div>

                    <div>
                      <label style={labelStyle}>Método de pago</label>
                      <select
                        value={metodoCobro}
                        onChange={(e) => setMetodoCobro(e.target.value)}
                        style={selectStyle}
                      >
                        <option value="efectivo">Efectivo</option>
                        <option value="tarjeta">Tarjeta</option>
                        <option value="cuotas">Crédito</option>
                      </select>
                    </div>

                    <div>
                      <label style={labelStyle}>Referencia</label>
                      <input
                        value={referenciaCobro}
                        onChange={(e) => setReferenciaCobro(e.target.value)}
                        placeholder="Opcional"
                        style={inputStyle}
                      />
                    </div>

                    {metodoCobro === "cuotas" ? (
                      <div style={{ display: "grid", gap: 12 }}>
                        <div>
                          <label style={labelStyle}>Número de cuotas</label>
                          <input
                            type="number"
                            min="1"
                            max="24"
                            value={numeroCuotas}
                            onChange={(e) => setNumeroCuotas(e.target.value)}
                            style={inputStyle}
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>Frecuencia</label>
                          <select
                            value={frecuenciaPago}
                            onChange={(e) => setFrecuenciaPago(e.target.value)}
                            style={selectStyle}
                          >
                            <option value="semanal">Semanal</option>
                            <option value="quincenal">Quincenal</option>
                            <option value="mensual">Mensual</option>
                          </select>
                        </div>
                        <div>
                          <label style={labelStyle}>Primer pago</label>
                          <input
                            type="date"
                            value={fechaPrimerPago}
                            onChange={(e) => setFechaPrimerPago(e.target.value)}
                            style={inputStyle}
                          />
                        </div>
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={cobrarPedidoPendiente}
                      disabled={cobrandoPedido}
                      style={{
                        ...primaryButtonStyle,
                        width: "100%",
                        opacity: cobrandoPedido ? 0.65 : 1,
                        cursor: cobrandoPedido ? "not-allowed" : "pointer",
                      }}
                    >
                      <ReceiptText size={17} />
                      {cobrandoPedido ? "Procesando cobro…" : "Cobrar pedido"}
                    </button>
                  </>
                ) : (
                  <div style={panelEmptyStyle}>Selecciona un pedido para cobrarlo.</div>
                )}
              </div>
            </div>
          )}
        </div>

        {vistaTodasSucursales ? (
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
                  Cajas abiertas por sucursal
                </h2>
                <p
                  style={{
                    margin: "6px 0 0",
                    color: "#64748b",
                    fontSize: 14,
                  }}
                >
                  Vista global para super admin.
                </p>
              </div>

              <button
                type="button"
                onClick={() => load(true)}
                disabled={loading || busy}
                style={{
                  ...secondaryButtonStyle,
                  opacity: loading || busy ? 0.6 : 1,
                  cursor: loading || busy ? "not-allowed" : "pointer",
                }}
              >
                <RefreshCw size={16} />
                Refrescar
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 16,
              }}
            >
              {loading ? (
                <div style={panelEmptyStyle}>Cargando sucursales…</div>
              ) : actualLista.length === 0 ? (
                <div style={panelEmptyStyle}>No hay cajas abiertas.</div>
              ) : (
                actualLista.map((caja) => {
                  const abierta = !caja?.cerrado_en;
                  const nombre =
                    caja?.ubicacion?.nombre ||
                    (caja?.ubicacion_id
                      ? `Sucursal #${caja.ubicacion_id}`
                      : "Sucursal");

                  return (
                    <div
                      key={caja.id}
                      style={{
                        borderRadius: 22,
                        padding: 18,
                        background:
                          "linear-gradient(180deg, rgba(248,250,252,0.96) 0%, rgba(241,245,249,0.96) 100%)",
                        border: "1px solid #e2e8f0",
                        display: "grid",
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          alignItems: "center",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 900,
                            color: "#0f172a",
                            fontSize: 18,
                          }}
                        >
                          {nombre}
                        </div>
                        {abierta ? (
                          <span style={badgeStyle("green")}>Abierta</span>
                        ) : (
                          <span style={badgeStyle("gray")}>Cerrada</span>
                        )}
                      </div>

                      <div
                        style={{
                          color: "#475569",
                          fontSize: 14,
                          lineHeight: 1.7,
                        }}
                      >
                        <div>
                          <strong>ID caja:</strong> {caja?.id ?? "—"}
                        </div>
                        <div>
                          <strong>Apertura:</strong>{" "}
                          {formatDate(caja?.abierto_en)}
                        </div>
                        <div>
                          <strong>Base:</strong>{" "}
                          {money(caja?.efectivo_inicial)}
                        </div>
                        <div>
                          <strong>Ingresos:</strong>{" "}
                          {money(caja?.total_ingresos)}
                        </div>
                        <div>
                          <strong>Egresos:</strong>{" "}
                          {money(caja?.total_egresos)}
                        </div>
                        <div>
                          <strong>Esperado:</strong>{" "}
                          {money(caja?.saldo_esperado)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setUbicacionId(String(caja?.ubicacion_id || ""))
                        }
                        style={{
                          ...primaryButtonStyle,
                          width: "100%",
                          height: 46,
                        }}
                      >
                        Ver esta sucursal
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <>
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
                        loading || busy || !hasUbicacion
                          ? "not-allowed"
                          : "pointer",
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
                    value={
                      resumen?.abierto_en ? formatDate(resumen.abierto_en) : "—"
                    }
                  />
                  <InfoPanel
                    icon={<ShieldCheck size={16} />}
                    title="Cierre"
                    value={
                      resumen?.cerrado_en ? formatDate(resumen.cerrado_en) : "—"
                    }
                  />
                  <InfoPanel
                    icon={<Wallet size={16} />}
                    title="Efectivo inicial"
                    value={resumen ? money(resumen.efectivo_inicial) : "—"}
                  />
                  <InfoPanel
                    icon={<ReceiptText size={16} />}
                    title="Saldo esperado"
                    value={money(cajaEsperada)}
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
                      <strong>Notas:</strong>{" "}
                      {resumen?.notas || "Sin observaciones"}
                    </div>
                    <div>
                      <strong>Ingresos del día:</strong> {money(totalIngresos)}
                    </div>
                    <div>
                      <strong>Egresos del día:</strong> {money(totalEgresos)}
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
                    Apertura, cierre y control de egresos.
                  </p>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
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
                          busy || loading || isAbierta || !hasUbicacion
                            ? 0.6
                            : 1,
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
                          busy || loading || !isAbierta || !hasUbicacion
                            ? 0.6
                            : 1,
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

                  <div
                    style={{
                      borderRadius: 22,
                      padding: 18,
                      border: "1px solid #fed7aa",
                      background:
                        "linear-gradient(180deg, rgba(255,247,237,0.95) 0%, rgba(254,215,170,0.45) 100%)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: 14,
                    }}
                  >
                    <div>
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
                          Egresos
                        </div>

                        {!isAbierta ? (
                          <span style={badgeStyle("gray")}>Sin caja</span>
                        ) : (
                          <span style={badgeStyle("red")}>Disponible</span>
                        )}
                      </div>

                      <div
                        style={{
                          color: "#475569",
                          fontSize: 14,
                          lineHeight: 1.7,
                        }}
                      >
                        Registra una salida de dinero desde un modal más limpio
                        y rápido.
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={abrirModalEgreso}
                      disabled={busy || loading || !isAbierta || !hasUbicacion}
                      style={{
                        ...dangerButtonStyle,
                        width: "100%",
                        opacity:
                          busy || loading || !isAbierta || !hasUbicacion
                            ? 0.6
                            : 1,
                        cursor:
                          busy || loading || !isAbierta || !hasUbicacion
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      {busy ? "Procesando..." : "Egresos"}
                    </button>

                    {!isAbierta ? (
                      <p style={hintStyle}>
                        Debe existir una caja abierta para registrar egresos.
                      </p>
                    ) : (
                      <p style={hintStyle}>
                        Presiona el botón para abrir el modal.
                      </p>
                    )}
                  </div>
                </div>
              </div>
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
                      Movimientos del día
                    </h2>
                    <p
                      style={{
                        margin: "6px 0 0",
                        color: "#64748b",
                        fontSize: 14,
                      }}
                    >
                      Ingresos y egresos registrados en la caja actual.
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
                    {loading
                      ? "Cargando…"
                      : `${movimientosActuales.length} movimiento(s)`}
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
                        <th style={thStyle}>Tipo</th>
                        <th style={thStyle}>Concepto</th>
                        <th style={thStyle}>Método</th>
                        <th style={thStyle}>Monto</th>
                        <th style={thStyle}>Referencia</th>
                        <th style={thStyle}>Fecha</th>
                      </tr>
                    </thead>

                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={7} style={emptyTdStyle}>
                            Cargando…
                          </td>
                        </tr>
                      ) : movimientosActuales.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={emptyTdStyle}>
                            Sin movimientos registrados.
                          </td>
                        </tr>
                      ) : (
                        movimientosActuales.map((m) => (
                          <tr key={m.id} style={{ borderTop: "1px solid #eef2f7" }}>
                            <td style={tdStyle}>{m.id}</td>
                            <td style={tdStyle}>
                              {m.tipo === "ingreso" ? (
                                <span style={badgeStyle("green")}>Ingreso</span>
                              ) : (
                                <span style={badgeStyle("red")}>Egreso</span>
                              )}
                            </td>
                            <td style={tdStyle}>{m.concepto || "—"}</td>
                            <td style={tdStyle}>{m.metodo_pago || "—"}</td>
                            <td style={tdStyle}>{money(m.monto)}</td>
                            <td style={tdStyle}>
                              {m.referencia_tipo
                                ? `${m.referencia_tipo} #${m.referencia_id ?? ""}`
                                : "—"}
                            </td>
                            <td style={tdStyle}>{formatDate(m.creado_en)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
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
                  gap: 16,
                  alignContent: "start",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
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
                      Dashboard de egresos
                    </h2>
                    <p
                      style={{
                        margin: "6px 0 0",
                        color: "#64748b",
                        fontSize: 14,
                      }}
                    >
                      Resumen rápido, ranking y PDF.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={exportarPdfEgresos}
                    disabled={loading || !hasUbicacion}
                    style={{
                      ...secondaryButtonStyle,
                      opacity: loading || !hasUbicacion ? 0.6 : 1,
                      cursor:
                        loading || !hasUbicacion ? "not-allowed" : "pointer",
                    }}
                  >
                    <FileText size={16} />
                    PDF egresos
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
                    icon={<BadgeDollarSign size={16} />}
                    title="Total egresado"
                    value={money(dashboardEgresos.total)}
                  />
                  <InfoPanel
                    icon={<ReceiptText size={16} />}
                    title="Cantidad"
                    value={String(dashboardEgresos.cantidad)}
                  />
                  <InfoPanel
                    icon={<Tags size={16} />}
                    title="Mayor egreso"
                    value={
                      dashboardEgresos.mayor
                        ? `${dashboardEgresos.mayor.tipo} · ${money(
                            dashboardEgresos.mayor.monto
                          )}`
                        : "—"
                    }
                  />
                  <InfoPanel
                    icon={<BarChart3 size={16} />}
                    title="Promedio"
                    value={
                      dashboardEgresos.cantidad > 0
                        ? money(
                            dashboardEgresos.total / dashboardEgresos.cantidad
                          )
                        : money(0)
                    }
                  />
                </div>

                <div
                  style={{
                    borderRadius: 22,
                    border: "1px solid #e2e8f0",
                    background:
                      "linear-gradient(180deg, rgba(248,250,252,0.95) 0%, rgba(241,245,249,0.95) 100%)",
                    padding: 18,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 800,
                      color: "#0f172a",
                      marginBottom: 12,
                    }}
                  >
                    Ranking por tipo
                  </div>

                  {dashboardEgresos.ranking.length === 0 ? (
                    <div style={{ color: "#64748b", fontSize: 14 }}>
                      No hay egresos para mostrar.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      {dashboardEgresos.ranking.slice(0, 8).map((item) => {
                        const porcentaje =
                          dashboardEgresos.total > 0
                            ? (item.monto / dashboardEgresos.total) * 100
                            : 0;

                        return (
                          <div key={item.tipo}>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 10,
                                marginBottom: 6,
                                fontSize: 14,
                                color: "#334155",
                              }}
                            >
                              <span>{item.tipo}</span>
                              <strong>{money(item.monto)}</strong>
                            </div>
                            <div
                              style={{
                                width: "100%",
                                height: 10,
                                background: "#e2e8f0",
                                borderRadius: 999,
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: `${Math.min(100, porcentaje)}%`,
                                  height: "100%",
                                  background:
                                    "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
                                  borderRadius: 999,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

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
                Últimas aperturas y cierres con filtro mensual.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 12px",
                  borderRadius: 14,
                  border: "1px solid #dbe2ea",
                  background: "#fff",
                }}
              >
                <CalendarRange size={16} color="#334155" />
                <input
                  type="month"
                  value={mesFiltro}
                  onChange={(e) => setMesFiltro(e.target.value)}
                  style={{
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    fontSize: 14,
                    color: "#0f172a",
                  }}
                />
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
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 14,
              marginBottom: 18,
            }}
          >
            <InfoPanel
              icon={<TrendingUp size={16} />}
              title="Ingresos del mes"
              value={money(resumenHistorialMes.ingresos)}
            />
            <InfoPanel
              icon={<TrendingDown size={16} />}
              title="Egresos del mes"
              value={money(resumenHistorialMes.egresos)}
            />
            <InfoPanel
              icon={<Wallet size={16} />}
              title="Aperturas del mes"
              value={money(resumenHistorialMes.inicial)}
            />
            <InfoPanel
              icon={<CircleDollarSign size={16} />}
              title="Cierres contados"
              value={money(resumenHistorialMes.final)}
            />
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
                minWidth: 1000,
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
                  <th style={thStyle}>Ingresos</th>
                  <th style={thStyle}>Egresos</th>
                  <th style={thStyle}>Esperado</th>
                  <th style={thStyle}>Final</th>
                  <th style={thStyle}>Estado</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} style={emptyTdStyle}>
                      Cargando…
                    </td>
                  </tr>
                ) : historial.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={emptyTdStyle}>
                      Sin registros.
                    </td>
                  </tr>
                ) : (
                  historial.map((c) => {
                    const abierta = !c.cerrado_en;
                    const nombreSucursalFila =
                      c?.ubicacion?.nombre ||
                      ubicacionesDisponibles.find(
                        (u) =>
                          Number(u.id) ===
                          Number(c?.ubicacion_id || c?.ubicacion?.id)
                      )?.nombre ||
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
                          <span style={pillStyle}>{money(c.total_ingresos)}</span>
                        </td>
                        <td style={tdStyle}>
                          <span style={pillStyle}>{money(c.total_egresos)}</span>
                        </td>
                        <td style={tdStyle}>
                          <span style={pillStyle}>{money(c.saldo_esperado)}</span>
                        </td>
                        <td style={tdStyle}>
                          {c.efectivo_final != null ? (
                            <span style={pillStyle}>{money(c.efectivo_final)}</span>
                          ) : (
                            "—"
                          )}
                        </td>
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

      {egresoModalOpen ? (
        <div
          onClick={cerrarModalEgreso}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.55)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 560,
              borderRadius: 28,
              background: "#ffffff",
              boxShadow: "0 30px 80px rgba(15,23,42,0.35)",
              border: "1px solid rgba(148,163,184,0.20)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "22px 24px 16px",
                background:
                  "linear-gradient(135deg, rgba(255,247,237,1) 0%, rgba(254,215,170,0.58) 100%)",
                borderBottom: "1px solid #fed7aa",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 900,
                    color: "#0f172a",
                    letterSpacing: "-0.03em",
                  }}
                >
                  Registrar egreso
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 14,
                    color: "#7c2d12",
                  }}
                >
                  Sucursal: {nombreSucursal}
                </div>
              </div>

              <button
                type="button"
                onClick={cerrarModalEgreso}
                disabled={busy}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  border: "1px solid #fdba74",
                  background: "#fff",
                  color: "#9a3412",
                  fontSize: 22,
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={registrarEgreso} style={{ padding: 24 }}>
              <div style={{ display: "grid", gap: 14 }}>
                <div>
                  <label style={labelStyle}>Tipo</label>
                  <select
                    value={egresoTipo}
                    onChange={(e) => setEgresoTipo(e.target.value)}
                    disabled={busy || loading || !isAbierta || !hasUbicacion}
                    style={selectStyle}
                  >
                    {TIPOS_EGRESO.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                {egresoTipo === "Otro" ? (
                  <div>
                    <label style={labelStyle}>Concepto personalizado</label>
                    <input
                      value={egresoConcepto}
                      onChange={(e) => setEgresoConcepto(e.target.value)}
                      placeholder="Escribe el concepto"
                      disabled={busy || loading || !isAbierta || !hasUbicacion}
                      style={inputStyle}
                    />
                  </div>
                ) : null}

                <div>
                  <label style={labelStyle}>Monto</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={egresoMonto}
                    onChange={(e) => setEgresoMonto(e.target.value)}
                    placeholder="0.00"
                    disabled={busy || loading || !isAbierta || !hasUbicacion}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Referencia</label>
                  <input
                    value={egresoReferencia}
                    onChange={(e) => setEgresoReferencia(e.target.value)}
                    placeholder="Factura, recibo, comprobante"
                    disabled={busy || loading || !isAbierta || !hasUbicacion}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Notas</label>
                  <input
                    value={egresoNotas}
                    onChange={(e) => setEgresoNotas(e.target.value)}
                    placeholder="Observación opcional"
                    disabled={busy || loading || !isAbierta || !hasUbicacion}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 12,
                  marginTop: 22,
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  onClick={cerrarModalEgreso}
                  disabled={busy}
                  style={{
                    ...secondaryButtonStyle,
                    height: 50,
                    minWidth: 120,
                    cursor: busy ? "not-allowed" : "pointer",
                  }}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={busy || loading || !isAbierta || !hasUbicacion}
                  style={{
                    ...dangerButtonStyle,
                    height: 50,
                    minWidth: 170,
                    opacity:
                      busy || loading || !isAbierta || !hasUbicacion ? 0.6 : 1,
                    cursor:
                      busy || loading || !isAbierta || !hasUbicacion
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {busy ? "Guardando..." : "Guardar egreso"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <style>
        {`
          @media (max-width: 1200px) {
            div[style*="grid-template-columns: repeat(6, 1fr)"] {
              grid-template-columns: 1fr 1fr 1fr !important;
            }

            div[style*="grid-template-columns: 1.05fr 0.95fr"] {
              grid-template-columns: 1fr !important;
            }

            div[style*="grid-template-columns: repeat(3, 1fr)"] {
              grid-template-columns: 1fr !important;
            }
          }

          @media (max-width: 860px) {
            div[style*="grid-template-columns: repeat(6, 1fr)"] {
              grid-template-columns: 1fr 1fr !important;
            }

            div[style*="grid-template-columns: repeat(2, 1fr)"] {
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

            div[style*="grid-template-columns: repeat(6, 1fr)"] {
              grid-template-columns: 1fr !important;
            }

            div[style*="grid-template-columns: repeat(4, 1fr)"] {
              grid-template-columns: 1fr !important;
            }
          }

          input:focus, select:focus {
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
          wordBreak: "break-word",
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

const selectStyle = {
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

const panelEmptyStyle = {
  borderRadius: 20,
  padding: 22,
  border: "1px dashed #cbd5e1",
  background: "#f8fafc",
  color: "#64748b",
  textAlign: "center",
};