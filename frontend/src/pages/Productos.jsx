// src/pages/Productos.jsx
import React, { useEffect, useMemo, useState } from "react";
import { productosApi } from "../api/productos";

function fullImg(url) {
  if (!url) return "";
  const base = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
  return url.startsWith("http") ? url : `${base}/${url}`;
}

const PRESENTACION_OPTIONS = [
  { value: "unidad", label: "Unidad" },
  { value: "docena", label: "Docena" },
  { value: "paquete", label: "Paquete" },
  { value: "caja", label: "Caja" },
  { value: "bolsa", label: "Bolsa" },
  { value: "fardo", label: "Fardo" },
  { value: "millar", label: "Millar" },
  { value: "cubo", label: "Cubo" },
];

function presentacionLabel(value) {
  return PRESENTACION_OPTIONS.find((x) => x.value === value)?.label || value || "—";
}

function money(v) {
  const n = Number(v || 0);
  return `Q ${n.toFixed(2)}`;
}

function makePrecioRow() {
  return {
    id: null,
    presentacion: "unidad",
    factor_base: 1,
    precio: "",
    activo: true,
  };
}

export default function Productos() {
  const [q, setQ] = useState("");
  const [activo, setActivo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);

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
    if (!window.confirm(`¿Eliminar producto "${row.nombre}"?`)) return;

    try {
      await productosApi.remove(row.id);
      await fetchData(1);
    } catch (e) {
      alert(e?.response?.data?.message || e?.message || "No se pudo eliminar");
    }
  }

  function renderPrecios(row) {
    const precios = Array.isArray(row?.precios) ? row.precios : [];
    if (!precios.length) return <span className="muted small">Sin precios</span>;

    return (
      <div className="price-list">
        {precios.map((p, idx) => (
          <div className="price-chip" key={p.id ?? `${p.presentacion}-${idx}`}>
            <strong>{presentacionLabel(p.presentacion)}</strong>
            <span>{money(p.precio)}</span>
            <small>factor: {Number(p.factor_base || 0)}</small>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="title">Productos</h1>
          <p className="muted">Crea, edita y administra catálogo con precios por presentación.</p>
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
                <th style={{ minWidth: 320 }}>Precios</th>
                <th style={{ width: 120 }}>Activo</th>
                <th style={{ width: 210 }}>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="muted">
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
                      <div className="muted tiny">Unidad base: {presentacionLabel(row.unidad_base)}</div>
                    </td>

                    <td>{renderPrecios(row)}</td>

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
                  <td colSpan={6} className="muted">
                    Sin productos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {meta?.last_page > 1 ? (
          <div className="pager">
            <button
              className="btn"
              disabled={loading || meta.current_page <= 1}
              onClick={() => fetchData(meta.current_page - 1)}
            >
              Anterior
            </button>
            <span className="muted small">
              Página {meta.current_page} de {meta.last_page}
            </span>
            <button
              className="btn"
              disabled={loading || meta.current_page >= meta.last_page}
              onClick={() => fetchData(meta.current_page + 1)}
            >
              Siguiente
            </button>
          </div>
        ) : null}
      </div>

      {openForm ? (
        <ProductoModal
          initial={editing}
          onClose={() => setOpenForm(false)}
          onSaved={async () => {
            setOpenForm(false);
            await fetchData(meta?.current_page || 1);
          }}
        />
      ) : null}

      <style>{styles}</style>
    </div>
  );
}

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

  const [precios, setPrecios] = useState(() => {
    if (Array.isArray(initial?.precios) && initial.precios.length) {
      return initial.precios.map((p) => ({
        id: p.id ?? null,
        presentacion: p.presentacion || "unidad",
        factor_base: p.factor_base ?? 1,
        precio: p.precio ?? "",
        activo: p.activo ?? true,
      }));
    }
    return [makePrecioRow()];
  });

  const presentacionesUsadas = useMemo(
    () => precios.map((p) => p.presentacion).filter(Boolean),
    [precios]
  );

  function updatePrecioRow(index, field, value) {
    setPrecios((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  function addPrecioRow() {
    setPrecios((prev) => [...prev, makePrecioRow()]);
  }

  function removePrecioRow(index) {
    setPrecios((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }

  async function submit(e) {
    e.preventDefault();
    setErr("");

    const preciosLimpios = precios
      .map((p) => ({
        id: p.id || undefined,
        presentacion: p.presentacion,
        factor_base: Number(p.factor_base || 0),
        precio: Number(p.precio || 0),
        activo: !!p.activo,
      }))
      .filter((p) => p.presentacion && p.factor_base > 0);

    if (!nombre.trim()) {
      setErr("El nombre es requerido.");
      return;
    }

    if (!preciosLimpios.length) {
      setErr("Debes agregar al menos un precio por presentación.");
      return;
    }

    const repetidas = preciosLimpios
      .map((p) => p.presentacion)
      .filter((v, i, arr) => arr.indexOf(v) !== i);

    if (repetidas.length) {
      setErr("No puedes repetir presentaciones en el mismo producto.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        sku: sku || null,
        nombre: nombre.trim(),
        descripcion: descripcion || null,
        unidad_base: unidadBase,
        alerta_stock: Number(alertaStock || 0),
        activo: !!activo,
        precios: preciosLimpios,
      };

      let prod;
      if (isEdit) {
        prod = await productosApi.update(initial.id, payload);
      } else {
        prod = await productosApi.create(payload);
      }

      const id = prod?.id ?? initial?.id;

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
      <div className="modal modal-lg" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">{isEdit ? "Editar producto" : "Nuevo producto"}</h2>
            <p className="muted small">
              Llena los datos básicos, agrega precios por presentación y opcionalmente sube imagen.
            </p>
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
              <select
                className="input"
                value={unidadBase}
                onChange={(e) => setUnidadBase(e.target.value)}
              >
                {PRESENTACION_OPTIONS.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
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
                <input
                  type="checkbox"
                  checked={!!activo}
                  onChange={(e) => setActivo(e.target.checked)}
                />
                <span>Activo</span>
              </label>
            </div>

            <div className="col-2">
              <div className="price-box">
                <div className="price-box-head">
                  <div>
                    <h3 className="subttl">Precios por presentación</h3>
                    <p className="muted tiny">
                      Aquí defines cuánto vale cada presentación y cuánto descuenta del stock base.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={addPrecioRow}
                    disabled={saving}
                  >
                    + Agregar precio
                  </button>
                </div>

                <div className="price-editor-wrap">
                  <table className="price-editor">
                    <thead>
                      <tr>
                        <th>Presentación</th>
                        <th>Factor base</th>
                        <th>Precio</th>
                        <th>Activo</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {precios.map((row, index) => (
                        <tr key={`${row.id ?? "new"}-${index}`}>
                          <td>
                            <select
                              className="input"
                              value={row.presentacion}
                              onChange={(e) =>
                                updatePrecioRow(index, "presentacion", e.target.value)
                              }
                            >
                              {PRESENTACION_OPTIONS.filter(
                                (op) =>
                                  op.value === row.presentacion ||
                                  !presentacionesUsadas.includes(op.value)
                              ).map((op) => (
                                <option key={op.value} value={op.value}>
                                  {op.label}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td>
                            <input
                              type="number"
                              step="0.0001"
                              min="0.0001"
                              className="input"
                              value={row.factor_base}
                              onChange={(e) =>
                                updatePrecioRow(index, "factor_base", e.target.value)
                              }
                            />
                          </td>

                          <td>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="input"
                              value={row.precio}
                              onChange={(e) => updatePrecioRow(index, "precio", e.target.value)}
                            />
                          </td>

                          <td>
                            <label className="check center-check">
                              <input
                                type="checkbox"
                                checked={!!row.activo}
                                onChange={(e) =>
                                  updatePrecioRow(index, "activo", e.target.checked)
                                }
                              />
                              <span>{row.activo ? "Sí" : "No"}</span>
                            </label>
                          </td>

                          <td>
                            <button
                              type="button"
                              className="btn btn-sm btn-danger"
                              onClick={() => removePrecioRow(index)}
                              disabled={precios.length === 1 || saving}
                            >
                              Quitar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="price-help">
                  <div className="helper-card">
                    <strong>Ejemplo:</strong>
                    <span>Unidad = factor 1</span>
                  </div>
                  <div className="helper-card">
                    <strong>Docena:</strong>
                    <span>factor 12</span>
                  </div>
                  <div className="helper-card">
                    <strong>Paquete:</strong>
                    <span>depende del producto</span>
                  </div>
                  <div className="helper-card">
                    <strong>Fardo:</strong>
                    <span>depende del producto</span>
                  </div>
                </div>
              </div>
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

const styles = `
.page{
  max-width:1280px;
  margin:0 auto;
  padding:18px;
}
.page-header{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:16px;
  margin-bottom:14px;
}
.title{
  margin:0;
  font-size:26px;
}
.muted{
  color:#6b7280;
  margin:4px 0 0;
}
.small{
  font-size:12px;
}
.tiny{
  font-size:11px;
}

.card{
  background:#fff;
  border:1px solid #e5e7eb;
  border-radius:14px;
  padding:14px;
  box-shadow:0 1px 2px rgba(0,0,0,.04);
}
.filters{
  display:flex;
  gap:10px;
  align-items:center;
  flex-wrap:wrap;
  margin-bottom:12px;
}

.table-wrap{
  overflow:auto;
  border-radius:12px;
  border:1px solid #eef2f7;
}
.table{
  width:100%;
  border-collapse:separate;
  border-spacing:0;
  min-width:1100px;
}
.table th,
.table td{
  padding:10px 12px;
  border-bottom:1px solid #eef2f7;
  text-align:left;
  vertical-align:middle;
}
.table th{
  font-size:12px;
  text-transform:uppercase;
  letter-spacing:.06em;
  color:#6b7280;
  background:#fafafa;
}
.table tr:last-child td{
  border-bottom:none;
}

.input{
  width:100%;
  padding:10px 12px;
  border:1px solid #e5e7eb;
  border-radius:10px;
  outline:none;
  background:#fff;
}
.input:focus{
  border-color:#c7d2fe;
  box-shadow:0 0 0 3px rgba(99,102,241,.15);
}

.btn{
  padding:10px 12px;
  border-radius:10px;
  border:1px solid #e5e7eb;
  background:#fff;
  cursor:pointer;
}
.btn:hover{
  background:#fafafa;
}
.btn:disabled{
  opacity:.6;
  cursor:not-allowed;
}
.btn-sm{
  padding:8px 10px;
  border-radius:10px;
}
.btn-primary{
  background:#4f46e5;
  color:#fff;
  border-color:#4f46e5;
}
.btn-primary:hover{
  background:#4338ca;
}
.btn-danger{
  background:#ef4444;
  color:#fff;
  border-color:#ef4444;
}
.btn-danger:hover{
  background:#dc2626;
}
.btn-ghost{
  background:#fff;
}

.actions{
  display:flex;
  gap:8px;
  flex-wrap:wrap;
}
.pill{
  display:inline-flex;
  align-items:center;
  padding:6px 10px;
  border-radius:999px;
  background:#f3f4f6;
  font-size:12px;
}
.pill-ok{
  background:#ecfdf5;
  color:#065f46;
  border:1px solid #a7f3d0;
}

.thumb{
  width:46px;
  height:46px;
  border-radius:12px;
  border:1px solid #e5e7eb;
  overflow:hidden;
  display:grid;
  place-items:center;
  background:#fafafa;
}
.thumb img{
  width:100%;
  height:100%;
  object-fit:cover;
  display:block;
}
.thumb-ph{
  color:#9ca3af;
  font-size:14px;
}

.alert{
  padding:10px 12px;
  border-radius:12px;
  margin:10px 0;
}
.alert-danger{
  background:#fef2f2;
  border:1px solid #fecaca;
  color:#991b1b;
}

.name{
  font-weight:600;
}
.mono{
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.price-list{
  display:flex;
  flex-wrap:wrap;
  gap:8px;
}
.price-chip{
  display:flex;
  flex-direction:column;
  gap:2px;
  padding:8px 10px;
  border:1px solid #e5e7eb;
  background:#fafafa;
  border-radius:12px;
  min-width:110px;
}
.price-chip strong{
  font-size:12px;
}
.price-chip span{
  font-size:13px;
  font-weight:700;
  color:#111827;
}
.price-chip small{
  color:#6b7280;
  font-size:11px;
}

.pager{
  display:flex;
  justify-content:flex-end;
  align-items:center;
  gap:12px;
  margin-top:12px;
}

/* modal */
.modal-backdrop{
  position:fixed;
  inset:0;
  background:rgba(0,0,0,.35);
  display:flex;
  align-items:center;
  justify-content:center;
  padding:16px;
  z-index:50;
}
.modal{
  width:min(760px, 100%);
  max-height:calc(100vh - 32px);
  overflow:auto;
  background:#fff;
  border-radius:16px;
  border:1px solid #e5e7eb;
  box-shadow:0 15px 30px rgba(0,0,0,.18);
  padding:14px;
}
.modal-lg{
  width:min(1100px, 100%);
}
.modal-header{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
  margin-bottom:10px;
}
.modal-title{
  margin:0;
  font-size:18px;
}
.iconbtn{
  width:38px;
  height:38px;
  border-radius:12px;
  border:1px solid #e5e7eb;
  background:#fff;
  cursor:pointer;
}
.iconbtn:hover{
  background:#fafafa;
}

.form{
  margin-top:10px;
}
.grid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:12px;
}
.col-2{
  grid-column:span 2;
}
.label{
  display:block;
  font-size:12px;
  color:#6b7280;
  margin:0 0 6px;
}
.row{
  display:flex;
  align-items:center;
  gap:10px;
}
.check{
  display:flex;
  align-items:center;
  gap:10px;
  user-select:none;
}
.center-check{
  justify-content:center;
}

.modal-actions{
  display:flex;
  justify-content:flex-end;
  gap:10px;
  margin-top:12px;
}

.price-box{
  border:1px solid #e5e7eb;
  border-radius:14px;
  padding:12px;
  background:#fcfcfd;
}
.price-box-head{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
  margin-bottom:12px;
}
.subttl{
  margin:0;
  font-size:16px;
}
.price-editor-wrap{
  overflow:auto;
  border-radius:12px;
  border:1px solid #eef2f7;
  background:#fff;
}
.price-editor{
  width:100%;
  border-collapse:separate;
  border-spacing:0;
  min-width:760px;
}
.price-editor th,
.price-editor td{
  padding:10px;
  border-bottom:1px solid #eef2f7;
  text-align:left;
  vertical-align:middle;
}
.price-editor th{
  font-size:12px;
  text-transform:uppercase;
  letter-spacing:.04em;
  color:#6b7280;
  background:#fafafa;
}
.price-editor tr:last-child td{
  border-bottom:none;
}
.price-help{
  display:flex;
  flex-wrap:wrap;
  gap:8px;
  margin-top:12px;
}
.helper-card{
  display:flex;
  flex-direction:column;
  gap:2px;
  padding:8px 10px;
  border:1px dashed #d1d5db;
  border-radius:12px;
  background:#fff;
}
.helper-card strong{
  font-size:12px;
}
.helper-card span{
  font-size:12px;
  color:#6b7280;
}

@media (max-width: 900px){
  .grid{
    grid-template-columns:1fr;
  }
  .col-2{
    grid-column:span 1;
  }
  .page-header{
    flex-direction:column;
    align-items:stretch;
  }
}
`;