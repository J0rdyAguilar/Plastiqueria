// src/pages/Rutas.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { rutasApi } from "../lib/rutas";
import { zonasApi } from "../lib/zonas";
import { getSession } from "../lib/auth";
import { useNavigate } from "react-router-dom";

const emptyForm = { zona_id: "", nombre: "" };

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

function extractList(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  return [];
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function wordsOf(value) {
  return normalizeText(value)
    .split(/\s+/)
    .filter(Boolean);
}

function getSearchScore(item, rawTerm, mode) {
  const term = normalizeText(rawTerm);
  if (!term) return 1;

  const nombre = normalizeText(item?.nombre);
  const zona = normalizeText(item?.zona?.nombre || item?.zona_nombre);
  const id = normalizeText(item?.id);

  const target =
    mode === "ruta"
      ? nombre
      : mode === "zona"
      ? zona
      : mode === "id"
      ? id
      : normalizeText(`${nombre} ${zona} ${id}`);

  if (!target.includes(term)) return -1;

  let score = 0;

  if (id === term) score += 260;
  if (nombre === term) score += 220;
  if (zona === term) score += 180;

  if (id.startsWith(term)) score += 200;
  if (nombre.startsWith(term)) score += 140;
  if (zona.startsWith(term)) score += 110;

  const termWords = wordsOf(term);
  const targetWords = wordsOf(target);

  for (const word of termWords) {
    if (targetWords.includes(word)) score += 20;
    if (target.startsWith(word)) score += 10;
    if (target.includes(word)) score += 6;
  }

  score += Math.max(0, 40 - target.indexOf(term));
  score += Math.max(0, 25 - Math.abs(target.length - term.length));

  return score;
}

/* ================= LOADER ================= */

function InlineLoader() {
  return (
    <div className="mini-loader-wrap">
      <span className="mini-loader"></span>
    </div>
  );
}

function TableLoader() {
  return (
    <div className="table-loader-wrap">
      <div className="table-loader-ring"></div>
    </div>
  );
}

function ModalLoader({ text = "Cargando..." }) {
  return (
    <div className="modal-loader-wrap">
      <div className="modal-loader-ring"></div>
      <div className="modal-loader-text">{text}</div>
    </div>
  );
}

/* ================= COMPONENTE ================= */

export default function Rutas() {
  const nav = useNavigate();
  const me = getSession()?.user;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const [zonas, setZonas] = useState([]);
  const [loadingZonas, setLoadingZonas] = useState(false);

  const [searchMode, setSearchMode] = useState("todos");
  const [searchFocus, setSearchFocus] = useState(false);

  const [page, setPage] = useState(1);
  const perPage = 10;

  const searchBoxRef = useRef(null);

  async function load() {
    setError("");
    setLoading(true);

    try {
      const res = await rutasApi.list({ per_page: 500 });
      setItems(extractList(res));
    } catch (err) {
      setError(formatBackendError(err));
      if (err?.response?.status === 401) {
        nav("/login", { replace: true });
      }
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

  useEffect(() => {
    function handleClickOutside(e) {
      if (!searchBoxRef.current?.contains(e.target)) {
        setSearchFocus(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [q, searchMode]);

  const filtered = useMemo(() => {
    const term = q.trim();

    if (!term) {
      return [...items].sort((a, b) =>
        String(a?.nombre || "").localeCompare(String(b?.nombre || ""))
      );
    }

    return items
      .map((r) => ({
        ...r,
        __score: getSearchScore(r, term, searchMode),
      }))
      .filter((r) => r.__score >= 0)
      .sort((a, b) => {
        if (b.__score !== a.__score) return b.__score - a.__score;
        return String(a?.nombre || "").localeCompare(String(b?.nombre || ""));
      });
  }, [items, q, searchMode]);

  const sugerencias = useMemo(() => {
    if (!q.trim()) return [];
    return filtered.slice(0, 6);
  }, [filtered, q]);

  const meta = useMemo(() => {
    const total = filtered.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const currentPage = Math.min(page, lastPage);

    return {
      current_page: currentPage,
      last_page: lastPage,
      total,
    };
  }, [filtered, page]);

  const itemsPaginados = useMemo(() => {
    const start = (meta.current_page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, meta.current_page]);

  const canPrev = meta.current_page > 1;
  const canNext = meta.current_page < meta.last_page;

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
      zona_id: r.zona_id ?? r.zona?.id ?? "",
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

  const isBusy = loading || busy || typing;

  return (
    <div className="routes-page">
      <section className="routes-hero">
        <div className="routes-hero-top">
          <div className="routes-hero-title">
            <h1>Rutas</h1>
            <p>
              Administra tus rutas de forma más rápida, con búsqueda inteligente,
              mejor visualización y control más limpio por zona.
            </p>
          </div>

          <div className="routes-hero-actions">
            <button className="btn btn-soft" onClick={load} disabled={loading || busy}>
              {loading ? <InlineLoader /> : "Recargar"}
            </button>

            <button className="btn btn-primary btn-lg" onClick={openCreate} disabled={busy}>
              + Nueva ruta
            </button>
          </div>
        </div>

        <div className="routes-session">
          <span>Sesión:</span>
          <strong>{me?.nombre || me?.usuario || "—"}</strong>
          <small>({me?.rol || "—"})</small>
        </div>

        <div className="routes-stats">
          <div className="stat-card">
            <span>Total visibles</span>
            <strong>{loading ? <InlineLoader /> : filtered.length}</strong>
          </div>
          <div className="stat-card">
            <span>Página actual</span>
            <strong>{meta.current_page}</strong>
          </div>
          <div className="stat-card">
            <span>Total páginas</span>
            <strong>{meta.last_page}</strong>
          </div>
        </div>

        <div className="search-panel">
          <div className="search-grid search-grid-routes">
            <div className="search-main" ref={searchBoxRef}>
              <label>Buscador inteligente</label>

              <div className="search-input-wrap">
                <span className="search-icon">⌕</span>

                <input
                  className="input search-input"
                  placeholder="Buscar por ruta, zona o ID..."
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setTyping(true);
                    setTimeout(() => setTyping(false), 150);
                  }}
                  onFocus={() => setSearchFocus(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setSearchFocus(false);
                    }

                    if (e.key === "Enter" && sugerencias.length > 0) {
                      e.preventDefault();
                      setQ(sugerencias[0]?.nombre || "");
                      setSearchFocus(false);
                    }
                  }}
                />

                {typing ? <span className="search-mini-loader" /> : null}

                {!typing && q ? (
                  <button
                    type="button"
                    className="clear-search"
                    onClick={() => {
                      setQ("");
                      setSearchFocus(false);
                    }}
                    aria-label="Limpiar búsqueda"
                  >
                    ✕
                  </button>
                ) : null}
              </div>

              {searchFocus && sugerencias.length > 0 ? (
                <div className="search-suggestions">
                  {sugerencias.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="search-suggestion-item"
                      onClick={() => {
                        setQ(item.nombre || "");
                        setSearchFocus(false);
                      }}
                    >
                      <div className="search-suggestion-top">
                        <strong>{item.nombre || "-"}</strong>
                        <span className="route-id-badge">ID #{item.id}</span>
                      </div>

                      <div className="search-suggestion-meta">
                        Zona: {item?.zona?.nombre || `Zona #${item?.zona_id || "-"}`}
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="search-mode-chips">
                <button
                  type="button"
                  className={searchMode === "todos" ? "chip chip-active" : "chip"}
                  onClick={() => setSearchMode("todos")}
                >
                  Todo
                </button>
                <button
                  type="button"
                  className={searchMode === "ruta" ? "chip chip-active" : "chip"}
                  onClick={() => setSearchMode("ruta")}
                >
                  Ruta
                </button>
                <button
                  type="button"
                  className={searchMode === "zona" ? "chip chip-active" : "chip"}
                  onClick={() => setSearchMode("zona")}
                >
                  Zona
                </button>
                <button
                  type="button"
                  className={searchMode === "id" ? "chip chip-active" : "chip"}
                  onClick={() => setSearchMode("id")}
                >
                  ID
                </button>
              </div>

              <div className="search-results-info">
                <span>
                  {q.trim()
                    ? `${filtered.length} resultado(s) para "${q}"`
                    : `${filtered.length} ruta(s) cargada(s)`}
                </span>

                {q.trim() ? (
                  <button
                    type="button"
                    className="clear-text-btn"
                    onClick={() => {
                      setQ("");
                      setSearchFocus(false);
                    }}
                  >
                    Limpiar búsqueda
                  </button>
                ) : null}
              </div>
            </div>

            <div className="search-actions">
              <button className="btn btn-primary" onClick={load} disabled={isBusy}>
                Buscar
              </button>

              <button
                className="btn btn-soft"
                onClick={() => {
                  setQ("");
                  setSearchMode("todos");
                  setSearchFocus(false);
                  setPage(1);
                }}
                disabled={isBusy}
              >
                Limpiar
              </button>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="alert alert-danger" style={{ whiteSpace: "pre-wrap" }}>
          {error}
        </div>
      )}

      <section className="routes-table-card">
        <div className="table-card-head">
          <div>
            <h2>Listado de rutas</h2>
            <p>Vista ordenada para buscar, editar y administrar rutas sin saturación.</p>
          </div>
        </div>

        <div className="table-wrap pro-table-wrap">
          <table className="table pro-table">
            <thead>
              <tr>
                <th style={{ width: 180 }}>Zona</th>
                <th>Ruta</th>
                <th style={{ width: 120 }}>ID</th>
                <th style={{ width: 240 }} className="right">
                  Acciones
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="4">
                    <TableLoader />
                  </td>
                </tr>
              ) : itemsPaginados.length === 0 ? (
                <tr>
                  <td colSpan="4">
                    <div className="empty-state">
                      <div className="empty-state-icon">🛣️</div>
                      <h3>Sin resultados</h3>
                      <p>No se encontraron rutas con esos filtros.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                itemsPaginados.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className="zone-badge">
                        {r.zona?.nombre || `Zona #${r.zona_id}`}
                      </span>
                    </td>

                    <td>
                      <div className="route-name">{r.nombre}</div>
                    </td>

                    <td>
                      <span className="route-id-badge">#{r.id}</span>
                    </td>

                    <td className="right">
                      <div className="actions actions-right">
                        <button className="btn btn-edit btn-sm" onClick={() => openEdit(r)} disabled={busy}>
                          Editar
                        </button>

                        <button className="btn btn-delete btn-sm" onClick={() => del(r)} disabled={busy}>
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {meta.last_page > 1 ? (
          <div className="pager pro-pager">
            <button
              className="btn btn-soft"
              disabled={!canPrev || isBusy}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Anterior
            </button>

            <div className="pager-info">
              Página <strong>{meta.current_page}</strong> de <strong>{meta.last_page}</strong> · Total{" "}
              <strong>{meta.total}</strong>
            </div>

            <button
              className="btn btn-soft"
              disabled={!canNext || isBusy}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente →
            </button>
          </div>
        ) : null}
      </section>

      {open && (
        <div className="modal-backdrop" onMouseDown={() => !busy && setOpen(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3>{editing ? "Editar ruta" : "Nueva ruta"}</h3>
                <p className="muted small">Selecciona zona y define el nombre.</p>
              </div>

              <button className="iconbtn" onClick={() => !busy && setOpen(false)}>
                ✕
              </button>
            </div>

            {error && (
              <div className="alert alert-danger" style={{ whiteSpace: "pre-wrap" }}>
                {error}
              </div>
            )}

            {busy ? (
              <ModalLoader text="Guardando ruta..." />
            ) : (
              <form onSubmit={save} className="grid modal-grid">
                <div className="field">
                  <label>Zona</label>

                  {loadingZonas ? (
                    <ModalLoader text="Cargando zonas..." />
                  ) : (
                    <select
                      className="input"
                      value={form.zona_id}
                      onChange={(e) => setForm({ ...form, zona_id: e.target.value })}
                    >
                      <option value="">Seleccione una zona...</option>

                      {zonas.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.nombre}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="field">
                  <label>Nombre de ruta</label>
                  <input
                    className="input"
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    placeholder="Ej: Zona 1 - Centro"
                  />
                </div>

                <div className="modal-actions col-2">
                  <button type="button" className="btn btn-soft" onClick={() => !busy && setOpen(false)}>
                    Cancelar
                  </button>

                  <button className="btn btn-primary">
                    Guardar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <style>{styles}</style>
    </div>
  );
}

const styles = `
:root{
  --text:#0f172a;
  --muted:#64748b;
  --primary:#4f46e5;
  --primary-2:#6366f1;
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

.routes-page{
  max-width:1380px;
  margin:0 auto;
  padding:22px;
  display:flex;
  flex-direction:column;
  gap:18px;
  color:var(--text);
}

.routes-hero{
  position:relative;
  overflow:visible;
  border-radius:var(--radius-xl);
  padding:24px;
  background:
    radial-gradient(circle at top right, rgba(99,102,241,.16), transparent 28%),
    radial-gradient(circle at bottom left, rgba(56,189,248,.10), transparent 24%),
    linear-gradient(180deg, #f8fbff 0%, #eef2ff 100%);
  border:1px solid rgba(99,102,241,.12);
  box-shadow:var(--shadow-md);
  z-index:2;
}

.routes-hero-top{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:16px;
  flex-wrap:wrap;
}

.routes-hero-title h1{
  margin:0;
  font-size:34px;
  letter-spacing:-.03em;
  line-height:1.05;
}

.routes-hero-title p{
  margin:10px 0 0;
  max-width:760px;
  color:var(--muted);
  font-size:14px;
  line-height:1.6;
}

.routes-hero-actions{
  display:flex;
  align-items:center;
  gap:10px;
  flex-wrap:wrap;
}

.routes-session{
  margin-top:16px;
  display:flex;
  align-items:center;
  gap:8px;
  flex-wrap:wrap;
  color:#334155;
  font-size:14px;
}

.routes-session span{
  color:var(--muted);
}

.routes-session small{
  color:var(--muted);
}

.routes-stats{
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
  display:flex;
  align-items:center;
  margin-top:6px;
  font-size:24px;
  line-height:1;
  min-height:28px;
}

.search-panel{
  margin-top:18px;
  padding:18px;
  border-radius:22px;
  background:rgba(255,255,255,.72);
  border:1px solid rgba(255,255,255,.92);
  box-shadow:var(--shadow-sm);
  backdrop-filter:blur(12px);
  position:relative;
  z-index:5;
}

.search-grid{
  display:grid;
  gap:14px;
  align-items:start;
}

.search-grid-routes{
  grid-template-columns:minmax(420px,1.8fr) auto;
}

.search-main{
  display:flex;
  flex-direction:column;
  gap:8px;
  position:relative;
}

.search-main label{
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

.search-actions{
  display:flex;
  gap:10px;
  flex-wrap:wrap;
  align-items:end;
}

.search-suggestions{
  position:absolute;
  top:calc(100% + 8px);
  left:0;
  right:0;
  background:#fff;
  border:1px solid #e5e7eb;
  border-radius:18px;
  box-shadow:0 18px 50px rgba(15, 23, 42, 0.12);
  padding:8px;
  z-index:40;
  display:grid;
  gap:8px;
}

.search-suggestion-item{
  text-align:left;
  border:1px solid #eef2f7;
  background:#fff;
  border-radius:14px;
  padding:12px;
  cursor:pointer;
  display:grid;
  gap:6px;
  transition:.18s ease;
}

.search-suggestion-item:hover{
  background:#fafcff;
  border-color:#dbe4f0;
}

.search-suggestion-top{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  flex-wrap:wrap;
}

.search-suggestion-top strong{
  color:#0f172a;
  font-size:14px;
}

.search-suggestion-meta{
  color:#64748b;
  font-size:12px;
  line-height:1.45;
}

.search-mode-chips{
  margin-top:10px;
  display:flex;
  gap:8px;
  flex-wrap:wrap;
  align-items:center;
}

.chip{
  border:1px solid #dbe4f0;
  background:#fff;
  color:#334155;
  border-radius:999px;
  padding:8px 12px;
  cursor:pointer;
  font-weight:700;
  font-size:13px;
  transition:.18s ease;
}

.chip:hover{
  background:#f8fafc;
}

.chip-active{
  background:#eff6ff;
  border:1px solid #93c5fd;
  color:#1d4ed8;
  box-shadow:0 4px 14px rgba(37, 99, 235, 0.12);
}

.search-results-info{
  margin-top:10px;
  font-size:13px;
  color:#64748b;
  display:flex;
  justify-content:space-between;
  gap:12px;
  flex-wrap:wrap;
}

.clear-text-btn{
  border:0;
  background:transparent;
  color:#2563eb;
  cursor:pointer;
  font-weight:700;
}

.routes-table-card{
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
  min-width:760px;
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

.right{
  text-align:right !important;
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

.zone-badge{
  display:inline-flex;
  align-items:center;
  min-height:36px;
  padding:0 12px;
  border-radius:999px;
  background:#f8fafc;
  border:1px solid #e2e8f0;
  font-size:12px;
  color:#334155;
  font-weight:700;
}

.route-id-badge{
  display:inline-flex;
  align-items:center;
  min-height:30px;
  padding:0 10px;
  border-radius:999px;
  background:#eef2ff;
  border:1px solid #c7d2fe;
  font-size:12px;
  color:#4338ca;
  font-weight:800;
}

.route-name{
  font-size:15px;
  font-weight:900;
  color:#0f172a;
  line-height:1.25;
}

.actions{
  display:flex;
  gap:8px;
  flex-wrap:wrap;
}

.actions-right{
  justify-content:flex-end;
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

.mini-loader-wrap{
  display:flex;
  align-items:center;
  justify-content:flex-start;
}

.mini-loader{
  width:18px;
  height:18px;
  border-radius:999px;
  border:2px solid rgba(79,70,229,.15);
  border-top-color:#4f46e5;
  animation:spin .7s linear infinite;
}

.modal-loader-wrap{
  min-height:120px;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  gap:12px;
}

.modal-loader-ring{
  width:42px;
  height:42px;
  border-radius:999px;
  border:4px solid rgba(79,70,229,.12);
  border-top-color:#4f46e5;
  animation:spin .75s linear infinite;
}

.modal-loader-text{
  font-size:14px;
  font-weight:700;
  color:#64748b;
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
  width:min(720px, 100%);
  max-height:calc(100vh - 36px);
  overflow:auto;
  background:#fff;
  border-radius:24px;
  border:1px solid rgba(226,232,240,.9);
  box-shadow:var(--shadow-lg);
  padding:18px;
}

.modal-head{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
  margin-bottom:12px;
}

.modal-head h3{
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

.grid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:14px;
}

.modal-grid{
  margin-top:10px;
}

.col-2{
  grid-column:span 2;
}

.field{
  display:flex;
  flex-direction:column;
  gap:8px;
}

.field label{
  display:block;
  font-size:12px;
  color:#64748b;
  margin:0;
  font-weight:800;
  letter-spacing:.04em;
}

.modal-actions{
  display:flex;
  justify-content:flex-end;
  gap:10px;
  margin-top:6px;
  flex-wrap:wrap;
}

@keyframes spin{
  to{ transform:rotate(360deg); }
}

@media (max-width: 980px){
  .search-grid-routes{
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
  .routes-page{
    padding:14px;
  }

  .routes-hero{
    padding:18px;
    border-radius:22px;
  }

  .routes-hero-title h1{
    font-size:28px;
  }

  .routes-stats{
    display:grid;
    grid-template-columns:1fr 1fr;
  }

  .table-card-head{
    flex-direction:column;
  }

  .pro-pager{
    justify-content:center;
  }
}
`;