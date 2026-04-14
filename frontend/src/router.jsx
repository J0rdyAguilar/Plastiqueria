import React from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";

import Layout from "./components/Layout";

import Login from "./pages/Login";
import Usuarios from "./pages/Usuarios";
import Vendedores from "./pages/Vendedores";
import Zonas from "./pages/Zonas";
import Rutas from "./pages/Rutas";
import Caja from "./pages/Caja";
import Productos from "./pages/Productos";
import Stock from "./pages/Stock";
import MovimientosStock from "./pages/MovimientosStock";
import Pedidos from "./pages/pedidos";
import PedidosAdmin from "./pages/PedidosAdmin";
import VentaTienda from "./pages/VentaTienda";
import RegistroVentasTienda from "./pages/RegistroVentasTienda";
import PerfilUsuario from "./pages/PerfilUsuario";
import Rutero from "./pages/Rutero";
import HistorialRutero from "./pages/HistorialRutero";

import ProtectedRoute from "./api/auth/ProtectedRoute";
import { getSession, getToken } from "./lib/auth";

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

function getRole() {
  const session = getSession();
  return normalizeRole(session?.user?.rol || session?.user?.role);
}

function roleHome() {
  const token = getToken();
  if (!token) return "/login";

  const rol = getRole();

  if (rol === "admin" || rol === "super_admin") return "/pedidos-admin";
  if (rol === "caja") return "/caja";
  if (rol === "vendedor") return "/pedidos";
  if (rol === "vendedor_tienda") return "/ventas-tienda";
  if (rol === "rutero") return "/rutero";

  return "/login";
}

function RootRedirect() {
  return <Navigate to={roleHome()} replace />;
}

function LoginRoute() {
  const token = getToken();

  if (token) {
    return <Navigate to={roleHome()} replace />;
  }

  return <Login />;
}

function RoleGuard({ roles = [], children }) {
  const rol = getRole();

  if (roles.length > 0 && !roles.includes(rol)) {
    return <Navigate to={roleHome()} replace />;
  }

  return children;
}

function Wrap({ roles, children }) {
  return (
    <ProtectedRoute>
      <RoleGuard roles={roles}>{children}</RoleGuard>
    </ProtectedRoute>
  );
}

function WrapWithLayout({ roles, children }) {
  return (
    <ProtectedRoute>
      <RoleGuard roles={roles}>
        <Layout>{children}</Layout>
      </RoleGuard>
    </ProtectedRoute>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootRedirect />,
  },
  {
    path: "/login",
    element: <LoginRoute />,
  },

  {
    path: "/usuarios",
    element: (
      <WrapWithLayout roles={["super_admin"]}>
        <Usuarios />
      </WrapWithLayout>
    ),
  },

  {
    path: "/vendedores",
    element: (
      <WrapWithLayout roles={["admin", "super_admin"]}>
        <Vendedores />
      </WrapWithLayout>
    ),
  },

  {
    path: "/pedidos-admin",
    element: (
      <WrapWithLayout roles={["admin", "super_admin"]}>
        <PedidosAdmin />
      </WrapWithLayout>
    ),
  },

  {
    path: "/zonas",
    element: (
      <WrapWithLayout roles={["admin", "super_admin"]}>
        <Zonas />
      </WrapWithLayout>
    ),
  },

  {
    path: "/rutas",
    element: (
      <WrapWithLayout roles={["admin", "super_admin"]}>
        <Rutas />
      </WrapWithLayout>
    ),
  },

  {
    path: "/productos",
    element: (
      <WrapWithLayout roles={["admin", "super_admin"]}>
        <Productos />
      </WrapWithLayout>
    ),
  },

  {
    path: "/stock",
    element: (
      <WrapWithLayout roles={["admin", "super_admin"]}>
        <Stock />
      </WrapWithLayout>
    ),
  },

  {
    path: "/movimientos-stock",
    element: (
      <WrapWithLayout roles={["admin", "super_admin"]}>
        <MovimientosStock />
      </WrapWithLayout>
    ),
  },

  {
    path: "/pedidos",
    element: (
      <WrapWithLayout roles={["vendedor"]}>
        <Pedidos />
      </WrapWithLayout>
    ),
  },

  {
    path: "/rutero",
    element: (
      <WrapWithLayout roles={["rutero", "super_admin"]}>
        <Rutero />
      </WrapWithLayout>
    ),
  },

  {
    path: "/rutero/historial",
    element: (
      <WrapWithLayout roles={["rutero", "super_admin"]}>
        <HistorialRutero />
      </WrapWithLayout>
    ),
  },

  {
    path: "/ventas-tienda",
    element: (
      <WrapWithLayout roles={["vendedor_tienda", "admin", "super_admin"]}>
        <VentaTienda />
      </WrapWithLayout>
    ),
  },

  {
    path: "/registro-ventas-tienda",
    element: (
      <WrapWithLayout roles={["vendedor_tienda", "admin", "super_admin"]}>
        <RegistroVentasTienda />
      </WrapWithLayout>
    ),
  },

  {
    path: "/caja",
    element: (
      <WrapWithLayout roles={["admin", "super_admin", "caja"]}>
        <Caja />
      </WrapWithLayout>
    ),
  },

  {
    path: "/perfil",
    element: (
      <WrapWithLayout
        roles={["admin", "super_admin", "caja", "vendedor", "vendedor_tienda", "rutero"]}
      >
        <PerfilUsuario />
      </WrapWithLayout>
    ),
  },

  {
    path: "*",
    element: <RootRedirect />,
  },
]);