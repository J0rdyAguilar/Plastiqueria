// src/lib/usuarios.js
import { api } from "./api";

export const usuariosApi = {
  list: (params = {}) => api.usuariosList(params),
  ruteros: () => api.usuariosList({ rol: "rutero" }),
};