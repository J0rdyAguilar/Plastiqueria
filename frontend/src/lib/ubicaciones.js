// src/lib/ubicaciones.js
import { http } from "./http";

export const ubicacionesApi = {
  list: async ({ q = "", tipo = "", activa = "", page = 1, per_page = 50 } = {}) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (tipo) params.set("tipo", tipo);
    if (activa !== "" && activa !== null && activa !== undefined) params.set("activa", String(activa));
    params.set("page", String(page));
    params.set("per_page", String(per_page));

    const { data } = await http.get(`/ubicaciones?${params.toString()}`);
    return data;
  },

  get: async (id) => {
    const { data } = await http.get(`/ubicaciones/${id}`);
    return data;
  },

  create: async (payload) => {
    const { data } = await http.post(`/ubicaciones`, payload);
    return data;
  },

  update: async (id, payload) => {
    const { data } = await http.put(`/ubicaciones/${id}`, payload);
    return data;
  },

  toggle: async (id) => {
    const { data } = await http.patch(`/ubicaciones/${id}/toggle`);
    return data;
  },
};
