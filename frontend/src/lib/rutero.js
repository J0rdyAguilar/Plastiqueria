import { httpV1 } from "../lib/httpV1";

export const ruteroApi = {
  misPedidos: async ({ soloActivos = true } = {}) => {
    const { data } = await httpV1.get("/pedidos/rutero/mis-pedidos", {
      params: {
        solo_activos: soloActivos ? 1 : 0,
      },
    });
    return data;
  },

  entregar: async (pedidoId) => {
    const { data } = await httpV1.post(`/pedidos/${pedidoId}/entregar`);
    return data;
  },

  misEntregas: async ({ estado = "" } = {}) => {
    const params = {};
    if (estado) params.estado = estado;

    const { data } = await httpV1.get("/pedidos/mis-entregas", { params });
    return data;
  },
};

export default ruteroApi;