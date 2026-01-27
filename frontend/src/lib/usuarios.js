// src/lib/usuarios.js
import { api } from "./api";

export const usuariosApi = {
  list: () => api.usuariosList(),
};
