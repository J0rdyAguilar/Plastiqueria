// src/lib/api.js
import { getToken, clearSession } from "./auth";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";

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

function qs(params = {}) {
  const clean = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    clean[k] = v;
  }
  const s = new URLSearchParams(clean).toString();
  return s ? `?${s}` : "";
}

export const api = {
  /* ======================
     AUTH
  ====================== */
  login: (payload) => request("/login", { method: "POST", body: payload }),

  // opcional (si tu backend ya los tiene)
  me: () => request("/me"),
  logout: () => request("/logout", { method: "POST" }),

  /* ======================
     USUARIOS
  ====================== */
  usuariosList: () => request("/usuarios"),
  usuariosCreate: (payload) => request("/usuarios", { method: "POST", body: payload }),
  usuariosUpdate: (id, payload) => request(`/usuarios/${id}`, { method: "PUT", body: payload }),
  usuariosDelete: (id) => request(`/usuarios/${id}`, { method: "DELETE" }),

  /* ======================
     VENDEDORES
     (NOMBRES que tus páginas ya usan)
  ====================== */
  vendedoresList: (params = {}) => request(`/vendedores${qs(params)}`),
  vendedoresCreate: (payload) => request("/vendedores", { method: "POST", body: payload }),
  vendedoresUpdate: (id, payload) => request(`/vendedores/${id}`, { method: "PUT", body: payload }),
  vendedoresDelete: (id) => request(`/vendedores/${id}`, { method: "DELETE" }),
  vendedoresShow: (id) => request(`/vendedores/${id}`),

  // asignación de rutas (sync/attach según tu backend)
  vendedoresAsignarRutas: (id, payload) =>
    request(`/vendedores/${id}/rutas`, { method: "POST", body: payload }),

  /* ======================
     RUTAS
  ====================== */
  rutasList: (params = {}) => request(`/rutas${qs(params)}`),

  /* ======================
     CAJA  ✅✅✅ (lo que te falta)
  ====================== */
  // GET /api/v1/caja/actual?ubicacion_id=1
  cajaActual: (params = {}) => request(`/caja/actual${qs(params)}`),

  // GET /api/v1/caja/historial?ubicacion_id=1&per_page=20
  cajaHistorial: (params = {}) => request(`/caja/historial${qs(params)}`),

  // POST /api/v1/caja/abrir
  cajaAbrir: (payload) => request("/caja/abrir", { method: "POST", body: payload }),

  // POST /api/v1/caja/cerrar
  cajaCerrar: (payload) => request("/caja/cerrar", { method: "POST", body: payload }),
};
