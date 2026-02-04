// src/pages/Productos.jsx
import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { productosApi } from "../api/productos";

function fullImg(url) {
  if (!url) return "";
  const base = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
  return url.startsWith("http") ? url : `${base}/${url}`;
}

export default function Productos() {
  const [q, setQ] = useState("");
  const [activo, setActivo] = useState(""); // "" | "1" | "0"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);

  // modal
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null);

  async function fetchData(page = 1) {
    setLoading(true);
    setError("");
    try {
      const data = await productosApi.list({
        q: q || undefined,
        activo: activo || undefined,
        page,
        per_page: 10,
      });

      const rows = data?.data ?? data;
      setItems(rows || []);
      setMeta(data?.meta ?? null);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Error cargando productos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onNew() {
    setEditing(null);
    setOpenForm(true);
  }

  function onEdit(row) {
    setEditing(row);
    setOpenForm(true);
  }

  async function onDelete(row) {
    if (!confirm(`¿Eliminar producto "${row.nombre}"?`)) return;
    try {
      await productosApi.remove(row.id);
      await fetchData(1);
    } catch (e) {
      alert(e?.response?.data?.message || e?.message || "No se pudo eliminar");
    }
  }

  return (
    <Layout>
      <div className="page">
        <div className="page-header">
          <div>
            <h1 className="title">Productos</h1>
            <p className="muted">Crea, edita y administra catálogo.</p>
          </div>

          <button className="btn btn-primary" onClick={onNew}>
            + Nuevo producto
          </button>
        </div>

        <div className="card">
          <div className="filters">
            <input
              className="input"
              placeholder="Buscar por nombre o SKU..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />

            <select className="input" value={activo} onChange={(e) => setActivo(e.target.value)}>
              <option value="">Todos</option>
              <option value="1">Activos</option>
              <option value="0">Inactivos</option>
            </select>

            <button className="btn" onClick={() => fetchData(1)} disabled={loading}>
              Buscar
            </button>

            <button
              className="btn btn-ghost"
              onClick={() => {
                setQ("");
                setActivo("");
                setTimeout(() => fetchData(1), 0);
              }}
              disabled={loading}
            >
              Limpiar
            </button>
          </div>

          {error ? <div className="alert alert-danger">{error}</div> : null}

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>Imagen</th>
                  <th>SKU</th>
                  <th>Nombre</th>
                  <th style={{ width: 120 }}>Activo</th>
                  <th style={{ width: 210 }}>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      Cargando...
                    </td>
                  </tr>
                ) : items?.length ? (
                  items.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className="thumb">
                          {row?.imagen_principal?.url ? (
                            <img src={fullImg(row.imagen_principal.url)} alt={row.nombre} />
                          ) : (
                            <div className="thumb-ph">—</div>
                          )}
                        </div>
                      </td>

                      <td className="mono">{row.sku || "—"}</td>

                      <td>
                        <div className="name">{row.nombre}</div>
                        <div className="muted small">{row.descripcion || ""}</div>
                      </td>

                      <td>
                        <span className={row.activo ? "pill pill-ok" : "pill"}>
                          {row.activo ? "Sí" : "No"}
                        </span>
                      </td>

                      <td>
                        <div className="actions">
                          <button className="btn btn-sm" onClick={() => onEdit(row)}>
                            Editar
                          </button>
                          <button className="btn btn-sm btn-danger" onClick={() => onDelete(row)}>
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="muted">
                      Sin productos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ✅ MODAL */}
        {openForm ? (
          <ProductoModal
            initial={editing}
            onClose={() => setOpenForm(false)}
            onSaved={async () => {
              setOpenForm(false);
              await fetchData(1);
            }}
          />
        ) : null}

        <style>{styles}</style>
      </div>
    </Layout>
  );
}

