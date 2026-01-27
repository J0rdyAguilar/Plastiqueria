// src/pages/Caja.jsx
import React, { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { getSession } from "../lib/auth";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";

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

function money(n) {
  const x = Number(n ?? 0);
  if (Number.isNaN(x)) return "—";
  return `Q${x.toFixed(2)}`;
}

export default function Caja() {
  const nav = useNavigate();
  const me = getSession()?.user;

  const [ubicacionId, setUbicacionId] = useState(1);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [actual, setActual] = useState(null);
  const [historial, setHistorial] = useState([]);

  const [notasAbrir, setNotasAbrir] = useState("Apertura");
  const [efectivoInicial, setEfectivoInicial] = useState(100);

  const [notasCerrar, setNotasCerrar] = useState("Cierre");
  const [efectivoFinal, setEfectivoFinal] = useState(100);

  const isAbierta = !!actual && !actual?.cerrado_en;

  async function load() {
    setError("");
    setLoading(true);
    try {
      // actual
      const r1 = await api.cajaActual({ ubicacion_id: Number(ubicacionId) });
      setActual(r1?.data || null);

      // historial
      const r2 = await api.cajaHistorial({
        ubicacion_id: Number(ubicacionId),
        per_page: 20,
      });

      // tu backend a veces devuelve paginate directamente; lo normalizamos
      const list = Array.isArray(r2) ? r2 : (r2?.data || []);
      setHistorial(list);
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

  const resumen = useMemo(() => {
    if (!actual) return null;
    return {
      abierto_en: actual.abierto_en,
      cerrado_en: actual.cerrado_en,
      efectivo_inicial: actual.efectivo_inicial,
      efectivo_final: actual.efectivo_final,
      notas: actual.notas,
      id: actual.id,
    };
  }, [actual]);

  async function abrirCaja(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.cajaAbrir({
        ubicacion_id: Number(ubicacionId),
        efectivo_inicial: Number(efectivoInicial),
        notas: (notasAbrir || "").trim() || null,
      });
      await load();
    } catch (err) {
      setError(formatBackendError(err));
    } finally {
      setBusy(false);
    }
  }// GET /api/v1/caja/actual?ubicacion_id=1

  async function cerrarCaja(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.cajaCerrar({
        ubicacion_id: Number(ubicacionId),
        efectivo_final: Number(efectivoFinal),
        notas: (notasCerrar || "").trim() || null,
      });
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
            <h2>Caja</h2>
            <p className="muted">
              Sesión: <b>{me?.nombre || me?.usuario || "—"}</b> ({me?.rol || "—"})
            </p>
          </div>

          <div className="topbar-actions">
            <div className="inline-field">
              <label className="muted small">Ubicación</label>
              <input
                className="input sm"
                type="number"
                min="1"
                value={ubicacionId}
                onChange={(e) => setUbicacionId(e.target.value)}
                style={{ width: 110 }}
              />
            </div>

            <button className="btn" onClick={load} disabled={loading || busy}>
              Refrescar
            </button>
          </div>
        </header>

        {error ? (
          <div className="alert" style={{ whiteSpace: "pre-wrap" }}>
            {error}
          </div>
        ) : null}

        <div className="grid-2">
          {/* ====== Caja actual ====== */}
          <div className="card pad">
            <div className="card-head">
              <div>
                <h3 style={{ margin: 0 }}>Caja actual</h3>
                <p className="muted small" style={{ marginTop: 6 }}>
                  Estado:{" "}
                  {loading ? (
                    <span className="badge">Cargando…</span>
                  ) : isAbierta ? (
                    <span className="badge ok">Abierta</span>
                  ) : (
                    <span className="badge off">No hay caja abierta</span>
                  )}
                </p>
              </div>

              {resumen?.id ? (
                <div className="muted small" style={{ textAlign: "right" }}>
                  <div>
                    ID: <b>{resumen.id}</b>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="kv">
              <div className="kv-row">
                <span className="muted">Apertura</span>
                <span>{resumen?.abierto_en ? String(resumen.abierto_en) : "—"}</span>
              </div>
              <div className="kv-row">
                <span className="muted">Cierre</span>
                <span>{resumen?.cerrado_en ? String(resumen.cerrado_en) : "—"}</span>
              </div>
              <div className="kv-row">
                <span className="muted">Efectivo inicial</span>
                <span className="pill">{resumen ? money(resumen.efectivo_inicial) : "—"}</span>
              </div>
              <div className="kv-row">
                <span className="muted">Efectivo final</span>
                <span className="pill">{resumen?.efectivo_final ? money(resumen.efectivo_final) : "—"}</span>
              </div>
              <div className="kv-row">
                <span className="muted">Notas</span>
                <span>{resumen?.notas || "—"}</span>
              </div>
            </div>
          </div>

          {/* ====== Acciones abrir/cerrar ====== */}
          <div className="card pad">
            <div className="card-head">
              <div>
                <h3 style={{ margin: 0 }}>Acciones</h3>
                <p className="muted small" style={{ marginTop: 6 }}>
                  Abrir o cerrar la caja de la ubicación seleccionada.
                </p>
              </div>
            </div>

            <div className="split-forms">
              {/* Abrir */}
              <form onSubmit={abrirCaja} className="form-card">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <b>Abrir caja</b>
                  {isAbierta ? <span className="badge ok">Abierta</span> : <span className="badge">Lista</span>}
                </div>

                <div className="field">
                  <label>Notas</label>
                  <input
                    value={notasAbrir}
                    onChange={(e) => setNotasAbrir(e.target.value)}
                    placeholder="Apertura…"
                    disabled={busy || loading || isAbierta}
                  />
                </div>

                <div className="field">
                  <label>Efectivo inicial</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={efectivoInicial}
                    onChange={(e) => setEfectivoInicial(e.target.value)}
                    disabled={busy || loading || isAbierta}
                  />
                </div>

                <button className="btn primary w-100" disabled={busy || loading || isAbierta}>
                  {busy ? "Procesando…" : "Abrir"}
                </button>

                {isAbierta ? (
                  <p className="hint" style={{ marginTop: 10 }}>
                    Ya hay una caja abierta en esta ubicación.
                  </p>
                ) : null}
              </form>

              {/* Cerrar */}
              <form onSubmit={cerrarCaja} className="form-card">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <b>Cerrar caja</b>
                  {!isAbierta ? <span className="badge off">Sin caja</span> : <span className="badge warn">Pendiente</span>}
                </div>

                <div className="field">
                  <label>Notas</label>
                  <input
                    value={notasCerrar}
                    onChange={(e) => setNotasCerrar(e.target.value)}
                    placeholder="Cierre…"
                    disabled={busy || loading || !isAbierta}
                  />
                </div>

                <div className="field">
                  <label>Efectivo final</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={efectivoFinal}
                    onChange={(e) => setEfectivoFinal(e.target.value)}
                    disabled={busy || loading || !isAbierta}
                  />
                </div>

                <button className="btn danger w-100" disabled={busy || loading || !isAbierta}>
                  {busy ? "Procesando…" : "Cerrar"}
                </button>

                {!isAbierta ? (
                  <p className="hint" style={{ marginTop: 10 }}>
                    No hay caja abierta para cerrar.
                  </p>
                ) : null}
              </form>
            </div>
          </div>
        </div>

        {/* ====== Historial ====== */}
        <div className="card pad" style={{ marginTop: 14 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0 }}>Historial</h3>
              <p className="muted small" style={{ marginTop: 6 }}>
                Últimos movimientos de apertura/cierre por ubicación.
              </p>
            </div>
            <div className="muted small">
              {loading ? "Cargando…" : `${historial.length} registro(s)`}
            </div>
          </div>

          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Apertura</th>
                  <th>Cierre</th>
                  <th>Inicial</th>
                  <th>Final</th>
                  <th>Notas</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="muted">
                      Cargando…
                    </td>
                  </tr>
                ) : historial.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="muted">
                      Sin registros.
                    </td>
                  </tr>
                ) : (
                  historial.map((c) => {
                    const abierta = !c.cerrado_en;
                    return (
                      <tr key={c.id}>
                        <td>{c.id}</td>
                        <td className="small">{String(c.abierto_en || "—")}</td>
                        <td className="small">{c.cerrado_en ? String(c.cerrado_en) : "—"}</td>
                        <td><span className="pill">{money(c.efectivo_inicial)}</span></td>
                        <td>{c.efectivo_final != null ? <span className="pill">{money(c.efectivo_final)}</span> : "—"}</td>
                        <td className="small">{c.notas || "—"}</td>
                        <td>
                          {abierta ? <span className="badge ok">Abierta</span> : <span className="badge">Cerrada</span>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
