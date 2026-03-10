// src/pages/Pedidos.jsx
import React from "react";
import Layout from "../components/Layout";
import { getSession } from "../lib/auth";

export default function Pedidos() {
  const me = getSession()?.user;

  return (
    
      <div className="page">
        <header className="topbar">
          <div>
            <h2>Pedidos</h2>
            <p className="muted">
              Sesión: <b>{me?.nombre || me?.usuario || "—"}</b> ({me?.rol || "—"})
            </p>
          </div>
        </header>

        <div className="card pad" style={{ marginTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>Módulo Vendedor</h3>
          <p className="muted" style={{ marginBottom: 0 }}>
            Aquí irá el flujo del vendedor (clientes, rutas, pedidos, entregas).
            Por ahora esta pantalla evita que el sistema se quede en blanco.
          </p>
        </div>
      </div>
   
  );
}