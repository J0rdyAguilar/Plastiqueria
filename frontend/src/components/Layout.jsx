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

const RAW_API_BASE = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000/api/v1"
).replace(/\/+$/, "");

function uniqueValues(values) {
  return values.filter((value, index, arr) => value && arr.indexOf(value) === index);
}

function getBackendRoot() {
  return String(RAW_API_BASE)
    .replace(/\/+$/, "")
    .replace(/\/api\/v1$/i, "")
    .replace(/\/api$/i, "");
}

function getApiBaseCandidates() {
  const raw = String(RAW_API_BASE).replace(/\/+$/, "");
  const root = getBackendRoot();

  return uniqueValues([
    raw,
    `${root}/api/v1`,
    `${root}/api`,
  ]);
}

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

function money(value) {
  return `Q${Number(value || 0).toFixed(2)}`;
}

function formatNotificationDate(value) {
  if (!value) return "Pendiente";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function getDetalleNombre(detalle) {
  return (
    detalle?.producto_nombre ||
    detalle?.producto?.nombre ||
    detalle?.nombre ||
    `Producto #${detalle?.producto_id || "—"}`
  );
}

function normalizeDetalles(detalles) {
  return Array.isArray(detalles) ? detalles : [];
}

function buildNotificacionPedido(pedido) {
  const detalles = normalizeDetalles(pedido?.detalles);
  return {
    id: `pedido-${pedido.id}`,
    entidad: "pedido",
    entidadId: pedido.id,
    titulo: `Pedido #${pedido.id}`,
    subtitulo: "Pedido con monto variable",
    mensaje: `Pedido #${pedido.id} requiere aprobación de monto variable.`,
    tiempo: formatNotificationDate(pedido.creado_en || pedido.created_at),
    cliente:
      pedido.cliente_nombre ||
      pedido.cliente?.nombre ||
      pedido.nombre_cliente ||
      "Cliente no especificado",
    vendedor:
      pedido.vendedor_nombre ||
      pedido.vendedor?.nombre ||
      pedido.vendedor?.usuario ||
      "Vendedor no especificado",
    sucursal:
      pedido.ubicacion_nombre ||
      pedido.ubicacion?.nombre ||
      pedido.sucursal_nombre ||
      "Sucursal no especificada",
    total: Number(pedido.total || 0),
    estado: pedido.estado || "pendiente_revision",
    detalles,
    leido: false,
    tipo: "pendiente",
  };
}

function buildNotificacionVentaTienda(venta) {
  const detalles = normalizeDetalles(venta?.detalles);
  return {
    id: `venta-tienda-${venta.id}`,
    entidad: "venta_tienda",
    entidadId: venta.id,
    titulo: `Venta tienda #${venta.id}`,
    subtitulo: "Venta tienda con monto variable",
    mensaje: `Venta tienda #${venta.id} requiere aprobación de monto variable.`,
    tiempo: formatNotificationDate(venta.creado_en || venta.created_at),
    cliente:
      venta.nombre_comprador ||
      venta.cliente_nombre ||
      venta.cliente?.nombre ||
      "Consumidor final",
    vendedor:
      venta.usuario_nombre ||
      venta.usuario?.nombre ||
      venta.usuario?.usuario ||
      "Vendedor no especificado",
    sucursal:
      venta.ubicacion_nombre ||
      venta.ubicacion?.nombre ||
      venta.sucursal_nombre ||
      "Sucursal no especificada",
    total: Number(venta.total || 0),
    estado: venta.estado || "pendiente_revision",
    detalles,
    leido: false,
    tipo: "pendiente",
  };
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
  const bases = getApiBaseCandidates();
  let lastError = null;

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  for (const base of bases) {
    try {
      const cleanPath = String(path || "").startsWith("/")
        ? String(path || "")
        : `/${path}`;

      const res = await fetch(`${base}${cleanPath}`, {
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
          `Error HTTP ${res.status} al llamar ${base}${cleanPath}`;

        const err = new Error(message);
        err.status = res.status;
        err.data = data;
        err.url = `${base}${cleanPath}`;
        throw err;
      }

      return data;
    } catch (err) {
      lastError = err;

      // Si una base falla por 404, probamos con la siguiente.
      if (err?.status === 404) {
        continue;
      }

      // Si falla por permisos o validación, no ocultamos el error.
      if (err?.status === 401 || err?.status === 403 || err?.status === 422) {
        throw err;
      }
    }
  }

  throw lastError || new Error(`No se pudo llamar ${path}`);
}

async function requestApiOptional(path, options = {}) {
  try {
    return await requestApi(path, options);
  } catch (err) {
    console.error(`Error opcional llamando ${path}:`, err);
    return null;
  }
}

function tieneBanderaMontoVariable(valor) {
  return valor === true || valor === 1 || valor === "1" || valor === "true";
}

function estaPendienteMontoVariable(item) {
  const estadoMonto = String(
    item?.monto_variable_estado ||
      item?.estado_monto_variable ||
      item?.monto_variable_status ||
      ""
  )
    .trim()
    .toLowerCase();

  const estado = String(item?.estado || "")
    .trim()
    .toLowerCase();

  const aprobado = tieneBanderaMontoVariable(
    item?.monto_variable_aprobado ||
      item?.aprobado_monto_variable ||
      item?.monto_variable_approved
  );

  const rechazado = tieneBanderaMontoVariable(
    item?.monto_variable_rechazado ||
      item?.rechazado_monto_variable ||
      item?.monto_variable_rejected
  );

  if (aprobado || rechazado) return false;

  if (
    [
      "aprobado",
      "aprobada",
      "rechazado",
      "rechazada",
      "monto_aprobado",
      "monto_rechazado",
      "aprobado_monto_variable",
      "rechazado_monto_variable",
    ].includes(estadoMonto)
  ) {
    return false;
  }

  if (
    [
      "pendiente",
      "pendiente_revision",
      "pendiente_aprobacion",
      "en_revision",
      "revision",
    ].includes(estadoMonto)
  ) {
    return true;
  }

  if (["pendiente_revision", "pendiente_aprobacion"].includes(estado)) {
    return true;
  }

  return false;
}

function filtrarPedidosMontoVariablePendiente(pedidos) {
  return extractArray(pedidos).filter((pedido) => {
    const detalles = Array.isArray(pedido?.detalles) ? pedido.detalles : [];

    const tieneDetalleMontoVariable = detalles.some((detalle) => {
      return (
        tieneBanderaMontoVariable(detalle?.es_monto_variable) ||
        tieneBanderaMontoVariable(detalle?.monto_variable)
      );
    });

    return (
      estaPendienteMontoVariable(pedido) ||
      (tieneDetalleMontoVariable &&
        estaPendienteMontoVariable({
          estado: pedido?.estado,
          monto_variable_estado: pedido?.monto_variable_estado || "pendiente",
        }))
    );
  });
}

function filtrarVentasTiendaMontoVariablePendiente(ventas) {
  return extractArray(ventas).filter((venta) => {
    const detalles = Array.isArray(venta?.detalles) ? venta.detalles : [];

    const tieneDetalleMontoVariable = detalles.some((detalle) => {
      return (
        tieneBanderaMontoVariable(detalle?.es_monto_variable) ||
        tieneBanderaMontoVariable(detalle?.monto_variable)
      );
    });

    return (
      estaPendienteMontoVariable(venta) ||
      (tieneDetalleMontoVariable &&
        estaPendienteMontoVariable({
          estado: venta?.estado,
          monto_variable_estado: venta?.monto_variable_estado || "pendiente",
        }))
    );
  });
}

async function cargarPedidosMontoVariablePendientes() {
  const directo = await requestApiOptional("/pedidos/montos-variables/pendientes", {
    method: "GET",
  });

  const pedidosDirectos = filtrarPedidosMontoVariablePendiente(directo);
  if (pedidosDirectos.length > 0) {
    return pedidosDirectos;
  }

  const respaldo = await requestApiOptional(
    "/pedidos?estado=pendiente_revision&per_page=100",
    { method: "GET" }
  );

  return filtrarPedidosMontoVariablePendiente(respaldo);
}

async function cargarVentasTiendaMontoVariablePendientes() {
  const directo = await requestApiOptional("/ventas-tienda/montos-variables/pendientes", {
    method: "GET",
  });

  const ventasDirectas = filtrarVentasTiendaMontoVariablePendiente(directo);
  if (ventasDirectas.length > 0) {
    return ventasDirectas;
  }

  const respaldo = await requestApiOptional(
    "/ventas-tienda?estado=pendiente_revision&per_page=100",
    { method: "GET" }
  );

  return filtrarVentasTiendaMontoVariablePendiente(respaldo);
}

export default function Layout({ children }) {
  const nav = useNavigate();
  const loc = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [notiOpen, setNotiOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [expandedNoti, setExpandedNoti] = useState({});
  const [processingNoti, setProcessingNoti] = useState({});

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
      const [pedidos, ventas] = await Promise.all([
        cargarPedidosMontoVariablePendientes(),
        cargarVentasTiendaMontoVariablePendientes(),
      ]);

      const notificacionesPedidos = extractArray(pedidos).map(buildNotificacionPedido);
      const notificacionesVentas = extractArray(ventas).map(buildNotificacionVentaTienda);

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

  function getAccionEndpointCandidates(noti, accion) {
    const id = noti?.entidadId;
    const base =
      noti?.entidad === "venta_tienda"
        ? `/ventas-tienda/${id}`
        : `/pedidos/${id}`;

    return [
      `${base}/${accion}-monto-variable`,
      `${base}/${accion}-monto`,
      `${base}/${accion}`,
    ];
  }

  async function ejecutarAccionMontoVariable(noti, accion) {
    const entidadNombre = noti.entidad === "venta_tienda" ? "Venta tienda" : "Pedido";
    const verbo = accion === "aprobar" ? "aprobar" : "rechazar";
    const verboPasado = accion === "aprobar" ? "aprobado" : "rechazado";

    if (
      !window.confirm(
        `¿${verbo.charAt(0).toUpperCase() + verbo.slice(1)} el monto variable para ${entidadNombre} #${noti.entidadId}?`
      )
    ) {
      return;
    }

    setProcessingNoti((prev) => ({ ...prev, [noti.id]: true }));

    const endpoints = getAccionEndpointCandidates(noti, accion);
    const methods = ["POST", "PATCH", "PUT"];
    let ultimoError = null;

    try {
      for (const endpoint of endpoints) {
        for (const method of methods) {
          try {
            await requestApi(endpoint, { method });

            setNotifications((prev) => prev.filter((n) => n.id !== noti.id));
            setExpandedNoti((prev) => {
              const copy = { ...prev };
              delete copy[noti.id];
              return copy;
            });

            notify.success(
              `Monto variable de ${entidadNombre} #${noti.entidadId} ${verboPasado}.`
            );

            window.setTimeout(() => {
              cargarMontosVariablesPendientes();
            }, 800);

            return;
          } catch (error) {
            ultimoError = error;

            if (error?.status === 404 || error?.status === 405) {
              continue;
            }

            throw error;
          }
        }
      }

      throw ultimoError || new Error("No se encontró una ruta válida para procesar la notificación.");
    } catch (error) {
      console.error(`Error al ${verbo} monto variable:`, error);
      notify.error(
        error?.message ||
          `No se pudo ${verbo} el monto variable de ${entidadNombre} #${noti.entidadId}.`
      );
    } finally {
      setProcessingNoti((prev) => {
        const copy = { ...prev };
        delete copy[noti.id];
        return copy;
      });
    }
  }

  async function handleAprobarMonto(noti) {
    await ejecutarAccionMontoVariable(noti, "aprobar");
  }

  async function handleRechazarMonto(noti) {
    await ejecutarAccionMontoVariable(noti, "rechazar");
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
      to: "/clientes",
      label: "Clientes",
      icon: <Users size={18} />,
      show: isSuperAdmin,
      active: loc.pathname.startsWith("/clientes"),
    },
    {
      to: "/vendedores",
      label: "Vendedores",
      icon: <UserCog size={18} />,
      show: isSuperAdmin,
      active: loc.pathname.startsWith("/vendedores"),
    },
    {
      to: "/rutero/historial",
      label: "Cobros ruteros",
      icon: <ReceiptText size={18} />,
      show: isSuperAdmin,
      active: loc.pathname === "/rutero/historial",
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
          width: min(480px, calc(100vw - 24px));
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
          max-height: 520px;
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
        .lux-noti-topline {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
        }
        .lux-noti-kind {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 4px 8px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          background: rgba(59, 130, 246, 0.16);
          color: #93c5fd;
          border: 1px solid rgba(147, 197, 253, 0.26);
          white-space: nowrap;
        }
        .lux-noti-total {
          font-size: 18px;
          color: #fff;
          font-weight: 900;
          letter-spacing: -0.02em;
        }
        .lux-noti-meta-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 8px;
        }
        .lux-noti-meta-card {
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.04);
          border-radius: 12px;
          padding: 8px 10px;
          min-width: 0;
        }
        .lux-noti-meta-label {
          display: block;
          font-size: 10px;
          color: #64748b;
          font-weight: 800;
          text-transform: uppercase;
          margin-bottom: 3px;
        }
        .lux-noti-meta-value {
          display: block;
          font-size: 12px;
          color: #e2e8f0;
          font-weight: 700;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .lux-noti-detail-btn {
          border: 1px solid rgba(147, 197, 253, 0.22);
          background: rgba(59, 130, 246, 0.10);
          color: #93c5fd;
          border-radius: 10px;
          padding: 7px 10px;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          margin-top: 6px;
        }
        .lux-noti-detail-btn:hover {
          background: rgba(59, 130, 246, 0.18);
        }
        .lux-noti-detail-panel {
          margin-top: 8px;
          padding: 10px;
          border-radius: 12px;
          background: rgba(2, 6, 23, 0.32);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .lux-noti-detail-title {
          font-size: 11px;
          color: #cbd5e1;
          font-weight: 900;
          margin-bottom: 8px;
          text-transform: uppercase;
        }
        .lux-noti-product-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
          padding: 8px 0;
          border-top: 1px solid rgba(255,255,255,0.06);
        }
        .lux-noti-product-row:first-of-type {
          border-top: none;
          padding-top: 0;
        }
        .lux-noti-product-name {
          color: #f8fafc;
          font-size: 12px;
          font-weight: 800;
          line-height: 1.35;
        }
        .lux-noti-product-sub {
          color: #94a3b8;
          font-size: 11px;
          margin-top: 2px;
        }
        .lux-noti-product-money {
          color: #bbf7d0;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
        }
        .lux-noti-empty-detail {
          color: #94a3b8;
          font-size: 12px;
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
        .lux-btn-approve:disabled,
        .lux-btn-reject:disabled {
          opacity: 0.65;
          cursor: not-allowed;
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
                            notifications.map((noti) => {
                              const isExpanded = !!expandedNoti[noti.id];
                              const kindLabel =
                                noti.entidad === "venta_tienda" ? "Venta tienda" : "Pedido";
                              const detalles = Array.isArray(noti.detalles)
                                ? noti.detalles
                                : [];
                              const isProcessing = !!processingNoti[noti.id];

                              return (
                                <div
                                  key={noti.id}
                                  className={`lux-noti-item ${
                                    noti.leido ? "read" : "unread"
                                  }`}
                                >
                                  <div className="lux-noti-topline">
                                    <div>
                                      <span className="lux-noti-kind">{kindLabel}</span>
                                      <p className="lux-noti-text" style={{ marginTop: 8 }}>
                                        {noti.titulo || noti.mensaje}
                                      </p>
                                      <span className="lux-noti-time">{noti.tiempo}</span>
                                    </div>
                                    <div className="lux-noti-total">{money(noti.total)}</div>
                                  </div>

                                  <div className="lux-noti-meta-grid">
                                    <div className="lux-noti-meta-card">
                                      <span className="lux-noti-meta-label">Cliente</span>
                                      <span className="lux-noti-meta-value">{noti.cliente}</span>
                                    </div>
                                    <div className="lux-noti-meta-card">
                                      <span className="lux-noti-meta-label">Sucursal</span>
                                      <span className="lux-noti-meta-value">{noti.sucursal}</span>
                                    </div>
                                    <div className="lux-noti-meta-card">
                                      <span className="lux-noti-meta-label">Vendedor</span>
                                      <span className="lux-noti-meta-value">{noti.vendedor}</span>
                                    </div>
                                    <div className="lux-noti-meta-card">
                                      <span className="lux-noti-meta-label">Estado</span>
                                      <span className="lux-noti-meta-value">{noti.estado}</span>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    className="lux-noti-detail-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedNoti((prev) => ({
                                        ...prev,
                                        [noti.id]: !prev[noti.id],
                                      }));
                                    }}
                                  >
                                    {isExpanded ? "Ocultar detalles" : "Ver detalles"}
                                  </button>

                                  {isExpanded && (
                                    <div className="lux-noti-detail-panel">
                                      <div className="lux-noti-detail-title">
                                        Productos solicitados
                                      </div>
                                      {detalles.length === 0 ? (
                                        <div className="lux-noti-empty-detail">
                                          No hay detalles disponibles para mostrar.
                                        </div>
                                      ) : (
                                        detalles.map((detalle, index) => (
                                          <div
                                            className="lux-noti-product-row"
                                            key={`${noti.id}-detalle-${index}`}
                                          >
                                            <div>
                                              <div className="lux-noti-product-name">
                                                {getDetalleNombre(detalle)}
                                              </div>
                                              <div className="lux-noti-product-sub">
                                                Cantidad: {detalle.cantidad || 0} · Presentación: {detalle.presentacion || "—"}
                                              </div>
                                            </div>
                                            <div className="lux-noti-product-money">
                                              {money(
                                                detalle.subtotal ||
                                                  Number(detalle.cantidad || 0) *
                                                    Number(detalle.precio_unitario || 0)
                                              )}
                                            </div>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  )}

                                  {noti.tipo === "pendiente" && (
                                    <div
                                      className="lux-noti-actions"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <button
                                        type="button"
                                        className="lux-btn-approve"
                                        disabled={isProcessing}
                                        onClick={() => handleAprobarMonto(noti)}
                                      >
                                        {isProcessing ? "Procesando..." : "Aprobar"}
                                      </button>
                                      <button
                                        type="button"
                                        className="lux-btn-reject"
                                        disabled={isProcessing}
                                        onClick={() => handleRechazarMonto(noti)}
                                      >
                                        {isProcessing ? "Procesando..." : "Rechazar"}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })
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
