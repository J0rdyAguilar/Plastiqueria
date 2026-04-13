import { http } from "../lib/http";

export const productosApi = {
  list: (params = {}) =>
    http.get("/v1/productos", { params }).then((r) => r.data),

  create: (payload) =>
    http.post("/v1/productos", payload).then((r) => r.data),

  update: (id, payload) =>
    http.put(`/v1/productos/${id}`, payload).then((r) => r.data),

  remove: (id) =>
    http.delete(`/v1/productos/${id}`).then((r) => r.data),

  show: (id) =>
    http.get(`/v1/productos/${id}`).then((r) => r.data),

  uploadImagen: ({ producto_id, file, es_principal = true, orden = 0 }) => {
    const fd = new FormData();
    fd.append("producto_id", String(producto_id));
    fd.append("imagen", file);
    fd.append("es_principal", es_principal ? "1" : "0");
    fd.append("orden", String(orden));

    return http
      .post("/v1/producto-imagenes", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
};