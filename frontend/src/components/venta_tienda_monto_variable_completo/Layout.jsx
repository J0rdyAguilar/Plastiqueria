import React, { useEffect, useMemo, useState } from "react";
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
  Bell,
} from "lucide-react";
import { clearSession, getSession, isLoggedIn } from "../lib/auth";
import { notify } from "../lib/notify";
import "./layout.css";

const API_BASE = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000/api"
).replace(/\/+$/, "");

function normalizeRole(r) {
  const x = (r || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  if (x === "cajero") return "caja";
  if (x === "superadmin") return "super_admin";
  if (x === "administrador_bodega") return "admin_bodega";
  if (x === "adminbod") return "admin_bodega";
  return x;
}

function prettyRole(role) {
  if (role === "super_admin") return "Super Admin";
  if (role === "admin") return "Administrador";
  if (role === "admin_bodega") return "Administrador de bodega";
  if (role === "vendedor") return "Vendedor";
  if (role === "vendedor_tienda") return "Vendedor tienda";
  if (role === "rutero") return "Rutero";
  if (role === "caja") return "Caja";
  return role || "Usuario";
}

function extractArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  return [];
}

function getPossibleTokenFromObject(obj) {
  if (!obj || typeof obj !== "object") return "";

  return (
    obj.token ||
    obj.access_token ||
    obj.plainTextToken ||
    obj.plain_text_token ||
    obj.auth_token ||
    obj.bearer ||
    obj?.data?.token ||
    obj?.data?.access_token ||
    obj?.data?.plainTextToken ||
    obj?.data?.plain_text_token ||
    obj?.user?.token ||
    ""
  );
}

function getAuthToken() {
  const session = getSession();
  const direct = getPossibleTokenFromObject(session);
  if (direct) return direct;

  const commonKeys = [
    "token",
    "access_token",
    "auth_token",
    "session",
    "auth",
    "user",
    "usuario",
  ];

  for (const key of commonKeys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      const token = getPossibleTokenFromObject(parsed);
      if (token) return token;
    } catch {
      if (raw.length > 20 && !raw.includes("{")) return raw;
    }
  }

  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    const raw = key ? localStorage.getItem(key) : null;
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      const token = getPossibleTokenFromObject(parsed);
      if (token) return token;
    } catch {
      // ignorar valores que no son JSON
    }
  }

  return "";
}

