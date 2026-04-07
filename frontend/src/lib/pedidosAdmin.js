import { httpV1 } from "./httpV1";

export const pedidosAdminApi = {
  list: async ({ q = "", estado = "", page = 1, per_page = 20 } = {}) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (estado) params.set("estado", estado);
    params.set("page", String(page));
    params.set("per_page", String(per_page));

    const { data } = await httpV1.get(`/pedidos?${params.toString()}`);
    return data;
  },

  aprobar: async (id, payload = {}) => {
    const { data } = await httpV1.post(`/pedidos/${id}/aprobar`, payload);
    return data;
  },

  preparar: async (id) => {
    const { data } = await httpV1.post(`/pedidos/${id}/preparar`);
    return data;
  },

  entregar: async (id) => {
    const { data } = await httpV1.post(`/pedidos/${id}/entregar`);
    return data;
  },

  asignarRutero: async (id, payload) => {
    const { data } = await httpV1.post(`/pedidos/${id}/asignar-rutero`, payload);
    return data;
  },
};