import { http } from "./http";

export const pedidosAdminApi = {
  list: async ({ q = "", estado = "", page = 1, per_page = 20 } = {}) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (estado) params.set("estado", estado);
    params.set("page", String(page));
    params.set("per_page", String(per_page));

    const { data } = await http.get(`/pedidos?${params.toString()}`);
    return data;
  },

  aprobar: async (id, payload = {}) => {
    const { data } = await http.post(`/pedidos/${id}/aprobar`, payload);
    return data;
  },

  preparar: async (id, payload = {}) => {
    const { data } = await http.post(`/pedidos/${id}/preparar`, payload);
    return data;
  },

  entregar: async (id, payload = {}) => {
    const { data } = await http.post(`/pedidos/${id}/entregar`, payload);
    return data;
  },

  enviar: async (id, payload = {}) => {
    const { data } = await http.post(`/pedidos/${id}/enviar`, payload);
    return data;
  },
};