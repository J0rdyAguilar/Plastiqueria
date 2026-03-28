import React, { useMemo, useState } from "react";
import { ventasTienda } from "../api/ventasTienda";

export default function VentaTienda() {
  const [items, setItems] = useState([]);
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [precio, setPrecio] = useState("");
  const [loading, setLoading] = useState(false);

  function agregarItem() {
    if (!productoId || !cantidad || !precio) return;

    setItems((prev) => [
      ...prev,
      {
        producto_id: Number(productoId),
        cantidad: Number(cantidad),
        precio_unitario: Number(precio),
      },
    ]);

    setProductoId("");
    setCantidad(1);
    setPrecio("");
  }

  function eliminarItem(index) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const total = useMemo(() => {
    return items.reduce((acc, item) => {
      return acc + Number(item.cantidad) * Number(item.precio_unitario);
    }, 0);
  }, [items]);

  async function finalizarVenta() {
    if (items.length === 0) {
      alert("Agrega al menos un producto.");
      return;
    }

    try {
      setLoading(true);

      await ventasTienda.crear({
        items,
      });

      alert("Venta realizada correctamente.");
      setItems([]);
    } catch (error) {
      console.error(error);
      alert(error?.data?.message || "No se pudo realizar la venta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h1 style={{ margin: 0 }}>Ventas tienda</h1>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr auto",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <input
          type="number"
          placeholder="Producto ID"
          value={productoId}
          onChange={(e) => setProductoId(e.target.value)}
        />

        <input
          type="number"
          placeholder="Cantidad"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
        />

        <input
          type="number"
          placeholder="Precio"
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
        />

        <button type="button" onClick={agregarItem}>
          Agregar
        </button>
      </div>

      <div style={{ marginBottom: 20 }}>
        {items.length === 0 ? (
          <p>No hay productos en la venta.</p>
        ) : (
          items.map((item, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 0",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <div>
                <strong>Producto #{item.producto_id}</strong>
                <div>
                  Cantidad: {item.cantidad} | Precio: Q{Number(item.precio_unitario).toFixed(2)}
                </div>
              </div>

              <button type="button" onClick={() => eliminarItem(index)}>
                Quitar
              </button>
            </div>
          ))
        )}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2 style={{ margin: 0 }}>Total: Q{total.toFixed(2)}</h2>

        <button type="button" onClick={finalizarVenta} disabled={loading}>
          {loading ? "Guardando..." : "Finalizar venta"}
        </button>
      </div>
    </section>
  );
}