// src/router.jsx
import React from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Usuarios from "./pages/Usuarios";
import Vendedores from "./pages/Vendedores";
import Zonas from "./pages/Zonas";
import Rutas from "./pages/Rutas";
import Caja from "./pages/Caja";
import Productos from "./pages/Productos";

// 👉 NUEVOS
import Stock from "./pages/Stock";
import MovimientosStock from "./pages/MovimientosStock";

import ProtectedRoute from "./api/auth/ProtectedRoute";

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/login" replace /> },

  { path: "/login", element: <Login /> },

  {
    path: "/usuarios",
    element: (
      <ProtectedRoute roles={["admin", "super_admin"]}>
        <Usuarios />
      </ProtectedRoute>
    ),
  },

  {
    path: "/vendedores",
    element: (
      <ProtectedRoute roles={["admin", "super_admin"]}>
        <Vendedores />
      </ProtectedRoute>
    ),
  },

  {
    path: "/zonas",
    element: (
      <ProtectedRoute roles={["admin", "super_admin"]}>
        <Zonas />
      </ProtectedRoute>
    ),
  },

  {
    path: "/rutas",
    element: (
      <ProtectedRoute roles={["admin", "super_admin"]}>
        <Rutas />
      </ProtectedRoute>
    ),
  },

  {
    path: "/productos",
    element: (
      <ProtectedRoute roles={["admin", "super_admin"]}>
        <Productos />
      </ProtectedRoute>
    ),
  },

  // =========================
  // 📦 INVENTARIO / STOCK
  // =========================
  {
    path: "/stock",
    element: (
      <ProtectedRoute roles={["admin", "super_admin"]}>
        <Stock />
      </ProtectedRoute>
    ),
  },

  {
    path: "/movimientos-stock",
    element: (
      <ProtectedRoute roles={["admin", "super_admin"]}>
        <MovimientosStock />
      </ProtectedRoute>
    ),
  },

  // =========================
  // 💰 CAJA / POS
  // =========================
  {
    path: "/caja",
    element: (
      <ProtectedRoute roles={["admin", "super_admin", "caja", "cajero"]}>
        <Caja />
      </ProtectedRoute>
    ),
  },

  { path: "*", element: <Navigate to="/login" replace /> },
]);
