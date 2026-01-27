// src/pages/Login.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api } from "../lib/api";
import { setSession, getSession, isLoggedIn } from "../lib/auth";
import Layout from "../components/Layout";

function normalizeRole(r) {
  const x = (r || "").toLowerCase();
  return x === "cajero" ? "caja" : x;
}

function roleHome(role) {
  const r = normalizeRole(role);
  // caja/cajero -> /caja
  if (r === "caja") return "/caja";
  // admin/super_admin -> /usuarios
  return "/usuarios";
}

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation();

  const [usuario, setUsuario] = useState("admin");
  const [password, setPassword] = useState("123456");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ✅ si ya hay sesión, no debe quedarse en /login
  useEffect(() => {
    if (isLoggedIn()) {
      const me = getSession()?.user;
      nav(roleHome(me?.rol), { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.login({ usuario, password }); // { token, user }
      setSession(res);

      // ✅ si venía de una ruta protegida, respétala
      const from = loc.state?.from;
      if (from) {
        nav(from, { replace: true });
      } else {
        nav(roleHome(res?.user?.rol), { replace: true });
      }
    } catch (err) {
      setError(err?.data?.message || err?.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div className="auth-wrap">
        <div className="auth-bg" />

        <form className="card auth-card" onSubmit={onSubmit}>
          <div className="auth-brand">
            <div className="auth-logo">P</div>
            <div>
              <h1>Iniciar sesión</h1>
              <p className="muted">Usa tu usuario y contraseña</p>
            </div>
          </div>

          {error ? <div className="alert">{error}</div> : null}

          <div className="field">
            <label>Usuario</label>
            <input
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              autoFocus
              autoComplete="username"
            />
          </div>

          <div className="field">
            <label>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <button className="btn primary" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <p className="hint">
            Consejo: luego quitamos los valores por defecto (admin/123456) para producción.
          </p>
        </form>
      </div>
    </Layout>
  );
}
