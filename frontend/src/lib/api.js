// src/lib/api.js
import { getToken, clearSession } from "./auth";

const BASE_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";

async function request(path, { method = "GET", body, headers = {} } = {}) {
  const token = getToken();

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  const ct = res.headers.get("content-type") || "";

  if (ct.includes("application/json")) {
    data = await res.json().catch(() => null);
  } else {
    const text = await res.text().catch(() => "");
    data = { message: text };
  }

  if (!res.ok) {
    if (res.status === 401) clearSession();
    const err = new Error(data?.message || `Error HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  /* ======================
     AUTH
  ====================== */
  login: (payload) =>
    request("/login", { method: "POST", body: payload }),

  /* ======================
     USUARIOS
  ====================== */
  usuariosList: () => request("/usuarios"),
  usuariosCreate: (payload) =>
    request("/usuarios", { method: "POST", body: payload }),
  usuariosUpdate: (id, payload) =>
    request(`/usuarios/${id}`, { method: "PUT", body: payload }),
  usuariosDelete: (id) =>
    request(`/usuarios/${id}`, { method: "DELETE" }),

  /* ======================
     VENDEDORES
  ====================== */
  vendedoresList: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/vendedores${qs ? `?${qs}` : ""}`);
  },
  vendedoresCreate: (payload) =>
    request("/vendedores", { method: "POST", body: payload }),
  vendedoresUpdate: (id, payload) =>
    request(`/vendedores/${id}`, { method: "PUT", body: payload }),
  vendedoresDelete: (id) =>
    request(`/vendedores/${id}`, { method: "DELETE" }),
    // Vendedores: asignaciones
  vendedoresAsignarRutas: (id, payload) =>
    request(`/vendedores/${id}/rutas`, { method: "POST", body: payload }),

    // Rutas CRUD
    rutasList: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/rutas${qs ? `?${qs}` : ""}`);
    },
    rutasCreate: (payload) => request(`/rutas`, { method: "POST", body: payload }),
    rutasUpdate: (id, payload) => request(`/rutas/${id}`, { method: "PUT", body: payload }),
    rutasDelete: (id) => request(`/rutas/${id}`, { method: "DELETE" }),
    
    zonasList: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/zonas${qs ? `?${qs}` : ""}`);
    },

    zonasList: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/zonas${qs ? `?${qs}` : ""}`);
    },
    zonasCreate: (payload) => request(`/zonas`, { method: "POST", body: payload }),
    zonasUpdate: (id, payload) => request(`/zonas/${id}`, { method: "PUT", body: payload }),
    zonasDelete: (id) => request(`/zonas/${id}`, { method: "DELETE" }),

};

