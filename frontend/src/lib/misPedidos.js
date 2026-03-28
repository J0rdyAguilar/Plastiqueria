import { http } from "./http";

export const misPedidosApi = {
  list: async ({ estado = "", page = 1, per_page = 20 } = {}) => {
    const params = new URLSearchParams();

    if (estado) params.set("estado", estado);
    params.set("page", String(page));
    params.set("per_page", String(per_page));

    const { data } = await http.get(`/ventas/pedidos-vendedor?${params.toString()}`);
    return data;
  },
};