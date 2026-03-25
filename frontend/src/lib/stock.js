// src/lib/stock.js
import { http } from "./http";

function cleanParams(obj = {}) {
  const params = new URLSearchParams();

  Object.entries(obj).forEach(([key, value]) => {
    if (value === undefined || value === null) return;

    const text = String(value).trim();
    if (text === "") return;

    params.set(key, text);
  });

  return params.toString();
}

export const stockApi = {
  list: async ({ q = "", ubicacion_id = "", page = 1, per_page = 10 } = {}) => {
    const query = cleanParams({
      q,
      ubicacion_id,
      page,
      per_page,
    });

    const url = query ? `/stock?${query}` : `/stock`;
    const { data } = await http.get(url);
    return data;
  },
};

export const movimientosStockApi = {
  list: async ({
    tipo = "",
    ubicacion_id = "",
    producto_id = "",
    page = 1,
    per_page = 10,
  } = {}) => {
    const query = cleanParams({
      tipo,
      ubicacion_id,
      producto_id,
      page,
      per_page,
    });

    const url = query ? `/movimientos-stock?${query}` : `/movimientos-stock`;
    const { data } = await http.get(url);
    return data;
  },

  create: async (payload = {}) => {
    const cleanPayload = { ...payload };

    Object.keys(cleanPayload).forEach((key) => {
      if (
        cleanPayload[key] === undefined ||
        cleanPayload[key] === null ||
        cleanPayload[key] === ""
      ) {
        delete cleanPayload[key];
      }
    });

    const { data } = await http.post(`/movimientos-stock`, cleanPayload);
    return data;
  },
};