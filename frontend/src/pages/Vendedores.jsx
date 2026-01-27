// src/pages/Vendedores.jsx
import React, { useEffect, useMemo, useState } from "react";
import { vendedoresApi } from "../lib/vendedores";
import { rutasApi } from "../lib/rutas";
import { api } from "../lib/api";
import { getSession } from "../lib/auth";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";

const emptyForm = {
  usuario_id: "",
  codigo: "",
};

function formatBackendError(err) {
  const data = err?.data;
  if (data?.errors && typeof data.errors === "object") {
    const lines = [];
    for (const [k, arr] of Object.entries(data.errors)) {
      if (Array.isArray(arr)) arr.forEach((m) => lines.push(`${k}: ${m}`));
    }
    if (lines.length) return lines.join("\n");
  }
  return data?.message || err?.message || "Ocurrió un error";
}

export default function Vendedores() {
  const nav = useNavigate();
  const me = getSession()?.user;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  // modal vendedor (crear/editar)
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  // SELECT usuarios rol=vendedor (activos)
  const [usuariosVend, setUsuariosVend] = useState([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);

  // modal rutas
  const [openRutas, setOpenRutas] = useState(false);
  const [vendedorRutas, setVendedorRutas] = useState(null);
  const [rutas, setRutas] = useState([]);
  const [rutaIds, setRutaIds] = useState([]);
  const [loadingRutas, setLoadingRutas] = useState(false);

  async function load() {
    setError("");
    setLoading(true);
    try {
      const data = await api.vendedoresList({ per_page: 100 });
      setItems(Array.isArray(data) ? data : data?.data || []);
    } catch (err) {
      setError(formatBackendError(err));
      if (err?.status === 401) nav("/login", { replace: true });
    } finally {
      setLoading(false);
    }
  }

  async function loadUsuariosVendedor() {
    setLoadingUsuarios(true);
    try {
      const data = await api.usuariosList();
      const list = Array.isArray(data) ? data : data?.data || [];
      const vend = list.filter((u) => u.rol === "vendedor" && !!u.activo);
      setUsuariosVend(vend);
    } catch (err) {
      setError(formatBackendError(err));
    } finally {
      setLoadingUsuarios(false);
    }
  }

  async function abrirAsignarRutas(v) {
    setError("");
    setVendedorRutas(v);
    setRutaIds([]);
    setOpenRutas(true);

    // cargar catálogo rutas
    setLoadingRutas(true);
    try {
      const data = await rutasApi.list({ per_page: 500 });
      setRutas(Array.isArray(data) ? data : data?.data || []);
    } catch (err) {
      setError(formatBackendError(err));
    } finally {
      setLoadingRutas(false);
    }

    // cargar rutas asignadas
    try {
      // requiere api.vendedoresShow en api.js (o usar vendedoresApi.show si lo tenés)
      const full = await api.vendedoresShow(v.id);
      const ids = (full?.rutas || []).map((r) => r.id);
      setRutaIds(ids);
    } catch {
      // no bloquea
    }
  }

  function toggleRuta(id) {
    setRutaIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function guardarRutas() {
    if (!vendedorRutas?.id) return;
    if (rutaIds.length === 0) {
      setError("Selecciona al menos 1 ruta.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await vendedoresApi.asignarRutas(vendedorRutas.id, rutaIds, "sync");
      setOpenRutas(false);
      await load();
    } catch (err) {
      setError(formatBackendError(err));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;

    return items.filter((v) => {
      const u = v.usuario || {};
      const activoUsuario = !!u.activo;
      const a = `${u.nombre || ""} ${u.usuario || ""} ${u.telefono || ""} ${
        v.codigo || ""
      } ${activoUsuario ? "activo" : "inactivo"}`.toLowerCase();
      return a.includes(s);
    });
  }, [items, q]);

  async function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm });
    setOpen(true);
    setError("");
    await loadUsuariosVendedor();
  }

  function openEdit(v) {
    setEditing(v);
    setForm({
      usuario_id: v.usuario_id ?? "",
      codigo: v.codigo ?? "",
    });
    setOpen(true);
    setError("");
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      if (editing?.id) {
        const payload = {
          codigo: form.codigo.trim() ? form.codigo.trim() : null,
        };
        await vendedoresApi.update(editing.id, payload);
      } else {
        const payload = {
          usuario_id: Number(form.usuario_id),
          codigo: form.codigo.trim() ? form.codigo.trim() : null,
        };
        if (!payload.usuario_id)
          throw new Error("Debes seleccionar un usuario vendedor.");
        await vendedoresApi.create(payload);
      }

      setOpen(false);
      await load();
    } catch (err) {
      setError(formatBackendError(err));
    } finally {
      setBusy(false);
    }
  }

  async function del(v) {
    const u = v.usuario || {};
    const ok = confirm(
      `¿Eliminar vendedor de "${u.usuario || u.nombre || "ID " + v.id}"?`
    );
    if (!ok) return;

    setBusy(true);
    setError("");
    try {
      await vendedoresApi.remove(v.id);
      await load();
    } catch (err) {
      setError(formatBackendError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout>
      <div className="page">
        <header className="topbar">
          <div>
            <h2>Vendedores</h2>
            <p className="muted">
              Sesión: <b>{me?.nombre || me?.usuario || "—"}</b> ({me?.rol || "—"})
            </p>
          </div>

          <div className="topbar-actions">
            <button className="btn" onClick={load} disabled={loading || busy}>
              Recargar
            </button>
            <button className="btn primary" onClick={openCreate} disabled={busy}>
              + Nuevo
            </button>
          </div>
        </header>

        <div className="card pad">
          <div className="row">
            <div className="search">
              <input
                placeholder="Buscar por nombre, usuario, teléfono o código…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="muted small">
              {loading ? "Cargando..." : `${filtered.length} vendedor(es)`}
            </div>
          </div>

          {error ? (
            <div
              className="alert"
              style={{ marginTop: 12, whiteSpace: "pre-wrap" }}
            >
              {error}
            </div>
          ) : null}

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Usuario</th>
                  <th>Teléfono</th>
                  <th>Código</th>
                  <th>Activo</th>
                  <th className="right">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="muted">
                      Cargando…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="muted">
                      Sin resultados
                    </td>
                  </tr>
                ) : (
                  filtered.map((v) => {
                    const u = v.usuario || {};
                    const activoUsuario = !!u.activo;

                    return (
                      <tr key={v.id}>
                        <td>{u.nombre || "—"}</td>
                        <td>
                          <span className="pill">{u.usuario || "—"}</span>
                        </td>
                        <td>{u.telefono || "—"}</td>
                        <td>{v.codigo || "—"}</td>
                        <td>
                          {activoUsuario ? (
                            <span className="dot ok">Activo</span>
                          ) : (
                            <span className="dot off">Inactivo</span>
                          )}
                        </td>
                        <td className="right">
                          <button
                            className="btn sm"
                            onClick={() => abrirAsignarRutas(v)}
                            disabled={busy}
                          >
                            Rutas
                          </button>
                          <button
                            className="btn sm"
                            onClick={() => openEdit(v)}
                            disabled={busy}
                          >
                            Editar
                          </button>
                          <button
                            className="btn sm danger"
                            onClick={() => del(v)}
                            disabled={busy}
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL CREAR/EDITAR */}
        {open ? (
          <div
            className="modal-backdrop"
            onMouseDown={() => !busy && setOpen(false)}
          >
            <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <h3>{editing ? "Editar vendedor" : "Nuevo vendedor"}</h3>
                  <p className="muted small">
                    {editing
                      ? "Actualiza el código del vendedor."
                      : "Crea un vendedor vinculado a un usuario con rol vendedor."}
                  </p>
                </div>
                <button
                  className="iconbtn"
                  onClick={() => !busy && setOpen(false)}
                >
                  ✕
                </button>
              </div>

              {error ? (
                <div className="alert" style={{ whiteSpace: "pre-wrap" }}>
                  {error}
                </div>
              ) : null}

              <form onSubmit={save} className="grid">
                {!editing ? (
                  <div className="field">
                    <label>Usuario (rol vendedor)</label>

                    <select
                      value={form.usuario_id}
                      onChange={(e) =>
                        setForm({ ...form, usuario_id: e.target.value })
                      }
                      disabled={loadingUsuarios}
                    >
                      <option value="">
                        {loadingUsuarios
                          ? "Cargando usuarios..."
                          : "Seleccione un usuario vendedor..."}
                      </option>
                      {usuariosVend.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nombre} ({u.usuario})
                        </option>
                      ))}
                    </select>

                    <p className="hint" style={{ marginTop: 6 }}>
                      Solo aparecen usuarios con rol <b>vendedor</b> y activos.
                    </p>
                  </div>
                ) : null}

                <div className="field">
                  <label>Código</label>
                  <input
                    value={form.codigo}
                    onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                    placeholder="Ej: VEND-001"
                  />
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => !busy && setOpen(false)}
                  >
                    Cancelar
                  </button>
                  <button className="btn primary" disabled={busy}>
                    {busy ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {/* MODAL ASIGNAR RUTAS */}
        {openRutas ? (
          <div
            className="modal-backdrop"
            onMouseDown={() => !busy && setOpenRutas(false)}
          >
            <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <h3>Asignar rutas</h3>
                  <p className="muted small">
                    Vendedor:{" "}
                    <b>
                      {vendedorRutas?.usuario?.nombre ||
                        vendedorRutas?.usuario?.usuario ||
                        "—"}
                    </b>
                  </p>
                </div>
                <button
                  className="iconbtn"
                  onClick={() => !busy && setOpenRutas(false)}
                >
                  ✕
                </button>
              </div>

              {error ? (
                <div className="alert" style={{ whiteSpace: "pre-wrap" }}>
                  {error}
                </div>
              ) : null}

              <div className="card pad" style={{ marginTop: 10 }}>
                {loadingRutas ? (
                  <div className="muted">Cargando rutas…</div>
                ) : rutas.length === 0 ? (
                  <div className="muted">No hay rutas creadas.</div>
                ) : (
                  <div className="routes-list">
                    {rutas.map((r) => (
                      <label key={r.id} className="route-item">
                        <input
                          type="checkbox"
                          className="route-check"
                          checked={rutaIds.includes(r.id)}
                          onChange={() => toggleRuta(r.id)}
                          disabled={busy}
                        />
                        <span className="route-name">{r.nombre}</span>
                        {r.zona?.nombre ? (
                          <span className="route-zone">{r.zona.nombre}</span>
                        ) : null}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => !busy && setOpenRutas(false)}
                >
                  Cancelar
                </button>
                <button
                  className="btn primary"
                  onClick={guardarRutas}
                  disabled={busy || loadingRutas}
                >
                  {busy ? "Guardando..." : "Guardar rutas"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Layout>
  );
}
