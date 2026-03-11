import { http } from "./http";

export const rutasApi = {
  list: async ({ q = "", activo = "", page = 1, per_page = 200 } = {}) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (activo !== "" && activo !== null && activo !== undefined) {
      params.set("activo", String(activo));
    }
    params.set("page", String(page));
    params.set("per_page", String(per_page));

    const { data } = await http.get(`/v1/rutas?${params.toString()}`);
    return data;
  },

  create: async (payload) => {
    const { data } = await http.post(`/v1/rutas`, payload);
    return data;
  },

  update: async (id, payload) => {
    const { data } = await http.put(`/v1/rutas/${id}`, payload);
    return data;
  },

  remove: async (id) => {
    const { data } = await http.delete(`/v1/rutas/${id}`);
    return data;
  },
};