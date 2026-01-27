// src/lib/rutas.js
import { api } from "./api";

export const rutasApi = {
  list: (params) => api.rutasList(params),
  create: (payload) => api.rutasCreate(payload),
  update: (id, payload) => api.rutasUpdate(id, payload),
  remove: (id) => api.rutasDelete(id),
};
