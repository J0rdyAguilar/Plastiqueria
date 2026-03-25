import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LockKeyhole,
  User,
  Eye,
  EyeOff,
  ArrowRight,
} from "lucide-react";
import { api } from "../lib/api";
import { setSession, getSession, isLoggedIn } from "../lib/auth";

function normalizeRole(r) {
  const x = (r || "").toLowerCase();
  return x === "cajero" ? "caja" : x;
}

function roleHome(role) {
  const r = normalizeRole(role);
  if (r === "caja") return "/caja";
  return "/usuarios";
}

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation();

  const [usuario, setUsuario] = useState("admin");
  const [password, setPassword] = useState("123456");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    if (isLoggedIn()) {
      const me = getSession()?.user;
      nav(roleHome(me?.rol), { replace: true });
    }
  }, [nav]);

  const canSubmit = useMemo(() => {
    return usuario.trim() && password.trim() && !loading;
  }, [usuario, password, loading]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.login({ usuario, password });
      setSession(res);

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
    <div className="login-premium-page">
      <div className="login-premium-bg">
        <div className="login-orb orb-1" />
        <div className="login-orb orb-2" />
        <div className="login-grid" />
      </div>

      <div className="login-center-wrap">
        <motion.form
          className="login-card-premium"
          onSubmit={onSubmit}
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45 }}
        >
          <div className="login-card-top">
            <div className="login-logo-premium">P</div>
            <div>
              <h2>Iniciar sesión</h2>
              <p>Panel administrativo</p>
            </div>
          </div>

          {error ? <div className="login-alert">{error}</div> : null}

          <div className="premium-field">
            <label>Usuario</label>
            <div className="premium-input-wrap">
              <User size={18} />
              <input
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                autoFocus
                autoComplete="username"
                placeholder="Ingresa tu usuario"
              />
            </div>
          </div>

          <div className="premium-field">
            <label>Contraseña</label>
            <div className="premium-input-wrap">
              <LockKeyhole size={18} />
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Ingresa tu contraseña"
              />
              <button
                type="button"
                className="pass-toggle-btn"
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button className="premium-submit-btn" disabled={!canSubmit}>
            <span>{loading ? "Entrando..." : "Entrar"}</span>
            <ArrowRight size={18} />
          </button>
        </motion.form>
      </div>
    </div>
  );
}