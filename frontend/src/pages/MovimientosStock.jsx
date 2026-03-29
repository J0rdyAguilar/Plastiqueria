import React, { useEffect, useMemo, useState } from "react";
import { movimientosStockApi } from "../lib/stock";
import { ubicacionesApi } from "../lib/ubicaciones";
import { productosApi } from "../lib/productos";
import { notify } from "../lib/notify";
import { getSession } from "../lib/auth";

const TIPOS = [
  { value: "", label: "Todos" },
  { value: "entrada", label: "Entrada" },
  { value: "salida", label: "Salida" },
  { value: "traslado", label: "Traslado" },
  { value: "ajuste", label: "Ajuste" },
];

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

function getErrorMessage(error) {
  const data = error?.response?.data;

  if (data?.errors && typeof data.errors === "object") {
    const firstKey = Object.keys(data.errors)[0];
    const firstValue = firstKey ? data.errors[firstKey] : null;

    if (Array.isArray(firstValue) && firstValue[0]) return firstValue[0];
    if (typeof firstValue === "string" && firstValue.trim()) return firstValue;
  }

  if (data?.message && String(data.message).trim()) return data.message;

  return error?.message || "No se pudo aplicar el movimiento";
}

function toNullableNumber(value) {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  if (text === "") return undefined;

  const n = Number(text);
  return Number.isNaN(n) ? undefined : n;
}

function esUbicacionBodega(u) {
  const tipo = String(u?.tipo || "").toLowerCase().trim();
  const nombre = String(u?.nombre || "").toLowerCase().trim();

  return tipo === "bodega" || nombre.includes("bodega");
}

function InlineLoader() {
  return (
    <div className="mini-loader-wrap" aria-label="Cargando">
      <span className="mini-loader"></span>
    </div>
  );
}

function TableLoader() {
  return (
    <div className="table-loader-wrap" aria-label="Cargando">
      <div className="table-loader-ring"></div>
    </div>
  );
}

function ModalLoader({ text = "Cargando..." }) {
  return (
    <div className="modal-loader-wrap" aria-label={text}>
      <div className="modal-loader-ring"></div>
      <div className="modal-loader-text">{text}</div>
    </div>
  );
}

