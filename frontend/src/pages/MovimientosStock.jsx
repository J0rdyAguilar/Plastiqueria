// src/pages/MovimientosStock.jsx
import React, { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { movimientosStockApi } from "../lib/stock";
import { ubicacionesApi } from "../lib/ubicaciones";

const TIPOS = [
  { value: "", label: "Todos" },
  { value: "entrada", label: "Entrada" },
  { value: "salida", label: "Salida" },
  { value: "traslado", label: "Traslado" },
  { value: "ajuste", label: "Ajuste" },
];

export default function MovimientosStock() {
  const [tipo, setTipo] = useState("");
  const [ubicacionId, setUbicacionId] = useState("");
  const [productoId, setProductoId] = useState("");

  const [ubicaciones, setUbicaciones] = useState([]);

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);

  const [page, setPage] = useState(1);
  const [perPage] = useState(10);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // modal
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    tipo: "entrada",
    producto_id: "",
    cantidad_base: "",
    ubicacion_origen_id: "",
    ubicacion_destino_id: "",
    motivo: "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const needsOrigen = useMemo(() => ["salida", "traslado", "ajuste"].includes(form.tipo), [form.tipo]);
  const needsDestino = useMemo(() => ["entrada", "traslado"].includes(form.tipo), [form.tipo]);

  async function loadUbicaciones() {
    try {
      const res = await ubicacionesApi.list({ per_page: 200, activa: 1 });
      const arr = res?.data ?? res ?? [];
      setUbicaciones(arr);
    } catch (e) {
      console.error(e);
    }
  }

  async function load(p = page) {
    setLoading(true);
    setError("");
    try {
      const res = await movimientosStockApi.list({
        tipo,
        ubicacion_id: ubicacionId,
        producto_id: productoId,
        page: p,
        per_page: perPage,
      });
      setItems(res.data || []);
      setMeta({
        current_page: res.current_page,
        last_page: res.last_page,
        total: res.total,
      });
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Error cargando movimientos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUbicaciones();
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, ubicacionId]);

  async function onCreate(e) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    setError("");

    try {
      const payload = {
        tipo: form.tipo,
        producto_id: Number(form.producto_id),
        cantidad_base: Number(form.cantidad_base),
        motivo: form.motivo || undefined,
        ubicacion_origen_id: needsOrigen ? Number(form.ubicacion_origen_id) : undefined,
        ubicacion_destino_id: needsDestino ? Number(form.ubicacion_destino_id) : undefined,
      };

      // limpia undefined
      Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

      await movimientosStockApi.create(payload);

      setMsg("Movimiento aplicado correctamente.");
      setOpen(false);
      setForm({
        tipo: "entrada",
        producto_id: "",
        cantidad_base: "",
        ubicacion_origen_id: "",
        ubicacion_destino_id: "",
        motivo: "",
      });
      load(1);
    } catch (e) {
      const m = e?.response?.data?.message || e?.message || "Error al crear movimiento";
      setError(m);
    } finally {
      setSaving(false);
    }
  }

  const canPrev = meta?.current_page > 1;
  const canNext = meta?.current_page < meta?.last_page;

  return (
    <Layout>
      <div className="page">
        <div className="page-head row between">
          <div>
            <h2>Movimientos de Stock</h2>
            <div className="muted">Entradas, salidas, traslados y ajustes</div>
          </div>
          <button className="btn primary" onClick={() => setOpen(true)}>
            + Nuevo movimiento
          </button>
        </div>

        <div className="card">
          <div className="row gap">
            <div className="field">
              <label>Tipo</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Ubicación (origen/destino)</label>
              <select value={ubicacionId} onChange={(e) => setUbicacionId(e.target.value)}>
                <option value="">Todas</option>
                {ubicaciones.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} ({u.tipo})
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Producto ID (opcional)</label>
              <input value={productoId} onChange={(e) => setProductoId(e.target.value)} placeholder="Ej: 10" />
            </div>

            <div className="field">
              <label>&nbsp;</label>
              <button className="btn" onClick={() => load(1)} disabled={loading}>
                {loading ? "Cargando..." : "Filtrar"}
              </button>
            </div>
          </div>

          {msg && <div className="alert alert-success">{msg}</div>}
          {error && <div className="alert alert-danger">{error}</div>}

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Producto</th>
                  <th className="right">Cantidad</th>
                  <th>Origen</th>
                  <th>Destino</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan="7" className="muted">
                      No hay movimientos.
                    </td>
                  </tr>
                )}
                {items.map((m) => (
                  <tr key={m.id}>
                    <td className="muted">{m.creado_en}</td>
                    <td>{m.tipo}</td>
                    <td>{m.producto_id}</td>
                    <td className="right">{m.cantidad_base}</td>
                    <td className="muted">{m.ubicacion_origen_id || "-"}</td>
                    <td className="muted">{m.ubicacion_destino_id || "-"}</td>
                    <td className="muted">{m.motivo || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta && (
            <div className="row between mt">
              <div className="muted">
                Página {meta.current_page} de {meta.last_page} · Total {meta.total}
              </div>
              <div className="row gap">
                <button className="btn" disabled={!canPrev || loading} onClick={() => { const p = page - 1; setPage(p); load(p); }}>
                  Anterior
                </button>
                <button className="btn" disabled={!canNext || loading} onClick={() => { const p = page + 1; setPage(p); load(p); }}>
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal simple */}
        {open && (
          <div className="modal-backdrop" onClick={() => !saving && setOpen(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <h3>Nuevo movimiento</h3>
                <button className="icon-btn" onClick={() => !saving && setOpen(false)}>
                  ✕
                </button>
              </div>

              <form onSubmit={onCreate} className="modal-body">
                <div className="row gap">
                  <div className="field">
                    <label>Tipo</label>
                    <select
                      value={form.tipo}
                      onChange={(e) =>
                        setForm((s) => ({
                          ...s,
                          tipo: e.target.value,
                        }))
                      }
                    >
                      <option value="entrada">Entrada</option>
                      <option value="salida">Salida</option>
                      <option value="traslado">Traslado</option>
                      <option value="ajuste">Ajuste</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>Producto ID</label>
                    <input
                      required
                      value={form.producto_id}
                      onChange={(e) => setForm((s) => ({ ...s, producto_id: e.target.value }))}
                      placeholder="Ej: 10"
                    />
                  </div>

                  <div className="field">
                    <label>{form.tipo === "ajuste" ? "Cantidad (delta +/-)" : "Cantidad"}</label>
                    <input
                      required
                      value={form.cantidad_base}
                      onChange={(e) => setForm((s) => ({ ...s, cantidad_base: e.target.value }))}
                      placeholder={form.tipo === "ajuste" ? "Ej: 5 o -3" : "Ej: 10"}
                    />
                  </div>
                </div>

                <div className="row gap">
                  {needsOrigen && (
                    <div className="field grow">
                      <label>Ubicación origen</label>
                      <select
                        required
                        value={form.ubicacion_origen_id}
                        onChange={(e) => setForm((s) => ({ ...s, ubicacion_origen_id: e.target.value }))}
                      >
                        <option value="">Seleccione...</option>
                        {ubicaciones.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.nombre} ({u.tipo})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {needsDestino && (
                    <div className="field grow">
                      <label>Ubicación destino</label>
                      <select
                        required
                        value={form.ubicacion_destino_id}
                        onChange={(e) => setForm((s) => ({ ...s, ubicacion_destino_id: e.target.value }))}
                      >
                        <option value="">Seleccione...</option>
                        {ubicaciones.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.nombre} ({u.tipo})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="field">
                  <label>Motivo (obligatorio en ajuste)</label>
                  <input
                    value={form.motivo}
                    onChange={(e) => setForm((s) => ({ ...s, motivo: e.target.value }))}
                    placeholder="Ej: Conteo físico / Compra / Merma"
                    required={form.tipo === "ajuste"}
                  />
                </div>

                <div className="row between mt">
                  <button type="button" className="btn" onClick={() => !saving && setOpen(false)}>
                    Cancelar
                  </button>
                  <button className="btn primary" disabled={saving}>
                    {saving ? "Guardando..." : "Aplicar"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
