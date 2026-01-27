// src/lib/api.js
import { getToken, clearSession } from "./auth";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

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

  // si backend devuelve JSON
  let data = null;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    data = await res.json().catch(() => null);
  } else {
    const text = await res.text().catch(() => "");
    data = { message: text };
  }

  if (!res.ok) {
    // 401 => sesión inválida
    if (res.status === 401) clearSession();
    const msg = data?.message || `Error HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  // Auth
  login: (payload) => request("/login", { method: "POST", body: payload }),

  // Usuarios CRUD
  usuariosList: () => request("/usuarios"),
  usuariosCreate: (payload) => request("/usuarios", { method: "POST", body: payload }),
  usuariosUpdate: (id, payload) => request(`/usuarios/${id}`, { method: "PUT", body: payload }),
  usuariosDelete: (id) => request(`/usuarios/${id}`, { method: "DELETE" }),
};
