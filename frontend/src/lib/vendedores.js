// src/lib/vendedores.js
import { api } from "./api";

export const vendedoresApi = {
  list: (params) => api.vendedoresList(params),
  create: (payload) => api.vendedoresCreate(payload),
  update: (id, payload) => api.vendedoresUpdate(id, payload),
  remove: (id) => api.vendedoresDelete(id),

  // ✅ asignar rutas
    asignarRutas: (id, ruta_ids, modo="sync") =>
    request(`/vendedores/${id}/rutas`, { method:"POST", body:{ ruta_ids, modo } }),

};
