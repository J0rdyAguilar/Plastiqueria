// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Usuarios from "./pages/Usuarios";
import Vendedores from "./pages/Vendedores";
import { isLoggedIn } from "./lib/auth";

function Private({ children }) {
  return isLoggedIn() ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/usuarios" replace />} />
        <Route path="/login" element={<Login />} />

        <Route
          path="/usuarios"
          element={
            <Private>
              <Usuarios />
            </Private>
          }
        />

        <Route
          path="/vendedores"
          element={
            <Private>
              <Vendedores />
            </Private>
          }
        />

        <Route path="*" element={<Navigate to="/usuarios" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
// GET /api/v1/caja/actual?ubicacion_id=1