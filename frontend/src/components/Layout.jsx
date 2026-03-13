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
  const isVendedor = logged && rol === "vendedor";
  const isCaja = logged && rol === "caja";

  const canSeeUsuarios = isAdmin;
  const canSeeVendedores = isAdmin;
  const canSeePedidosAdmin = isAdmin;
  const canSeeZonas = isAdmin;
  const canSeeRutas = isAdmin;
  const canSeeProductos = isAdmin;
  const canSeeStock = isAdmin;
  const canSeeMovimientos = isAdmin;
  const canSeeCaja = logged && (isAdmin || isCaja);

  const homeLink = useMemo(() => {
    if (!logged) return "/login";
    if (isAdmin) return "/pedidos-admin";
    if (isCaja) return "/caja";
    if (isVendedor) return "/pedidos";
    return "/login";
  }, [logged, isAdmin, isCaja, isVendedor]);

  function logout() {
    clearSession();
    nav("/login", { replace: true });
  }

  return (
    <div className="pro-shell">
      <header className="pro-header">
        <div className="pro-header-inner">
          <Link to={homeLink} className="pro-brand">
            <span className="pro-brand-logo">P</span>

            <span className="pro-brand-text">
              <strong>Plastiquería</strong>
              <small>Panel administrativo</small>
            </span>
          </Link>

          <div className="pro-center-nav">
            {isVendedor && loc.pathname === "/pedidos" && (
              <>
                <a href="#nuevo-pedido" className="pro-nav-btn is-active">
                  Crear nuevo pedido
                </a>
                <a href="#mis-pedidos" className="pro-nav-btn">
                  Mis pedidos
                </a>
              </>
            )}

            {isCaja && !isAdmin && (
              <NavItem to="/caja" active={loc.pathname.startsWith("/caja")}>
                Caja
              </NavItem>
            )}
          </div>

          <div className="pro-user-side">
            {logged ? (
              <>
                <div className="pro-user-card">
                  <span className="pro-user-dot" />
                  <div className="pro-user-info">
                    <strong>{me?.nombre || me?.usuario || "Usuario"}</strong>
                    <small>{rol || "—"}</small>
                  </div>
                </div>

                <button className="pro-logout-btn" onClick={logout}>
                  Salir
                </button>
              </>
            ) : (
              <Link className="pro-logout-btn" to="/login">
                Iniciar sesión
              </Link>
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="pro-subnav-wrap">
            <div className="pro-subnav">
              {canSeePedidosAdmin && (
                <NavItem
                  to="/pedidos-admin"
                  active={loc.pathname.startsWith("/pedidos-admin")}
                >
                  Pedidos
                </NavItem>
              )}

              {canSeeUsuarios && (
                <NavItem
                  to="/usuarios"
                  active={loc.pathname.startsWith("/usuarios")}
                >
                  Usuarios
                </NavItem>
              )}

              {canSeeVendedores && (
                <NavItem
                  to="/vendedores"
                  active={loc.pathname.startsWith("/vendedores")}
                >
                  Vendedores
                </NavItem>
              )}

              {canSeeZonas && (
                <NavItem to="/zonas" active={loc.pathname.startsWith("/zonas")}>
                  Zonas
                </NavItem>
              )}

              {canSeeRutas && (
                <NavItem to="/rutas" active={loc.pathname.startsWith("/rutas")}>
                  Rutas
                </NavItem>
              )}

              {canSeeProductos && (
                <NavItem
                  to="/productos"
                  active={loc.pathname.startsWith("/productos")}
                >
                  Productos
                </NavItem>
              )}

              {canSeeStock && (
                <NavItem to="/stock" active={loc.pathname.startsWith("/stock")}>
                  Inventario
                </NavItem>
              )}

              {canSeeMovimientos && (
                <NavItem
                  to="/movimientos-stock"
                  active={loc.pathname.startsWith("/movimientos-stock")}
                >
                  Movimientos
                </NavItem>
              )}

              {canSeeCaja && (
                <NavItem to="/caja" active={loc.pathname.startsWith("/caja")}>
                  Caja
                </NavItem>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="pro-main">{children}</main>

      <footer className="pro-footer">
        <div className="pro-footer-inner">
          <span>© {new Date().getFullYear()} Plastiquería</span>
          <span>Grupo Cresth by Joserweb</span>
        </div>
      </footer>
    </div>
  );
}

function NavItem({ to, active, children }) {
  return (
    <Link to={to} className={`pro-nav-btn ${active ? "is-active" : ""}`}>
      {children}
    </Link>
  );
}