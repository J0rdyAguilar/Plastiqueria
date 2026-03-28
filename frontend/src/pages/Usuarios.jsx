import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { getSession } from "../lib/auth";

const emptyForm = {
  ubicacion_id: "",
  nombre: "",
  usuario: "",
  telefono: "",
  password: "",
  rol: "vendedor",
  activo: true,
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

function prettyRole(rol) {
  switch (rol) {
    case "super_admin":
      return "Super Admin";
    case "admin":
      return "Admin";
    case "vendedor":
      return "Vendedor";
    case "vendedor-tienda":
      return "Vendedor Tienda";
    case "caja":
      return "Caja";
    default:
      return rol || "—";
  }
}

export default function Usuarios() {
  const nav = useNavigate();
  const me = getSession()?.user;

  const canManageUsers = me?.rol === "admin" || me?.rol === "super_admin";

  const [items, setItems] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingUbicaciones, setLoadingUbicaciones] = useState(true);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!me) nav("/login", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadUsuarios() {
    setError("");
    setLoading(true);
    try {
      const res = await api.usuariosList();
      const list = Array.isArray(res) ? res : res?.data || [];
      setItems(list);
    } catch (err) {
      setError(formatBackendError(err));
      if (err?.status === 401) nav("/login", { replace: true });
    } finally {
      setLoading(false);
    }
  }

  async function loadUbicaciones() {
    setLoadingUbicaciones(true);
    try {
      const res = await api.ubicacionesList();
      let list = Array.isArray(res) ? res : res?.data || [];
      list = list.filter((u) => Number(u.activa) === 1 || u.activa === true);
      setUbicaciones(list);
    } catch (err) {
      setError(formatBackendError(err));
    } finally {
      setLoadingUbicaciones(false);
    }
  }

  async function loadAll() {
    await Promise.all([loadUsuarios(), loadUbicaciones()]);
  }

  useEffect(() => {
    if (!canManageUsers) {
      setLoading(false);
      setLoadingUbicaciones(false);
      return;
    }
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageUsers]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;

    return items.filter((u) => {
      const ubicacionNombre = u.ubicacion?.nombre || u.ubicacion_nombre || "";
      const a =
        `${u.nombre || ""} ${u.usuario || ""} ${u.telefono || ""} ${u.rol || ""} ${ubicacionNombre}`.toLowerCase();

      return a.includes(s);
    });
  }, [items, q]);

  function openCreate() {
    setEditing(null);
    setForm({
      ...emptyForm,
      activo: true,
      rol: "vendedor",
      ubicacion_id: "",
    });
    setOpen(true);
    setError("");
  }

  function openEdit(u) {
    setEditing(u);
    setForm({
      ubicacion_id: u.ubicacion_id ?? u.ubicacion?.id ?? "",
      nombre: u.nombre ?? "",
      usuario: u.usuario ?? "",
      telefono: u.telefono ?? "",
      password: "",
      rol: u.rol ?? "vendedor",
      activo: !!u.activo,
    });
    setOpen(true);
    setError("");
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      if (!form.ubicacion_id) {
        throw new Error("Debes seleccionar una sucursal.");
      }

      const payload = {
        ubicacion_id: Number(form.ubicacion_id),
        nombre: form.nombre.trim(),
        usuario: form.usuario.trim(),
        telefono: form.telefono.trim() ? form.telefono.trim() : null,
        rol: form.rol,
        activo: form.activo ? 1 : 0,
      };

      if (form.password && form.password.trim().length > 0) {
        payload.password = form.password.trim();
      }

      if (editing?.id) {
        await api.usuariosUpdate(editing.id, payload);
      } else {
        if (!payload.password) {
          throw new Error("La contraseña es obligatoria para crear un usuario.");
        }
        await api.usuariosCreate(payload);
      }

      setOpen(false);
      await loadUsuarios();
    } catch (err) {
      setError(formatBackendError(err));
    } finally {
      setBusy(false);
    }
  }

  async function del(u) {
    const ok = confirm(`¿Eliminar usuario "${u.usuario}"?`);
    if (!ok) return;

    setBusy(true);
    setError("");
    try {
      await api.usuariosDelete(u.id);
      await loadUsuarios();
    } catch (err) {
      setError(formatBackendError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      {!canManageUsers ? (
        <div className="card pad" style={{ marginTop: 12 }}>
          <h3>Acceso denegado</h3>
          <p className="muted" style={{ marginTop: 6 }}>
            Tu rol <b>{me?.rol || "—"}</b> no tiene permiso para administrar usuarios.
          </p>

          <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
            <button className="btn primary" onClick={() => nav("/", { replace: true })}>
              Ir al inicio
            </button>
            <button className="btn" onClick={() => nav(-1)}>
              Volver
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="card pad">
            <div className="row">
              <div className="search">
                <input
                  placeholder="Buscar por nombre, usuario, teléfono, rol o sucursal…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>

              <div className="muted small users-count-box">
                {loading ? <InlineLoader /> : `${filtered.length} usuario(s)`}
              </div>

              <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
                <button
                  className="btn"
                  onClick={loadAll}
                  disabled={loading || busy || loadingUbicaciones}
                >
                  Recargar
                </button>
                <button
                  className="btn primary"
                  onClick={openCreate}
                  disabled={busy || loadingUbicaciones}
                >
                  + Nuevo
                </button>
              </div>
            </div>

            {error ? (
              <div className="alert" style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>
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
                    <th>Sucursal</th>
                    <th>Rol</th>
                    <th>Activo</th>
                    <th className="right">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="users-loader-cell">
                        <TableLoader />
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="muted">
                        Sin resultados
                      </td>
                    </tr>
                  ) : (
                    filtered.map((u) => (
                      <tr key={u.id}>
                        <td>{u.nombre}</td>
                        <td>
                          <span className="pill">{u.usuario}</span>
                        </td>
                        <td>{u.telefono || "—"}</td>
                        <td>{u.ubicacion?.nombre || u.ubicacion_nombre || "—"}</td>
                        <td>
                          <span className="badge">{prettyRole(u.rol)}</span>
                        </td>
                        <td>
                          {u.activo ? (
                            <span className="dot ok">Activo</span>
                          ) : (
                            <span className="dot off">Inactivo</span>
                          )}
                        </td>
                        <td className="right">
                          <button className="btn sm" onClick={() => openEdit(u)} disabled={busy}>
                            Editar
                          </button>
                          <button className="btn sm danger" onClick={() => del(u)} disabled={busy}>
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {open ? (
            <div className="modal-backdrop" onMouseDown={() => !busy && setOpen(false)}>
              <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
                <div className="modal-head">
                  <div>
                    <h3>{editing ? "Editar usuario" : "Nuevo usuario"}</h3>
                    <p className="muted small">
                      {editing
                        ? "Actualiza los datos del usuario y su sucursal. Password opcional."
                        : "Crea un usuario con rol, contraseña y sucursal."}
                    </p>
                  </div>
                  <button className="iconbtn" onClick={() => !busy && setOpen(false)}>
                    ✕
                  </button>
                </div>

                {error ? (
                  <div className="alert" style={{ whiteSpace: "pre-wrap" }}>
                    {error}
                  </div>
                ) : null}

                <form onSubmit={save} className="grid">
                  <div className="field">
                    <label>Sucursal</label>
                    <select
                      value={form.ubicacion_id}
                      onChange={(e) => setForm({ ...form, ubicacion_id: e.target.value })}
                      disabled={loadingUbicaciones}
                    >
                      <option value="">
                        {loadingUbicaciones ? "Cargando sucursales..." : "Seleccione una sucursal"}
                      </option>
                      {ubicaciones.map((ub) => (
                        <option key={ub.id} value={ub.id}>
                          {ub.nombre} {ub.tipo ? `(${ub.tipo})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>Nombre</label>
                    <input
                      value={form.nombre}
                      onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>Usuario</label>
                    <input
                      value={form.usuario}
                      onChange={(e) => setForm({ ...form, usuario: e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>Teléfono</label>
                    <input
                      value={form.telefono}
                      onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>Contraseña {editing ? "(opcional)" : ""}</label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder={editing ? "Dejar vacío para no cambiar" : "Crear contraseña"}
                    />
                  </div>

                  <div className="field">
                    <label>Rol</label>
                    <select
                      value={form.rol}
                      onChange={(e) => setForm({ ...form, rol: e.target.value })}
                    >
                      <option value="super_admin">Super Admin</option>
                      <option value="admin">Admin</option>
                      <option value="vendedor">Vendedor</option>
                      <option value="vendedor-tienda">Vendedor Tienda</option>
                      <option value="caja">Caja</option>
                      <option value="rutero">rutero</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>Activo</label>
                    <div className="switch">
                      <input
                        id="activo"
                        type="checkbox"
                        checked={!!form.activo}
                        onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                      />
                      <label htmlFor="activo">{form.activo ? "Sí" : "No"}</label>
                    </div>
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
        </>
      )}
    </div>
  );
}