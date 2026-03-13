import { http } from "./http";

export const misPedidosApi = {
  list: async ({ vendedor_id, estado = "", page = 1, per_page = 20 } = {}) => {
    const params = new URLSearchParams();
    if (vendedor_id) params.set("vendedor_id", String(vendedor_id));
    if (estado) params.set("estado", estado);
    params.set("page", String(page));
    params.set("per_page", String(per_page));

    const { data } = await http.get(`/ventas/pedidos-vendedor?${params.toString()}`);
    return data;
  },
};