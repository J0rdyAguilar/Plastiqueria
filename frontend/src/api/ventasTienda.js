import { http } from "../lib/http";

export const ventasTienda = {
  list: async ({
    q = "",
    estado = "",
    metodo_pago = "",
    fecha_desde = "",
    fecha_hasta = "",
    solo_mias = 0,
    page = 1,
    per_page = 20,
  } = {}) => {
    const { data } = await http.get("/v1/ventas-tienda", {
      params: {
        q,
        estado,
        metodo_pago,
        fecha_desde,
        fecha_hasta,
        solo_mias,
        page,
        per_page,
      },
    });
    return data;
  },

  crear: async (payload) => {
    const { data } = await http.post("/v1/ventas-tienda", payload);
    return data;
  },
};