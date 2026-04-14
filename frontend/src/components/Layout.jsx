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
  UserCircle2,
} from "lucide-react";
import { clearSession, getSession, isLoggedIn } from "../lib/auth";
import "./layout.css";

function normalizeRole(r) {
  const x = (r || "").toString().trim().toLowerCase();
  if (x === "cajero") return "caja";
  if (x === "superadmin") return "super_admin";
  return x;
}

function prettyRole(role) {
  if (role === "super_admin") return "Super Admin";
  if (role === "admin") return "Administrador";
  if (role === "vendedor") return "Vendedor";
  if (role === "vendedor_tienda") return "Vendedor tienda";
  if (role === "rutero") return "Rutero";
  if (role === "caja") return "Caja";
  return role || "Usuario";
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
  const isRutero = logged && rol === "rutero";
  const isCaja = logged && rol === "caja";

  const canAccessTienda = logged && (isAdmin || isSuperAdmin || isVendedorTienda);

  const homeLink = useMemo(() => {
    if (!logged) return "/login";
    if (isRutero) return "/rutero";
    if (isVendedorTienda) return "/ventas-tienda";
    if (isAdminLike) return "/pedidos-admin";
    if (isCaja) return "/caja";
    if (isVendedor) return "/pedidos#crear-pedido";
    return "/login";
  }, [logged, isRutero, isVendedorTienda, isAdminLike, isCaja, isVendedor]);

  const vendedorEnPedidos = isVendedor && loc.pathname === "/pedidos";
  const vendedorVista = loc.hash === "#mis-pedidos" ? "mios" : "crear";

  const ruteroEnVista =
    isRutero &&
    (loc.pathname === "/rutero" || loc.pathname === "/rutero/historial");

  function logout() {
    clearSession();
    nav("/login", { replace: true });
  }

  function goProfile() {
    setMobileOpen(false);
    nav("/perfil");
  }

  const adminLinks = [
    {
      to: "/pedidos-admin",
      label: "Pedidos",
      icon: <ShoppingCart size={18} />,
      show: isAdminLike,
      active: loc.pathname.startsWith("/pedidos-admin"),
    },
    {
      to: "/usuarios",
      label: "Usuarios",
      icon: <Users size={18} />,
      show: isSuperAdmin,
      active: loc.pathname.startsWith("/usuarios"),
    },
    {
      to: "/vendedores",
      label: "Vendedores",
      icon: <UserCog size={18} />,
      show: isAdminLike,
      active: loc.pathname.startsWith("/vendedores"),
    },
    {
      to: "/zonas",
      label: "Zonas",
      icon: <MapPinned size={18} />,
      show: isAdminLike,
      active: loc.pathname.startsWith("/zonas"),
    },
    {
      to: "/rutas",
      label: "Rutas",
      icon: <Route size={18} />,
      show: isAdminLike,
      active: loc.pathname.startsWith("/rutas"),
    },
    {
      to: "/productos",
      label: "Productos",
      icon: <Package size={18} />,
      show: isAdminLike,
      active: loc.pathname.startsWith("/productos"),
    },
    {
      to: "/stock",
      label: "Inventario",
      icon: <Boxes size={18} />,
      show: isAdminLike,
      active: loc.pathname.startsWith("/stock"),
    },
    {
      to: "/movimientos-stock",
      label: "Movimientos",
      icon: <ArrowLeftRight size={18} />,
      show: isAdminLike,
      active: loc.pathname.startsWith("/movimientos-stock"),
    },
    {
      to: "/ventas-tienda",
      label: "Tienda",
      icon: <Store size={18} />,
      show: canAccessTienda,
      active: loc.pathname.startsWith("/ventas-tienda"),
    },
    {
      to: "/registro-ventas-tienda",
      label: "Registro ventas",
      icon: <ReceiptText size={18} />,
      show: canAccessTienda,
      active: loc.pathname.startsWith("/registro-ventas-tienda"),
    },
    {
      to: "/caja",
      label: "Caja",
      icon: <Wallet size={18} />,
      show: logged && (isAdminLike || isCaja),
      active: loc.pathname.startsWith("/caja"),
    },
  ].filter((item) => item.show);

  return (
    <div className="lux-shell">
      <header className="lux-header">
        <div className="lux-header-glow lux-header-glow--one" />
        <div className="lux-header-glow lux-header-glow--two" />

        <div className="lux-header-inner">
          <div className="lux-header-row">
            <Link to={homeLink} className="lux-brand">
              <div className="lux-brand-logo-wrap">
                <img
                  src="/img/logo.png"
                  alt="Plastimax"
                  className="lux-brand-logo-img"
                />
              </div>

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

              {ruteroEnVista && (
                <div className="lux-segmented desktop-only">
                  <Link
                    to="/rutero"
                    className={`lux-chip ${loc.pathname === "/rutero" ? "is-active" : ""}`}
                  >
                    <Package size={15} />
                    Pedidos asignados
                  </Link>

                  <Link
                    to="/rutero/historial"
                    className={`lux-chip ${loc.pathname === "/rutero/historial" ? "is-active" : ""}`}
                  >
                    <ReceiptText size={15} />
                    Historial
                  </Link>
                </div>
              )}

              {logged ? (
                <div className="lux-user-box desktop-only">
                  <button
                    type="button"
                    className="lux-user-profile-btn"
                    onClick={goProfile}
                    title="Ver perfil"
                  >
                    <div className="lux-avatar">
                      {(me?.nombre || me?.usuario || "U").charAt(0).toUpperCase()}
                    </div>

                    <div className="lux-user-copy">
                      <strong>{me?.nombre || me?.usuario || "Usuario"}</strong>
                      <span>{prettyRole(rol)}</span>
                    </div>
                  </button>

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
        </div>

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
                    <span>{prettyRole(rol)}</span>
                  </div>
                </div>
              )}

              {logged && (
                <div className="lux-mobile-group">
                  <button
                    type="button"
                    className={`lux-mobile-link ${loc.pathname === "/perfil" ? "is-active" : ""}`}
                    onClick={goProfile}
                  >
                    <UserCircle2 size={16} />
                    Mi perfil
                  </button>
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

              {ruteroEnVista && (
                <div className="lux-mobile-group">
                  <Link
                    to="/rutero"
                    className={`lux-mobile-link ${loc.pathname === "/rutero" ? "is-active" : ""}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Package size={16} />
                    Pedidos asignados
                  </Link>

                  <Link
                    to="/rutero/historial"
                    className={`lux-mobile-link ${loc.pathname === "/rutero/historial" ? "is-active" : ""}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <ReceiptText size={16} />
                    Historial
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

      <div className="lux-layout">
        {(isAdminLike || isVendedorTienda) && (
          <aside className="lux-sidebar desktop-only">
            <div className="lux-sidebar-inner">
              <div className="lux-sidebar-badge">Panel</div>
              <div className="lux-sidebar-title">Menú principal</div>

              <nav className="lux-sidebar-nav">
                {adminLinks.map((item) => (
                  <NavItem key={item.to} {...item} vertical />
                ))}
              </nav>
            </div>
          </aside>
        )}

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
      </div>

      <footer className="lux-footer">
        <div className="lux-footer-inner">
          <div className="lux-footer-brand">
            <LayoutDashboard size={16} />
            <span>© {new Date().getFullYear()} Plastiquería</span>
          </div>
          <span>Ing. Jordy by Joserweb</span>
        </div>
      </footer>
    </div>
  );
}

function NavItem({ to, active, label, icon, vertical = false }) {
  return (
    <Link
      to={to}
      className={`lux-nav-link ${vertical ? "is-vertical" : ""} ${active ? "is-active" : ""}`}
    >
      <span className="lux-nav-icon">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}