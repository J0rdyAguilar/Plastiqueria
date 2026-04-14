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

export const pedidosApi = {
  list: async ({
    estado = "",
    vendedor_id = "",
    cliente_id = "",
    q = "",
    ubicacion_id = "",
    page = 1,
    per_page = 10,
  } = {}) => {
    const query = cleanParams({
      estado,
      vendedor_id,
      cliente_id,
      q,
      ubicacion_id,
      page,
      per_page,
    });

    const url = query ? `/pedidos?${query}` : `/pedidos`;
    const { data } = await httpV1.get(url);
    return data;
  },

  misPedidos: async ({ estado = "", page = 1, per_page = 20 } = {}) => {
    const query = cleanParams({
      estado,
      page,
      per_page,
    });

    const url = query ? `/pedidos/mis-pedidos?${query}` : `/pedidos/mis-pedidos`;
    const { data } = await httpV1.get(url);
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

    const { data } = await httpV1.post("/pedidos", cleanPayload);
    return data;
  },

  enviar: async (pedidoId) => {
    const { data } = await httpV1.post(`/pedidos/${pedidoId}/enviar`);
    return data;
  },
};