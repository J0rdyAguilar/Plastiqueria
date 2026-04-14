// src/pages/Productos.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { productosApi } from "../lib/productos";

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
    precio_costo: "",
    precio_venta: "",
    activo: true,
  };
}

export default function Productos() {
  const [q, setQ] = useState("");
  const [activo, setActivo] = useState("");
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState("");

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);

  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsRow, setDetailsRow] = useState(null);

  const firstLoadRef = useRef(true);

  async function fetchData(page = 1, opts = {}) {
    const { silent = false } = opts;

    if (!silent) setLoading(true);
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
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    fetchData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (firstLoadRef.current) {
      firstLoadRef.current = false;
      return;
    }

    setTyping(true);

    const timer = setTimeout(async () => {
      await fetchData(1, { silent: false });
      setTyping(false);
    }, 300);

    return () => {
      clearTimeout(timer);
      setTyping(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, activo]);

  function onNew() {
    setEditing(null);
    setOpenForm(true);
  }

  function onEdit(row) {
    setEditing(row);
    setOpenForm(true);
  }

  function onViewDetails(row) {
    setDetailsRow(row);
    setDetailsOpen(true);
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
    const total = precios.length;

    if (!total) {
      return (
        <div className="prices-compact">
          <span className="empty-prices">Sin precios configurados</span>
        </div>
      );
    }

    return (
      <div className="prices-compact">
        <div className="prices-summary">
          <strong>{total}</strong>
          <span>{total === 1 ? "presentación" : "presentaciones"}</span>
        </div>

        <button
          type="button"
          className="btn btn-soft btn-sm"
          onClick={() => onViewDetails(row)}
        >
          Ver detalles
        </button>
      </div>
    );
  }

  const isBusy = loading || typing;

  return (
    <div className="products-page">
      <section className="products-hero">
        <div className="products-hero-top">
          <div className="products-hero-title">
            <h1>Productos</h1>
            <p>
              Administra tu catálogo, busca rápido entre cientos de productos y controla
              precios por presentación de una forma más clara y elegante.
            </p>
          </div>

          <div className="products-hero-actions">
            <button className="btn btn-primary btn-lg" onClick={onNew}>
              + Nuevo producto
            </button>
          </div>
        </div>

        <div className="products-stats">
          <div className="stat-card">
            <span>Total visibles</span>
            <strong>{items?.length || 0}</strong>
          </div>
          <div className="stat-card">
            <span>Página actual</span>
            <strong>{meta?.current_page || 1}</strong>
          </div>
          <div className="stat-card">
            <span>Total páginas</span>
            <strong>{meta?.last_page || 1}</strong>
          </div>
        </div>

        <div className="search-panel">
          <div className="search-grid">
            <div className="search-main">
              <label>Buscador inteligente</label>
              <div className="search-input-wrap">
                <span className="search-icon">⌕</span>

                <input
                  className="input search-input"
                  placeholder="Busca por nombre, SKU o descripción..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />

                {typing ? <span className="search-mini-loader" /> : null}

                {!typing && q ? (
                  <button
                    type="button"
                    className="clear-search"
                    onClick={() => setQ("")}
                    aria-label="Limpiar búsqueda"
                  >
                    ✕
                  </button>
                ) : null}
              </div>
            </div>

            <div className="search-filter">
              <label>Estado</label>
              <select
                className="input search-select"
                value={activo}
                onChange={(e) => setActivo(e.target.value)}
              >
                <option value="">Todos</option>
                <option value="1">Activos</option>
                <option value="0">Inactivos</option>
              </select>
            </div>

            <div className="search-actions">
              <button className="btn btn-primary" onClick={() => fetchData(1)} disabled={isBusy}>
                {typing ? "Buscando..." : "Buscar"}
              </button>

              <button
                className="btn btn-soft"
                onClick={() => {
                  setQ("");
                  setActivo("");
                }}
                disabled={isBusy}
              >
                Limpiar
              </button>
            </div>
          </div>
        </div>
      </section>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <section className="products-table-card">
        <div className="table-card-head">
          <div>
            <h2>Listado de productos</h2>
            <p>Vista optimizada para manejar muchos productos sin que se vea saturado.</p>
          </div>
        </div>

        <div className="table-wrap pro-table-wrap">
          <table className="table pro-table">
            <thead>
              <tr>
                <th style={{ width: 90 }}>Imagen</th>
                <th style={{ width: 150 }}>SKU</th>
                <th>Producto</th>
                <th style={{ minWidth: 260 }}>Precios</th>
                <th style={{ width: 120 }}>Estado</th>
                <th style={{ width: 270 }}>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6}>
                    <div className="table-loader-wrap">
                      <div className="table-loader-ring" />
                    </div>
                  </td>
                </tr>
              ) : items?.length ? (
                items.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="thumb thumb-lg">
                        {row?.imagen_principal?.url ? (
                          <img src={fullImg(row.imagen_principal.url)} alt={row.nombre} />
                        ) : (
                          <div className="thumb-ph">Sin imagen</div>
                        )}
                      </div>
                    </td>

                    <td>
                      <div className="sku-badge">{row.sku || "—"}</div>
                    </td>

                    <td>
                      <div className="product-name">{row.nombre}</div>
                      <div className="product-desc">{row.descripcion || "Sin descripción"}</div>
                    </td>

                    <td>{renderPrecios(row)}</td>

                    <td>
                      <span className={row.activo ? "status-pill status-active" : "status-pill status-inactive"}>
                        {row.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>

                    <td>
                      <div className="actions">
                        <button className="btn btn-soft btn-sm" onClick={() => onViewDetails(row)}>
                          Detalles
                        </button>
                        <button className="btn btn-edit btn-sm" onClick={() => onEdit(row)}>
                          Editar
                        </button>
                        <button className="btn btn-delete btn-sm" onClick={() => onDelete(row)}>
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state">
                      <div className="empty-state-icon">📦</div>
                      <h3>No hay productos</h3>
                      <p>Agrega tu primer producto o ajusta los filtros de búsqueda.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {meta?.last_page > 1 ? (
          <div className="pager pro-pager">
            <button
              className="btn btn-soft"
              disabled={isBusy || meta.current_page <= 1}
              onClick={() => fetchData(meta.current_page - 1)}
            >
              ← Anterior
            </button>

            <div className="pager-info">
              Página <strong>{meta.current_page}</strong> de <strong>{meta.last_page}</strong>
            </div>

            <button
              className="btn btn-soft"
              disabled={isBusy || meta.current_page >= meta.last_page}
              onClick={() => fetchData(meta.current_page + 1)}
            >
              Siguiente →
            </button>
          </div>
        ) : null}
      </section>

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

      {detailsOpen && detailsRow ? (
        <ProductoDetallesModal
          row={detailsRow}
          onClose={() => {
            setDetailsOpen(false);
            setDetailsRow(null);
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
        precio_costo: p.precio_costo ?? "",
        precio_venta: p.precio_venta ?? p.precio ?? "",
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
        precio_costo: Number(p.precio_costo || 0),
        precio_venta: Number(p.precio_venta || 0),
        activo: !!p.activo,
      }))
      .filter((p) => p.presentacion && p.factor_base > 0);

    if (!nombre.trim()) {
      setErr("El nombre es requerido.");
      return;
    }

    if (!preciosLimpios.length) {
      setErr("Debes agregar al menos una presentación.");
      return;
    }

    const repetidas = preciosLimpios
      .map((p) => p.presentacion)
      .filter((v, i, arr) => arr.indexOf(v) !== i);

    if (repetidas.length) {
      setErr("No puedes repetir presentaciones en el mismo producto.");
      return;
    }

    const sinVenta = preciosLimpios.some((p) => p.precio_venta <= 0);
    if (sinVenta) {
      setErr("Cada presentación debe tener precio de venta mayor a 0.");
      return;
    }

    const sinCosto = preciosLimpios.some((p) => p.precio_costo < 0);
    if (sinCosto) {
      setErr("El precio costo no puede ser negativo.");
      return;
    }

    setSaving(true);

    try {
      const unidadBaseAuto = preciosLimpios[0]?.presentacion || "unidad";

      const payload = {
        sku: sku || null,
        nombre: nombre.trim(),
        descripcion: descripcion || null,
        unidad_base: unidadBaseAuto,
        activo: !!activo,
        precios: preciosLimpios,
      };

      let prod;
      if (isEdit) {
        prod = await productosApi.update(initial.id, payload);
      } else {
        prod = await productosApi.create(payload);
      }

      const id = prod?.data?.id ?? prod?.id ?? initial?.id;

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
              Llena los datos básicos, agrega presentaciones con precio costo y precio venta, y sube una imagen si lo deseas.
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
                    <h3 className="subttl">Presentaciones y precios</h3>
                    <p className="muted tiny">
                      Aquí defines unidad, docena, paquete, etc. con su factor base, precio costo y precio venta.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={addPrecioRow}
                    disabled={saving}
                  >
                    + Agregar presentación
                  </button>
                </div>

                <div className="price-editor-wrap">
                  <table className="price-editor">
                    <thead>
                      <tr>
                        <th>Presentación</th>
                        <th>Factor base</th>
                        <th>Precio costo</th>
                        <th>Precio venta</th>
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
                              value={row.precio_costo}
                              onChange={(e) =>
                                updatePrecioRow(index, "precio_costo", e.target.value)
                              }
                            />
                          </td>

                          <td>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="input"
                              value={row.precio_venta}
                              onChange={(e) =>
                                updatePrecioRow(index, "precio_venta", e.target.value)
                              }
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
                              className="btn btn-delete btn-sm"
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
                    <strong>Unidad</strong>
                    <span>factor 1</span>
                  </div>
                  <div className="helper-card">
                    <strong>Docena</strong>
                    <span>factor 12</span>
                  </div>
                  <div className="helper-card">
                    <strong>Paquete</strong>
                    <span>según producto</span>
                  </div>
                  <div className="helper-card">
                    <strong>Fardo</strong>
                    <span>según producto</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-soft" onClick={onClose} disabled={saving}>
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

function ProductoDetallesModal({ row, onClose }) {
  const precios = Array.isArray(row?.precios) ? row.precios : [];

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal modal-details" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Detalles del producto</h2>
            <p className="muted small">
              Aquí puedes ver todas las presentaciones configuradas para este producto.
            </p>
          </div>
          <button className="iconbtn" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className="details-product-head">
          <div className="details-thumb">
            {row?.imagen_principal?.url ? (
              <img src={fullImg(row.imagen_principal.url)} alt={row.nombre} />
            ) : (
              <div className="thumb-ph">Sin imagen</div>
            )}
          </div>

          <div className="details-main">
            <div className="details-topline">
              <h3>{row?.nombre || "Producto"}</h3>
              <span className={row?.activo ? "status-pill status-active" : "status-pill status-inactive"}>
                {row?.activo ? "Activo" : "Inactivo"}
              </span>
            </div>

            <div className="details-meta">
              <span className="sku-badge">{row?.sku || "Sin SKU"}</span>
            </div>

            <p className="details-desc">
              {row?.descripcion || "Sin descripción"}
            </p>
          </div>
        </div>

        <div className="details-section">
          <div className="details-section-head">
            <h3>Presentaciones y precios</h3>
            <span>{precios.length} {precios.length === 1 ? "registro" : "registros"}</span>
          </div>

          {!precios.length ? (
            <div className="empty-state small-empty">
              <div className="empty-state-icon">📦</div>
              <h3>Sin presentaciones</h3>
              <p>Este producto todavía no tiene precios configurados.</p>
            </div>
          ) : (
            <div className="details-grid">
              {precios.map((p, idx) => (
                <div className="detail-price-card" key={p.id ?? `${p.presentacion}-${idx}`}>
                  <div className="detail-price-head">
                    <strong>{presentacionLabel(p.presentacion)}</strong>
                    <span className="price-factor">x{Number(p.factor_base || 0)}</span>
                  </div>

                  <div className="detail-price-body">
                    <div className="detail-line">
                      <span>Costo</span>
                      <strong>{money(p.precio_costo ?? 0)}</strong>
                    </div>

                    <div className="detail-line">
                      <span>Venta</span>
                      <strong>{money(p.precio_venta ?? p.precio ?? 0)}</strong>
                    </div>

                    <div className="detail-line">
                      <span>Estado</span>
                      <strong>{p.activo ? "Activo" : "Inactivo"}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-soft" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = `
:root{
  --bg:#f4f7fb;
  --card:#ffffff;
  --card-2:rgba(255,255,255,.84);
  --line:#e6ebf3;
  --line-2:rgba(15,23,42,.08);
  --text:#0f172a;
  --muted:#64748b;
  --primary:#4f46e5;
  --primary-2:#6366f1;
  --primary-soft:rgba(79,70,229,.10);
  --success:#16a34a;
  --success-soft:rgba(22,163,74,.12);
  --danger:#ef4444;
  --danger-soft:rgba(239,68,68,.10);
  --shadow-sm:0 10px 25px rgba(15,23,42,.05);
  --shadow-md:0 18px 40px rgba(15,23,42,.08);
  --shadow-lg:0 24px 65px rgba(15,23,42,.12);
  --radius-xl:28px;
  --radius-lg:20px;
  --radius-md:16px;
  --radius-sm:12px;
}

*{
  box-sizing:border-box;
}

.products-page{
  max-width:1380px;
  margin:0 auto;
  padding:22px;
  display:flex;
  flex-direction:column;
  gap:18px;
  color:var(--text);
}

.products-hero{
  position:relative;
  overflow:hidden;
  border-radius:var(--radius-xl);
  padding:24px;
  background:
    radial-gradient(circle at top right, rgba(99,102,241,.16), transparent 28%),
    radial-gradient(circle at bottom left, rgba(56,189,248,.10), transparent 24%),
    linear-gradient(180deg, #f8fbff 0%, #eef2ff 100%);
  border:1px solid rgba(99,102,241,.12);
  box-shadow:var(--shadow-md);
}

.products-hero-top{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:16px;
  flex-wrap:wrap;
}

.products-hero-title h1{
  margin:0;
  font-size:34px;
  letter-spacing:-.03em;
  line-height:1.05;
}

.products-hero-title p{
  margin:10px 0 0;
  max-width:760px;
  color:var(--muted);
  font-size:14px;
  line-height:1.6;
}

.products-hero-actions{
  display:flex;
  align-items:center;
  gap:10px;
}

.products-stats{
  margin-top:18px;
  display:flex;
  gap:12px;
  flex-wrap:wrap;
}

.stat-card{
  min-width:140px;
  padding:14px 16px;
  border-radius:18px;
  background:rgba(255,255,255,.76);
  border:1px solid rgba(255,255,255,.95);
  backdrop-filter:blur(10px);
  box-shadow:var(--shadow-sm);
}

.stat-card span{
  display:block;
  font-size:12px;
  color:var(--muted);
  font-weight:700;
}

.stat-card strong{
  display:block;
  margin-top:6px;
  font-size:24px;
  line-height:1;
}

.search-panel{
  margin-top:18px;
  padding:18px;
  border-radius:22px;
  background:rgba(255,255,255,.72);
  border:1px solid rgba(255,255,255,.92);
  box-shadow:var(--shadow-sm);
  backdrop-filter:blur(12px);
}

.search-grid{
  display:grid;
  grid-template-columns:minmax(320px,1.9fr) minmax(180px,.8fr) auto;
  gap:14px;
  align-items:end;
}

.search-main,
.search-filter{
  display:flex;
  flex-direction:column;
  gap:8px;
}

.search-main label,
.search-filter label{
  margin:0;
  font-size:12px;
  text-transform:uppercase;
  letter-spacing:.08em;
  color:var(--muted);
  font-weight:800;
}

.search-input-wrap{
  position:relative;
}

.search-icon{
  position:absolute;
  left:16px;
  top:50%;
  transform:translateY(-50%);
  color:#94a3b8;
  font-size:18px;
  pointer-events:none;
}

.search-input{
  padding-left:48px !important;
  padding-right:48px !important;
  height:56px;
  border-radius:18px !important;
  font-size:15px;
  background:rgba(255,255,255,.92);
  border:1px solid rgba(148,163,184,.22) !important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.65);
}

.search-input::placeholder{
  color:#94a3b8;
}

.clear-search{
  position:absolute;
  right:12px;
  top:50%;
  transform:translateY(-50%);
  width:28px;
  height:28px;
  border:none;
  border-radius:999px;
  background:#eef2ff;
  color:#4f46e5;
  font-weight:900;
  cursor:pointer;
}

.search-mini-loader{
  position:absolute;
  right:14px;
  top:50%;
  transform:translateY(-50%);
  width:22px;
  height:22px;
  border-radius:999px;
  border:2.5px solid rgba(79,70,229,.15);
  border-top-color:#4f46e5;
  animation:spin .7s linear infinite;
}

.search-select{
  height:56px;
  border-radius:18px !important;
  background:rgba(255,255,255,.92);
}

.search-actions{
  display:flex;
  gap:10px;
  flex-wrap:wrap;
}

.products-table-card{
  background:rgba(255,255,255,.90);
  border:1px solid rgba(226,232,240,.95);
  border-radius:26px;
  padding:18px;
  box-shadow:var(--shadow-md);
}

.table-card-head{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:12px;
  margin-bottom:14px;
}

.table-card-head h2{
  margin:0;
  font-size:20px;
  letter-spacing:-.02em;
}

.table-card-head p{
  margin:6px 0 0;
  color:var(--muted);
  font-size:13px;
}

.pro-table-wrap{
  overflow:auto;
  border-radius:22px;
  border:1px solid #edf2f7;
  background:linear-gradient(180deg, #fff 0%, #fcfdff 100%);
}

.pro-table{
  width:100%;
  min-width:980px;
  border-collapse:separate;
  border-spacing:0;
}

.pro-table th,
.pro-table td{
  padding:14px 14px;
  border-bottom:1px solid #edf2f7;
  text-align:left;
  vertical-align:middle;
}

.pro-table th{
  position:sticky;
  top:0;
  z-index:1;
  font-size:11px;
  text-transform:uppercase;
  letter-spacing:.12em;
  color:#64748b;
  background:linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  font-weight:900;
}

.pro-table tbody tr{
  transition:.18s ease;
}

.pro-table tbody tr:hover{
  background:#fafcff;
}

.pro-table tbody tr:last-child td{
  border-bottom:none;
}

.input{
  width:100%;
  padding:11px 13px;
  border:1px solid #e5e7eb;
  border-radius:12px;
  outline:none;
  background:#fff;
  color:var(--text);
  transition:.2s ease;
}

.input:focus{
  border-color:#c7d2fe;
  box-shadow:0 0 0 4px rgba(99,102,241,.12);
}

.btn{
  border:none;
  outline:none;
  cursor:pointer;
  transition:.18s ease;
  font-weight:800;
  border-radius:14px;
  padding:11px 14px;
}

.btn:disabled{
  opacity:.6;
  cursor:not-allowed;
}

.btn-lg{
  height:48px;
  padding:0 18px;
  border-radius:16px;
}

.btn-sm{
  padding:9px 12px;
  border-radius:12px;
  font-size:13px;
}

.btn-primary{
  background:linear-gradient(135deg, var(--primary), var(--primary-2));
  color:#fff;
  box-shadow:0 10px 24px rgba(79,70,229,.24);
}

.btn-primary:hover{
  transform:translateY(-1px);
  filter:brightness(1.02);
}

.btn-soft{
  background:#f8fafc;
  color:#334155;
  border:1px solid #e2e8f0;
}

.btn-soft:hover{
  background:#f1f5f9;
}

.btn-edit{
  background:#eef2ff;
  color:#4338ca;
  border:1px solid rgba(99,102,241,.18);
}

.btn-edit:hover{
  background:#e0e7ff;
}

.btn-delete{
  background:#fff1f2;
  color:#dc2626;
  border:1px solid rgba(239,68,68,.16);
}

.btn-delete:hover{
  background:#ffe4e6;
}

.thumb{
  overflow:hidden;
  display:grid;
  place-items:center;
  background:#f8fafc;
  border:1px solid #e5e7eb;
}

.thumb-lg{
  width:62px;
  height:62px;
  border-radius:16px;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.9);
}

.thumb img{
  width:100%;
  height:100%;
  object-fit:cover;
  display:block;
}

.thumb-ph{
  font-size:11px;
  color:#94a3b8;
  text-align:center;
  padding:8px;
}

.sku-badge{
  display:inline-flex;
  align-items:center;
  min-height:36px;
  padding:0 12px;
  border-radius:999px;
  background:#f8fafc;
  border:1px solid #e2e8f0;
  font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace;
  font-size:12px;
  color:#334155;
  font-weight:700;
}

.product-name{
  font-size:15px;
  font-weight:900;
  color:#0f172a;
  line-height:1.25;
}

.product-desc{
  margin-top:4px;
  font-size:13px;
  line-height:1.45;
  color:#64748b;
}

.prices-compact{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  flex-wrap:wrap;
}

.prices-summary{
  display:flex;
  flex-direction:column;
  justify-content:center;
  min-width:120px;
  padding:10px 12px;
  border-radius:14px;
  background:#f8fafc;
  border:1px solid #e2e8f0;
}

.prices-summary strong{
  font-size:18px;
  line-height:1;
  color:#0f172a;
}

.prices-summary span{
  margin-top:4px;
  font-size:12px;
  color:#64748b;
  font-weight:700;
}

.empty-prices{
  display:inline-flex;
  align-items:center;
  min-height:40px;
  padding:0 14px;
  border-radius:999px;
  background:#f8fafc;
  border:1px dashed #cbd5e1;
  color:#64748b;
  font-size:12px;
  font-weight:700;
}

.status-pill{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-width:92px;
  min-height:34px;
  border-radius:999px;
  font-size:12px;
  font-weight:900;
  border:1px solid transparent;
}

.status-active{
  background:var(--success-soft);
  color:#166534;
  border-color:rgba(34,197,94,.22);
}

.status-inactive{
  background:#f8fafc;
  color:#64748b;
  border-color:#e2e8f0;
}

.actions{
  display:flex;
  gap:8px;
  flex-wrap:wrap;
}

.alert{
  padding:12px 14px;
  border-radius:16px;
  font-weight:700;
}

.alert-danger{
  background:#fff1f2;
  border:1px solid #fecdd3;
  color:#b91c1c;
}

.empty-state{
  padding:44px 20px;
  text-align:center;
}

.empty-state-icon{
  font-size:36px;
  margin-bottom:12px;
}

.empty-state h3{
  margin:0;
  font-size:18px;
}

.empty-state p{
  margin:8px 0 0;
  color:var(--muted);
}

.pro-pager{
  display:flex;
  justify-content:flex-end;
  align-items:center;
  gap:12px;
  margin-top:16px;
  flex-wrap:wrap;
}

.pager-info{
  padding:10px 14px;
  border-radius:999px;
  background:#f8fafc;
  border:1px solid #e2e8f0;
  color:#475569;
  font-size:13px;
  font-weight:700;
}

.table-loader-wrap{
  min-height:220px;
  display:flex;
  align-items:center;
  justify-content:center;
}

.table-loader-ring{
  width:50px;
  height:50px;
  border-radius:999px;
  border:4px solid rgba(79,70,229,.12);
  border-top-color:#4f46e5;
  animation:spin .75s linear infinite;
}

.modal-backdrop{
  position:fixed;
  inset:0;
  background:rgba(2,6,23,.45);
  display:flex;
  align-items:center;
  justify-content:center;
  padding:18px;
  z-index:100;
  backdrop-filter:blur(3px);
}

.modal{
  width:min(760px, 100%);
  max-height:calc(100vh - 36px);
  overflow:auto;
  background:#fff;
  border-radius:24px;
  border:1px solid rgba(226,232,240,.9);
  box-shadow:var(--shadow-lg);
  padding:18px;
}

.modal-lg{
  width:min(1180px, 100%);
}

.modal-details{
  width:min(920px, 100%);
}

.modal-header{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
  margin-bottom:12px;
}

.modal-title{
  margin:0;
  font-size:22px;
  letter-spacing:-.02em;
}

.muted{
  color:#64748b;
  margin:4px 0 0;
}

.small{
  font-size:12px;
}

.tiny{
  font-size:11px;
}

.iconbtn{
  width:42px;
  height:42px;
  border-radius:14px;
  border:1px solid #e5e7eb;
  background:#fff;
  cursor:pointer;
  font-weight:900;
}

.iconbtn:hover{
  background:#f8fafc;
}

.form{
  margin-top:10px;
}

.grid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:14px;
}

.col-2{
  grid-column:span 2;
}

.label{
  display:block;
  font-size:12px;
  color:#64748b;
  margin:0 0 7px;
  font-weight:800;
  letter-spacing:.04em;
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
  font-weight:700;
  color:#334155;
}

.center-check{
  justify-content:center;
}

.modal-actions{
  display:flex;
  justify-content:flex-end;
  gap:10px;
  margin-top:16px;
  flex-wrap:wrap;
}

.price-box{
  border:1px solid #e8edf5;
  border-radius:22px;
  padding:14px;
  background:linear-gradient(180deg, #fcfdff 0%, #f8fafc 100%);
}

.price-box-head{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
  margin-bottom:12px;
  flex-wrap:wrap;
}

.subttl{
  margin:0;
  font-size:17px;
  letter-spacing:-.01em;
}

.price-editor-wrap{
  overflow:auto;
  border-radius:18px;
  border:1px solid #edf2f7;
  background:#fff;
}

.price-editor{
  width:100%;
  border-collapse:separate;
  border-spacing:0;
  min-width:980px;
}

.price-editor th,
.price-editor td{
  padding:11px;
  border-bottom:1px solid #edf2f7;
  text-align:left;
  vertical-align:middle;
}

.price-editor th{
  font-size:11px;
  text-transform:uppercase;
  letter-spacing:.1em;
  color:#64748b;
  background:#f8fafc;
  font-weight:900;
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
  gap:4px;
  padding:10px 12px;
  border:1px dashed #cbd5e1;
  border-radius:14px;
  background:#fff;
}

.helper-card strong{
  font-size:12px;
  color:#0f172a;
}

.helper-card span{
  font-size:12px;
  color:#64748b;
}

.details-product-head{
  display:grid;
  grid-template-columns:110px 1fr;
  gap:16px;
  align-items:start;
  margin-bottom:18px;
}

.details-thumb{
  width:110px;
  height:110px;
  border-radius:20px;
  overflow:hidden;
  display:grid;
  place-items:center;
  background:#f8fafc;
  border:1px solid #e5e7eb;
}

.details-thumb img{
  width:100%;
  height:100%;
  object-fit:cover;
  display:block;
}

.details-main h3{
  margin:0;
  font-size:24px;
  line-height:1.1;
  color:#0f172a;
}

.details-topline{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  flex-wrap:wrap;
}

.details-meta{
  margin-top:10px;
}

.details-desc{
  margin:12px 0 0;
  color:#64748b;
  line-height:1.6;
}

.details-section{
  margin-top:10px;
}

.details-section-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  margin-bottom:14px;
  flex-wrap:wrap;
}

.details-section-head h3{
  margin:0;
  font-size:18px;
  color:#0f172a;
}

.details-section-head span{
  font-size:13px;
  color:#64748b;
  font-weight:700;
}

.details-grid{
  display:grid;
  grid-template-columns:repeat(2, minmax(0, 1fr));
  gap:14px;
}

.detail-price-card{
  border:1px solid #e8edf5;
  border-radius:18px;
  background:linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  box-shadow:0 5px 16px rgba(15,23,42,.04);
  padding:14px;
}

.detail-price-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  margin-bottom:12px;
}

.detail-price-head strong{
  font-size:15px;
  color:#0f172a;
}

.detail-price-body{
  display:flex;
  flex-direction:column;
  gap:10px;
}

.detail-line{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  padding:10px 0;
  border-bottom:1px solid #edf2f7;
}

.detail-line:last-child{
  border-bottom:none;
  padding-bottom:0;
}

.detail-line span{
  font-size:13px;
  color:#64748b;
  font-weight:700;
}

.detail-line strong{
  font-size:15px;
  color:#0f172a;
}

.small-empty{
  padding:28px 16px;
}

@keyframes spin{
  to{ transform:rotate(360deg); }
}

@media (max-width: 980px){
  .search-grid{
    grid-template-columns:1fr;
  }

  .search-actions{
    width:100%;
  }

  .search-actions .btn{
    flex:1;
  }

  .grid{
    grid-template-columns:1fr;
  }

  .col-2{
    grid-column:span 1;
  }
}

@media (max-width: 700px){
  .products-page{
    padding:14px;
  }

  .products-hero{
    padding:18px;
    border-radius:22px;
  }

  .products-hero-title h1{
    font-size:28px;
  }

  .products-stats{
    display:grid;
    grid-template-columns:1fr 1fr;
  }

  .table-card-head{
    flex-direction:column;
  }

  .pro-pager{
    justify-content:center;
  }

  .details-product-head{
    grid-template-columns:1fr;
  }

  .details-thumb{
    width:90px;
    height:90px;
  }

  .details-grid{
    grid-template-columns:1fr;
  }
}
`;