// src/pages/Zonas.jsx
import React, { useEffect, useMemo, useState } from "react";
import { zonasApi } from "../lib/zonas";
import { getSession } from "../lib/auth";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";

const emptyForm = { nombre: "" };

function formatBackendError(err) {
  const data = err?.response?.data;

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

function ModalLoader({ text = "Cargando..." }) {
  return (
    <div className="modal-loader-wrap" aria-label={text}>
      <div className="modal-loader-ring"></div>
      <div className="modal-loader-text">{text}</div>
    </div>
  );
}

export default function Zonas() {
  const nav = useNavigate();
  const me = getSession()?.user;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  async function load() {
    setError("");
    setLoading(true);

    try {
      const res = await zonasApi.list({ per_page: 200 });

      const list =
        Array.isArray(res) ? res :
        Array.isArray(res?.data) ? res.data :
        Array.isArray(res?.data?.data) ? res.data.data :
        [];

      setItems(list);
    } catch (err) {
      setError(formatBackendError(err));
      if (err?.status === 401) nav("/login", { replace: true });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((z) =>
      `${z.nombre || ""}`.toLowerCase().includes(s)
    );
  }, [items, q]);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm });
    setOpen(true);
    setError("");
  }

  function openEdit(z) {
    setEditing(z);
    setForm({ nombre: z.nombre ?? "" });
    setOpen(true);
    setError("");
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      const payload = { nombre: form.nombre.trim() };
      if (!payload.nombre) throw new Error("El nombre es obligatorio.");

      if (editing?.id) {
        await zonasApi.update(editing.id, payload);
      } else {
        await zonasApi.create(payload);
      }

      setOpen(false);
      await load();
    } catch (err) {
      setError(formatBackendError(err));
    } finally {
      setBusy(false);
    }
  }

  async function del(z) {
    const ok = confirm(`¿Eliminar zona "${z.nombre}"?`);
    if (!ok) return;

    setBusy(true);
    setError("");
    try {
      await zonasApi.remove(z.id);
      await load();
    } catch (err) {
      setError(formatBackendError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h2>Zonas</h2>
          <p className="muted">
            Sesión: <b>{me?.nombre || me?.usuario || "—"}</b> ({me?.rol || "—"})
          </p>
        </div>

        <div className="topbar-actions">
          <button className="btn" onClick={load} disabled={loading || busy}>
            {loading ? <InlineLoader /> : "Recargar"}
          </button>
          <button className="btn primary" onClick={openCreate} disabled={busy || loading}>
            + Nueva zona
          </button>
        </div>
      </header>

      <div className="card pad">
        <div className="row">
          <div className="search">
            <input
              placeholder="Buscar zona…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="muted small users-count-box">
            {loading ? <InlineLoader /> : `${filtered.length} zona(s)`}
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
                <th>Zona</th>
                <th className="right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="2" className="users-loader-cell">
                    <TableLoader />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="2" className="muted">Sin resultados</td>
                </tr>
              ) : (
                filtered.map((z) => (
                  <tr key={z.id}>
                    <td>{z.nombre}</td>
                    <td className="right">
                      <button
                        className="btn sm"
                        onClick={() => openEdit(z)}
                        disabled={busy}
                      >
                        Editar
                      </button>
                      <button
                        className="btn sm danger"
                        onClick={() => del(z)}
                        disabled={busy}
                      >
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
                <h3>{editing ? "Editar zona" : "Nueva zona"}</h3>
                <p className="muted small">Define el nombre de la zona.</p>
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

            {busy ? (
              <ModalLoader text="Guardando zona..." />
            ) : (
              <form onSubmit={save} className="grid">
                <div className="field">
                  <label>Nombre</label>
                  <input
                    value={form.nombre}
                    onChange={(e) =>
                      setForm({ ...form, nombre: e.target.value })
                    }
                    placeholder="Ej: Zona 1"
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
                    Guardar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}