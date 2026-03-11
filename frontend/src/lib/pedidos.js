import { http } from "./http";

export const pedidosApi = {
  createPedidoVendedor: async (payload) => {
    const { data } = await http.post(`/ventas/pedido-vendedor`, payload);
    return data;
  },
};