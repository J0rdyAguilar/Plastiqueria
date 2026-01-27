// src/api/auth/ProtectedRoute.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getSession, isLoggedIn } from "../../lib/auth";

function normalizeRole(r) {
  const x = (r || "").toLowerCase();
  // tu sistema a veces usa cajero pero en UI dices caja
  if (x === "cajero") return "caja";
  return x;
}

export default function ProtectedRoute({ roles = [], children }) {
  const loc = useLocation();

  if (!isLoggedIn()) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }

  const me = getSession()?.user || {};
  const userRole = normalizeRole(me.rol);

  if (Array.isArray(roles) && roles.length > 0) {
    const allowed = roles.map(normalizeRole);
    if (!allowed.includes(userRole)) {
      // si está logueado pero no tiene rol, lo mandamos a su home
      const home = userRole === "caja" ? "/caja" : "/usuarios";
      return <Navigate to={home} replace />;
    }
  }

  return children;
}
