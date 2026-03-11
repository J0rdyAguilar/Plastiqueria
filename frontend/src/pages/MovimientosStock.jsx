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

const TIPOS_FORM = [
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

  const [productoSearch, setProductoSearch] = useState("");
  const [productoOptions, setProductoOptions] = useState([]);
  const [searchingProductos, setSearchingProductos] = useState(false);
  const [selectedProducto, setSelectedProducto] = useState(null);

  const needsOrigen = useMemo(
    () => ["salida", "traslado", "ajuste"].includes(form.tipo),
    [form.tipo]
  );

  const needsDestino = useMemo(
    () => ["entrada", "traslado"].includes(form.tipo),
    [form.tipo]
  );

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
      setError(
        e?.response?.data?.message ||
          e?.message ||
          "Error cargando movimientos"
      );
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
      const res = await productosApi.search(text, { per_page: 20 });
      const arr = res?.data ?? [];
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, ubicacionId]);

  useEffect(() => {
    const t = setTimeout(() => {
      searchProductos(productoSearch);
    }, 300);

    return () => clearTimeout(t);
  }, [productoSearch]);

  useEffect(() => {
    // limpiar campos según el tipo para evitar payloads raros
    setForm((s) => {
      const next = { ...s };

      if (s.tipo === "entrada") {
        next.ubicacion_origen_id = "";
      }

      if (s.tipo === "salida") {
        next.ubicacion_destino_id = "";
      }

      if (s.tipo === "ajuste") {
        // dejamos origen, pero limpiamos destino por simplicidad
        next.ubicacion_destino_id = "";
      }

      return next;
    });
  }, [form.tipo]);

  function getErrorMessage(e) {
    const data = e?.response?.data;

    if (data?.errors) {
      const firstKey = Object.keys(data.errors)[0];
      if (firstKey && data.errors[firstKey]?.length) {
        return data.errors[firstKey][0];
      }
    }

    return data?.message || e?.message || "Error al crear movimiento";
  }

  async function onCreate(e) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    setError("");

    try {
      const cantidad = Number(form.cantidad_base);

      if (!form.producto_id) {
        throw new Error("Selecciona un producto.");
      }

      if (!Number.isFinite(cantidad) || cantidad === 0) {
        throw new Error("La cantidad debe ser válida y distinta de 0.");
      }

      if (needsOrigen && !form.ubicacion_origen_id) {
        throw new Error("Selecciona la ubicación origen.");
      }

      if (needsDestino && !form.ubicacion_destino_id) {
        throw new Error("Selecciona la ubicación destino.");
      }

      if (
        form.tipo === "traslado" &&
        String(form.ubicacion_origen_id) === String(form.ubicacion_destino_id)
      ) {
        throw new Error("En traslado, origen y destino no pueden ser iguales.");
      }

      const payload = {
        tipo: String(form.tipo).toLowerCase().trim(),
        producto_id: Number(form.producto_id),
        cantidad_base: cantidad,
        motivo: form.motivo?.trim() || undefined,
        ubicacion_origen_id: needsOrigen
          ? Number(form.ubicacion_origen_id)
          : undefined,
        ubicacion_destino_id: needsDestino
          ? Number(form.ubicacion_destino_id)
          : undefined,
      };

      Object.keys(payload).forEach((k) => {
        if (
          payload[k] === undefined ||
          payload[k] === null ||
          payload[k] === ""
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
        cantidad_base: "",
        ubicacion_origen_id: "",
        ubicacion_destino_id: "",
        motivo: "",
      });

      setProductoSearch("");
      setProductoOptions([]);
      setSelectedProducto(null);

      setPage(1);
      load(1);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  function pickProducto(p) {
    setSelectedProducto(p);
    setProductoSearch(`${p.sku || ""} - ${p.nombre || ""}`.trim());
    setProductoOptions([]);
    setForm((s) => ({
      ...s,
      producto_id: String(p.id),
    }));
  }

  const canPrev = meta?.current_page > 1;
  const canNext = meta?.current_page < meta?.last_page;

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
                <th className="right">Cantidad base</th>
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
                    <td className="muted">
                      {m.creado_en
                        ? new Date(m.creado_en).toLocaleString()
                        : "-"}
                    </td>

                    <td style={{ textTransform: "capitalize" }}>
                      {m.tipo || "-"}
                    </td>

                    <td>
                      {m.producto ? (
                        <div>
                          <div style={{ fontWeight: 600 }}>{m.producto.nombre}</div>
                          <div className="muted" style={{ fontSize: 13 }}>
                            {m.producto.sku || "-"}
                          </div>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>

                    <td className="right">{m.cantidad_base}</td>

                    <td className="muted">
                      {m.ubicacion_origen
                        ? `${m.ubicacion_origen.nombre} (${m.ubicacion_origen.tipo})`
                        : "-"}
                    </td>

                    <td className="muted">
                      {m.ubicacion_destino
                        ? `${m.ubicacion_destino.nombre} (${m.ubicacion_destino.tipo})`
                        : "-"}
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
                    {TIPOS_FORM.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
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
                      setForm((s) => ({ ...s, producto_id: "" }));
                    }}
                    placeholder="Escribe SKU, nombre o ID. Ej: VA"
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
                  <label>{form.tipo === "ajuste" ? "Cantidad (delta +/-)" : "Cantidad"}</label>
                  <input
                    required
                    type="number"
                    step="1"
                    value={form.cantidad_base}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, cantidad_base: e.target.value }))
                    }
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
                  onClick={() => !saving && setOpen(false)}
                >
                  Cancelar
                </button>

                <button className="btn primary" disabled={saving || !form.producto_id}>
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