import api from "./axios";

export const loginApi = async (data) => {
  const res = await api.post("/login", data);
  return res.data;
};

export const logoutApi = async () => {
  const res = await api.post("/logout");
  return res.data;
};
// GET /api/v1/caja/actual?ubicacion_id=1