import React, { useEffect, useMemo, useState } from "react";
import { getSession } from "../lib/auth";
import { ruteroApi } from "../lib/rutero";
import { usuariosApi } from "../lib/usuarios";

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

function normalizeRole(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  return [];
}

export default function HistorialRutero() {
  const session = getSession();
  const me = session?.user || {};
  const role = normalizeRole(me?.rol || me?.role || "");
  const isSuperAdmin = role === "super_admin" || role === "superadmin";

  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const [error, setError] = useState("");
  const [ruteros, setRuteros] = useState([]);
  const [ruteroId, setRuteroId] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [resumen, setResumen] = useState({
    total_entregas_cobradas: 0,
    total_dinero_recibido: 0,
    entregas_pendientes_cobro: 0,
  });

  async function cargarHistorial() {
    try {
      setError("");
      setLoading(true);

      const res = await ruteroApi.misEntregas({
        estado,
        ruteroId: isSuperAdmin ? ruteroId : "",
        fechaDesde,
        fechaHasta,
      });
      const lista = Array.isArray(res?.data) ? res.data : [];

      setPedidos(lista);
      setResumen({
        total_entregas_cobradas: Number(res?.resumen?.total_entregas_cobradas || 0),
        total_dinero_recibido: Number(res?.resumen?.total_dinero_recibido || 0),
        entregas_pendientes_cobro: Number(res?.resumen?.entregas_pendientes_cobro || 0),
      });

      if (lista.length > 0) {
        setSelectedId((prev) => {
          if (prev && lista.some((p) => p.id === prev)) return prev;
          return lista[0].id;
        });
      } else {
        setSelectedId(null);
      }
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Error al cargar historial");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarHistorial();
  }, [estado, ruteroId, fechaDesde, fechaHasta]);

  useEffect(() => {
    if (!isSuperAdmin) return;

    usuariosApi
      .list({ rol: "rutero", per_page: 100 })
      .then((res) => setRuteros(extractRows(res)))
      .catch(() => setRuteros([]));
  }, [isSuperAdmin]);

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

  useEffect(() => {
    if (!pedidosFiltrados.length) {
      setSelectedId(null);
      return;
    }

    if (!selectedId || !pedidosFiltrados.some((p) => p.id === selectedId)) {
      setSelectedId(pedidosFiltrados[0].id);
    }
  }, [pedidosFiltrados, selectedId]);

  const pedidoSeleccionado = useMemo(() => {
    return pedidos.find((p) => p.id === selectedId) || null;
  }, [pedidos, selectedId]);

  return (
    <>
      <style>{`
        .rutero-page {
          display: flex;
          flex-direction: column;
          gap: 24px;
          padding: 4px 2px 10px;
        }

        .rutero-hero {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 18px;
          padding: 28px;
          border-radius: 30px;
          background:
            radial-gradient(circle at top right, rgba(99, 102, 241, 0.18), transparent 28%),
            linear-gradient(135deg, #ffffff 0%, #f5f7ff 52%, #eef2ff 100%);
          border: 1px solid rgba(99, 102, 241, 0.12);
          box-shadow: 0 20px 55px rgba(15, 23, 42, 0.08);
        }

        .rutero-hero__left {
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-width: 0;
        }

        .rutero-hero__right {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          flex-wrap: wrap;
        }

        .rutero-chip {
          display: inline-flex;
          align-items: center;
          width: fit-content;
          padding: 8px 14px;
          border-radius: 999px;
          background: rgba(99, 102, 241, 0.1);
          color: #4f46e5;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .rutero-title {
          margin: 0;
          font-size: clamp(30px, 4vw, 42px);
          line-height: 1.05;
          font-weight: 900;
          color: #0f172a;
        }

        .rutero-subtitle {
          margin: 0;
          color: #64748b;
          font-size: 15px;
          line-height: 1.6;
          max-width: 760px;
        }

        .rutero-userbar {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 6px;
        }

        .rutero-userpill {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 12px 16px;
          min-width: 150px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.88);
          border: 1px solid rgba(148, 163, 184, 0.16);
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05);
          backdrop-filter: blur(8px);
        }

        .rutero-userpill__label {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #94a3b8;
        }

        .rutero-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(360px, 0.9fr);
          gap: 24px;
          align-items: start;
        }

        .rt-card--panel {
          padding: 22px;
          border-radius: 28px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
          border: 1px solid rgba(148, 163, 184, 0.14);
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06);
        }

        .rt-card-head {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 16px;
        }

        .rt-card-head--between {
          flex-direction: row;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
        }

        .rt-card-head h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 800;
          color: #0f172a;
        }

        .rt-card-subtext {
          margin: 0;
          color: #64748b;
          font-size: 14px;
        }

        .rt-counter {
          min-width: 110px;
          padding: 12px 14px;
          border-radius: 18px;
          background: linear-gradient(135deg, #eef2ff 0%, #f8fbff 100%);
          border: 1px solid rgba(99, 102, 241, 0.12);
          text-align: center;
        }

        .rt-counter strong {
          display: block;
          font-size: 22px;
          line-height: 1;
          color: #312e81;
        }

        .rt-counter span {
          display: block;
          margin-top: 4px;
          font-size: 12px;
          color: #64748b;
        }

        .rt-search-row {
          display: grid;
          grid-template-columns: 1fr 180px;
          gap: 12px;
          margin-bottom: 16px;
        }

        .rt-search-wrap {
          position: relative;
        }

        .rt-search-icon {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 16px;
          color: #94a3b8;
          pointer-events: none;
        }

        .rt-input,
        .rt-select {
          width: 100%;
          height: 52px;
          border: 1px solid rgba(148, 163, 184, 0.22);
          border-radius: 16px;
          background: #fff;
          font-size: 14px;
          color: #0f172a;
          outline: none;
          transition: all 0.2s ease;
          box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.03);
        }

        .rt-input {
          padding: 0 16px 0 44px;
        }

        .rt-select {
          padding: 0 14px;
        }

        .rt-input:focus,
        .rt-select:focus {
          border-color: rgba(99, 102, 241, 0.45);
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.10);
        }

        .rt-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
          max-height: 650px;
          overflow: auto;
          padding-right: 4px;
        }

        .rt-empty,
        .rt-empty-mini {
          padding: 26px 18px;
          border: 1px dashed rgba(148, 163, 184, 0.3);
          border-radius: 18px;
          text-align: center;
          color: #64748b;
          background: rgba(248, 250, 252, 0.85);
        }

        .rt-order-card {
          width: 100%;
          border: 1px solid rgba(148, 163, 184, 0.18);
          background: #fff;
          border-radius: 22px;
          padding: 18px;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .rt-order-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 34px rgba(15, 23, 42, 0.08);
          border-color: rgba(99, 102, 241, 0.18);
        }

        .rt-order-card.is-active {
          border-color: rgba(99, 102, 241, 0.35);
          background: linear-gradient(180deg, #ffffff 0%, #f6f7ff 100%);
          box-shadow: 0 18px 34px rgba(99, 102, 241, 0.12);
        }

        .rt-order-card__top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 14px;
        }

        .rt-order-card__id {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .rt-order-card__id h3 {
          margin: 0;
          color: #0f172a;
          font-size: 18px;
          font-weight: 800;
        }

        .rt-order-dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          box-shadow: 0 0 0 5px rgba(99, 102, 241, 0.10);
          flex-shrink: 0;
        }

        .rt-order-card__body {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 18px;
        }

        .rt-order-meta {
          flex: 1;
        }

        .rt-order-meta__row,
        .rt-order-meta__grid > div {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .rt-order-meta__row span,
        .rt-order-meta__grid span {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #94a3b8;
        }

        .rt-order-meta__row strong,
        .rt-order-meta__grid strong {
          color: #0f172a;
          font-size: 14px;
          font-weight: 700;
          line-height: 1.4;
        }

        .rt-order-meta__grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-top: 12px;
        }

        .rt-order-total {
          min-width: 110px;
          padding: 12px 14px;
          border-radius: 18px;
          background: #f8fafc;
          border: 1px solid rgba(148, 163, 184, 0.16);
          text-align: right;
          flex-shrink: 0;
        }

        .rt-order-total span {
          display: block;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #94a3b8;
          margin-bottom: 4px;
        }

        .rt-order-total strong {
          font-size: 18px;
          color: #0f172a;
        }

        .rt-detail {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .rt-detail-hero {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          padding: 18px;
          border-radius: 24px;
          background:
            radial-gradient(circle at top right, rgba(99, 102, 241, 0.12), transparent 34%),
            linear-gradient(135deg, #f8fbff 0%, #eef2ff 100%);
          border: 1px solid rgba(99, 102, 241, 0.12);
        }

        .rt-detail-hero__eyebrow {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #6366f1;
          margin-bottom: 6px;
        }

        .rt-detail-hero h3 {
          margin: 0 0 6px;
          font-size: 26px;
          line-height: 1.1;
          color: #0f172a;
        }

        .rt-detail-hero p {
          margin: 0;
          color: #475569;
          font-size: 14px;
        }

        .rt-info-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .rt-info-box {
          padding: 16px;
          border-radius: 20px;
          background: #fff;
          border: 1px solid rgba(148, 163, 184, 0.18);
          box-shadow: 0 10px 26px rgba(15, 23, 42, 0.04);
        }

        .rt-info-box--full {
          grid-column: 1 / -1;
        }

        .rt-info-box span {
          display: block;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #94a3b8;
          margin-bottom: 6px;
        }

        .rt-info-box strong {
          display: block;
          color: #0f172a;
          font-size: 15px;
          line-height: 1.45;
        }

        .rt-box--soft {
          padding: 18px;
          border-radius: 22px;
          background: #fff;
          border: 1px solid rgba(148, 163, 184, 0.16);
          box-shadow: 0 12px 26px rgba(15, 23, 42, 0.04);
        }

        .rt-box__head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .rt-box__head label {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #64748b;
        }

        .rt-box__head span {
          font-size: 13px;
          color: #64748b;
        }

        .rt-note {
          min-height: 62px;
          padding: 14px 16px;
          border-radius: 16px;
          background: #f8fafc;
          border: 1px solid rgba(148, 163, 184, 0.16);
          color: #334155;
          line-height: 1.55;
        }

        .rt-items {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .rt-item-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 14px 2px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.12);
        }

        .rt-item-row:last-child {
          border-bottom: 0;
          padding-bottom: 0;
        }

        .rt-item-row__left {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
          flex: 1;
        }

        .rt-item-avatar {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          font-weight: 800;
          color: #4338ca;
          background: linear-gradient(135deg, #e0e7ff 0%, #ede9fe 100%);
          border: 1px solid rgba(99, 102, 241, 0.12);
          flex-shrink: 0;
        }

        .rt-item-row strong {
          display: block;
          color: #0f172a;
          line-height: 1.35;
        }

        .rt-item-row p {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 13px;
        }

        .rt-item-price {
          font-weight: 800;
          color: #0f172a;
          white-space: nowrap;
        }

        .rt-total--modern {
          padding: 18px 20px;
          border-radius: 22px;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          color: #fff;
          box-shadow: 0 18px 36px rgba(15, 23, 42, 0.18);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
        }

        .rt-total--modern span {
          display: block;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.75);
        }

        .rt-total--modern small {
          display: block;
          margin-top: 4px;
          color: rgba(255, 255, 255, 0.62);
          font-size: 12px;
        }

        .rt-total--modern strong {
          font-size: 28px;
          line-height: 1;
          white-space: nowrap;
        }

        .rt-btn {
          border: 0;
          outline: none;
          cursor: pointer;
          transition: all 0.2s ease;
          font-weight: 800;
        }

        .rt-btn--dark {
          height: 48px;
          padding: 0 20px;
          border-radius: 16px;
          color: #fff;
          background: linear-gradient(135deg, #0f172a 0%, #334155 100%);
          box-shadow: 0 14px 28px rgba(15, 23, 42, 0.18);
        }

        .rt-btn--dark:hover {
          transform: translateY(-2px);
        }

        .rt-alert {
          padding: 16px 18px;
          border-radius: 18px;
          border: 1px solid rgba(239, 68, 68, 0.16);
          background: linear-gradient(135deg, #fff1f2 0%, #fff7f7 100%);
          color: #b91c1c;
          font-weight: 600;
        }

        .rt-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 34px;
          padding: 8px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.03em;
          text-transform: capitalize;
          background: #e2e8f0;
          color: #334155;
          white-space: nowrap;
        }

        .rt-badge--success {
          background: #dcfce7;
          color: #166534;
        }

        .rt-badge--info {
          background: #dbeafe;
          color: #1d4ed8;
        }

        .rt-badge--warning {
          background: #fef3c7;
          color: #b45309;
        }

        .rt-badge--purple {
          background: #ede9fe;
          color: #6d28d9;
        }

        @media (max-width: 1180px) {
          .rutero-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .rutero-hero {
            padding: 20px;
            border-radius: 24px;
            flex-direction: column;
          }

          .rutero-hero__right {
            width: 100%;
          }

          .rt-btn--dark {
            width: 100%;
          }

          .rt-card--panel {
            padding: 18px;
            border-radius: 22px;
          }

          .rt-card-head--between {
            flex-direction: column;
            align-items: stretch;
          }

          .rt-counter {
            width: 100%;
          }

          .rt-search-row {
            grid-template-columns: 1fr;
          }

          .rt-order-card__body {
            flex-direction: column;
            align-items: stretch;
          }

          .rt-order-total {
            width: 100%;
            text-align: left;
          }

          .rt-detail-hero {
            flex-direction: column;
          }

          .rt-info-grid {
            grid-template-columns: 1fr;
          }

          .rt-info-box--full {
            grid-column: auto;
          }

          .rt-item-row {
            flex-direction: column;
            align-items: stretch;
          }

          .rt-item-price {
            text-align: right;
          }

          .rt-total--modern {
            flex-direction: column;
            align-items: flex-start;
          }

          .rt-total--modern strong {
            font-size: 24px;
          }
        }
      `}</style>

      <div className="rutero-page">
        <div className="rutero-hero">
          <div className="rutero-hero__left">
            <div className="rutero-chip">Historial rutero</div>
            <h1 className="rutero-title">
              {isSuperAdmin ? "Control de entregas de ruteros" : "Historial de entregas"}
            </h1>
            <p className="rutero-subtitle">
              {isSuperAdmin
                ? "Revisa el dinero recibido, entregas cobradas y pendientes de los ruteros."
                : "Consulta tus entregas, el dinero recibido y el detalle necesario para cuadrar cobros."}
            </p>

            <div className="rutero-userbar">
              <div className="rutero-userpill">
                <span className="rutero-userpill__label">Sesión</span>
                <strong>{me?.nombre || me?.usuario || "Rutero"}</strong>
              </div>

              {me?.ubicacion_id ? (
                <div className="rutero-userpill">
                  <span className="rutero-userpill__label">Sucursal</span>
                  <strong>#{me.ubicacion_id}</strong>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rutero-hero__right">
            {isSuperAdmin ? (
              <select
                className="rt-select"
                value={ruteroId}
                onChange={(e) => setRuteroId(e.target.value)}
              >
                <option value="">Todos los ruteros</option>
                {ruteros.map((rutero) => (
                  <option key={rutero.id} value={rutero.id}>
                    {rutero.nombre || rutero.usuario || `Rutero #${rutero.id}`}
                  </option>
                ))}
              </select>
            ) : null}

            <input
              className="rt-select"
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              title="Fecha desde"
            />

            <input
              className="rt-select"
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              title="Fecha hasta"
            />

            <select
              className="rt-select"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="entregado">Entregado</option>
              <option value="en_ruta">En ruta</option>
            </select>

            <button className="rt-btn rt-btn--dark" onClick={cargarHistorial}>
              Actualizar
            </button>
          </div>
        </div>

        {error ? <div className="rt-alert">{error}</div> : null}

        <div className="rt-info-grid">
          <div className="rt-info-box">
            <span>Total de entregas cobradas</span>
            <strong>{resumen.total_entregas_cobradas}</strong>
          </div>
          <div className="rt-info-box">
            <span>Total de dinero recibido</span>
            <strong>{money(resumen.total_dinero_recibido)}</strong>
          </div>
          <div className="rt-info-box">
            <span>Entregas pendientes de cobro</span>
            <strong>{resumen.entregas_pendientes_cobro}</strong>
          </div>
        </div>

        <div className="rutero-grid">
          <section className="rt-card--panel">
            <div className="rt-card-head rt-card-head--between">
              <div>
                <h2>{isSuperAdmin ? "Entregas de ruteros" : "Mis entregas"}</h2>
                <p className="rt-card-subtext">
                  Busca por cliente, código, ruta o zona.
                </p>
              </div>

              <div className="rt-counter">
                <strong>{pedidosFiltrados.length}</strong>
                <span>registro(s)</span>
              </div>
            </div>

            <div className="rt-search-row">
              <div className="rt-search-wrap">
                <span className="rt-search-icon">⌕</span>
                <input
                  className="rt-input"
                  type="text"
                  placeholder="Buscar por cliente, código, ruta o zona..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>

              <select
                className="rt-select"
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
              >
                <option value="">Todos los estados</option>
                <option value="entregado">Entregado</option>
                <option value="en_ruta">En ruta</option>
              </select>
            </div>

            <div className="rt-list">
              {loading ? (
                <div className="rt-empty">Cargando historial...</div>
              ) : pedidosFiltrados.length === 0 ? (
                <div className="rt-empty">No hay registros en tu historial.</div>
              ) : (
                pedidosFiltrados.map((pedido) => (
                  <button
                    key={pedido.id}
                    type="button"
                    className={`rt-order-card ${selectedId === pedido.id ? "is-active" : ""}`}
                    onClick={() => setSelectedId(pedido.id)}
                  >
                    <div className="rt-order-card__top">
                      <div className="rt-order-card__id">
                        <span className="rt-order-dot"></span>
                        <h3>Pedido #{pedido.id}</h3>
                      </div>

                      <span className={estadoClase(pedido.estado)}>
                        {pedido.estado || "—"}
                      </span>
                    </div>

                    <div className="rt-order-card__body">
                      <div className="rt-order-meta">
                        <div className="rt-order-meta__row">
                          <span>Cliente</span>
                          <strong>{pedido?.cliente_nombre || "Consumidor final"}</strong>
                        </div>

                        <div className="rt-order-meta__grid">
                          <div>
                            <span>Ruta</span>
                            <strong>{pedido?.ruta_nombre || "Sin ruta"}</strong>
                          </div>
                          <div>
                            <span>Fecha entrega</span>
                            <strong>{fmtDate(pedido?.entregado_en || pedido?.creado_en)}</strong>
                          </div>
                          <div>
                            <span>Cobro</span>
                            <strong>
                              {pedido?.cobro?.registrado
                                ? `${money(pedido.cobro.monto)} · ${pedido.cobro.metodo_pago || "registrado"}`
                                : "Pendiente"}
                            </strong>
                          </div>
                          {isSuperAdmin ? (
                            <div>
                              <span>Rutero</span>
                              <strong>{pedido?.rutero_nombre || "—"}</strong>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="rt-order-total">
                        <span>Total</span>
                        <strong>{money(pedido.total)}</strong>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <aside className="rt-card--panel">
            <div className="rt-card-head">
              <div>
                <h2>Detalle de la entrega</h2>
                <p className="rt-card-subtext">
                  Visualiza toda la información del pedido seleccionado.
                </p>
              </div>
            </div>

            {!pedidoSeleccionado ? (
              <div className="rt-empty">Selecciona una entrega para ver el detalle.</div>
            ) : (
              <div className="rt-detail">
                <div className="rt-detail-hero">
                  <div>
                    <div className="rt-detail-hero__eyebrow">Entrega seleccionada</div>
                    <h3>Pedido #{pedidoSeleccionado.id}</h3>
                    <p>
                      Cliente: <strong>{pedidoSeleccionado?.cliente_nombre || "Consumidor final"}</strong>
                    </p>
                  </div>

                  <span className={estadoClase(pedidoSeleccionado.estado)}>
                    {pedidoSeleccionado.estado || "—"}
                  </span>
                </div>

                <div className="rt-info-grid">
                  <div className="rt-info-box">
                    <span>Vendedor</span>
                    <strong>{pedidoSeleccionado?.vendedor_nombre || "—"}</strong>
                  </div>

                  <div className="rt-info-box">
                    <span>Ruta</span>
                    <strong>{pedidoSeleccionado?.ruta_nombre || "—"}</strong>
                  </div>

                  <div className="rt-info-box">
                    <span>Zona</span>
                    <strong>{pedidoSeleccionado?.zona_nombre || "—"}</strong>
                  </div>

                  <div className="rt-info-box">
                    <span>Sucursal</span>
                    <strong>{pedidoSeleccionado?.ubicacion_nombre || pedidoSeleccionado?.ubicacion_id || "—"}</strong>
                  </div>

                  <div className="rt-info-box">
                    <span>Rutero</span>
                    <strong>{pedidoSeleccionado?.rutero_nombre || me?.nombre || me?.usuario || "—"}</strong>
                  </div>

                  <div className="rt-info-box">
                    <span>Estado del cobro</span>
                    <strong>
                      {pedidoSeleccionado?.cobro?.registrado
                        ? "Cobrado"
                        : "Pendiente de cobro"}
                    </strong>
                  </div>

                  <div className="rt-info-box">
                    <span>Dinero recibido</span>
                    <strong>
                      {pedidoSeleccionado?.cobro?.registrado
                        ? money(pedidoSeleccionado.cobro.monto)
                        : money(0)}
                    </strong>
                  </div>

                  <div className="rt-info-box">
                    <span>Método de pago</span>
                    <strong>{pedidoSeleccionado?.cobro?.metodo_pago || "—"}</strong>
                  </div>

                  <div className="rt-info-box rt-info-box--full">
                    <span>Fecha de entrega</span>
                    <strong>{fmtDate(pedidoSeleccionado?.entregado_en || pedidoSeleccionado?.creado_en)}</strong>
                  </div>
                </div>

                <div className="rt-box--soft">
                  <div className="rt-box__head">
                    <label>Observaciones</label>
                  </div>
                  <div className="rt-note">
                    {pedidoSeleccionado?.observaciones?.trim() || "Sin observaciones"}
                  </div>
                </div>

                <div className="rt-box--soft">
                  <div className="rt-box__head">
                    <label>Productos</label>
                    <span>{(pedidoSeleccionado?.detalles || []).length} item(s)</span>
                  </div>

                  <div className="rt-items">
                    {(pedidoSeleccionado?.detalles || []).length === 0 ? (
                      <div className="rt-empty-mini">Esta entrega no tiene detalle.</div>
                    ) : (
                      pedidoSeleccionado.detalles.map((item, index) => (
                        <div className="rt-item-row" key={item.id || index}>
                          <div className="rt-item-row__left">
                            <div className="rt-item-avatar">
                              {(item?.producto_nombre || "P").charAt(0).toUpperCase()}
                            </div>

                            <div>
                              <strong>{item?.producto_nombre || "Producto"}</strong>
                              <p>
                                Cantidad: {item?.cantidad || 0} {item?.presentacion || ""}
                              </p>
                            </div>
                          </div>

                          <div className="rt-item-price">
                            {money(item?.subtotal || 0)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rt-total--modern">
                  <div>
                    <span>Total del pedido</span>
                    <small>Incluye todos los productos del detalle</small>
                  </div>
                  <strong>{money(pedidoSeleccionado.total)}</strong>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}