export default function MovimientosStock() {
  const session = getSession();
  const user = session?.user || {};

  const role = String(user?.role || user?.rol || "").toLowerCase();
  const isSuperAdmin = role === "superadmin";
  const userUbicacionId = String(user?.ubicacion_id || user?.sucursal_id || "");

  const [tipo, setTipo] = useState("");
  const [ubicacionId, setUbicacionId] = useState("");
  const [productoId, setProductoId] = useState("");

  const [ubicaciones, setUbicaciones] = useState([]);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);

  const [page, setPage] = useState(1);
  const [perPage] = useState(10);

  const [loading, setLoading] = useState(false);

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
    return (
      presentaciones.find(
        (p) =>
          p.presentacion.toLowerCase() ===
          String(form.presentacion || "").toLowerCase()
      ) || null
    );
  }, [presentaciones, form.presentacion]);

  const ubicacionPropia = useMemo(() => {
    return ubicaciones.find((u) => String(u.id) === userUbicacionId) || null;
  }, [ubicaciones, userUbicacionId]);

  const ubicacionesDisponiblesFiltro = useMemo(() => {
    if (isSuperAdmin) return ubicaciones;
    return ubicacionPropia ? [ubicacionPropia] : [];
  }, [isSuperAdmin, ubicaciones, ubicacionPropia]);

  const ubicacionesOrigenModal = useMemo(() => {
    if (isSuperAdmin) return ubicaciones;
    return ubicacionPropia ? [ubicacionPropia] : [];
  }, [isSuperAdmin, ubicaciones, ubicacionPropia]);

  const ubicacionesDestinoModal = useMemo(() => {
    if (isSuperAdmin) {
      if (form.tipo === "traslado" && form.ubicacion_origen_id) {
        return ubicaciones.filter(
          (u) => String(u.id) !== String(form.ubicacion_origen_id)
        );
      }
      return ubicaciones;
    }

    if (form.tipo === "traslado") {
      return ubicaciones.filter((u) => {
        const esPropia = String(u.id) === String(userUbicacionId);
        const esBodega = esUbicacionBodega(u);

        return !esPropia && !esBodega;
      });
    }

    if (form.tipo === "entrada") {
      return ubicacionPropia ? [ubicacionPropia] : [];
    }

    return [];
  }, [
    isSuperAdmin,
    ubicaciones,
    ubicacionPropia,
    form.tipo,
    form.ubicacion_origen_id,
    userUbicacionId,
  ]);

  async function loadUbicaciones() {
    try {
      const res = await ubicacionesApi.list({ per_page: 200, activa: 1 });
      const arr = res?.data ?? res ?? [];
      setUbicaciones(arr);

      if (!isSuperAdmin && userUbicacionId) {
        const propia = arr.find((u) => String(u.id) === userUbicacionId);
        if (propia) setUbicacionId(String(propia.id));
      }
    } catch (e) {
      console.error(e);
      notify.error(getErrorMessage(e));
    }
  }

  async function load(p = page, forcedUbicacionId = ubicacionId) {
    setLoading(true);

    try {
      const payload = {
        page: p,
        per_page: perPage,
      };

      if (tipo) payload.tipo = tipo;
      if (forcedUbicacionId) payload.ubicacion_id = forcedUbicacionId;
      if (productoId) payload.producto_id = productoId;

      const res = await movimientosStockApi.list(payload);

      setItems(res?.data || []);
      setMeta({
        current_page: res?.current_page || 1,
        last_page: res?.last_page || 1,
        total: res?.total || 0,
      });
    } catch (e) {
      console.error("ERROR CARGANDO MOVIMIENTOS:", e?.response?.data || e);
      notify.error(getErrorMessage(e));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isSuperAdmin && userUbicacionId) {
      setUbicacionId(userUbicacionId);
      load(1, userUbicacionId);
    } else {
      load(1, ubicacionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin, userUbicacionId]);

  useEffect(() => {
    const t = setTimeout(() => {
      searchProductos(productoSearch);
    }, 300);

    return () => clearTimeout(t);
  }, [productoSearch]);

  useEffect(() => {
    if (!open) return;
    if (!userUbicacionId && !isSuperAdmin) return;

    if (isSuperAdmin) {
      if (form.tipo === "entrada") {
        setForm((s) => ({ ...s, ubicacion_origen_id: "" }));
      }

      if (form.tipo === "salida" || form.tipo === "ajuste") {
        setForm((s) => ({ ...s, ubicacion_destino_id: "" }));
      }

      if (form.tipo === "traslado") {
        setForm((s) => ({
          ...s,
          ubicacion_destino_id:
            s.ubicacion_origen_id && s.ubicacion_origen_id === s.ubicacion_destino_id
              ? ""
              : s.ubicacion_destino_id,
        }));
      }

      return;
    }

    if (form.tipo === "entrada") {
      setForm((s) => ({
        ...s,
        ubicacion_origen_id: "",
        ubicacion_destino_id: userUbicacionId,
      }));
    }

    if (form.tipo === "salida" || form.tipo === "ajuste") {
      setForm((s) => ({
        ...s,
        ubicacion_origen_id: userUbicacionId,
        ubicacion_destino_id: "",
      }));
    }

    if (form.tipo === "traslado") {
      setForm((s) => ({
        ...s,
        ubicacion_origen_id: userUbicacionId,
        ubicacion_destino_id:
          String(s.ubicacion_destino_id) === String(userUbicacionId)
            ? ""
            : s.ubicacion_destino_id,
      }));
    }
  }, [form.tipo, open, isSuperAdmin, userUbicacionId]);

  async function onCreate(e) {
    e.preventDefault();
    setSaving(true);

    try {
      if (!isSuperAdmin && !userUbicacionId) {
        throw new Error("Tu usuario no tiene sucursal asignada.");
      }

      const payload = {
        tipo: form.tipo,
        producto_id: toNullableNumber(form.producto_id),
        presentacion: form.presentacion,
        cantidad: toNullableNumber(form.cantidad),
        motivo: form.motivo || undefined,
        ubicacion_origen_id: needsOrigen
          ? toNullableNumber(form.ubicacion_origen_id)
          : undefined,
        ubicacion_destino_id: needsDestino
          ? toNullableNumber(form.ubicacion_destino_id)
          : undefined,
      };

      Object.keys(payload).forEach((k) => {
        if (payload[k] === undefined || payload[k] === null || payload[k] === "") {
          delete payload[k];
        }
      });

      await movimientosStockApi.create(payload);

      notify.success("Movimiento aplicado correctamente");

      resetModal();
      setPage(1);
      await load(1, isSuperAdmin ? ubicacionId : userUbicacionId);
    } catch (e) {
      console.error("ERROR MOVIMIENTO:", e?.response?.data || e);
      notify.error(getErrorMessage(e));
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

  function openModal() {
    setOpen(true);

    setForm({
      tipo: "entrada",
      producto_id: "",
      presentacion: "",
      cantidad: "",
      ubicacion_origen_id: "",
      ubicacion_destino_id: !isSuperAdmin ? userUbicacionId || "" : "",
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

        <button className="btn primary" onClick={openModal} disabled={saving}>
          + Nuevo movimiento
        </button>
      </div>

      <div className="card">
        <div className="row gap">
          <div className="field">
            <label>Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} disabled={loading}>
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Ubicación (origen/destino)</label>
            {isSuperAdmin ? (
              <select
                value={ubicacionId}
                onChange={(e) => setUbicacionId(e.target.value)}
                disabled={loading}
              >
                <option value="">Todas</option>
                {ubicacionesDisponiblesFiltro.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} ({u.tipo})
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={
                  ubicacionPropia
                    ? `${ubicacionPropia.nombre} (${ubicacionPropia.tipo})`
                    : "Sucursal asignada"
                }
                disabled
                readOnly
              />
            )}
          </div>

          <div className="field">
            <label>Producto ID (opcional)</label>
            <input
              value={productoId}
              onChange={(e) => setProductoId(e.target.value)}
              placeholder="Ej: 10"
              disabled={loading}
            />
          </div>

          <div className="field">
            <label>&nbsp;</label>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setPage(1);
                load(1, isSuperAdmin ? ubicacionId : userUbicacionId);
              }}
              disabled={loading}
            >
              {loading ? <InlineLoader /> : "Filtrar"}
            </button>
          </div>
        </div>

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
              {loading ? (
                <tr>
                  <td colSpan="10" className="users-loader-cell">
                    <TableLoader />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan="10" className="muted">
                    No hay movimientos.
                  </td>
                </tr>
              ) : (
                items.map((m) => (
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
                ))
              )}
            </tbody>
          </table>
        </div>

        {meta && (
          <div className="row between mt">
            <div className="muted">
              {loading ? <InlineLoader /> : `Página ${meta.current_page} de ${meta.last_page} · Total ${meta.total}`}
            </div>

            <div className="row gap">
              <button
                className="btn"
                disabled={!canPrev || loading}
                onClick={() => {
                  const p = page - 1;
                  setPage(p);
                  load(p, isSuperAdmin ? ubicacionId : userUbicacionId);
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
                  load(p, isSuperAdmin ? ubicacionId : userUbicacionId);
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

            {saving ? (
              <ModalLoader text="Aplicando movimiento..." />
            ) : (
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
                          ubicacion_origen_id:
                            e.target.value === "salida" ||
                            e.target.value === "ajuste" ||
                            e.target.value === "traslado"
                              ? isSuperAdmin
                                ? ""
                                : userUbicacionId
                              : "",
                          ubicacion_destino_id:
                            e.target.value === "entrada"
                              ? isSuperAdmin
                                ? ""
                                : userUbicacionId
                              : "",
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
                        Seleccionado: #{selectedProducto.id} - {selectedProducto.sku} - {selectedProducto.nombre}
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
                            <b>{p.sku || "(sin sku)"}</b> - {p.nombre} <span className="muted">#{p.id}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {productoSearch.trim().length > 0 && searchingProductos && (
                      <div style={{ marginTop: 8 }}>
                        <InlineLoader />
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
                    <b>Equivalencia:</b> {form.cantidad || 0} × {presentacionSeleccionada.presentacion} × factor{" "}
                    {presentacionSeleccionada.factor_base} ={" "}
                    <b>
                      {Number(form.cantidad || 0) *
                        Number(presentacionSeleccionada.factor_base || 0)}
                    </b>{" "}
                    en unidad base
                  </div>
                ) : null}

                <div className="row gap">
                  {needsOrigen && (
                    <div className="field grow">
                      <label>Ubicación origen</label>

                      {isSuperAdmin ? (
                        <select
                          required
                          value={form.ubicacion_origen_id}
                          onChange={(e) =>
                            setForm((s) => ({
                              ...s,
                              ubicacion_origen_id: e.target.value,
                              ubicacion_destino_id:
                                form.tipo === "traslado" &&
                                e.target.value === s.ubicacion_destino_id
                                  ? ""
                                  : s.ubicacion_destino_id,
                            }))
                          }
                        >
                          <option value="">Seleccione...</option>
                          {ubicacionesOrigenModal.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.nombre} ({u.tipo})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={
                            ubicacionPropia
                              ? `${ubicacionPropia.nombre} (${ubicacionPropia.tipo})`
                              : "Sucursal asignada"
                          }
                          disabled
                          readOnly
                        />
                      )}
                    </div>
                  )}

                  {needsDestino && (
                    <div className="field grow">
                      <label>Ubicación destino</label>

                      {!isSuperAdmin && form.tipo === "entrada" ? (
                        <input
                          value={
                            ubicacionPropia
                              ? `${ubicacionPropia.nombre} (${ubicacionPropia.tipo})`
                              : "Sucursal asignada"
                          }
                          disabled
                          readOnly
                        />
                      ) : (
                        <select
                          required
                          value={form.ubicacion_destino_id}
                          onChange={(e) =>
                            setForm((s) => ({ ...s, ubicacion_destino_id: e.target.value }))
                          }
                        >
                          <option value="">Seleccione...</option>
                          {ubicacionesDestinoModal.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.nombre} ({u.tipo})
                            </option>
                          ))}
                        </select>
                      )}
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
                      !form.cantidad ||
                      (!isSuperAdmin && !userUbicacionId) ||
                      (needsOrigen && isSuperAdmin && !form.ubicacion_origen_id) ||
                      (needsDestino && form.tipo === "traslado" && !form.ubicacion_destino_id) ||
                      (needsDestino && form.tipo === "entrada" && isSuperAdmin && !form.ubicacion_destino_id)
                    }
                  >
                    {saving ? <InlineLoader /> : "Aplicar"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}