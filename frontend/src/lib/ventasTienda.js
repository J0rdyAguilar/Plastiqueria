import { httpV1 } from "./httpV1";

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

export const ventasTienda = {
  list: async ({
    fecha_desde = "",
    fecha_hasta = "",
    metodo_pago = "",
    ubicacion_id = "",
    solo_mias = 0,
    page = 1,
    per_page = 30,
  } = {}) => {
    const query = cleanParams({
      fecha_desde,
      fecha_hasta,
      metodo_pago,
      ubicacion_id,
      solo_mias,
      page,
      per_page,
    });

    const url = query
      ? `/ventas-tienda/registro?${query}`
      : "/ventas-tienda/registro";

    const { data } = await httpV1.get(url);
    return data;
  },
};