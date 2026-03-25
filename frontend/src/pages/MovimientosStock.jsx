import React, { useEffect, useMemo, useState } from "react";
import { movimientosStockApi } from "../lib/stock";
import { ubicacionesApi } from "../lib/ubicaciones";
import { productosApi } from "../lib/productos";

const TIPOS = [
  { value: "", label: "Todos" },
  { value: "entrada", label: "Entrada" },
  { value: "salida", label: "Salida" },
  { value: "traslado", label: "Traslado" },
  { value: "ajuste", label: "Ajuste" },
];

function formatApiError(e) {
  const data = e?.response?.data;

  if (typeof data?.message === "string" && data.message.trim()) {
    return data.message;
  }

  if (data?.errors && typeof data.errors === "object") {
    const firstKey = Object.keys(data.errors)[0];
    const firstValue = data.errors[firstKey];
    if (Array.isArray(firstValue) && firstValue.length) {
      return firstValue[0];
    }
    if (typeof firstValue === "string") {
      return firstValue;
    }
  }

  return e?.message || "Error cargando movimientos";
}

function normalizarPrecios(precios = []) {
  if (!Array.isArray(precios)) return [];

  return precios
    .filter((p) => p && (p.activo === undefined || p.activo === true || p.activo === 1))
    .map((p) => ({
      id: p.id,
      presentacion: String(p.presentacion || "").trim(),
      factor_base: Number(p.factor_base || 0),
      precio: Number(p.precio || 0),
    }))
    .filter((p) => p.presentacion && p.factor_base > 0);
}

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

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    tipo: "entrada",
    producto_id: "",
    presentacion: "",
    cantidad: "",
    ubicacion_origen_id: "",
    ubicacion_destino_id: "",
    motivo: "",
  });

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [productoSearch, setProductoSearch] = useState("");
  const [productoOptions, setProductoOptions] = useState([]);
  const [searchingProductos, setSearchingProductos] = useState(false);
  const [selectedProducto, setSelectedProducto] = useState(null);
  const [presentaciones, setPresentaciones] = useState([]);

  const needsOrigen = useMemo(
    () => ["salida", "traslado", "ajuste"].includes(form.tipo),
    [form.tipo]
  );

  const needsDestino = useMemo(
    () => ["entrada", "traslado"].includes(form.tipo),
    [form.tipo]
  );

  const presentacionSeleccionada = useMemo(() => {
    return presentaciones.find(
      (p) => p.presentacion.toLowerCase() === String(form.presentacion || "").toLowerCase()
    ) || null;
  }, [presentaciones, form.presentacion]);

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
      const payload = {
        page: p,
        per_page: perPage,
      };

      if (tipo) payload.tipo = tipo;
      if (ubicacionId) payload.ubicacion_id = ubicacionId;
      if (productoId) payload.producto_id = productoId;

      const res = await movimientosStockApi.list(payload);

      setItems(res?.data || []);
      setMeta({
        current_page: res?.current_page || 1,
        last_page: res?.last_page || 1,
        total: res?.total || 0,
      });
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }

  async function searchProductos(term) {
    const text = String(term || "").trim();

    if (text.length < 1) {
      setProductoOptions([]);
      return;
    }

    try {
      setSearchingProductos(true);

      let arr = [];
      if (typeof productosApi.search === "function") {
        const res = await productosApi.search(text, { per_page: 20 });
        arr = res?.data ?? [];
      } else if (typeof productosApi.list === "function") {
        const res = await productosApi.list({ q: text, per_page: 20 });
        arr = res?.data ?? [];
      }

      setProductoOptions(arr);
    } catch (e) {
      console.error(e);
      setProductoOptions([]);
    } finally {
      setSearchingProductos(false);
    }
  }

  useEffect(() => {
    loadUbicaciones();
    load(1);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      searchProductos(productoSearch);
    }, 300);

    return () => clearTimeout(t);
  }, [productoSearch]);

  async function onCreate(e) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    setError("");

    try {
      const payload = {
        tipo: form.tipo,
        producto_id: Number(form.producto_id),
        presentacion: form.presentacion,
        cantidad: Number(form.cantidad),
        motivo: form.motivo || undefined,
        ubicacion_origen_id: needsOrigen ? Number(form.ubicacion_origen_id) : undefined,
        ubicacion_destino_id: needsDestino ? Number(form.ubicacion_destino_id) : undefined,
      };

      Object.keys(payload).forEach((k) => {
        if (
          payload[k] === undefined ||
          payload[k] === null ||
          payload[k] === "" ||
          Number.isNaN(payload[k])
        ) {
          delete payload[k];
        }
      });

      await movimientosStockApi.create(payload);

      setMsg("Movimiento aplicado correctamente.");
      setOpen(false);
      setForm({
        tipo: "entrada",
        producto_id: "",
        presentacion: "",
        cantidad: "",
        ubicacion_origen_id: "",
        ubicacion_destino_id: "",
        motivo: "",
      });
      setProductoSearch("");
      setProductoOptions([]);
      setSelectedProducto(null);
      setPresentaciones([]);
      setPage(1);
      await load(1);
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setSaving(false);
    }
  }

  function pickProducto(p) {
    const precios = normalizarPrecios(p?.precios || []);

    setSelectedProducto(p);
    setProductoSearch(`${p.sku || ""} - ${p.nombre || ""}`.trim());
    setProductoOptions([]);
    setPresentaciones(precios);

    setForm((s) => ({
      ...s,
      producto_id: String(p.id),
      presentacion: precios[0]?.presentacion || "",
    }));
  }

  function resetModal() {
    setOpen(false);
    setForm({
      tipo: "entrada",
      producto_id: "",
      presentacion: "",
      cantidad: "",
      ubicacion_origen_id: "",
      ubicacion_destino_id: "",
      motivo: "",
    });
    setProductoSearch("");
    setProductoOptions([]);
    setSelectedProducto(null);
    setPresentaciones([]);
  }

  const canPrev = (meta?.current_page || 1) > 1;
  const canNext = (meta?.current_page || 1) < (meta?.last_page || 1);

  return (
    <div className="page">
      <div className="page-head row between">
        <div>
          <h2>Movimientos de Stock</h2>
          <div className="muted">Entradas, salidas, traslados y ajustes</div>
        </div>
        <button
          className="btn primary"
          onClick={() => {
            setMsg("");
            setError("");
            setOpen(true);
          }}
        >
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
            <input
              value={productoId}
              onChange={(e) => setProductoId(e.target.value)}
              placeholder="Ej: 10"
            />
          </div>

          <div className="field">
            <label>&nbsp;</label>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setPage(1);
                load(1);
              }}
              disabled={loading}
            >
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
                <th>Presentación</th>
                <th className="right">Cantidad</th>
                <th className="right">Factor</th>
                <th className="right">Cantidad base</th>
                <th>Origen</th>
                <th>Destino</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan="10" className="muted">
                    No hay movimientos.
                  </td>
                </tr>
              )}

              {items.map((m) => (
                <tr key={m.id}>
                  <td className="muted">{m.creado_en}</td>
                  <td>{m.tipo}</td>
                  <td>{m.producto_nombre || m.producto?.nombre || m.producto_id}</td>
                  <td>{m.presentacion || "-"}</td>
                  <td className="right">{m.cantidad ?? "-"}</td>
                  <td className="right">{m.factor_aplicado ?? "-"}</td>
                  <td className="right">{m.cantidad_base}</td>
                  <td className="muted">
                    {m.ubicacion_origen_nombre || m.ubicacion_origen_id || "-"}
                  </td>
                  <td className="muted">
                    {m.ubicacion_destino_nombre || m.ubicacion_destino_id || "-"}
                  </td>
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
              <button
                className="btn"
                disabled={!canPrev || loading}
                onClick={() => {
                  const p = page - 1;
                  setPage(p);
                  load(p);
                }}
              >
                Anterior
              </button>
              <button
                className="btn"
                disabled={!canNext || loading}
                onClick={() => {
                  const p = page + 1;
                  setPage(p);
                  load(p);
                }}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {open && (
        <div className="modal-backdrop" onClick={() => !saving && resetModal()}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Nuevo movimiento</h3>
              <button className="icon-btn" onClick={() => !saving && resetModal()}>
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
                        ubicacion_origen_id: "",
                        ubicacion_destino_id: "",
                      }))
                    }
                  >
                    <option value="entrada">Entrada</option>
                    <option value="salida">Salida</option>
                    <option value="traslado">Traslado</option>
                    <option value="ajuste">Ajuste</option>
                  </select>
                </div>

                <div className="field" style={{ position: "relative" }}>
                  <label>Producto</label>
                  <input
                    required
                    value={productoSearch}
                    onChange={(e) => {
                      setProductoSearch(e.target.value);
                      setSelectedProducto(null);
                      setPresentaciones([]);
                      setForm((s) => ({
                        ...s,
                        producto_id: "",
                        presentacion: "",
                      }));
                    }}
                    placeholder="Escribe SKU, nombre o ID"
                    autoComplete="off"
                  />

                  {form.producto_id && selectedProducto ? (
                    <div className="muted" style={{ marginTop: 6 }}>
                      Seleccionado: #{selectedProducto.id} - {selectedProducto.sku} -{" "}
                      {selectedProducto.nombre}
                    </div>
                  ) : null}

                  {productoSearch.trim().length > 0 && productoOptions.length > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        background: "#fff",
                        border: "1px solid #ddd",
                        borderRadius: 10,
                        marginTop: 6,
                        maxHeight: 220,
                        overflowY: "auto",
                        zIndex: 50,
                        boxShadow: "0 8px 24px rgba(0,0,0,.12)",
                      }}
                    >
                      {productoOptions.map((p) => (
                        <button
                          type="button"
                          key={p.id}
                          onClick={() => pickProducto(p)}
                          style={{
                            display: "block",
                            width: "100%",
                            textAlign: "left",
                            padding: "10px 12px",
                            border: "none",
                            background: "white",
                            cursor: "pointer",
                          }}
                        >
                          <b>{p.sku || "(sin sku)"}</b> - {p.nombre}{" "}
                          <span className="muted">#{p.id}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {productoSearch.trim().length > 0 && searchingProductos && (
                    <div className="muted" style={{ marginTop: 6 }}>
                      Buscando productos...
                    </div>
                  )}
                </div>

                <div className="field">
                  <label>Presentación</label>
                  <select
                    required
                    value={form.presentacion}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, presentacion: e.target.value }))
                    }
                    disabled={!form.producto_id || presentaciones.length === 0}
                  >
                    <option value="">Seleccione...</option>
                    {presentaciones.map((p) => (
                      <option key={p.id || p.presentacion} value={p.presentacion}>
                        {p.presentacion} (factor: {p.factor_base})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>{form.tipo === "ajuste" ? "Cantidad (delta)" : "Cantidad"}</label>
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={form.cantidad}
                    onChange={(e) => setForm((s) => ({ ...s, cantidad: e.target.value }))}
                    placeholder="Ej: 10"
                  />
                </div>
              </div>

              {presentacionSeleccionada ? (
                <div
                  style={{
                    marginTop: 10,
                    marginBottom: 8,
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    fontSize: 14,
                  }}
                >
                  <b>Equivalencia:</b>{" "}
                  {form.cantidad || 0} × {presentacionSeleccionada.presentacion} × factor{" "}
                  {presentacionSeleccionada.factor_base} ={" "}
                  <b>
                    {Number(form.cantidad || 0) * Number(presentacionSeleccionada.factor_base || 0)}
                  </b>{" "}
                  en unidad base
                </div>
              ) : null}

              <div className="row gap">
                {needsOrigen && (
                  <div className="field grow">
                    <label>Ubicación origen</label>
                    <select
                      required
                      value={form.ubicacion_origen_id}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, ubicacion_origen_id: e.target.value }))
                      }
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
                      onChange={(e) =>
                        setForm((s) => ({ ...s, ubicacion_destino_id: e.target.value }))
                      }
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
                <button
                  type="button"
                  className="btn"
                  onClick={() => !saving && resetModal()}
                >
                  Cancelar
                </button>
                <button
                  className="btn primary"
                  disabled={
                    saving ||
                    !form.producto_id ||
                    !form.presentacion ||
                    !form.cantidad
                  }
                >
                  {saving ? "Guardando..." : "Aplicar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}