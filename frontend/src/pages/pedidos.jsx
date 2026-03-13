import React, { useEffect, useMemo, useState } from "react";
import { getSession } from "../lib/auth";
import { stockApi } from "../lib/stock";
import { rutasApi } from "../lib/rutas";
import { zonasApi } from "../lib/zonas";
import { ubicacionesApi } from "../lib/ubicaciones";
import { clientesApi } from "../lib/clientes";
import { pedidosApi } from "../lib/pedidos";
import { misPedidosApi } from "../lib/misPedidos";

function money(n) {
  return `Q ${Number(n || 0).toFixed(2)}`;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function estadoBadgeStyle(estado) {
  const base = {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
  };

  switch (estado) {
    case "pendiente_revision":
      return { ...base, background: "#fff7ed", color: "#9a3412" };
    case "aprobado":
      return { ...base, background: "#ecfeff", color: "#155e75" };
    case "preparando":
      return { ...base, background: "#ecfdf5", color: "#166534" };
    case "entregado":
      return { ...base, background: "#f3f4f6", color: "#374151" };
    default:
      return { ...base, background: "#eef2ff", color: "#3730a3" };
  }
}

export default function Pedidos() {
  const session = getSession();
  const me = session?.user || {};

  const [loadingInit, setLoadingInit] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  const [q, setQ] = useState("");

  const [ubicacionId, setUbicacionId] = useState("");
  const [ubicaciones, setUbicaciones] = useState([]);

  const [rutas, setRutas] = useState([]);
  const [zonas, setZonas] = useState([]);

  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState("");
  const [mostrarNuevoCliente, setMostrarNuevoCliente] = useState(false);

  const [nuevoCliente, setNuevoCliente] = useState({
    nombre: "",
    propietario: "",
    telefono: "",
    ruta_id: "",
    zona_id: "",
    direccion: "",
    referencia: "",
  });

  const [productos, setProductos] = useState([]);
  const [lineas, setLineas] = useState({});
  const [observaciones, setObservaciones] = useState("");

  const [misPedidos, setMisPedidos] = useState([]);
  const [estadoFiltroPedidos, setEstadoFiltroPedidos] = useState("");
  const [loadingMisPedidos, setLoadingMisPedidos] = useState(false);

  const vendedorId = me?.vendedor_id || me?.id || "";

  async function loadInicial() {
    try {
      setLoadingInit(true);
      setError("");

      const results = await Promise.allSettled([
        ubicacionesApi.list({ activa: 1, per_page: 200 }),
        rutasApi.list({ per_page: 200 }),
        zonasApi.list({ per_page: 200 }),
        clientesApi.list({ vendedor_id: vendedorId, activo: 1, per_page: 200 }),
      ]);

      const [resUbicaciones, resRutas, resZonas, resClientes] = results;

      if (resUbicaciones.status === "fulfilled") {
        console.log("ubicaciones OK", resUbicaciones.value);
        setUbicaciones(resUbicaciones.value?.data || []);
      } else {
        console.error("ubicaciones ERROR", resUbicaciones.reason);
      }

      if (resRutas.status === "fulfilled") {
        console.log("rutas OK", resRutas.value);
        setRutas(resRutas.value?.data || []);
      } else {
        console.error("rutas ERROR", resRutas.reason);
      }

      if (resZonas.status === "fulfilled") {
        console.log("zonas OK", resZonas.value);
        setZonas(resZonas.value?.data || []);
      } else {
        console.error("zonas ERROR", resZonas.reason);
      }

      if (resClientes.status === "fulfilled") {
        console.log("clientes OK", resClientes.value);
        setClientes(resClientes.value?.data || []);
      } else {
        console.error("clientes ERROR", resClientes.reason);
      }

      if (results.some((r) => r.status === "rejected")) {
        setError("Algunos datos no cargaron. Revisa la consola.");
      }
    } catch (err) {
      console.error(err);
      setError("No se pudieron cargar los datos iniciales.");
    } finally {
      setLoadingInit(false);
    }
  }

  async function loadProductos() {
    try {
      if (!ubicacionId) {
        setProductos([]);
        return;
      }

      const res = await stockApi.list({
        ubicacion_id: ubicacionId,
        q,
        page: 1,
        per_page: 200,
      });

      const rows = res?.data || [];
      console.log("stock rows", rows);

      setProductos(
        rows.map((item) => ({
          id: item.producto_id,
          nombre: item.producto_nombre,
          sku: item.producto_sku,
          cantidad_base: num(item.cantidad_base),
          presentaciones: [{ tipo: "unidad", factor: 1, precio: 0 }],
          permite_monto_variable: true,
        }))
      );
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar el stock.");
    }
  }

  async function loadMisPedidos() {
    try {
      if (!vendedorId) {
        setMisPedidos([]);
        return;
      }

      setLoadingMisPedidos(true);

      const res = await misPedidosApi.list({
        vendedor_id: vendedorId,
        estado: estadoFiltroPedidos,
        page: 1,
        per_page: 20,
      });

      setMisPedidos(res?.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMisPedidos(false);
    }
  }

  useEffect(() => {
    loadInicial();
  }, []);

  useEffect(() => {
    loadProductos();
  }, [ubicacionId]);

  useEffect(() => {
    loadMisPedidos();
  }, [vendedorId, estadoFiltroPedidos]);

  const clienteSeleccionado = useMemo(() => {
    return clientes.find((c) => String(c.id) === String(clienteId)) || null;
  }, [clientes, clienteId]);

  const productosFiltrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return productos;

    return productos.filter(
      (p) =>
        String(p.nombre || "").toLowerCase().includes(term) ||
        String(p.sku || "").toLowerCase().includes(term)
    );
  }, [productos, q]);

  function getPresentacionDefault(producto) {
    return producto.presentaciones?.[0] || {
      tipo: "unidad",
      factor: 1,
      precio: 0,
    };
  }

  function ensureLinea(producto) {
    const actual = lineas[producto.id];
    if (actual) return actual;

    const p0 = getPresentacionDefault(producto);

    return {
      productoId: producto.id,
      nombre: producto.nombre,
      presentacion: p0.tipo,
      factor: num(p0.factor || 1),
      cantidad: 0,
      precioBase: num(p0.precio || 0),
      usaMontoVariable: false,
      montoVariable: num(p0.precio || 0),
      stockDisponible: num(producto.cantidad_base),
    };
  }

  function changeCantidad(producto, cantidad) {
    const linea = ensureLinea(producto);
    const cant = Math.max(0, num(cantidad));

    setLineas((prev) => ({
      ...prev,
      [producto.id]: {
        ...linea,
        cantidad: cant,
      },
    }));
  }

  function changePresentacion(producto, tipo) {
    const encontrada = (producto.presentaciones || []).find((p) => p.tipo === tipo);
    const linea = ensureLinea(producto);

    setLineas((prev) => ({
      ...prev,
      [producto.id]: {
        ...linea,
        presentacion: encontrada?.tipo || "unidad",
        factor: num(encontrada?.factor || 1),
        precioBase: num(encontrada?.precio || 0),
        montoVariable: num(encontrada?.precio || 0),
      },
    }));
  }

  function toggleMontoVariable(producto, checked) {
    const linea = ensureLinea(producto);

    setLineas((prev) => ({
      ...prev,
      [producto.id]: {
        ...linea,
        usaMontoVariable: checked,
        montoVariable: checked
          ? num(linea.montoVariable || linea.precioBase)
          : num(linea.precioBase),
      },
    }));
  }

  function setMontoVariable(producto, monto) {
    const linea = ensureLinea(producto);

    setLineas((prev) => ({
      ...prev,
      [producto.id]: {
        ...linea,
        montoVariable: num(monto),
      },
    }));
  }

  function getPrecioFinal(producto) {
    const linea = ensureLinea(producto);
    return linea.usaMontoVariable
      ? num(linea.montoVariable)
      : num(linea.precioBase);
  }

  function getCantidadBase(producto) {
    const linea = ensureLinea(producto);
    return num(linea.cantidad) * num(linea.factor || 1);
  }

  function getSubtotal(producto) {
    const linea = ensureLinea(producto);
    return num(linea.cantidad) * getPrecioFinal(producto);
  }

  const detalles = useMemo(() => {
    return productos
      .map((producto) => {
        const linea = lineas[producto.id];
        const cantidad = num(linea?.cantidad);
        if (cantidad <= 0) return null;

        return {
          producto_id: producto.id,
          producto_nombre: producto.nombre,
          presentacion: linea?.presentacion || "unidad",
          cantidad,
          cantidad_base: getCantidadBase(producto),
          precio_unitario: getPrecioFinal(producto),
          subtotal: getSubtotal(producto),
          es_monto_variable: !!linea?.usaMontoVariable,
        };
      })
      .filter(Boolean);
  }, [productos, lineas]);

  const totalPedido = useMemo(() => {
    return detalles.reduce((acc, item) => acc + num(item.subtotal), 0);
  }, [detalles]);

  async function handleCrearCliente() {
    if (!nuevoCliente.nombre || !nuevoCliente.ruta_id || !nuevoCliente.zona_id) {
      alert("Debes completar nombre, ruta y zona.");
      return;
    }

    try {
      const res = await clientesApi.create({
        ...nuevoCliente,
        vendedor_id: vendedorId,
      });

      const creado = res?.data;
      if (!creado) {
        alert("No se pudo crear el cliente.");
        return;
      }

      const clienteNormalizado = {
        id: creado.id,
        nombre: creado.nombre,
        propietario: creado.propietario,
        telefono: creado.telefono,
        direccion: creado.direccion,
        referencia: creado.referencia,
        activo: creado.activo,
        ruta_id: creado.ruta_id,
        ruta_nombre: creado.ruta?.nombre || "",
        zona_id: creado.zona_id,
        zona_nombre: creado.zona?.nombre || "",
      };

      setClientes((prev) => [clienteNormalizado, ...prev]);
      setClienteId(creado.id);
      setMostrarNuevoCliente(false);
      setNuevoCliente({
        nombre: "",
        propietario: "",
        telefono: "",
        ruta_id: "",
        zona_id: "",
        direccion: "",
        referencia: "",
      });

      alert("Cliente creado correctamente.");
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "No se pudo crear el cliente.");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!ubicacionId) {
      alert("Debes seleccionar una sucursal.");
      return;
    }

    if (!clienteId) {
      alert("Debes seleccionar un cliente.");
      return;
    }

    if (detalles.length === 0) {
      alert("Debes agregar al menos un producto.");
      return;
    }

    for (const item of detalles) {
      const producto = productos.find((p) => p.id === item.producto_id);
      if (!producto) continue;

      if (num(item.cantidad_base) > num(producto.cantidad_base)) {
        alert(`No hay stock suficiente para ${producto.nombre}.`);
        return;
      }
    }

    const payload = {
      ubicacion_id: ubicacionId,
      vendedor_id: vendedorId,
      cliente_id: clienteId,
      ruta_id: clienteSeleccionado?.ruta_id,
      zona_id: clienteSeleccionado?.zona_id,
      observaciones,
      total: totalPedido,
      detalles: detalles.map((d) => ({
        producto_id: d.producto_id,
        presentacion: d.presentacion,
        cantidad_base: d.cantidad_base,
        precio_unitario: d.precio_unitario,
        subtotal: d.subtotal,
        es_monto_variable: d.es_monto_variable ? 1 : 0,
      })),
    };

    try {
      setEnviando(true);
      await pedidosApi.createPedidoVendedor(payload);

      alert("Pedido enviado al administrador correctamente.");

      setClienteId("");
      setObservaciones("");
      setLineas({});
      setQ("");
      await loadProductos();
      await loadMisPedidos();
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "No se pudo enviar el pedido.");
    } finally {
      setEnviando(false);
    }
  }

  if (loadingInit) {
    return (
      <div className="page">
        <div className="card pad">Cargando datos...</div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h2>Pedidos</h2>
          <p className="muted">
            Sesión: <b>{me?.nombre || me?.usuario || "—"}</b> ({me?.rol || "—"})
          </p>
        </div>
      </header>

      {error ? (
        <div className="card pad" style={{ marginTop: 12, border: "1px solid #f5c2c7" }}>
          <div style={{ color: "#842029", fontWeight: 600 }}>{error}</div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} style={{ marginTop: 12 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: 16,
            alignItems: "start",
          }}
        >
          <div style={{ display: "grid", gap: 16 }}>
            <div className="card pad">
              <h3 style={{ marginTop: 0 }}>Datos del pedido</h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 12,
                }}
              >
                <div>
                  <label className="muted" style={{ display: "block", marginBottom: 6 }}>
                    Sucursal
                  </label>
                  <select
                    value={ubicacionId}
                    onChange={(e) => setUbicacionId(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Selecciona sucursal</option>
                    {ubicaciones.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="muted" style={{ display: "block", marginBottom: 6 }}>
                    Fecha
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={new Date().toLocaleDateString()}
                    style={{ ...inputStyle, background: "#f7f7f7" }}
                  />
                </div>
              </div>

              <div style={{ marginTop: 16, borderTop: "1px solid #eee", paddingTop: 16 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <h4 style={{ margin: 0 }}>Cliente / Tienda</h4>
                  <button
                    type="button"
                    onClick={() => setMostrarNuevoCliente((v) => !v)}
                    style={miniBtn}
                  >
                    {mostrarNuevoCliente ? "Cancelar" : "Nuevo cliente"}
                  </button>
                </div>

                {!mostrarNuevoCliente ? (
                  <div style={{ marginTop: 12 }}>
                    <label className="muted" style={{ display: "block", marginBottom: 6 }}>
                      Cliente
                    </label>
                    <select
                      value={clienteId}
                      onChange={(e) => setClienteId(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">Selecciona cliente</option>
                      {clientes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div
                    style={{
                      marginTop: 12,
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: 12,
                    }}
                  >
                    <div>
                      <label className="muted" style={{ display: "block", marginBottom: 6 }}>
                        Nombre tienda
                      </label>
                      <input
                        value={nuevoCliente.nombre}
                        onChange={(e) =>
                          setNuevoCliente((p) => ({ ...p, nombre: e.target.value }))
                        }
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label className="muted" style={{ display: "block", marginBottom: 6 }}>
                        Propietario
                      </label>
                      <input
                        value={nuevoCliente.propietario}
                        onChange={(e) =>
                          setNuevoCliente((p) => ({ ...p, propietario: e.target.value }))
                        }
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label className="muted" style={{ display: "block", marginBottom: 6 }}>
                        Teléfono
                      </label>
                      <input
                        value={nuevoCliente.telefono}
                        onChange={(e) =>
                          setNuevoCliente((p) => ({ ...p, telefono: e.target.value }))
                        }
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label className="muted" style={{ display: "block", marginBottom: 6 }}>
                        Ruta
                      </label>
                      <select
                        value={nuevoCliente.ruta_id}
                        onChange={(e) =>
                          setNuevoCliente((p) => ({ ...p, ruta_id: e.target.value }))
                        }
                        style={inputStyle}
                      >
                        <option value="">Selecciona ruta</option>
                        {rutas.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.nombre}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="muted" style={{ display: "block", marginBottom: 6 }}>
                        Zona
                      </label>
                      <select
                        value={nuevoCliente.zona_id}
                        onChange={(e) =>
                          setNuevoCliente((p) => ({ ...p, zona_id: e.target.value }))
                        }
                        style={inputStyle}
                      >
                        <option value="">Selecciona zona</option>
                        {zonas.map((z) => (
                          <option key={z.id} value={z.id}>
                            {z.nombre}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ gridColumn: "1 / -1" }}>
                      <label className="muted" style={{ display: "block", marginBottom: 6 }}>
                        Dirección
                      </label>
                      <textarea
                        rows={2}
                        value={nuevoCliente.direccion}
                        onChange={(e) =>
                          setNuevoCliente((p) => ({ ...p, direccion: e.target.value }))
                        }
                        style={{ ...inputStyle, resize: "vertical" }}
                      />
                    </div>

                    <div style={{ gridColumn: "1 / -1" }}>
                      <label className="muted" style={{ display: "block", marginBottom: 6 }}>
                        Referencia
                      </label>
                      <input
                        value={nuevoCliente.referencia}
                        onChange={(e) =>
                          setNuevoCliente((p) => ({ ...p, referencia: e.target.value }))
                        }
                        style={inputStyle}
                      />
                    </div>

                    <div style={{ gridColumn: "1 / -1" }}>
                      <button type="button" onClick={handleCrearCliente} style={saveBtn}>
                        Guardar cliente
                      </button>
                    </div>
                  </div>
                )}

                {!mostrarNuevoCliente && clienteSeleccionado ? (
                  <div
                    style={{
                      marginTop: 12,
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: 12,
                    }}
                  >
                    <div>
                      <label className="muted" style={{ display: "block", marginBottom: 6 }}>
                        Ruta
                      </label>
                      <input
                        readOnly
                        value={clienteSeleccionado?.ruta_nombre || ""}
                        style={{ ...inputStyle, background: "#f7f7f7" }}
                      />
                    </div>
                    <div>
                      <label className="muted" style={{ display: "block", marginBottom: 6 }}>
                        Zona
                      </label>
                      <input
                        readOnly
                        value={clienteSeleccionado?.zona_nombre || ""}
                        style={{ ...inputStyle, background: "#f7f7f7" }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              <div style={{ marginTop: 12 }}>
                <label className="muted" style={{ display: "block", marginBottom: 6 }}>
                  Observaciones
                </label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>
            </div>

            <div className="card pad">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <h3 style={{ margin: 0 }}>Productos</h3>

                <input
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onBlur={loadProductos}
                  placeholder="Buscar por nombre o código..."
                  style={{ ...inputStyle, maxWidth: 320 }}
                />
              </div>

              <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                {productosFiltrados.map((producto) => {
                  const linea = ensureLinea(producto);
                  const subtotal = getSubtotal(producto);

                  return (
                    <div
                      key={producto.id}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        padding: 14,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700 }}>{producto.nombre}</div>
                          <div className="muted" style={{ fontSize: 13 }}>
                            Código: {producto.sku || "—"}
                          </div>
                          <div className="muted" style={{ fontSize: 13 }}>
                            Stock base: {producto.cantidad_base}
                          </div>
                        </div>

                        <div style={{ fontWeight: 700 }}>
                          Subtotal: {money(subtotal)}
                        </div>
                      </div>

                      <div
                        style={{
                          marginTop: 12,
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr 1fr",
                          gap: 12,
                        }}
                      >
                        <div>
                          <label className="muted" style={{ display: "block", marginBottom: 6 }}>
                            Presentación
                          </label>
                          <select
                            value={linea.presentacion}
                            onChange={(e) => changePresentacion(producto, e.target.value)}
                            style={inputStyle}
                          >
                            {(producto.presentaciones || []).map((p) => (
                              <option key={p.tipo} value={p.tipo}>
                                {p.tipo}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="muted" style={{ display: "block", marginBottom: 6 }}>
                            Cantidad
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={linea.cantidad}
                            onChange={(e) => changeCantidad(producto, e.target.value)}
                            style={inputStyle}
                          />
                        </div>

                        <div>
                          <label className="muted" style={{ display: "block", marginBottom: 6 }}>
                            Precio aplicado
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={linea.usaMontoVariable ? linea.montoVariable : linea.precioBase}
                            onChange={(e) => setMontoVariable(producto, e.target.value)}
                            style={inputStyle}
                          />
                        </div>
                      </div>

                      <div style={{ marginTop: 12 }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={!!linea.usaMontoVariable}
                            onChange={(e) => toggleMontoVariable(producto, e.target.checked)}
                          />
                          <span>Usar monto variable</span>
                        </label>
                      </div>
                    </div>
                  );
                })}

                {productosFiltrados.length === 0 && (
                  <div className="muted">No se encontraron productos.</div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 16, position: "sticky", top: 12 }}>
            <div className="card pad">
              <h3 style={{ marginTop: 0 }}>Resumen del pedido</h3>

              <div style={{ display: "grid", gap: 10 }}>
                <div>
                  <div className="muted" style={{ fontSize: 13 }}>Cliente</div>
                  <div style={{ fontWeight: 600 }}>
                    {clienteSeleccionado?.nombre || "No seleccionado"}
                  </div>
                </div>

                <div>
                  <div className="muted" style={{ fontSize: 13 }}>Ruta / Zona</div>
                  <div style={{ fontWeight: 600 }}>
                    {(clienteSeleccionado?.ruta_nombre || "—") +
                      " / " +
                      (clienteSeleccionado?.zona_nombre || "—")}
                  </div>
                </div>

                <div>
                  <div className="muted" style={{ fontSize: 13 }}>Productos agregados</div>
                  <div style={{ fontWeight: 600 }}>{detalles.length}</div>
                </div>
              </div>

              <hr style={{ margin: "14px 0", border: 0, borderTop: "1px solid #eee" }} />

              <div style={{ maxHeight: 260, overflow: "auto", display: "grid", gap: 10 }}>
                {detalles.length === 0 ? (
                  <div className="muted">Aún no has agregado productos.</div>
                ) : (
                  detalles.map((item) => (
                    <div
                      key={item.producto_id}
                      style={{
                        border: "1px solid #eee",
                        borderRadius: 10,
                        padding: 10,
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{item.producto_nombre}</div>
                      <div className="muted" style={{ fontSize: 13 }}>
                        {item.cantidad} × {item.presentacion} × {money(item.precio_unitario)}
                      </div>
                      <div style={{ marginTop: 4, fontWeight: 700 }}>
                        {money(item.subtotal)}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <hr style={{ margin: "14px 0", border: 0, borderTop: "1px solid #eee" }} />

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: 18,
                  fontWeight: 800,
                }}
              >
                <span>Total</span>
                <span>{money(totalPedido)}</span>
              </div>

              <button
                type="submit"
                disabled={enviando}
                style={{
                  width: "100%",
                  marginTop: 14,
                  border: 0,
                  borderRadius: 10,
                  padding: "12px 14px",
                  fontWeight: 700,
                  cursor: enviando ? "not-allowed" : "pointer",
                }}
              >
                {enviando ? "Enviando..." : "Enviar pedido al admin"}
              </button>
            </div>
          </div>
        </div>
      </form>

      <div className="card pad" style={{ marginTop: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <div>
            <h3 style={{ margin: 0 }}>Mis pedidos</h3>
            <div className="muted">Aquí puedes ver si el admin ya revisó tu pedido.</div>
          </div>

          <div style={{ minWidth: 220 }}>
            <select
              value={estadoFiltroPedidos}
              onChange={(e) => setEstadoFiltroPedidos(e.target.value)}
              style={inputStyle}
            >
              <option value="">Todos los estados</option>
              <option value="pendiente_revision">Pendiente revisión</option>
              <option value="aprobado">Aprobado</option>
              <option value="preparando">Preparando</option>
              <option value="entregado">Entregado</option>
            </select>
          </div>
        </div>

        {loadingMisPedidos ? (
          <div className="muted">Cargando pedidos...</div>
        ) : misPedidos.length === 0 ? (
          <div className="muted">Aún no tienes pedidos registrados.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {misPedidos.map((pedido) => (
              <div
                key={pedido.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800 }}>Pedido #{pedido.id}</div>
                    <div className="muted">Cliente: {pedido.cliente_nombre || "—"}</div>
                    <div className="muted">Fecha: {pedido.creado_en || "—"}</div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={estadoBadgeStyle(pedido.estado)}>{pedido.estado}</div>
                    <div style={{ marginTop: 8, fontWeight: 800 }}>
                      {money(pedido.total)}
                    </div>
                  </div>
                </div>

                {pedido.detalles?.length ? (
                  <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                    {pedido.detalles.map((d) => (
                      <div
                        key={d.id}
                        style={{
                          border: "1px solid #f1f5f9",
                          background: "#fafafa",
                          borderRadius: 10,
                          padding: 10,
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>
                          {d.producto_nombre || `Producto #${d.producto_id}`}
                        </div>
                        <div className="muted" style={{ fontSize: 13 }}>
                          {d.cantidad_base} × {d.presentacion || "unidad"} × {money(d.precio_unitario)}
                        </div>
                        <div style={{ marginTop: 4, fontWeight: 700 }}>
                          {money(d.subtotal)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {pedido.observaciones ? (
                  <div style={{ marginTop: 10 }}>
                    <div className="muted" style={{ fontSize: 13 }}>Observaciones</div>
                    <div>{pedido.observaciones}</div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: "10px 12px",
  outline: "none",
};

const miniBtn = {
  border: "1px solid #d1d5db",
  background: "#fff",
  borderRadius: 8,
  padding: "8px 12px",
  cursor: "pointer",
  fontWeight: 600,
};

const saveBtn = {
  border: 0,
  background: "#111827",
  color: "#fff",
  borderRadius: 10,
  padding: "12px 14px",
  cursor: "pointer",
  fontWeight: 700,
}; 