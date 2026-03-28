import { getToken, clearSession } from "./auth";

const BASE_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

async function request(path, { method = "GET", body, headers = {} } = {}) {
  const token = getToken();

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: "omit",
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
  login: (payload) => request("/login", { method: "POST", body: payload }),

  usuariosList: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/usuarios${qs ? `?${qs}` : ""}`);
  },
  usuariosCreate: (payload) =>
    request("/usuarios", { method: "POST", body: payload }),
  usuariosUpdate: (id, payload) =>
    request(`/usuarios/${id}`, { method: "PUT", body: payload }),
  usuariosDelete: (id) =>
    request(`/usuarios/${id}`, { method: "DELETE" }),
  usuariosShow: (id) =>
    request(`/usuarios/${id}`),

  ubicacionesList: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/ubicaciones${qs ? `?${qs}` : ""}`);
  },
  ubicacionesCreate: (payload) =>
    request("/ubicaciones", { method: "POST", body: payload }),
  ubicacionesUpdate: (id, payload) =>
    request(`/ubicaciones/${id}`, { method: "PUT", body: payload }),
  ubicacionesDelete: (id) =>
    request(`/ubicaciones/${id}`, { method: "DELETE" }),
  ubicacionesShow: (id) =>
    request(`/ubicaciones/${id}`),
  ubicacionesToggle: (id) =>
    request(`/ubicaciones/${id}/toggle`, { method: "PATCH" }),

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
  vendedoresAsignarRutas: (id, payload) =>
    request(`/vendedores/${id}/rutas`, { method: "POST", body: payload }),
  vendedoresShow: (id) =>
    request(`/vendedores/${id}`),

  rutasList: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/rutas${qs ? `?${qs}` : ""}`);
  },
  rutasCreate: (payload) =>
    request("/rutas", { method: "POST", body: payload }),
  rutasUpdate: (id, payload) =>
    request(`/rutas/${id}`, { method: "PUT", body: payload }),
  rutasDelete: (id) =>
    request(`/rutas/${id}`, { method: "DELETE" }),
  rutasShow: (id) =>
    request(`/rutas/${id}`),

  zonasList: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/zonas${qs ? `?${qs}` : ""}`);
  },
  zonasCreate: (payload) =>
    request("/zonas", { method: "POST", body: payload }),
  zonasUpdate: (id, payload) =>
    request(`/zonas/${id}`, { method: "PUT", body: payload }),
  zonasDelete: (id) =>
    request(`/zonas/${id}`, { method: "DELETE" }),
  zonasShow: (id) =>
    request(`/zonas/${id}`),

  cajaActual: ({ ubicacion_id }) => {
    const qs = new URLSearchParams({
      ubicacion_id: String(ubicacion_id),
    }).toString();
    return request(`/caja/actual?${qs}`);
  },

  cajaHistorial: ({ ubicacion_id }) => {
    const qs = new URLSearchParams({
      ubicacion_id: String(ubicacion_id),
    }).toString();
    return request(`/caja/historial?${qs}`);
  },

  cajaAbrir: (payload) =>
    request("/caja/abrir", { method: "POST", body: payload }),

  cajaCerrar: (payload) =>
    request("/caja/cerrar", { method: "POST", body: payload }),

  ventasTiendaList: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/ventas-tienda${qs ? `?${qs}` : ""}`);
  },

  ventasTiendaCreate: (payload) =>
    request("/ventas-tienda", { method: "POST", body: payload }),
};