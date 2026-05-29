import { getToken } from "./auth";

const RAW_API_BASE =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000/api/v1";

function getApiBase() {
  let base = String(RAW_API_BASE).replace(/\/+$/, "");

  // Si tu .env dice http://127.0.0.1:8000/api,
  // automáticamente agrega /v1.
  if (base.endsWith("/api")) {
    base = `${base}/v1`;
  }

  return base;
}

function buildUrl(path, params = {}) {
  const base = getApiBase();
  const cleanPath = String(path || "").replace(/^\/+/, "");
  const url = new URL(`${base}/${cleanPath}`);

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

async function request(path, options = {}) {
  const token = getToken?.();

  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(buildUrl(path, options.params), {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();

  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const message =
      data?.message ||
      data?.error ||
      `Error HTTP ${res.status} en ${path}`;

    const error = new Error(message);
    error.response = {
      status: res.status,
      data,
    };
    throw error;
  }

  return data;
}

export const clientesApi = {
  list: (params = {}) => {
    return request("/clientes", {
      method: "GET",
      params,
    });
  },

  show: (id) => {
    return request(`/clientes/${id}`, {
      method: "GET",
    });
  },

  get: (id) => {
    return request(`/clientes/${id}`, {
      method: "GET",
    });
  },

  create: (payload) => {
    return request("/clientes", {
      method: "POST",
      body: payload,
    });
  },

  update: (id, payload) => {
    return request(`/clientes/${id}`, {
      method: "PUT",
      body: payload,
    });
  },

  remove: (id) => {
    return request(`/clientes/${id}`, {
      method: "DELETE",
    });
  },

  delete: (id) => {
    return request(`/clientes/${id}`, {
      method: "DELETE",
    });
  },
};