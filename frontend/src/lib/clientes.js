import { http } from "./http";

export const clientesApi = {
  list: async ({
    q = "",
    ruta_id = "",
    zona_id = "",
    activo = 1,
    vendedor_id = "",
    page = 1,
    per_page = 100,
  } = {}) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (ruta_id) params.set("ruta_id", ruta_id);
    if (zona_id) params.set("zona_id", zona_id);
    if (activo !== "" && activo !== null && activo !== undefined) {
      params.set("activo", String(activo));
    }
    if (vendedor_id) params.set("vendedor_id", vendedor_id);
    params.set("page", String(page));
    params.set("per_page", String(per_page));

    const { data } = await http.get(`/clientes?${params.toString()}`);
    return data;
  },

  create: async (payload) => {
    const { data } = await http.post(`/clientes`, payload);
    return data;
  },

  get: async (id) => {
    const { data } = await http.get(`/clientes/${id}`);
    return data;
  },

  update: async (id, payload) => {
    const { data } = await http.put(`/clientes/${id}`, payload);
    return data;
  },
};