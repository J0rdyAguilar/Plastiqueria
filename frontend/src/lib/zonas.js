import { http } from "./http";

export const zonasApi = {
  list: async ({ q = "", page = 1, per_page = 200 } = {}) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("page", String(page));
    params.set("per_page", String(per_page));

    const { data } = await http.get(`/v1/zonas?${params.toString()}`);
    return data;
  },

  create: async (payload) => {
    const { data } = await http.post(`/v1/zonas`, payload);
    return data;
  },

  get: async (id) => {
    const { data } = await http.get(`/v1/zonas/${id}`);
    return data;
  },

  update: async (id, payload) => {
    const { data } = await http.put(`/v1/zonas/${id}`, payload);
    return data;
  },

  remove: async (id) => {
    const { data } = await http.delete(`/v1/zonas/${id}`);
    return data;
  },
};