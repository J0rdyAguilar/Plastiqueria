// src/router.jsx
import React from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Usuarios from "./pages/Usuarios";
import Vendedores from "./pages/Vendedores";
import Caja from "./pages/Caja";
import Zonas from "./pages/Zonas"; // ✅ IMPORTA ZONAS

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
    path: "/caja",
    element: (
      <ProtectedRoute roles={["admin", "super_admin", "caja", "cajero"]}>
        <Caja />
      </ProtectedRoute>
    ),
  },

  { path: "*", element: <Navigate to="/login" replace /> },
]);
