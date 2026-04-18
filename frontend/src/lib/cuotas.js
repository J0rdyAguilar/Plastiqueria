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

export const cuotasApi = {
  list: async ({
    q = "",
    estado = "",
    origen_tipo = "",
    ubicacion_id = "",
    cliente_id = "",
    solo_pendientes = 0,
    page = 1,
    per_page = 20,
  } = {}) => {
    const query = cleanParams({
      q,
      estado,
      origen_tipo,
      ubicacion_id,
      cliente_id,
      solo_pendientes,
      page,
      per_page,
    });

    const url = query ? `/v1/cuotas?${query}` : `/v1/cuotas`;
    const { data } = await http.get(url);
    return data;
  },

  show: async (id) => {
    const { data } = await http.get(`/v1/cuotas/${id}`);
    return data;
  },

  abonar: async (id, payload) => {
    const { data } = await http.post(`/v1/cuotas/${id}/abonar`, payload);
    return data;
  },
};