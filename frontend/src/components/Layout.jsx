import React, { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  UserCog,
  MapPinned,
  Route,
  Package,
  Boxes,
  ArrowLeftRight,
  Wallet,
  LogOut,
  Menu,
  X,
  ShoppingCart,
  PlusCircle,
  ReceiptText,
  Store,
} from "lucide-react";
import { clearSession, getSession, isLoggedIn } from "../lib/auth";

function normalizeRole(r) {
  const x = (r || "").toString().trim().toLowerCase();
  if (x === "cajero") return "caja";
  if (x === "superadmin") return "super_admin";
  return x;
}

export default function Layout({ children }) {
  const nav = useNavigate();
  const loc = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const logged = isLoggedIn();
  const me = getSession()?.user;
  const rol = normalizeRole(me?.rol || me?.role);

  const isSuperAdmin = logged && rol === "super_admin";
  const isAdmin = logged && rol === "admin";
  const isAdminLike = logged && (rol === "admin" || rol === "super_admin");
  const isVendedor = logged && rol === "vendedor";
  const isVendedorTienda = logged && rol === "vendedor_tienda";
  const isCaja = logged && rol === "caja";

  const canAccessTienda = logged && (isAdmin || isSuperAdmin || isVendedorTienda);

  const homeLink = useMemo(() => {
    if (!logged) return "/login";
    if (isVendedorTienda) return "/ventas-tienda";
    if (isAdminLike) return "/pedidos-admin";
    if (isCaja) return "/caja";
    if (isVendedor) return "/pedidos#crear-pedido";
    return "/login";
  }, [logged, isVendedorTienda, isAdminLike, isCaja, isVendedor]);

  const vendedorEnPedidos = isVendedor && loc.pathname === "/pedidos";
  const vendedorVista = loc.hash === "#mis-pedidos" ? "mios" : "crear";

  function logout() {
    clearSession();
    nav("/login", { replace: true });
  }

  const adminLinks = [
    {
      to: "/pedidos-admin",
      label: "Pedidos",
      icon: <ShoppingCart size={16} />,
      show: isAdminLike,
      active: loc.pathname.startsWith("/pedidos-admin"),
    },
    {
      to: "/usuarios",
      label: "Usuarios",
      icon: <Users size={16} />,
      show: isSuperAdmin,
      active: loc.pathname.startsWith("/usuarios"),
    },
    {
      to: "/vendedores",
      label: "Vendedores",
      icon: <UserCog size={16} />,
      show: isAdminLike,
      active: loc.pathname.startsWith("/vendedores"),
    },
    {
      to: "/zonas",
      label: "Zonas",
      icon: <MapPinned size={16} />,
      show: isAdminLike,
      active: loc.pathname.startsWith("/zonas"),
    },
    {
      to: "/rutas",
      label: "Rutas",
      icon: <Route size={16} />,
      show: isAdminLike,
      active: loc.pathname.startsWith("/rutas"),
    },
    {
      to: "/productos",
      label: "Productos",
      icon: <Package size={16} />,
      show: isAdminLike,
      active: loc.pathname.startsWith("/productos"),
    },
    {
      to: "/stock",
      label: "Inventario",
      icon: <Boxes size={16} />,
      show: isAdminLike,
      active: loc.pathname.startsWith("/stock"),
    },
    {
      to: "/movimientos-stock",
      label: "Movimientos",
      icon: <ArrowLeftRight size={16} />,
      show: isAdminLike,
      active: loc.pathname.startsWith("/movimientos-stock"),
    },
    {
      to: "/ventas-tienda",
      label: "Tienda",
      icon: <Store size={16} />,
      show: canAccessTienda,
      active: loc.pathname.startsWith("/ventas-tienda"),
    },
    {
      to: "/caja",
      label: "Caja",
      icon: <Wallet size={16} />,
      show: logged && (isAdminLike || isCaja),
      active: loc.pathname.startsWith("/caja"),
    },
  ].filter((item) => item.show);

  return (
    <div className="lux-shell">
      <header className="lux-header">
        <div className="lux-header-row">
          <Link to={homeLink} className="lux-brand">
            <div className="lux-brand-logo">P</div>

            <div className="lux-brand-copy">
              <strong>Plastimax</strong>
              <span>
                {isVendedorTienda ? "Panel de tienda" : "Panel administrativo"}
              </span>
            </div>
          </Link>

          <div className="lux-top-actions">
            {vendedorEnPedidos && (
              <div className="lux-segmented desktop-only">
                <Link
                  to="/pedidos#crear-pedido"
                  className={`lux-chip ${vendedorVista === "crear" ? "is-active" : ""}`}
                >
                  <PlusCircle size={15} />
                  Crear pedido
                </Link>

                <Link
                  to="/pedidos#mis-pedidos"
                  className={`lux-chip ${vendedorVista === "mios" ? "is-active" : ""}`}
                >
                  <ReceiptText size={15} />
                  Mis pedidos
                </Link>
              </div>
            )}

            {logged ? (
              <div className="lux-user-box desktop-only">
                <div className="lux-avatar">
                  {(me?.nombre || me?.usuario || "U").charAt(0).toUpperCase()}
                </div>

                <div className="lux-user-copy">
                  <strong>{me?.nombre || me?.usuario || "Usuario"}</strong>
                  <span>{rol || "—"}</span>
                </div>

                <button type="button" className="lux-logout" onClick={logout}>
                  <LogOut size={16} />
                  Salir
                </button>
              </div>
            ) : (
              <Link className="lux-login-link desktop-only" to="/login">
                Iniciar sesión
              </Link>
            )}

            <button
              type="button"
              className="lux-mobile-toggle"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Abrir menú"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {(isAdminLike || isVendedorTienda) && (
          <nav className="lux-admin-nav desktop-only">
            {adminLinks.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </nav>
        )}

        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              className="lux-mobile-panel"
              initial={{ opacity: 0, y: -14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.22 }}
            >
              {logged && (
                <div className="lux-mobile-user">
                  <div className="lux-avatar">
                    {(me?.nombre || me?.usuario || "U").charAt(0).toUpperCase()}
                  </div>

                  <div className="lux-user-copy">
                    <strong>{me?.nombre || me?.usuario || "Usuario"}</strong>
                    <span>{rol || "—"}</span>
                  </div>
                </div>
              )}

              {vendedorEnPedidos && (
                <div className="lux-mobile-group">
                  <Link
                    to="/pedidos#crear-pedido"
                    className={`lux-mobile-link ${vendedorVista === "crear" ? "is-active" : ""}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <PlusCircle size={16} />
                    Crear pedido
                  </Link>

                  <Link
                    to="/pedidos#mis-pedidos"
                    className={`lux-mobile-link ${vendedorVista === "mios" ? "is-active" : ""}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <ReceiptText size={16} />
                    Mis pedidos
                  </Link>
                </div>
              )}

              <div className="lux-mobile-group">
                {adminLinks.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`lux-mobile-link ${item.active ? "is-active" : ""}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                ))}
              </div>

              {logged ? (
                <button type="button" className="lux-mobile-logout" onClick={logout}>
                  <LogOut size={16} />
                  Cerrar sesión
                </button>
              ) : (
                <Link
                  className="lux-mobile-logout"
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                >
                  Iniciar sesión
                </Link>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="lux-main">
        <motion.div
          className="lux-content-wrap"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
        >
          {children}
        </motion.div>
      </main>

      <footer className="lux-footer">
        <div className="lux-footer-inner">
          <div className="lux-footer-brand">
            <LayoutDashboard size={16} />
            <span>© {new Date().getFullYear()} Plastiquería</span>
          </div>
          <span>Grupo Cresth by Joserweb</span>
        </div>
      </footer>
    </div>
  );
}

function NavItem({ to, active, label, icon }) {
  return (
    <Link to={to} className={`lux-nav-link ${active ? "is-active" : ""}`}>
      {icon}
      <span>{label}</span>
    </Link>
  );
}