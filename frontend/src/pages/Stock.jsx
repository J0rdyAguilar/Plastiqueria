// src/pages/Stock.jsx
import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { stockApi } from "../lib/stock";
import { ubicacionesApi } from "../lib/ubicaciones"; // si ya la tienes, si no te la paso en el siguiente

export default function Stock() {
  const [q, setQ] = useState("");
  const [ubicacionId, setUbicacionId] = useState("");
  const [ubicaciones, setUbicaciones] = useState([]);

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);

  const [page, setPage] = useState(1);
  const [perPage] = useState(10);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadUbicaciones() {
    try {
      // suponiendo que tu ubicacionesApi.list devuelve paginator o array
      const res = await ubicacionesApi.list({ per_page: 200, activa: 1 });
      const arr = res?.data ?? res ?? [];
      setUbicaciones(arr);
      // si no ha elegido, selecciona primera
      if (!ubicacionId && arr.length) setUbicacionId(String(arr[0].id));
    } catch (e) {
      // no bloquea inventario, pero avisa
      console.error(e);
    }
  }

  async function load(p = page) {
    setLoading(true);
    setError("");
    try {
      const res = await stockApi.list({
        q,
        ubicacion_id: ubicacionId,
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
    setPage(1);
    if (ubicacionId) load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ubicacionId]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      if (ubicacionId) load(1);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const canPrev = meta?.current_page > 1;
  const canNext = meta?.current_page < meta?.last_page;

  return (
    <Layout>
      <div className="page">
        <div className="page-head">
          <h2>Inventario</h2>
          <div className="muted">Stock actual por ubicación</div>
        </div>

        <div className="card">
          <div className="row gap">
            <div className="field">
              <label>Ubicación</label>
              <select value={ubicacionId} onChange={(e) => setUbicacionId(e.target.value)}>
                {ubicaciones.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} ({u.tipo})
                  </option>
                ))}
              </select>
            </div>

            <div className="field grow">
              <label>Buscar producto</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Escribe el nombre del producto..."
              />
            </div>

            <div className="field">
              <label>&nbsp;</label>
              <button className="btn" onClick={() => load(1)} disabled={loading || !ubicacionId}>
                {loading ? "Cargando..." : "Buscar"}
              </button>
            </div>
          </div>

          {error && <div className="alert alert-danger">{error}</div>}

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="right">Cantidad (base)</th>
                  <th>Actualizado</th>
                </tr>
              </thead>
              <tbody>
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan="3" className="muted">
                      No hay registros.
                    </td>
                  </tr>
                )}

                {items.map((it) => (
                  <tr key={it.id}>
                    <td>{it.producto_nombre}</td>
                    <td className="right">{it.cantidad_base}</td>
                    <td className="muted">{it.actualizado_en || "-"}</td>
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
      </div>
    </Layout>
  );
}
