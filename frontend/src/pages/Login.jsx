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
  if (rol === "rutero") return "/rutero";

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
          success: "Bienvenido",
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
          <div className="login-card-top-pro">
            <div className="login-logo-box">
              <img src="/img/logo.png" alt="PLASTIMAX" />
            </div>

            <div className="login-title-box">
              <h2>PLASTIMAX</h2>
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
                className="pass-toggle-btn clean-eye-btn"
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
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

        <div className="login-footer-pro">
          <p>Acceso exclusivo para personal autorizado</p>
          <span>© 2026 Plastimax · Desarrollado por Ing. Jordy by JoserWeb</span>
        </div>
      </div>

      <style>{`
        .login-premium-page {
          min-height: 100vh;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            radial-gradient(circle at top left, rgba(115, 80, 255, 0.45), transparent 28%),
            radial-gradient(circle at bottom right, rgba(37, 99, 235, 0.35), transparent 25%),
            linear-gradient(180deg, #021127 0%, #03142d 100%);
        }

        .login-premium-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .login-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 42px 42px;
          mask-image: radial-gradient(circle at center, rgba(0,0,0,1), rgba(0,0,0,0.6));
        }

        .login-orb {
          position: absolute;
          border-radius: 999px;
          filter: blur(30px);
        }

        .orb-1 {
          width: 340px;
          height: 340px;
          left: -80px;
          top: -50px;
          background: rgba(125, 92, 255, 0.35);
        }

        .orb-2 {
          width: 280px;
          height: 280px;
          right: 40px;
          bottom: 30px;
          background: rgba(59, 130, 246, 0.20);
        }

        .login-center-wrap {
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: 440px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }

        .login-card-premium {
          width: 100%;
          background: rgba(0, 15, 40, 0.72);
          backdrop-filter: blur(18px);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow:
            0 20px 50px rgba(0,0,0,0.40),
            inset 0 1px 0 rgba(255,255,255,0.03);
          border-radius: 28px;
          padding: 26px 26px 24px;
        }

        .login-card-top-pro {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 22px;
        }

        .login-logo-box {
          width: 54px;
          height: 54px;
          border-radius: 16px;
          padding: 7px;
          background: linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02));
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow:
            0 10px 24px rgba(0,0,0,0.28),
            inset 0 1px 0 rgba(255,255,255,0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .login-logo-box img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
        }

        .login-title-box h2 {
          margin: 0;
          font-size: 29px;
          font-weight: 800;
          letter-spacing: 0.8px;
          color: #ffffff;
          line-height: 1;
        }

        .premium-field {
          margin-bottom: 16px;
        }

        .premium-field label {
          display: block;
          margin-bottom: 8px;
          color: #dbe7ff;
          font-size: 14px;
          font-weight: 700;
        }

        .premium-input-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 56px;
          padding: 0 14px;
          border-radius: 20px;
          background: #f4f7fb;
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow:
            0 4px 14px rgba(0,0,0,0.12),
            inset 0 1px 0 rgba(255,255,255,0.6);
        }

        .premium-input-wrap > svg {
          color: #6d89bd;
          flex-shrink: 0;
        }

        .premium-input-wrap input {
          flex: 1;
          height: 42px;
          border: 1px solid #d7dfeb;
          border-radius: 12px;
          background: rgba(255,255,255,0.55);
          outline: none;
          padding: 0 14px;
          font-size: 15px;
          font-weight: 600;
          color: #28405f;
        }

        .premium-input-wrap input::placeholder {
          color: #8ea1bf;
          font-weight: 600;
        }

        .premium-input-wrap:focus-within {
          box-shadow:
            0 0 0 3px rgba(52, 120, 246, 0.18),
            0 8px 20px rgba(0,0,0,0.14),
            inset 0 1px 0 rgba(255,255,255,0.6);
        }

        .clean-eye-btn {
          width: auto;
          height: auto;
          padding: 0;
          margin: 0;
          border: none;
          outline: none;
          background: transparent !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #6d89bd;
          flex-shrink: 0;
        }

        .clean-eye-btn:hover {
          background: transparent !important;
          box-shadow: none !important;
          color: #4c72b8;
          transform: none;
        }

        .clean-eye-btn:focus,
        .clean-eye-btn:focus-visible,
        .clean-eye-btn:active {
          outline: none;
          box-shadow: none !important;
          background: transparent !important;
        }

        .premium-submit-btn {
          width: 100%;
          margin-top: 10px;
          min-height: 54px;
          border: none;
          border-radius: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-size: 16px;
          font-weight: 800;
          color: #f9fbff;
          background: linear-gradient(90deg, #2f69c4 0%, #5445c6 100%);
          box-shadow:
            0 14px 30px rgba(47, 105, 196, 0.24),
            inset 0 1px 0 rgba(255,255,255,0.14);
          transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
        }

        .premium-submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow:
            0 18px 34px rgba(47, 105, 196, 0.28),
            inset 0 1px 0 rgba(255,255,255,0.14);
        }

        .premium-submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .login-footer-pro {
          margin-top: 56px;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 7px;
          animation: fadeIn 1s ease;
        }

        .login-footer-pro::before {
          content: "";
          width: 52px;
          height: 1px;
          margin: 0 auto 14px;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255,255,255,0.4),
            transparent
          );
        }

        .login-footer-pro p {
          margin: 0;
          font-size: 14px;
          color: rgba(255,255,255,0.70);
          letter-spacing: 0.2px;
        }

        .login-footer-pro span {
          margin: 0;
          font-size: 12px;
          color: rgba(255,255,255,0.42);
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 520px) {
          .login-center-wrap {
            padding: 18px;
          }

          .login-card-premium {
            padding: 22px 18px 20px;
            border-radius: 24px;
          }

          .login-title-box h2 {
            font-size: 24px;
          }

          .login-footer-pro {
            margin-top: 42px;
          }
        }
      `}</style>
    </div>
  );
}