/* =========================
   MODAL FORM
========================= */
function ProductoModal({ initial, onClose, onSaved }) {
  const isEdit = !!initial?.id;

  const [sku, setSku] = useState(initial?.sku || "");
  const [nombre, setNombre] = useState(initial?.nombre || "");
  const [descripcion, setDescripcion] = useState(initial?.descripcion || "");
  const [unidadBase, setUnidadBase] = useState(initial?.unidad_base || "unidad");
  const [alertaStock, setAlertaStock] = useState(initial?.alerta_stock ?? 0);
  const [activo, setActivo] = useState(initial?.activo ?? true);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [imgFile, setImgFile] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setSaving(true);

    try {
      const payload = {
        sku: sku || null,
        nombre,
        descripcion: descripcion || null,
        unidad_base: unidadBase,
        alerta_stock: Number(alertaStock || 0),
        activo: !!activo,
      };

      let prod;
      if (isEdit) {
        prod = await productosApi.update(initial.id, payload);
      } else {
        prod = await productosApi.create(payload);
      }

      // si tu API devuelve el producto creado en prod, usamos su id
      const id = prod?.id ?? initial?.id;

      // Subir imagen si eligió archivo
      if (imgFile && id) {
        await productosApi.uploadImagen({
          producto_id: id,
          file: imgFile,
          es_principal: true,
          orden: 0,
        });
      }

      await onSaved();
    } catch (e2) {
      setErr(e2?.response?.data?.message || e2?.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">{isEdit ? "Editar producto" : "Nuevo producto"}</h2>
            <p className="muted small">Llena los datos básicos y (opcional) sube imagen.</p>
          </div>
          <button className="iconbtn" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        {err ? <div className="alert alert-danger">{err}</div> : null}

        <form onSubmit={submit} className="form">
          <div className="grid">
            <div>
              <label className="label">SKU</label>
              <input className="input" value={sku} onChange={(e) => setSku(e.target.value)} />
            </div>

            <div>
              <label className="label">Nombre *</label>
              <input
                className="input"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
              />
            </div>

            <div className="col-2">
              <label className="label">Descripción</label>
              <input
                className="input"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </div>

            <div>
              <label className="label">Unidad base</label>
              <select className="input" value={unidadBase} onChange={(e) => setUnidadBase(e.target.value)}>
                <option value="unidad">Unidad</option>
                <option value="docena">Docena</option>
                <option value="paquete">Paquete</option>
                <option value="caja">Caja</option>
                <option value="bolsa">Bolsa</option>
                <option value="fardo">Fardo</option>
                <option value="millar">Millar</option>
              </select>
            </div>

            <div>
              <label className="label">Alerta stock</label>
              <input
                type="number"
                className="input"
                value={alertaStock}
                onChange={(e) => setAlertaStock(e.target.value)}
                min="0"
              />
            </div>

            <div className="col-2">
              <label className="label">Imagen principal (opcional)</label>
              <input
                type="file"
                className="input"
                accept="image/*"
                onChange={(e) => setImgFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className="col-2 row">
              <label className="check">
                <input type="checkbox" checked={!!activo} onChange={(e) => setActivo(e.target.checked)} />
                <span>Activo</span>
              </label>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button className="btn btn-primary" disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================
   CSS
========================= */
const styles = `
.page{ max-width:1100px; margin:0 auto; padding:18px; }
.page-header{ display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:14px; }
.title{ margin:0; font-size:26px; }
.muted{ color:#6b7280; margin:4px 0 0; }
.small{ font-size:12px; }

.card{ background:#fff; border:1px solid #e5e7eb; border-radius:14px; padding:14px; box-shadow:0 1px 2px rgba(0,0,0,.04); }
.filters{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:12px; }

.table-wrap{ overflow:auto; border-radius:12px; border:1px solid #eef2f7; }
.table{ width:100%; border-collapse:separate; border-spacing:0; min-width:840px; }
.table th, .table td{ padding:10px 12px; border-bottom:1px solid #eef2f7; text-align:left; vertical-align:middle; }
.table th{ font-size:12px; text-transform:uppercase; letter-spacing:.06em; color:#6b7280; background:#fafafa; }
.table tr:last-child td{ border-bottom:none; }

.input{ width:100%; padding:10px 12px; border:1px solid #e5e7eb; border-radius:10px; outline:none; }
.input:focus{ border-color:#c7d2fe; box-shadow:0 0 0 3px rgba(99,102,241,.15); }

.btn{ padding:10px 12px; border-radius:10px; border:1px solid #e5e7eb; background:#fff; cursor:pointer; }
.btn:hover{ background:#fafafa; }
.btn:disabled{ opacity:.6; cursor:not-allowed; }
.btn-sm{ padding:8px 10px; border-radius:10px; }
.btn-primary{ background:#4f46e5; color:#fff; border-color:#4f46e5; }
.btn-primary:hover{ background:#4338ca; }
.btn-danger{ background:#ef4444; color:#fff; border-color:#ef4444; }
.btn-danger:hover{ background:#dc2626; }
.btn-ghost{ background:#fff; }

.actions{ display:flex; gap:8px; }
.pill{ display:inline-flex; align-items:center; padding:6px 10px; border-radius:999px; background:#f3f4f6; font-size:12px; }
.pill-ok{ background:#ecfdf5; color:#065f46; border:1px solid #a7f3d0; }

.thumb{ width:46px; height:46px; border-radius:12px; border:1px solid #e5e7eb; overflow:hidden; display:grid; place-items:center; background:#fafafa; }
.thumb img{ width:100%; height:100%; object-fit:cover; display:block; }
.thumb-ph{ color:#9ca3af; font-size:14px; }

.alert{ padding:10px 12px; border-radius:12px; margin:10px 0; }
.alert-danger{ background:#fef2f2; border:1px solid #fecaca; color:#991b1b; }

.name{ font-weight:600; }
.mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }

/* MODAL */
.modal-backdrop{ position:fixed; inset:0; background:rgba(0,0,0,.35); display:flex; align-items:center; justify-content:center; padding:16px; z-index:50; }
.modal{ width:min(760px, 100%); background:#fff; border-radius:16px; border:1px solid #e5e7eb; box-shadow:0 15px 30px rgba(0,0,0,.18); padding:14px; }
.modal-header{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:10px; }
.modal-title{ margin:0; font-size:18px; }
.iconbtn{ width:38px; height:38px; border-radius:12px; border:1px solid #e5e7eb; background:#fff; cursor:pointer; }
.iconbtn:hover{ background:#fafafa; }

.form{ margin-top:10px; }
.grid{ display:grid; grid-template-columns: 1fr 1fr; gap:12px; }
.col-2{ grid-column: span 2; }
.label{ display:block; font-size:12px; color:#6b7280; margin:0 0 6px; }
.row{ display:flex; align-items:center; gap:10px; }
.check{ display:flex; align-items:center; gap:10px; user-select:none; }

.modal-actions{ display:flex; justify-content:flex-end; gap:10px; margin-top:12px; }
`;
