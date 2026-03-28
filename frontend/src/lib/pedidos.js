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

    const url = query ? `/ventas/pedidos-admin?${query}` : `/ventas/pedidos-admin`;
    const { data } = await http.get(url);
    return data;
  },

  createPedidoVendedor: async (payload = {}) => {
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

    const { data } = await http.post("/ventas/pedido-vendedor", cleanPayload);
    return data;
  },

  enviar: async (pedidoId) => {
    const { data } = await http.post(`/ventas/${pedidoId}/aprobar`);
    return data;
  },
};