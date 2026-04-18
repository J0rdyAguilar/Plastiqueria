import React, { useEffect, useMemo, useState } from "react";
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

function getMetodoPagoLabel(value) {
  if (value === "tarjeta") return "Tarjeta";
  if (value === "cuotas") return "Crédito";
  return "Efectivo";
}

function normalizeText(v) {
  return String(v || "").trim().toLowerCase();
}

function extractApiMessage(errorOrResponse) {
  return (
    errorOrResponse?.response?.data?.message ||
    errorOrResponse?.response?.data?.error ||
    errorOrResponse?.data?.message ||
    errorOrResponse?.data?.error ||
    errorOrResponse?.message ||
    ""
  );
}

function responseIndicatesFailure(res) {
  const msg = normalizeText(extractApiMessage(res));

  if (res?.ok === false) return true;
  if (res?.success === false) return true;
  if (res?.status === "error") return true;
  if (res?.data?.success === false) return true;
  if (res?.data?.ok === false) return true;
  if (res?.data?.status === "error") return true;

  if (
    msg.includes("no hay caja abierta") ||
    msg.includes("caja no abierta") ||
    msg.includes("caja cerrada") ||
    msg.includes("debe abrir una caja") ||
    msg.includes("debes abrir una caja") ||
    msg.includes("no existe una caja abierta") ||
    msg.includes("no tiene caja abierta") ||
    msg.includes("sin caja abierta")
  ) {
    return true;
  }

  return false;
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

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pedidoPendiente, setPedidoPendiente] = useState(null);

  const [metodoPago, setMetodoPago] = useState("efectivo");
  const [nombrePagador, setNombrePagador] = useState("");
  const [referenciaPago, setReferenciaPago] = useState("");
  const [observacionEntrega, setObservacionEntrega] = useState("");

  const [toast, setToast] = useState({
    open: false,
    type: "error",
    title: "",
    message: "",
  });

  function showToast({
    type = "error",
    title = "",
    message = "",
  }) {
    setToast({
      open: true,
      type,
      title,
      message,
    });

    window.clearTimeout(window.__ruteroToastTimer);
    window.__ruteroToastTimer = window.setTimeout(() => {
      setToast((prev) => ({ ...prev, open: false }));
    }, 4200);
  }

  function closeToast() {
    setToast((prev) => ({ ...prev, open: false }));
  }

  async function cargarPedidos() {
    try {
      setError("");
      setLoading(true);

      const res = await ruteroApi.misPedidos({ soloActivos: true });
      const lista = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];

      setPedidos(lista);

      if (lista.length > 0) {
        setSelectedId((prev) => {
          if (prev && lista.some((p) => p.id === prev)) return prev;
          return lista[0].id;
        });
      } else {
        setSelectedId(null);
      }
    } catch (e) {
      setError(extractApiMessage(e) || "Error al cargar pedidos");
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

  useEffect(() => {
    if (!pedidoSeleccionado) return;

    setNombrePagador(
      pedidoSeleccionado?.cliente_nombre ||
        pedidoSeleccionado?.nombre_comprador ||
        ""
    );
    setMetodoPago("efectivo");
    setReferenciaPago("");
    setObservacionEntrega("");
  }, [pedidoSeleccionado?.id]);

  function handleEntregado() {
    if (!pedidoSeleccionado || saving) return;

    if (!metodoPago) {
      showToast({
        type: "warning",
        title: "Método de pago requerido",
        message: "Selecciona un método de pago para continuar.",
      });
      return;
    }

    if (!nombrePagador.trim()) {
      showToast({
        type: "warning",
        title: "Nombre requerido",
        message: "Ingresa el nombre de quien paga.",
      });
      return;
    }

    if (metodoPago === "cuotas" && !pedidoSeleccionado?.cliente_id) {
      showToast({
        type: "warning",
        title: "Cliente requerido",
        message: "Este pedido necesita cliente para entregarse a crédito.",
      });
      return;
    }

    setPedidoPendiente(pedidoSeleccionado);
    setConfirmOpen(true);
  }

  async function confirmarEntregado() {
    if (!pedidoPendiente || saving) return;

    try {
      setSaving(true);

      const res = await ruteroApi.entregar(pedidoPendiente.id, {
        metodo_pago: metodoPago,
        nombre_pagador: nombrePagador.trim(),
        referencia_pago: referenciaPago.trim() || null,
        observacion_entrega: observacionEntrega.trim() || null,
        cliente_id: pedidoPendiente?.cliente_id || null,
      });

      if (responseIndicatesFailure(res)) {
        throw new Error(extractApiMessage(res) || "No se pudo marcar como entregado");
      }

      const activos = pedidos.filter((p) => p.id !== pedidoPendiente.id);
      setPedidos(activos);
      setSelectedId(activos[0]?.id ?? null);

      setConfirmOpen(false);
      setPedidoPendiente(null);
      setMetodoPago("efectivo");
      setNombrePagador("");
      setReferenciaPago("");
      setObservacionEntrega("");

      showToast({
        type: "success",
        title: "Entrega realizada",
        message: "El pedido fue cobrado y marcado como entregado correctamente.",
      });
    } catch (e) {
      const msg = extractApiMessage(e) || "No se pudo marcar como entregado";
      const msgNorm = normalizeText(msg);

      showToast({
        type: "error",
        title: msgNorm.includes("caja")
          ? "Caja no disponible"
          : "No se pudo completar la entrega",
        message: msgNorm.includes("caja")
          ? "No hay una caja abierta en la sucursal de este pedido. Abre la caja para poder entregar."
          : msg,
      });
    } finally {
      setSaving(false);
    }
  }

  function cancelarConfirmacion() {
    if (saving) return;
    setConfirmOpen(false);
    setPedidoPendiente(null);
  }

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
          flex-shrink: 0;
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

        .rt-card {
          background: #fff;
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

        .rt-search-wrap {
          margin-bottom: 16px;
        }

        .rt-search-wrap--icon {
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

        .rt-input {
          width: 100%;
          height: 52px;
          border: 1px solid rgba(148, 163, 184, 0.22);
          border-radius: 16px;
          background: #fff;
          padding: 0 16px;
          font-size: 14px;
          color: #0f172a;
          outline: none;
          transition: all 0.2s ease;
          box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.03);
        }

        .rt-input--search {
          padding-left: 44px;
        }

        .rt-input:focus,
        .rt-textarea:focus {
          border-color: rgba(99, 102, 241, 0.45);
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.10);
        }

        .rt-textarea {
          width: 100%;
          min-height: 84px;
          border: 1px solid rgba(148, 163, 184, 0.22);
          border-radius: 16px;
          background: #fff;
          padding: 12px 14px;
          font-size: 14px;
          color: #0f172a;
          outline: none;
          resize: vertical;
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
          padding: 16px;
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
          min-width: 0;
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
          min-width: 0;
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
          word-break: break-word;
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
          word-break: break-word;
        }

        .rt-box {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .rt-box--soft {
          padding: 18px;
          border-radius: 22px;
          background: #fff;
          border: 1px solid rgba(148, 163, 184, 0.16);
          box-shadow: 0 12px 26px rgba(15, 23, 42, 0.04);
        }

        .rt-box label {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #64748b;
        }

        .rt-box__head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
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
          padding: 14px 0;
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
          flex-shrink: 0;
        }

        .rt-total {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
        }

        .rt-total--modern {
          padding: 18px 20px;
          border-radius: 22px;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          color: #fff;
          box-shadow: 0 18px 36px rgba(15, 23, 42, 0.18);
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

        .rt-pay-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 12px;
        }

        .rt-pay-btn {
          height: 46px;
          border-radius: 14px;
          border: 1px solid #dbe2ea;
          background: #f8fafc;
          color: #0f172a;
          font-weight: 800;
          cursor: pointer;
        }

        .rt-pay-btn.is-active {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: #fff;
          border: 1px solid #2563eb;
          box-shadow: 0 10px 20px rgba(37,99,235,0.20);
        }

        .rt-btn {
          border: 0;
          outline: none;
          cursor: pointer;
          transition: all 0.2s ease;
          font-weight: 800;
        }

        .rt-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
          transform: none !important;
        }

        .rt-btn--dark {
          height: 48px;
          padding: 0 20px;
          border-radius: 16px;
          color: #fff;
          background: linear-gradient(135deg, #0f172a 0%, #334155 100%);
          box-shadow: 0 14px 28px rgba(15, 23, 42, 0.18);
        }

        .rt-btn--success {
          height: 54px;
          padding: 0 20px;
          border-radius: 18px;
          color: #fff;
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
          box-shadow: 0 16px 28px rgba(34, 197, 94, 0.24);
        }

        .rt-btn--full {
          width: 100%;
        }

        .rt-btn--ghost {
          height: 50px;
          padding: 0 20px;
          border-radius: 16px;
          background: #ffffff;
          color: #0f172a;
          border: 1px solid rgba(148, 163, 184, 0.2);
        }

        .rt-btn--danger {
          height: 50px;
          padding: 0 22px;
          border-radius: 16px;
          color: #fff;
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
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

        .rt-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 9999;
        }

        .rt-modal {
          width: 100%;
          max-width: 560px;
          border-radius: 28px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
          border: 1px solid rgba(148, 163, 184, 0.18);
          box-shadow: 0 30px 70px rgba(15, 23, 42, 0.28);
          overflow: hidden;
        }

        .rt-modal__top {
          padding: 22px 24px 12px;
        }

        .rt-modal__chip {
          display: inline-flex;
          align-items: center;
          padding: 8px 14px;
          border-radius: 999px;
          background: rgba(99, 102, 241, 0.1);
          color: #4f46e5;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .rt-modal__title {
          margin: 14px 0 8px;
          font-size: 28px;
          line-height: 1.05;
          font-weight: 900;
          color: #0f172a;
        }

        .rt-modal__text {
          margin: 0;
          color: #475569;
          font-size: 15px;
          line-height: 1.6;
        }

        .rt-modal__pedido {
          margin: 18px 24px 0;
          padding: 16px 18px;
          border-radius: 20px;
          background: linear-gradient(135deg, #eef2ff 0%, #f8fbff 100%);
          border: 1px solid rgba(99, 102, 241, 0.14);
        }

        .rt-modal__pedido strong {
          display: block;
          color: #0f172a;
          font-size: 18px;
          margin-bottom: 4px;
        }

        .rt-modal__pedido span {
          color: #64748b;
          font-size: 14px;
        }

        .rt-modal__actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          padding: 22px 24px 24px;
        }

        .rt-toast-wrap {
          position: fixed;
          top: 22px;
          right: 22px;
          z-index: 10050;
          display: flex;
          flex-direction: column;
          gap: 12px;
          pointer-events: none;
        }

        .rt-toast {
          width: min(420px, calc(100vw - 24px));
          border-radius: 22px;
          padding: 16px 18px;
          box-shadow: 0 24px 50px rgba(15, 23, 42, 0.22);
          border: 1px solid rgba(255,255,255,0.3);
          backdrop-filter: blur(12px);
          pointer-events: auto;
          animation: rtToastIn 0.22s ease;
        }

        .rt-toast--error {
          background: linear-gradient(135deg, rgba(127, 29, 29, 0.96) 0%, rgba(185, 28, 28, 0.95) 100%);
          color: #fff;
        }

        .rt-toast--success {
          background: linear-gradient(135deg, rgba(21, 128, 61, 0.96) 0%, rgba(22, 163, 74, 0.95) 100%);
          color: #fff;
        }

        .rt-toast--warning {
          background: linear-gradient(135deg, rgba(180, 83, 9, 0.96) 0%, rgba(217, 119, 6, 0.95) 100%);
          color: #fff;
        }

        .rt-toast__top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .rt-toast__left {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          min-width: 0;
        }

        .rt-toast__icon {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          font-size: 18px;
          font-weight: 900;
          background: rgba(255,255,255,0.16);
          flex-shrink: 0;
        }

        .rt-toast__content {
          min-width: 0;
        }

        .rt-toast__title {
          margin: 0;
          font-size: 15px;
          font-weight: 900;
          line-height: 1.2;
        }

        .rt-toast__message {
          margin: 6px 0 0;
          font-size: 13px;
          line-height: 1.5;
          color: rgba(255,255,255,0.92);
        }

        .rt-toast__close {
          border: 0;
          background: transparent;
          color: #fff;
          cursor: pointer;
          font-size: 20px;
          line-height: 1;
          opacity: 0.85;
        }

        .rt-toast__close:hover {
          opacity: 1;
        }

        .rt-toast__bar {
          margin-top: 12px;
          height: 4px;
          border-radius: 999px;
          background: rgba(255,255,255,0.22);
          overflow: hidden;
        }

        .rt-toast__bar::after {
          content: "";
          display: block;
          height: 100%;
          width: 100%;
          background: rgba(255,255,255,0.92);
          transform-origin: left center;
          animation: rtToastBar 4.2s linear forwards;
        }

        @keyframes rtToastIn {
          from {
            opacity: 0;
            transform: translateY(-10px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes rtToastBar {
          from {
            transform: scaleX(1);
          }
          to {
            transform: scaleX(0);
          }
        }

        @media (max-width: 1180px) {
          .rutero-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .rt-pay-grid {
            grid-template-columns: 1fr;
          }

          .rt-order-card__body,
          .rt-total--modern,
          .rt-detail-hero,
          .rt-item-row {
            flex-direction: column;
            align-items: stretch;
          }

          .rt-info-grid {
            grid-template-columns: 1fr;
          }

          .rt-toast-wrap {
            top: 14px;
            right: 12px;
            left: 12px;
          }

          .rt-toast {
            width: 100%;
          }
        }
      `}</style>

      {toast.open ? (
        <div className="rt-toast-wrap">
          <div className={`rt-toast rt-toast--${toast.type}`}>
            <div className="rt-toast__top">
              <div className="rt-toast__left">
                <div className="rt-toast__icon">
                  {toast.type === "success" ? "✓" : toast.type === "warning" ? "!" : "✕"}
                </div>

                <div className="rt-toast__content">
                  <h4 className="rt-toast__title">{toast.title}</h4>
                  <p className="rt-toast__message">{toast.message}</p>
                </div>
              </div>

              <button
                type="button"
                className="rt-toast__close"
                onClick={closeToast}
              >
                ×
              </button>
            </div>

            <div className="rt-toast__bar"></div>
          </div>
        </div>
      ) : null}

      <div className="rutero-page">
        <div className="rutero-hero">
          <div className="rutero-hero__left">
            <div className="rutero-chip">Panel rutero</div>
            <h1 className="rutero-title">Pedidos para entrega</h1>
            <p className="rutero-subtitle">
              Gestiona tus pedidos asignados, revisa sus detalles y cobra con efectivo, tarjeta o crédito.
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
            <button
              className="rt-btn rt-btn--dark"
              onClick={cargarPedidos}
              disabled={loading}
            >
              {loading ? "Cargando..." : "Actualizar"}
            </button>
          </div>
        </div>

        {error ? <div className="rt-alert">{error}</div> : null}

        <div className="rutero-grid">
          <section className="rt-card rt-card--panel">
            <div className="rt-card-head rt-card-head--between">
              <div>
                <h2>Mis pedidos asignados</h2>
                <p className="rt-card-subtext">
                  Revisa los pedidos activos pendientes por entregar.
                </p>
              </div>

              <div className="rt-counter">
                <strong>{pedidosFiltrados.length}</strong>
                <span>pedido(s)</span>
              </div>
            </div>

            <div className="rt-search-wrap rt-search-wrap--icon">
              <span className="rt-search-icon">⌕</span>
              <input
                className="rt-input rt-input--search"
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
                            <span>Zona</span>
                            <strong>{pedido?.zona_nombre || "Sin zona"}</strong>
                          </div>
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

          <aside className="rt-card rt-card--panel">
            <div className="rt-card-head">
              <div>
                <h2>Detalle del pedido</h2>
                <p className="rt-card-subtext">
                  Visualiza la información del pedido y cobra al momento de entregar.
                </p>
              </div>
            </div>

            {!pedidoSeleccionado ? (
              <div className="rt-empty">Selecciona un pedido para ver el detalle.</div>
            ) : (
              <div className="rt-detail">
                <div className="rt-detail-hero">
                  <div>
                    <div className="rt-detail-hero__eyebrow">Pedido seleccionado</div>
                    <h3>Pedido #{pedidoSeleccionado.id}</h3>
                    <p>
                      Cliente: <strong>{pedidoSeleccionado?.cliente_nombre || "Consumidor final"}</strong>
                    </p>
                  </div>

                  <div>
                    <span className={estadoClase(pedidoSeleccionado.estado)}>
                      {pedidoSeleccionado.estado || "—"}
                    </span>
                  </div>
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
                    <strong>
                      {pedidoSeleccionado?.ubicacion_nombre ||
                        pedidoSeleccionado?.ubicacion_id ||
                        "—"}
                    </strong>
                  </div>

                  <div className="rt-info-box rt-info-box--full">
                    <span>Fecha del pedido</span>
                    <strong>{fmtDate(pedidoSeleccionado?.creado_en)}</strong>
                  </div>
                </div>

                <div className="rt-box rt-box--soft">
                  <label>Observaciones</label>
                  <div className="rt-note">
                    {pedidoSeleccionado?.observaciones?.trim() || "Sin observaciones"}
                  </div>
                </div>

                <div className="rt-box rt-box--soft">
                  <div className="rt-box__head">
                    <label>Productos</label>
                    <span>{(pedidoSeleccionado?.detalles || []).length} item(s)</span>
                  </div>

                  <div className="rt-items">
                    {(pedidoSeleccionado?.detalles || []).length === 0 ? (
                      <div className="rt-empty-mini">Este pedido no tiene detalle.</div>
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

                <div className="rt-box rt-box--soft">
                  <label>Método de pago</label>
                  <div className="rt-pay-grid">
                    <button
                      type="button"
                      className={`rt-pay-btn ${metodoPago === "efectivo" ? "is-active" : ""}`}
                      onClick={() => setMetodoPago("efectivo")}
                    >
                      Efectivo
                    </button>

                    <button
                      type="button"
                      className={`rt-pay-btn ${metodoPago === "tarjeta" ? "is-active" : ""}`}
                      onClick={() => setMetodoPago("tarjeta")}
                    >
                      Tarjeta
                    </button>

                    <button
                      type="button"
                      className={`rt-pay-btn ${metodoPago === "cuotas" ? "is-active" : ""}`}
                      onClick={() => setMetodoPago("cuotas")}
                    >
                      Crédito
                    </button>
                  </div>
                </div>

                <div className="rt-box rt-box--soft">
                  <label>Nombre de quien paga</label>
                  <input
                    className="rt-input"
                    type="text"
                    value={nombrePagador}
                    onChange={(e) => setNombrePagador(e.target.value)}
                    placeholder="Ej. Tienda La Bendición"
                  />
                </div>

                <div className="rt-box rt-box--soft">
                  <label>
                    {metodoPago === "cuotas" ? "Referencia de crédito" : "Referencia de pago"}
                  </label>
                  <input
                    className="rt-input"
                    type="text"
                    value={referenciaPago}
                    onChange={(e) => setReferenciaPago(e.target.value)}
                    placeholder={
                      metodoPago === "cuotas"
                        ? "Ej. libreta / acuerdo"
                        : metodoPago === "tarjeta"
                        ? "Ej. voucher / últimos 4"
                        : "Ej. pago completo"
                    }
                  />
                </div>

                <div className="rt-box rt-box--soft">
                  <label>Observación de entrega</label>
                  <textarea
                    className="rt-textarea"
                    value={observacionEntrega}
                    onChange={(e) => setObservacionEntrega(e.target.value)}
                    placeholder="Ej. Cliente recibió conforme..."
                  />
                </div>

                <div className="rt-total rt-total--modern">
                  <div>
                    <span>Total del pedido</span>
                    <small>Método: {getMetodoPagoLabel(metodoPago)}</small>
                  </div>
                  <strong>{money(pedidoSeleccionado.total)}</strong>
                </div>

                <button
                  className="rt-btn rt-btn--success rt-btn--full"
                  onClick={handleEntregado}
                  disabled={
                    saving ||
                    !pedidoSeleccionado ||
                    String(pedidoSeleccionado.estado).toLowerCase() === "entregado"
                  }
                >
                  {saving ? "Guardando..." : "Cobrar y marcar como entregado"}
                </button>
              </div>
            )}
          </aside>
        </div>
      </div>

      {confirmOpen && pedidoPendiente ? (
        <div className="rt-modal-backdrop">
          <div className="rt-modal">
            <div className="rt-modal__top">
              <span className="rt-modal__chip">Confirmar entrega</span>
              <h3 className="rt-modal__title">¿Confirmar cobro y entrega?</h3>
              <p className="rt-modal__text">
                Se marcará el pedido como entregado con el método de pago seleccionado.
              </p>
            </div>

            <div className="rt-modal__pedido">
              <strong>Pedido #{pedidoPendiente.id}</strong>
              <span>
                Cliente: {pedidoPendiente?.cliente_nombre || "Consumidor final"} ·
                Total: {money(pedidoPendiente?.total || 0)} ·
                Método: {getMetodoPagoLabel(metodoPago)}
              </span>
            </div>

            <div className="rt-modal__actions">
              <button
                type="button"
                className="rt-btn rt-btn--ghost"
                onClick={cancelarConfirmacion}
                disabled={saving}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="rt-btn rt-btn--danger"
                onClick={confirmarEntregado}
                disabled={saving}
              >
                {saving ? "Guardando..." : "Sí, confirmar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}