// src/components/Layout.jsx
import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { clearSession, getSession, isLoggedIn } from "../lib/auth";

export default function Layout({ children }) {
  const nav = useNavigate();
  const loc = useLocation();
  const me = getSession()?.user;

  function logout() {
    clearSession();
    nav("/login", { replace: true });
  }

  const logged = isLoggedIn();
  const rol = me?.rol || "";

  const canSeeUsuarios = logged && (rol === "admin" || rol === "super_admin");
  const canSeeVendedores = logged && (rol === "admin" || rol === "super_admin");
  const canSeeCaja =
    logged && (rol === "admin" || rol === "super_admin" || rol === "caja" || rol === "cajero");

  // a dónde manda el logo
  const homeLink = canSeeUsuarios ? "/usuarios" : (canSeeCaja ? "/caja" : "/login");

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <Link to={homeLink} className="brand">
            <span className="brand-logo">P</span>
            <span className="brand-text">
              <b>Plastiquería</b>
              <small>Panel</small>
            </span>
          </Link>

          <nav className="nav">
            {/* ✅ Usuarios solo admin/super_admin */}
            {canSeeUsuarios && (
              <Link
                className={`navlink ${loc.pathname.startsWith("/usuarios") ? "active" : ""}`}
                to="/usuarios"
              >
                Usuarios
              </Link>
            )}

            {/* ✅ Vendedores solo admin/super_admin */}
            {canSeeVendedores && (
              <Link
                className={`navlink ${loc.pathname.startsWith("/vendedores") ? "active" : ""}`}
                to="/vendedores"
              >
                Vendedores
              </Link>
            )}

            {/* ✅ Caja */}
            {canSeeCaja && (
              <Link
                className={`navlink ${loc.pathname.startsWith("/caja") ? "active" : ""}`}
                to="/caja"
              >
                Caja
              </Link>
            )}
          </nav>
              <Link className={`navlink ${loc.pathname.startsWith("/zonas") ? "active" : ""}`} to="/zonas">
                Zonas
              </Link>

          <div className="hdr-right">
            {logged ? (
              <>
                <div className="me">
                  <div className="me-dot" />
                  <div className="me-text">
                    <b>{me?.nombre || me?.usuario || "Usuario"}</b>
                    <small>{me?.rol || "—"}</small>
                  </div>
                </div>

                <button className="btn sm ghost" onClick={logout}>
                  Salir
                </button>
              </>
            ) : (
              <Link className="btn sm ghost" to="/login">
                Iniciar sesión
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="app-main">{children}</main>

      <footer className="app-footer">
        <div className="app-footer-inner">
          <span>© {new Date().getFullYear()} Plastiquería</span>
          <span className="muted">Grupo Cresth by Joserweb</span>
        </div>
      </footer>
    </div>
  );
}
// GET /api/v1/caja/actual?ubicacion_id=1