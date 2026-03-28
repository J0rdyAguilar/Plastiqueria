import { api } from "../lib/api";

export const ventasTienda = {
  listar: (params = {}) => api.ventasTiendaList(params),
  crear: (payload) => api.ventasTiendaCreate(payload),
};