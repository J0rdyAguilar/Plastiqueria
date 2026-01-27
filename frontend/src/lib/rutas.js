// src/lib/rutas.js
import { api } from "./api";

export const rutasApi = {
  list: (params) => api.rutasList(params),
};
