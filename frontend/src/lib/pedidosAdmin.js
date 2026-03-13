import { http } from "./http";

export const pedidosAdminApi = {
  list: async ({ q = "", estado = "", page = 1, per_page = 20 } = {}) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (estado) params.set("estado", estado);
    params.set("page", String(page));
    params.set("per_page", String(per_page));

    const { data } = await http.get(`/ventas/pedidos-admin?${params.toString()}`);
    return data;
  },

  actualizar: async (id, payload) => {
    const { data } = await http.put(`/ventas/${id}/actualizar-admin`, payload);
    return data;
  },

  aprobar: async (id) => {
    const { data } = await http.post(`/ventas/${id}/aprobar`);
    return data;
  },

  preparar: async (id) => {
    const { data } = await http.post(`/ventas/${id}/preparar`);
    return data;
  },

  entregar: async (id) => {
    const { data } = await http.post(`/ventas/${id}/entregar`);
    return data;
  },
};