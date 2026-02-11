// src/lib/stock.js
import { http } from "./http";

// Inventario (stock actual)
export const stockApi = {
  list: async ({ q = "", ubicacion_id = "", page = 1, per_page = 10 } = {}) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (ubicacion_id) params.set("ubicacion_id", ubicacion_id);
    params.set("page", String(page));
    params.set("per_page", String(per_page));

    const { data } = await http.get(`/stock?${params.toString()}`);
    return data;
  },
};

// Movimientos de stock
export const movimientosStockApi = {
  list: async ({ tipo = "", ubicacion_id = "", producto_id = "", page = 1, per_page = 10 } = {}) => {
    const params = new URLSearchParams();
    if (tipo) params.set("tipo", tipo);
    if (ubicacion_id) params.set("ubicacion_id", ubicacion_id);
    if (producto_id) params.set("producto_id", producto_id);
    params.set("page", String(page));
    params.set("per_page", String(per_page));

    const { data } = await http.get(`/movimientos-stock?${params.toString()}`);
    return data;
  },

  create: async (payload) => {
    const { data } = await http.post(`/movimientos-stock`, payload);
    return data;
  },
};
