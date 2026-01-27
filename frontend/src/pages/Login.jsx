// src/pages/Login.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { setSession } from "../lib/auth";
import Layout from "../components/Layout";

export default function Login() {
  const nav = useNavigate();
  const [usuario, setUsuario] = useState("admin");
  const [password, setPassword] = useState("123456");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.login({ usuario, password }); // { token, user }
      setSession(res);
      nav("/usuarios", { replace: true });
    } catch (err) {
      setError(err?.message || "Error al iniciar sesión");
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
            <input value={usuario} onChange={(e) => setUsuario(e.target.value)} autoFocus />
          </div>

          <div className="field">
            <label>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
