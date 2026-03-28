import React, { useMemo, useState } from "react";
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
import { setSession } from "../lib/auth";
import { notify } from "../lib/notify";

function normalizeRole(r) {
  const x = (r || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  if (x === "cajero") return "caja";
  if (x === "superadmin") return "super_admin";

  return x;
}

function extractUser(payload) {
  return (
    payload?.user ||
    payload?.usuario ||
    payload?.data?.user ||
    payload?.data?.usuario ||
    null
  );
}

function roleHomeFromPayload(payload) {
  const user = extractUser(payload);
  const rol = normalizeRole(user?.rol || user?.role);

  if (rol === "admin" || rol === "super_admin") return "/pedidos-admin";
  if (rol === "caja") return "/caja";
  if (rol === "vendedor") return "/pedidos";
  if (rol === "vendedor_tienda") return "/ventas-tienda";

  return "/login";
}

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation();

  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const canSubmit = useMemo(() => {
    return usuario.trim() !== "" && password.trim() !== "" && !loading;
  }, [usuario, password, loading]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);

    try {
      const res = await notify.promise(
        api.login({
          usuario: usuario.trim(),
          password,
        }),
        {
          loading: "Iniciando sesión...",
          success: "Bienvenido 👋",
          error: "Credenciales incorrectas",
        }
      );

      setSession(res);

      const from = loc.state?.from;
      const destino = from || roleHomeFromPayload(res);

      nav(destino, { replace: true });
    } catch (err) {
      console.error(err);
      notify.error(err, "Error al iniciar sesión");
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
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="premium-submit-btn"
            disabled={!canSubmit}
          >
            <span>{loading ? "Entrando..." : "Entrar"}</span>
            <ArrowRight size={18} />
          </button>
        </motion.form>
      </div>
    </div>
  );
}