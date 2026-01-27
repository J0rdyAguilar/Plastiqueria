// src/pages/Rutas.jsx
import React, { useEffect, useMemo, useState } from "react";
import { rutasApi } from "../lib/rutas";
import { zonasApi } from "../lib/zonas";
import { getSession } from "../lib/auth";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";

const emptyForm = { zona_id: "", nombre: "" };

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

function extractList(res) {
  // ✅ soporta:
  // 1) [...]
  // 2) { data: [...] }
  // 3) { data: { data: [...] } } (Laravel paginado)
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  return [];
}

export default function Rutas() {
  const nav = useNavigate();
  const me = getSession()?.user;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  // modal create/edit
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  // zonas select
  const [zonas, setZonas] = useState([]);
  const [loadingZonas, setLoadingZonas] = useState(false);

  async function load() {
    setError("");
    setLoading(true);
    try {
      const res = await rutasApi.list({ per_page: 200 });
      setItems(extractList(res));
    } catch (err) {
      setError(formatBackendError(err));
      if (err?.status === 401) nav("/login", { replace: true });
    } finally {
      setLoading(false);
    }
  }

  async function loadZonas() {
    setLoadingZonas(true);
    try {
      const res = await zonasApi.list({ per_page: 500 });
      setZonas(extractList(res));
    } catch (err) {
      setError(formatBackendError(err));
    } finally {
      setLoadingZonas(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;

    return items.filter((r) => {
      const z = r.zona || {};
      const a = `${r.nombre || ""} ${z.nombre || ""}`.toLowerCase();
      return a.includes(s);
    });
  }, [items, q]);

  async function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm });
    setOpen(true);
    setError("");
    if (zonas.length === 0) await loadZonas();
  }

  async function openEdit(r) {
    setEditing(r);
    setForm({
      zona_id: r.zona_id ?? (r.zona?.id ?? ""),
      nombre: r.nombre ?? "",
    });
    setOpen(true);
    setError("");
    if (zonas.length === 0) await loadZonas();
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      const payload = {
        zona_id: Number(form.zona_id),
        nombre: form.nombre.trim(),
      };

      if (!payload.zona_id) throw new Error("Debes seleccionar una zona.");
      if (!payload.nombre) throw new Error("El nombre es obligatorio.");

      if (editing?.id) {
        await rutasApi.update(editing.id, payload);
      } else {
        await rutasApi.create(payload);
      }

      setOpen(false);
      await load();
    } catch (err) {
      setError(formatBackendError(err));
    } finally {
      setBusy(false);
    }
  }

  async function del(r) {
    const ok = confirm(`¿Eliminar ruta "${r.nombre}"?`);
    if (!ok) return;

    setBusy(true);
    setError("");
    try {
      await rutasApi.remove(r.id);
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
            <h2>Rutas</h2>
            <p className="muted">
              Sesión: <b>{me?.nombre || me?.usuario || "—"}</b> ({me?.rol || "—"})
            </p>
          </div>

          <div className="topbar-actions">
            <button className="btn" onClick={load} disabled={loading || busy}>
              Recargar
            </button>
            <button className="btn primary" onClick={openCreate} disabled={busy}>
              + Nueva ruta
            </button>
          </div>
        </header>

        <div className="card pad">
          <div className="row">
            <div className="search">
              <input
                placeholder="Buscar por ruta o zona…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="muted small">
              {loading ? "Cargando..." : `${filtered.length} ruta(s)`}
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
                  <th>Ruta</th>
                  <th className="right">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="3" className="muted">Cargando…</td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="muted">Sin resultados</td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.id}>
                      <td>{r.zona?.nombre || `Zona #${r.zona_id}`}</td>
                      <td>{r.nombre}</td>
                      <td className="right">
                        <button className="btn sm" onClick={() => openEdit(r)} disabled={busy}>
                          Editar
                        </button>
                        <button className="btn sm danger" onClick={() => del(r)} disabled={busy}>
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
                  <h3>{editing ? "Editar ruta" : "Nueva ruta"}</h3>
                  <p className="muted small">Selecciona zona y define el nombre.</p>
                </div>
                <button className="iconbtn" onClick={() => !busy && setOpen(false)}>✕</button>
              </div>

              {error ? (
                <div className="alert" style={{ whiteSpace: "pre-wrap" }}>{error}</div>
              ) : null}

              <form onSubmit={save} className="grid">
                <div className="field">
                  <label>Zona</label>
                  <select
                    value={form.zona_id}
                    onChange={(e) => setForm({ ...form, zona_id: e.target.value })}
                    disabled={loadingZonas}
                  >
                    <option value="">
                      {loadingZonas ? "Cargando zonas..." : "Seleccione una zona..."}
                    </option>
                    {zonas.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>Nombre de ruta</label>
                  <input
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    placeholder="Ej: Zona 1 - Centro"
                  />
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn" onClick={() => !busy && setOpen(false)}>
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
      </div>
    </Layout>
  );
}
