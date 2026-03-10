// src/router.jsx
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

import ProtectedRoute from "./api/auth/ProtectedRoute";
import { isLoggedIn, getSession } from "./lib/auth";

function normalizeRole(r) {
  const x = (r || "").toString().trim().toLowerCase();
  if (x === "cajero") return "caja";
  return x;
}

function roleHome() {
  if (!isLoggedIn()) return "/login";
  const rol = normalizeRole(getSession()?.user?.rol);

  if (rol === "admin" || rol === "super_admin") return "/usuarios";
  if (rol === "caja") return "/caja";
  if (rol === "vendedor") return "/pedidos";

  return "/login";
}

function HomeRedirect() {
  return <Navigate to={roleHome()} replace />;
}

function Wrap({ roles, children }) {
  return (
    <ProtectedRoute roles={roles} fallback={roleHome()}>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

export const router = createBrowserRouter([
  { path: "/", element: <HomeRedirect /> },
  { path: "/login", element: <Login /> },

  // =========================
  // 👑 ADMIN
  // =========================
  {
    path: "/usuarios",
    element: (
      <Wrap roles={["admin", "super_admin"]}>
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

  // =========================
  // 🧑‍💼 VENDEDOR
  // =========================
  {
    path: "/pedidos",
    element: (
      <Wrap roles={["vendedor", "admin", "super_admin"]}>
        <Pedidos />
      </Wrap>
    ),
  },

  // =========================
  // 💰 CAJA / CAJERO
  // =========================
  {
    path: "/caja",
    element: (
      <Wrap roles={["admin", "super_admin", "caja", "cajero"]}>
        <Caja />
      </Wrap>
    ),
  },

  { path: "*", element: <HomeRedirect /> },
]);