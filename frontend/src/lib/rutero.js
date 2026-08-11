import { httpV1 } from "../lib/httpV1";

export const ruteroApi = {
  misPedidos: async ({ soloActivos = true } = {}) => {
    const { data } = await httpV1.get("/pedidos/rutero/mis-pedidos", {
      params: {
        solo_activos: soloActivos ? 1 : 0,
      },
    });
    return data;
  },

  entregar: async (pedidoId, payload = {}) => {
    const body = {
      metodo_pago: payload.metodo_pago || "efectivo",
      nombre_pagador: payload.nombre_pagador || "",
      referencia_pago: payload.referencia_pago || null,
      observacion_entrega: payload.observacion_entrega || null,
      cliente_id: payload.cliente_id || null,
    };

    const { data } = await httpV1.post(`/pedidos/${pedidoId}/entregar`, body);
    return data;
  },

  misEntregas: async ({
    estado = "",
    ruteroId = "",
    fechaDesde = "",
    fechaHasta = "",
  } = {}) => {
    const params = {};
    if (estado) params.estado = estado;
    if (ruteroId) params.rutero_id = ruteroId;
    if (fechaDesde) params.fecha_desde = fechaDesde;
    if (fechaHasta) params.fecha_hasta = fechaHasta;

    const { data } = await httpV1.get("/pedidos/mis-entregas", { params });
    return data;
  },
};

export default ruteroApi;