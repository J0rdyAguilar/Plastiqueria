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
import Pedidos from "./pages/Pedidos";
import PedidosAdmin from "./pages/PedidosAdmin";
import VentaTienda from "./pages/VentaTienda";

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
      <Wrap roles={["super_admin"]}>
        <Usuarios />
      </Wrap>
    ),
  },

  {
    path: "/vendedores",
    element: (
      <Wrap roles={["admin", "super_admin"]}>
        <Vendedores />
      </Wrap>
    ),
  },

  {
    path: "/pedidos-admin",
    element: (
      <Wrap roles={["admin", "super_admin"]}>
        <PedidosAdmin />
      </Wrap>
    ),
  },

  {
    path: "/zonas",
    element: (
      <Wrap roles={["admin", "super_admin"]}>
        <Zonas />
      </Wrap>
    ),
  },

  {
    path: "/rutas",
    element: (
      <Wrap roles={["admin", "super_admin"]}>
        <Rutas />
      </Wrap>
    ),
  },

  {
    path: "/productos",
    element: (
      <Wrap roles={["admin", "super_admin"]}>
        <Productos />
      </Wrap>
    ),
  },

  {
    path: "/stock",
    element: (
      <Wrap roles={["admin", "super_admin"]}>
        <Stock />
      </Wrap>
    ),
  },

  {
    path: "/movimientos-stock",
    element: (
      <Wrap roles={["admin", "super_admin"]}>
        <MovimientosStock />
      </Wrap>
    ),
  },

  {
    path: "/pedidos",
    element: (
      <Wrap roles={["vendedor"]}>
        <Pedidos />
      </Wrap>
    ),
  },

  {
    path: "/ventas-tienda",
    element: (
      <Wrap roles={["vendedor_tienda", "admin", "super_admin"]}>
        <VentaTienda />
      </Wrap>
    ),
  },

  {
    path: "/caja",
    element: (
      <Wrap roles={["admin", "super_admin", "caja"]}>
        <Caja />
      </Wrap>
    ),
  },

  {
    path: "*",
    element: <RootRedirect />,
  },
]);