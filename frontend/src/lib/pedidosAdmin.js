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

export const pedidosAdminApi = {
  list: async ({
    q = "",
    estado = "",
    ubicacion_id = "",
    fecha_desde = "",
    fecha_hasta = "",
    page = 1,
    per_page = 20,
  } = {}) => {
    const query = cleanParams({
      q,
      estado,
      ubicacion_id,
      fecha_desde,
      fecha_hasta,
      page,
      per_page,
    });

    const url = query ? `/pedidos?${query}` : "/pedidos";
    const { data } = await httpV1.get(url);
    return data;
  },

  update: async (id, payload = {}) => {
    const { data } = await httpV1.put(`/pedidos/${id}`, payload);
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