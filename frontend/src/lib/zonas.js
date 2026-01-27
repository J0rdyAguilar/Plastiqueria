import { api } from "./api";

export const zonasApi = {
  list: (params) => api.zonasList(params),
  create: (payload) => api.zonasCreate(payload),
  update: (id, payload) => api.zonasUpdate(id, payload),
  remove: (id) => api.zonasDelete(id),
};
