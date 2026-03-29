import { http } from "./http";

export const perfilApi = {
  me: async () => {
    const { data } = await http.get("/perfil");
    return data;
  },

  update: async (formData) => {
    const { data } = await http.post("/perfil/actualizar", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return data;
  },

  changePassword: async (payload) => {
    const { data } = await http.post("/perfil/cambiar-password", payload);
    return data;
  },
};