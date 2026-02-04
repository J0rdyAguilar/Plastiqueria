import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { clearSession, getSession, isLoggedIn } from "../lib/auth";

function normalizeRole(r) {
  const x = (r || "").toString().trim().toLowerCase();
  // si en algún momento llega "cajero", lo tratamos como caja
  if (x === "cajero") return "caja";
  return x;
}

export default function Layout({ children }) {
  const nav = useNavigate();
  const loc = useLocation();
  const logged = isLoggedIn();
  const me = getSession()?.user;

  const rol = normalizeRole(me?.rol);

  // PERMISOS
  const canSeeUsuarios   = logged && (rol === "admin" || rol === "super_admin");
  const canSeeVendedores = logged && (rol === "admin" || rol === "super_admin");
  const canSeeZonas      = logged && (rol === "admin" || rol === "super_admin");
  const canSeeRutas      = logged && (rol === "admin" || rol === "super_admin");
  const canSeeProductos  = logged && (rol === "admin" || rol === "super_admin");
  const canSeeCaja       = logged && (rol === "admin" || rol === "super_admin" || rol === "caja");

  // a dónde manda el logo
  const homeLink = canSeeProductos
    ? "/productos"
    : canSeeUsuarios
      ? "/usuarios"
      : canSeeCaja
        ? "/caja"
        : "/login";

  function logout() {
    clearSession();
    nav("/login", { replace: true });
  }

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
            {canSeeUsuarios && (
              <Link
                to="/usuarios"
                className={`navlink ${loc.pathname.startsWith("/usuarios") ? "active" : ""}`}
              >
                Usuarios
              </Link>
            )}

            {canSeeVendedores && (
              <Link
                to="/vendedores"
                className={`navlink ${loc.pathname.startsWith("/vendedores") ? "active" : ""}`}
              >
                Vendedores
              </Link>
            )}

            {canSeeZonas && (
              <Link
                to="/zonas"
                className={`navlink ${loc.pathname.startsWith("/zonas") ? "active" : ""}`}
              >
                Zonas
              </Link>
            )}

            {canSeeRutas && (
              <Link
                to="/rutas"
                className={`navlink ${loc.pathname.startsWith("/rutas") ? "active" : ""}`}
              >
                Rutas
              </Link>
            )}

            {canSeeProductos && (
              <Link
                to="/productos"
                className={`navlink ${loc.pathname.startsWith("/productos") ? "active" : ""}`}
              >
                Productos
              </Link>
            )}

            {canSeeCaja && (
              <Link
                to="/caja"
                className={`navlink ${loc.pathname.startsWith("/caja") ? "active" : ""}`}
              >
                Caja
              </Link>
            )}
          </nav>

          <div className="hdr-right">
            {logged ? (
              <>
                <div className="me">
                  <div className="me-dot" />
                  <div className="me-text">
                    <b>{me?.nombre || me?.usuario || "Usuario"}</b>
                    <small>{rol || "—"}</small>
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