async function requestApi(path, options = {}) {
  const token = getAuthToken();

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  const text = await res.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const message =
      data?.message ||
      data?.error ||
      `Error HTTP ${res.status} al llamar ${path}`;

    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export default function Layout({ children }) {
  const nav = useNavigate();
  const loc = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [notiOpen, setNotiOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const logged = isLoggedIn();
  const me = getSession()?.user;
  const rol = normalizeRole(me?.rol || me?.role);

  const isSuperAdmin = logged && rol === "super_admin";
  const isAdmin = logged && rol === "admin";
  const isAdminBodega = logged && rol === "admin_bodega";
  const isVendedor = logged && rol === "vendedor";
  const isVendedorTienda = logged && rol === "vendedor_tienda";
  const isRutero = logged && rol === "rutero";
  const isCaja = logged && rol === "caja";

  const canAccessTienda =
    logged && (isSuperAdmin || isAdmin || isVendedorTienda);

  async function cargarMontosVariablesPendientes() {
    if (!isSuperAdmin) {
      setNotifications([]);
      return;
    }

    try {
      const [pedidosRes, ventasRes] = await Promise.allSettled([
        requestApi("/pedidos/montos-variables/pendientes", { method: "GET" }),
        requestApi("/ventas-tienda/montos-variables/pendientes", { method: "GET" }),
      ]);

      const pedidos =
        pedidosRes.status === "fulfilled" ? extractArray(pedidosRes.value) : [];
      const ventas =
        ventasRes.status === "fulfilled" ? extractArray(ventasRes.value) : [];

      if (pedidosRes.status === "rejected") {
        console.error("Error cargando montos variables de pedidos:", pedidosRes.reason);
      }

      if (ventasRes.status === "rejected") {
        console.error("Error cargando montos variables de ventas tienda:", ventasRes.reason);
      }

      const notificacionesPedidos = pedidos.map((pedido) => ({
        id: `pedido-${pedido.id}`,
        entidad: "pedido",
        entidadId: pedido.id,
        mensaje: `Pedido #${pedido.id} requiere aprobación de monto variable.`,
        tiempo: pedido.creado_en || pedido.created_at || "Pendiente",
        leido: false,
        tipo: "pendiente",
      }));

      const notificacionesVentas = ventas.map((venta) => ({
        id: `venta-tienda-${venta.id}`,
        entidad: "venta_tienda",
        entidadId: venta.id,
        mensaje: `Venta tienda #${venta.id} requiere aprobación de monto variable.`,
        tiempo: venta.creado_en || venta.created_at || "Pendiente",
        leido: false,
        tipo: "pendiente",
      }));

      setNotifications([...notificacionesPedidos, ...notificacionesVentas]);
    } catch (error) {
      console.error("Error cargando montos variables pendientes:", error);
      setNotifications([]);
    }
  }

  useEffect(() => {
    cargarMontosVariablesPendientes();

    if (!isSuperAdmin) return undefined;

    const interval = window.setInterval(() => {
      cargarMontosVariablesPendientes();
    }, 15000);

    return () => window.clearInterval(interval);
  }, [isSuperAdmin]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.leido).length;
  }, [notifications]);

  const homeLink = useMemo(() => {
    if (!logged) return "/login";
    if (isRutero) return "/rutero";
    if (isVendedorTienda) return "/ventas-tienda";
    if (isAdminBodega) return "/pedidos-admin";
    if (isSuperAdmin || isAdmin) return "/dashboard";
    if (isCaja) return "/caja";
    if (isVendedor) return "/pedidos#crear-pedido";
    return "/login";
  }, [
    logged,
    isRutero,
    isVendedorTienda,
    isAdminBodega,
    isSuperAdmin,
    isAdmin,
    isCaja,
    isVendedor,
  ]);

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

  function marcarComoLeidas() {
    setNotifications((prev) => prev.map((n) => ({ ...n, leido: true })));
  }

  async function handleAprobarMonto(noti) {
    const entidadNombre = noti.entidad === "venta_tienda" ? "Venta tienda" : "Pedido";

    if (
      !window.confirm(
        `¿Aprobar el monto variable para ${entidadNombre} #${noti.entidadId}?`
      )
    ) {
      return;
    }

    try {
      const endpoint =
        noti.entidad === "venta_tienda"
          ? `/ventas-tienda/${noti.entidadId}/aprobar-monto-variable`
          : `/pedidos/${noti.entidadId}/aprobar-monto-variable`;

      await requestApi(endpoint, { method: "POST" });

      setNotifications((prev) => prev.filter((n) => n.id !== noti.id));

      notify.success(`Monto variable de ${entidadNombre} #${noti.entidadId} aprobado.`);
      await cargarMontosVariablesPendientes();
    } catch (error) {
      console.error("Error aprobando monto variable:", error);
      notify.error(error?.message || "No se pudo aprobar el monto variable.");
    }
  }

  async function handleRechazarMonto(noti) {
    const entidadNombre = noti.entidad === "venta_tienda" ? "Venta tienda" : "Pedido";

    if (
      !window.confirm(
        `¿Rechazar el monto variable para ${entidadNombre} #${noti.entidadId}?`
      )
    ) {
      return;
    }

    try {
      const endpoint =
        noti.entidad === "venta_tienda"
          ? `/ventas-tienda/${noti.entidadId}/rechazar-monto-variable`
          : `/pedidos/${noti.entidadId}/rechazar-monto-variable`;

      await requestApi(endpoint, { method: "POST" });

      setNotifications((prev) => prev.filter((n) => n.id !== noti.id));

      notify.success(`Monto variable de ${entidadNombre} #${noti.entidadId} rechazado.`);
      await cargarMontosVariablesPendientes();
    } catch (error) {
      console.error("Error rechazando monto variable:", error);
      notify.error(error?.message || "No se pudo rechazar el monto variable.");
    }
  }

  const adminLinks = [
    {
      to: "/dashboard",
      label: "Dashboard",
      icon: <LayoutDashboard size={18} />,
      show: isSuperAdmin || isAdmin,
      active: loc.pathname.startsWith("/dashboard"),
    },
    {
      to: "/pedidos-admin",
      label: "Pedidos",
      icon: <ShoppingCart size={18} />,
      show: isSuperAdmin || isAdmin || isAdminBodega,
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
      show: isSuperAdmin,
      active: loc.pathname.startsWith("/vendedores"),
    },
    {
      to: "/zonas",
      label: "Zonas",
      icon: <MapPinned size={18} />,
      show: isSuperAdmin,
      active: loc.pathname.startsWith("/zonas"),
    },
    {
      to: "/rutas",
      label: "Rutas",
      icon: <Route size={18} />,
      show: isSuperAdmin,
      active: loc.pathname.startsWith("/rutas"),
    },
    {
      to: "/productos",
      label: "Productos",
      icon: <Package size={18} />,
      show: isSuperAdmin,
      active: loc.pathname.startsWith("/productos"),
    },
    {
      to: "/stock",
      label: "Inventario",
      icon: <Boxes size={18} />,
      show: isSuperAdmin || isAdmin || isAdminBodega,
      active: loc.pathname.startsWith("/stock"),
    },
    {
      to: "/movimientos-stock",
      label: "Movimientos",
      icon: <ArrowLeftRight size={18} />,
      show: isSuperAdmin || isAdmin || isAdminBodega,
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
      show: logged && (isSuperAdmin || isAdmin || isCaja),
      active: loc.pathname.startsWith("/caja"),
    },
    {
      to: "/cuotas",
      label: "Cuotas",
      icon: <Wallet size={18} />,
      show: isSuperAdmin,
      active: loc.pathname.startsWith("/cuotas"),
    },
  ].filter((item) => item.show);

  return (
    <div className="lux-shell" onClick={() => setNotiOpen(false)}>
      <style>{`
        .lux-shell {
          position: relative;
        }
        .lux-header,
        .lux-header-inner {
          position: relative;
          z-index: 999999 !important;
          overflow: visible !important;
        }
        .lux-header-row {
          position: relative;
          overflow: visible !important;
        }
        .lux-top-actions {
          position: relative;
          z-index: 999999 !important;
          display: flex;
          align-items: center;
          overflow: visible !important;
        }
        .lux-noti-container {
          position: relative;
          display: flex;
          align-items: center;
          margin-right: 12px;
          overflow: visible !important;
        }
        .lux-noti-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #a3b1cc;
          padding: 10px;
          border-radius: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          position: relative;
        }
        .lux-noti-btn:hover,
        .lux-noti-btn.active {
          background: rgba(255, 255, 255, 0.12);
          color: #fff;
          border-color: rgba(255, 255, 255, 0.25);
        }
        .lux-noti-badge {
          position: absolute;
          top: -3px;
          right: -3px;
          background: #ef4444;
          color: white;
          font-size: 10px;
          font-weight: bold;
          border-radius: 50%;
          min-width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2px;
          border: 2px solid #141923;
        }
        .lux-noti-dropdown {
          position: absolute;
          top: 56px;
          right: 0;
          width: 340px;
          background: #151a2e !important;
          border: 1px solid rgba(255, 255, 255, 0.16) !important;
          border-radius: 16px;
          box-shadow: 0 30px 60px -12px rgba(0, 0, 0, 0.85), 0 18px 36px -18px rgba(0, 0, 0, 0.8) !important;
          z-index: 99999999 !important;
          overflow: hidden !important;
          text-align: left;
        }
        .lux-noti-header {
          padding: 14px 16px;
          background: rgba(0, 0, 0, 0.35);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .lux-noti-header h4 {
          margin: 0;
          font-size: 14px;
          color: #fff;
          font-weight: 600;
        }
        .lux-noti-clear-btn {
          background: none;
          border: none;
          color: #3b82f6;
          font-size: 12px;
          cursor: pointer;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .lux-noti-clear-btn:hover {
          background: rgba(59, 130, 246, 0.15);
        }
        .lux-noti-body {
          max-height: 320px;
          overflow-y: auto;
        }
        .lux-noti-item {
          padding: 14px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          flex-direction: column;
          gap: 6px;
          transition: background 0.2s;
        }
        .lux-noti-item:hover {
          background: rgba(255, 255, 255, 0.04);
        }
        .lux-noti-item.unread {
          background: rgba(59, 130, 246, 0.08);
          border-left: 3px solid #3b82f6;
          padding-left: 13px;
        }
        .lux-noti-text {
          font-size: 13px;
          color: #e2e8f0;
          margin: 0;
          line-height: 1.4;
        }
        .lux-noti-time {
          font-size: 11px;
          color: #64748b;
        }
        .lux-noti-actions {
          display: flex;
          gap: 8px;
          margin-top: 4px;
        }
        .lux-btn-approve,
        .lux-btn-reject {
          flex: 1;
          color: white;
          border: none;
          padding: 6px 10px;
          font-size: 11px;
          font-weight: bold;
          border-radius: 6px;
          cursor: pointer;
          text-align: center;
          transition: background 0.2s;
        }
        .lux-btn-approve {
          background: #10b981;
        }
        .lux-btn-approve:hover {
          background: #059669;
        }
        .lux-btn-reject {
          background: #ef4444;
        }
        .lux-btn-reject:hover {
          background: #dc2626;
        }
        .lux-noti-empty {
          padding: 30px 16px;
          text-align: center;
          color: #64748b;
          font-size: 13px;
        }
      `}</style>

      <header className="lux-header" onClick={(e) => e.stopPropagation()}>
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
                  {isVendedorTienda
                    ? "Panel de tienda"
                    : isAdminBodega
                    ? "Panel de bodega"
                    : isSuperAdmin || isAdmin
                    ? "Dashboard administrativo"
                    : "Panel administrativo"}
                </span>
              </div>
            </Link>

            <div className="lux-top-actions">
              {vendedorEnPedidos && (
                <div className="lux-segmented desktop-only">
                  <Link
                    to="/pedidos#crear-pedido"
                    className={`lux-chip ${
                      vendedorVista === "crear" ? "is-active" : ""
                    }`}
                  >
                    <PlusCircle size={15} />
                    Crear pedido
                  </Link>

                  <Link
                    to="/pedidos#mis-pedidos"
                    className={`lux-chip ${
                      vendedorVista === "mios" ? "is-active" : ""
                    }`}
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
                    className={`lux-chip ${
                      loc.pathname === "/rutero" ? "is-active" : ""
                    }`}
                  >
                    <Package size={15} />
                    Pedidos asignados
                  </Link>

                  <Link
                    to="/rutero/historial"
                    className={`lux-chip ${
                      loc.pathname === "/rutero/historial" ? "is-active" : ""
                    }`}
                  >
                    <ReceiptText size={15} />
                    Historial
                  </Link>
                </div>
              )}

              {isSuperAdmin && (
                <div className="lux-noti-container">
                  <button
                    type="button"
                    className={`lux-noti-btn ${notiOpen ? "active" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setNotiOpen((v) => !v);
                      cargarMontosVariablesPendientes();
                    }}
                    title="Notificaciones de Montos"
                  >
                    <Bell size={18} />
                    {unreadCount > 0 && (
                      <span className="lux-noti-badge">{unreadCount}</span>
                    )}
                  </button>

                  <AnimatePresence>
                    {notiOpen && (
                      <motion.div
                        className="lux-noti-dropdown"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ duration: 0.12 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="lux-noti-header">
                          <h4>Monto Variable</h4>
                          {unreadCount > 0 && (
                            <button
                              className="lux-noti-clear-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                marcarComoLeidas();
                              }}
                            >
                              Marcar leídas
                            </button>
                          )}
                        </div>

                        <div className="lux-noti-body">
                          {notifications.length === 0 ? (
                            <div className="lux-noti-empty">
                              No hay notificaciones recientes
                            </div>
                          ) : (
                            notifications.map((noti) => (
                              <div
                                key={noti.id}
                                className={`lux-noti-item ${
                                  noti.leido ? "read" : "unread"
                                }`}
                              >
                                <p className="lux-noti-text">{noti.mensaje}</p>
                                <span className="lux-noti-time">
                                  {noti.tiempo}
                                </span>

                                {noti.tipo === "pendiente" && (
                                  <div
                                    className="lux-noti-actions"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      className="lux-btn-approve"
                                      onClick={() =>
                                        handleAprobarMonto(noti)
                                      }
                                    >
                                      Aprobar
                                    </button>
                                    <button
                                      type="button"
                                      className="lux-btn-reject"
                                      onClick={() =>
                                        handleRechazarMonto(noti)
                                      }
                                    >
                                      Rechazar
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
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
                      {(me?.nombre || me?.usuario || "U")
                        .charAt(0)
                        .toUpperCase()}
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
                    {(me?.nombre || me?.usuario || "U")
                      .charAt(0)
                      .toUpperCase()}
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
                    className={`lux-mobile-link ${
                      loc.pathname === "/perfil" ? "is-active" : ""
                    }`}
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
                    className={`lux-mobile-link ${
                      vendedorVista === "crear" ? "is-active" : ""
                    }`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <PlusCircle size={16} />
                    Crear pedido
                  </Link>

                  <Link
                    to="/pedidos#mis-pedidos"
                    className={`lux-mobile-link ${
                      vendedorVista === "mios" ? "is-active" : ""
                    }`}
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
                    className={`lux-mobile-link ${
                      loc.pathname === "/rutero" ? "is-active" : ""
                    }`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Package size={16} />
                    Pedidos asignados
                  </Link>

                  <Link
                    to="/rutero/historial"
                    className={`lux-mobile-link ${
                      loc.pathname === "/rutero/historial" ? "is-active" : ""
                    }`}
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
                    className={`lux-mobile-link ${
                      item.active ? "is-active" : ""
                    }`}
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                ))}
              </div>

              {logged ? (
                <button
                  type="button"
                  className="lux-mobile-logout"
                  onClick={logout}
                >
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
        {(isSuperAdmin || isAdmin || isAdminBodega || isVendedorTienda) && (
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
      className={`lux-nav-link ${vertical ? "is-vertical" : ""} ${
        active ? "is-active" : ""
      }`}
    >
      <span className="lux-nav-icon">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
