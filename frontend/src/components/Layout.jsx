import React, { useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { clearSession, getSession, isLoggedIn } from "../lib/auth";

function normalizeRole(r) {
  const x = (r || "").toString().trim().toLowerCase();
  if (x === "cajero") return "caja";
  return x;
}

export default function Layout({ children }) {
  const nav = useNavigate();
  const loc = useLocation();

  const logged = isLoggedIn();
  const me = getSession()?.user;
  const rol = normalizeRole(me?.rol);

  const isAdmin = logged && (rol === "admin" || rol === "super_admin");

  const canSeeUsuarios = isAdmin;
  const canSeeVendedores = isAdmin;
  const canSeeZonas = isAdmin;
  const canSeeRutas = isAdmin;
  const canSeeProductos = isAdmin;
  const canSeeStock = isAdmin;
  const canSeeMovimientos = isAdmin;

  // ✅ Caja SOLO admin + caja/cajero
  const canSeeCaja = logged && (isAdmin || rol === "caja");

  // ✅ Home por rol (para el logo)
  const homeLink = useMemo(() => {
    if (!logged) return "/login";
    if (isAdmin) return "/usuarios";
    if (rol === "caja") return "/caja";
    if (rol === "vendedor") return "/pedidos";
    return "/login";
  }, [logged, isAdmin, rol]);

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

            {canSeeStock && (
              <Link
                to="/stock"
                className={`navlink ${loc.pathname.startsWith("/stock") ? "active" : ""}`}
              >
                Inventario
              </Link>
            )}

            {canSeeMovimientos && (
              <Link
                to="/movimientos-stock"
                className={`navlink ${loc.pathname.startsWith("/movimientos-stock") ? "active" : ""}`}
              >
                Movimientos
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

            {/* ✅ Menú vendedor */}
            {logged && rol === "vendedor" && (
              <Link
                to="/pedidos"
                className={`navlink ${loc.pathname.startsWith("/pedidos") ? "active" : ""}`}
              >
                Pedidos
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