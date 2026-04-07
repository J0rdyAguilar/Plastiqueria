import { httpV1 } from "./httpV1";

export const productosApi = {
  list: (params = {}) => httpV1.get("/productos", { params }).then(r => r.data),
  create: (payload) => httpV1.post("/productos", payload).then(r => r.data),
  update: (id, payload) => httpV1.put(`/productos/${id}`, payload).then(r => r.data),
  remove: (id) => httpV1.delete(`/productos/${id}`).then(r => r.data),
  show: (id) => httpV1.get(`/productos/${id}`).then(r => r.data),

  search: (q, params = {}) =>
    httpV1.get("/productos", {
      params: {
        q,
        per_page: 20,
        ...params,
      },
    }).then(r => r.data),

  uploadImagen: ({ producto_id, file, es_principal = true, orden = 0 }) => {
    const fd = new FormData();
    fd.append("producto_id", String(producto_id));
    fd.append("imagen", file);
    fd.append("es_principal", es_principal ? "1" : "0");
    fd.append("orden", String(orden));

    return httpV1.post("/producto-imagenes", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then(r => r.data);
  },
};