import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ShoppingCart,
  Package,
  Boxes,
  DollarSign,
  Trash2,
  Plus,
  BadgeDollarSign,
  Loader2,
  CheckCircle2,
  Store,
  ClipboardList,
  Search,
  ScanSearch,
  CreditCard,
  Banknote,
  ReceiptText,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ventasTienda } from "../api/ventasTienda";
import { stockApi } from "../lib/stock";

function money(value) {
  return `Q${Number(value || 0).toFixed(2)}`;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function scoreProducto(prod, term) {
  if (!term) return 0;

  const nombre = normalizeText(prod.nombre);
  const codigo = normalizeText(prod.codigo);
  const id = normalizeText(prod.producto_id);
  const presentacion = normalizeText(prod.presentacion);

  let score = 0;

  if (id === term) score += 1000;
  if (codigo === term) score += 900;
  if (nombre === term) score += 800;

  if (id.startsWith(term)) score += 500;
  if (codigo.startsWith(term)) score += 450;
  if (nombre.startsWith(term)) score += 400;
  if (presentacion.startsWith(term)) score += 250;

  if (id.includes(term)) score += 220;
  if (codigo.includes(term)) score += 200;
  if (nombre.includes(term)) score += 180;
  if (presentacion.includes(term)) score += 120;

  if (Number(prod.stock) > 0) score += 30;

  return score;
}

function highlightText(text, query) {
  const raw = String(text || "");
  const q = String(query || "").trim();
  if (!q) return raw;

  const index = raw.toLowerCase().indexOf(q.toLowerCase());
  if (index === -1) return raw;

  const before = raw.slice(0, index);
  const match = raw.slice(index, index + q.length);
  const after = raw.slice(index + q.length);

  return (
    <>
      {before}
      <mark
        style={{
          background: "rgba(37,99,235,0.16)",
          color: "#1d4ed8",
          padding: "0 3px",
          borderRadius: 6,
        }}
      >
        {match}
      </mark>
      {after}
    </>
  );
}

export default function VentaTienda() {
  const nav = useNavigate();

  const [inventario, setInventario] = useState([]);
  const [items, setItems] = useState([]);

  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [q, setQ] = useState("");
  const [metodoPago, setMetodoPago] = useState("efectivo");

  const [loadingInventario, setLoadingInventario] = useState(true);
  const [loadingVenta, setLoadingVenta] = useState(false);

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);

  const searchWrapRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    cargarInventario();
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (!searchWrapRef.current?.contains(e.target)) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function cargarInventario() {
    try {
      setLoadingInventario(true);

      const resp = await stockApi.list({
        q: "",
        page: 1,
        per_page: 200,
      });

      const rows = Array.isArray(resp)
        ? resp
        : Array.isArray(resp?.data)
        ? resp.data
        : Array.isArray(resp?.items)
        ? resp.items
        : Array.isArray(resp?.rows)
        ? resp.rows
        : Array.isArray(resp?.stock)
        ? resp.stock
        : Array.isArray(resp?.inventario)
        ? resp.inventario
        : [];

      const normalizados = rows.map((row, index) => {
        return {
          key: row?.id ?? `${row?.producto_id ?? index}`,
          producto_id: String(row?.producto_id ?? ""),
          nombre:
            row?.producto_nombre ||
            row?.nombre ||
            row?.descripcion ||
            "Producto sin nombre",
          codigo:
            row?.producto_sku ||
            row?.codigo ||
            String(row?.producto_id ?? ""),
          stock: Number(
            row?.cantidad_base ??
              row?.cantidad ??
              row?.stock ??
              row?.existencia ??
              0
          ),
          precio: Number(row?.precio ?? row?.precio_venta ?? 0),
          presentacion: row?.presentacion || "",
          categoria: row?.categoria || "",
        };
      });

      setInventario(normalizados);
    } catch (error) {
      console.error("ERROR INVENTARIO:", error);
      alert(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          "No se pudo cargar el inventario."
      );
    } finally {
      setLoadingInventario(false);
    }
  }

  const inventarioFiltrado = useMemo(() => {
    const term = normalizeText(q);

    if (!term) {
      return [...inventario]
        .sort((a, b) => {
          if (Number(b.stock) !== Number(a.stock)) {
            return Number(b.stock) - Number(a.stock);
          }
          return String(a.nombre).localeCompare(String(b.nombre));
        })
        .slice(0, 12);
    }

    return [...inventario]
      .map((prod) => ({
        ...prod,
        _score: scoreProducto(prod, term),
      }))
      .filter((prod) => prod._score > 0)
      .sort((a, b) => {
        if (b._score !== a._score) return b._score - a._score;
        if (Number(b.stock) !== Number(a.stock)) {
          return Number(b.stock) - Number(a.stock);
        }
        return String(a.nombre).localeCompare(String(b.nombre));
      })
      .slice(0, 12);
  }, [inventario, q]);

  useEffect(() => {
    setSelectedSuggestionIndex(0);
  }, [q]);

  const productoSeleccionado = useMemo(() => {
    return inventario.find((p) => p.producto_id === productoId) || null;
  }, [inventario, productoId]);

  const subtotalPreview = useMemo(() => {
    if (!productoSeleccionado) return 0;

    const cantidadNum = Number(cantidad || 0);
    const precioNum = Number(productoSeleccionado?.precio || 0);

    if (cantidadNum <= 0 || precioNum <= 0) return 0;

    return cantidadNum * precioNum;
  }, [productoSeleccionado, cantidad]);

  function seleccionarProducto(prodOrId) {
    const prod =
      typeof prodOrId === "string"
        ? inventario.find((p) => p.producto_id === prodOrId)
        : prodOrId;

    if (!prod) return;

    setProductoId(prod.producto_id);
    setQ(`${prod.nombre}${prod.presentacion ? ` - ${prod.presentacion}` : ""}`);
    setShowSuggestions(false);
  }

  function onSearchKeyDown(e) {
    if (!showSuggestions && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setShowSuggestions(true);
      return;
    }

    if (!inventarioFiltrado.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedSuggestionIndex((prev) =>
        prev + 1 >= inventarioFiltrado.length ? 0 : prev + 1
      );
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedSuggestionIndex((prev) =>
        prev - 1 < 0 ? inventarioFiltrado.length - 1 : prev - 1
      );
    }

    if (e.key === "Enter") {
      if (showSuggestions && inventarioFiltrado[selectedSuggestionIndex]) {
        e.preventDefault();
        seleccionarProducto(inventarioFiltrado[selectedSuggestionIndex]);
      }
    }

    if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }

  function agregarItem() {
    if (!productoId) {
      alert("Selecciona un producto.");
      return;
    }

    if (!cantidad || Number(cantidad) <= 0) {
      alert("La cantidad debe ser mayor a 0.");
      return;
    }

    const prod = inventario.find((p) => p.producto_id === productoId);

    if (!prod) {
      alert("El producto no existe en el inventario.");
      return;
    }

    if (!prod.precio || Number(prod.precio) <= 0) {
      alert("El producto no tiene un precio válido.");
      return;
    }

    const cantidadNum = Number(cantidad);
    const precioNum = Number(prod.precio);

    if (cantidadNum > Number(prod.stock)) {
      alert(`Stock insuficiente. Disponible: ${prod.stock}`);
      return;
    }

    const indexExistente = items.findIndex(
      (item) => item.producto_id === productoId
    );

    if (indexExistente >= 0) {
      const nuevos = [...items];
      const nuevaCantidad =
        Number(nuevos[indexExistente].cantidad) + cantidadNum;

      if (nuevaCantidad > Number(prod.stock)) {
        alert(`Stock insuficiente. Disponible: ${prod.stock}`);
        return;
      }

      nuevos[indexExistente] = {
        ...nuevos[indexExistente],
        cantidad: nuevaCantidad,
        precio_unitario: precioNum,
      };
      setItems(nuevos);
    } else {
      setItems((prev) => [
        ...prev,
        {
          producto_id: String(prod.producto_id),
          nombre: prod.nombre,
          codigo: prod.codigo,
          presentacion: prod.presentacion,
          cantidad: cantidadNum,
          precio_unitario: precioNum,
        },
      ]);
    }

    setProductoId("");
    setCantidad(1);
    setQ("");
    setShowSuggestions(false);
    searchInputRef.current?.focus();
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

    if (!metodoPago) {
      alert("Selecciona un método de pago.");
      return;
    }

    try {
      setLoadingVenta(true);

      await ventasTienda.crear({
        metodo_pago: metodoPago,
        items: items.map((item) => ({
          producto_id: String(item.producto_id),
          cantidad: Number(item.cantidad),
          precio_unitario: Number(item.precio_unitario),
        })),
      });

      alert("Venta realizada correctamente.");
      setItems([]);
      setMetodoPago("efectivo");
      await cargarInventario();
    } catch (error) {
      console.error("ERROR VENTA:", error);
      alert(
        error?.response?.data?.message ||
          error?.data?.message ||
          "No se pudo realizar la venta."
      );
    } finally {
      setLoadingVenta(false);
    }
  }

  return (
    <section style={{ minHeight: "100%", padding: 28 }}>
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          display: "grid",
          gap: 24,
        }}
      >
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 28,
            padding: "30px 28px",
            background:
              "linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.96) 45%, rgba(59,130,246,0.88) 100%)",
            boxShadow: "0 20px 60px rgba(15,23,42,0.20)",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 20,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.10)",
                  color: "#e2e8f0",
                  fontSize: 13,
                  fontWeight: 700,
                  marginBottom: 16,
                }}
              >
                <Store size={16} />
                Venta conectada al inventario
              </div>

              <h1
                style={{
                  margin: 0,
                  color: "#fff",
                  fontSize: "clamp(28px, 4vw, 40px)",
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                }}
              >
                Ventas tienda
              </h1>

              <p
                style={{
                  margin: "10px 0 0",
                  color: "rgba(255,255,255,0.78)",
                  fontSize: 15,
                  maxWidth: 700,
                  lineHeight: 1.6,
                }}
              >
                Registra ventas por sucursal, indicando si fueron en efectivo o tarjeta.
              </p>
            </div>

            <div
              style={{
                minWidth: 280,
                display: "grid",
                gap: 12,
              }}
            >
              <div
                style={{
                  borderRadius: 24,
                  padding: "18px 20px",
                  background: "rgba(255,255,255,0.10)",
                  border: "1px solid rgba(255,255,255,0.14)",
                }}
              >
                <div
                  style={{
                    color: "rgba(255,255,255,0.72)",
                    fontSize: 13,
                    marginBottom: 8,
                  }}
                >
                  Total actual
                </div>
                <div
                  style={{
                    color: "#fff",
                    fontWeight: 900,
                    fontSize: 30,
                    letterSpacing: "-0.03em",
                  }}
                >
                  {money(total + subtotalPreview)}
                </div>
              </div>

              <button
                type="button"
                onClick={() => nav("/registro-ventas-tienda")}
                style={{
                  border: "none",
                  borderRadius: 16,
                  height: 48,
                  background: "rgba(255,255,255,0.14)",
                  color: "#fff",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                }}
              >
                <ReceiptText size={18} />
                Ver mi registro del día
              </button>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.3fr 0.7fr",
            gap: 24,
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.82)",
              borderRadius: 28,
              padding: 24,
              border: "1px solid rgba(148,163,184,0.18)",
              boxShadow: "0 18px 45px rgba(15,23,42,0.08)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 22,
              }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 16,
                  display: "grid",
                  placeItems: "center",
                  background:
                    "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                  color: "#fff",
                }}
              >
                <Package size={22} />
              </div>

              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#0f172a",
                  }}
                >
                  Agregar producto
                </h2>
                <p
                  style={{
                    margin: "4px 0 0",
                    color: "#64748b",
                    fontSize: 14,
                  }}
                >
                  Busca por nombre, código, presentación o ID y selecciona rápido.
                </p>
              </div>
            </div>

            {loadingInventario ? (
              <div
                style={{
                  padding: 30,
                  borderRadius: 22,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  color: "#334155",
                  fontWeight: 700,
                }}
              >
                <Loader2 size={18} className="spin-icon" />
                Cargando inventario...
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 18 }}>
                  <label style={labelStyle}>Buscador inteligente</label>

                  <div ref={searchWrapRef} style={{ position: "relative" }}>
                    <div style={{ position: "relative" }}>
                      <Search
                        size={18}
                        style={{
                          position: "absolute",
                          left: 14,
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "#64748b",
                        }}
                      />

                      <input
                        ref={searchInputRef}
                        type="text"
                        value={q}
                        onChange={(e) => {
                          setQ(e.target.value);
                          setShowSuggestions(true);
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        onKeyDown={onSearchKeyDown}
                        placeholder="Busca por nombre, código, presentación o ID..."
                        style={{
                          ...inputStyle,
                          height: 58,
                          paddingLeft: 44,
                          paddingRight: 44,
                          fontSize: 16,
                          borderRadius: 18,
                        }}
                      />

                      <ScanSearch
                        size={18}
                        style={{
                          position: "absolute",
                          right: 14,
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "#94a3b8",
                        }}
                      />
                    </div>

                    {showSuggestions && (
                      <div
                        style={{
                          position: "absolute",
                          top: "calc(100% + 10px)",
                          left: 0,
                          right: 0,
                          zIndex: 30,
                          background: "#fff",
                          border: "1px solid #dbe2ea",
                          borderRadius: 20,
                          boxShadow: "0 20px 50px rgba(15,23,42,0.14)",
                          overflow: "hidden",
                        }}
                      >
                        {inventarioFiltrado.length === 0 ? (
                          <div
                            style={{
                              padding: 18,
                              color: "#64748b",
                              fontSize: 14,
                            }}
                          >
                            No se encontraron productos.
                          </div>
                        ) : (
                          inventarioFiltrado.map((prod, index) => {
                            const active = index === selectedSuggestionIndex;

                            return (
                              <button
                                key={prod.key}
                                type="button"
                                onMouseEnter={() => setSelectedSuggestionIndex(index)}
                                onClick={() => seleccionarProducto(prod)}
                                style={{
                                  width: "100%",
                                  border: "none",
                                  background: active
                                    ? "linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%)"
                                    : "#fff",
                                  padding: "14px 16px",
                                  textAlign: "left",
                                  cursor: "pointer",
                                  borderBottom:
                                    index !== inventarioFiltrado.length - 1
                                      ? "1px solid #eef2f7"
                                      : "none",
                                  display: "grid",
                                  gap: 6,
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    gap: 14,
                                    alignItems: "center",
                                  }}
                                >
                                  <div
                                    style={{
                                      fontWeight: 800,
                                      color: "#0f172a",
                                      fontSize: 15,
                                    }}
                                  >
                                    {highlightText(prod.nombre, q)}
                                    {prod.presentacion ? ` - ${prod.presentacion}` : ""}
                                  </div>

                                  <div
                                    style={{
                                      flexShrink: 0,
                                      padding: "6px 10px",
                                      borderRadius: 999,
                                      background:
                                        Number(prod.stock) > 0 ? "#ecfdf5" : "#fef2f2",
                                      color:
                                        Number(prod.stock) > 0 ? "#047857" : "#b91c1c",
                                      fontSize: 12,
                                      fontWeight: 800,
                                    }}
                                  >
                                    Stock: {prod.stock}
                                  </div>
                                </div>

                                <div
                                  style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 10,
                                    fontSize: 13,
                                    color: "#64748b",
                                  }}
                                >
                                  <span>ID: {highlightText(prod.producto_id, q)}</span>
                                  <span>Código: {highlightText(prod.codigo, q)}</span>
                                  <span>Precio: {money(prod.precio)}</span>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1fr 1fr auto",
                    gap: 14,
                    alignItems: "end",
                  }}
                >
                  <div>
                    <label style={labelStyle}>Producto seleccionado</label>
                    <div
                      style={{
                        ...inputStyle,
                        minHeight: 52,
                        display: "flex",
                        alignItems: "center",
                        borderRadius: 16,
                        fontWeight: 700,
                        color: productoSeleccionado ? "#0f172a" : "#94a3b8",
                      }}
                    >
                      {productoSeleccionado
                        ? `${productoSeleccionado.nombre}${
                            productoSeleccionado.presentacion
                              ? ` - ${productoSeleccionado.presentacion}`
                              : ""
                          } | ID: ${productoSeleccionado.producto_id}`
                        : "Selecciona un producto desde el buscador"}
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Cantidad</label>
                    <input
                      type="number"
                      min="1"
                      value={cantidad}
                      onChange={(e) => setCantidad(e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Precio</label>
                    <input
                      type="text"
                      value={productoSeleccionado ? money(productoSeleccionado.precio) : ""}
                      readOnly
                      disabled
                      style={{
                        ...inputStyle,
                        background: "#eef2f7",
                        color: "#0f172a",
                        cursor: "not-allowed",
                        fontWeight: 800,
                        opacity: 1,
                      }}
                      placeholder="Selecciona un producto"
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Subtotal</label>
                    <input
                      type="text"
                      value={subtotalPreview ? money(subtotalPreview) : ""}
                      readOnly
                      disabled
                      style={{
                        ...inputStyle,
                        background: "#eef2f7",
                        color: "#0f172a",
                        cursor: "not-allowed",
                        fontWeight: 800,
                        opacity: 1,
                      }}
                      placeholder="Q0.00"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={agregarItem}
                    style={primaryButtonStyle}
                  >
                    <Plus size={18} />
                    Agregar
                  </button>
                </div>
              </>
            )}

            {productoSeleccionado && (
              <div
                style={{
                  marginTop: 18,
                  padding: 18,
                  borderRadius: 20,
                  background:
                    "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
                  border: "1px solid #e2e8f0",
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 14,
                }}
              >
                <InfoBox
                  icon={<ClipboardList size={16} />}
                  title="ID producto"
                  value={productoSeleccionado.producto_id}
                />
                <InfoBox
                  icon={<Package size={16} />}
                  title="Código"
                  value={productoSeleccionado.codigo}
                />
                <InfoBox
                  icon={<Boxes size={16} />}
                  title="Stock"
                  value={String(productoSeleccionado.stock)}
                />
                <InfoBox
                  icon={<DollarSign size={16} />}
                  title="Precio base"
                  value={money(productoSeleccionado.precio)}
                />
              </div>
            )}
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.82)",
              borderRadius: 28,
              padding: 24,
              border: "1px solid rgba(148,163,184,0.18)",
              boxShadow: "0 18px 45px rgba(15,23,42,0.08)",
              display: "grid",
              gap: 16,
              alignContent: "start",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 16,
                  display: "grid",
                  placeItems: "center",
                  background:
                    "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  color: "#fff",
                }}
              >
                <BadgeDollarSign size={22} />
              </div>

              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#0f172a",
                  }}
                >
                  Resumen
                </h2>
                <p
                  style={{
                    margin: "4px 0 0",
                    color: "#64748b",
                    fontSize: 14,
                  }}
                >
                  Estado actual de la venta.
                </p>
              </div>
            </div>

            <div
              style={{
                borderRadius: 18,
                border: "1px solid #e2e8f0",
                background: "#fff",
                padding: 16,
              }}
            >
              <label style={labelStyle}>Método de pago</label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <button
                  type="button"
                  onClick={() => setMetodoPago("efectivo")}
                  style={{
                    ...payButtonStyle,
                    ...(metodoPago === "efectivo" ? activePayButtonStyle : {}),
                  }}
                >
                  <Banknote size={18} />
                  Efectivo
                </button>

                <button
                  type="button"
                  onClick={() => setMetodoPago("tarjeta")}
                  style={{
                    ...payButtonStyle,
                    ...(metodoPago === "tarjeta" ? activePayButtonStyle : {}),
                  }}
                >
                  <CreditCard size={18} />
                  Tarjeta
                </button>
              </div>
            </div>

            <div
              style={{
                borderRadius: 22,
                background:
                  "linear-gradient(135deg, rgba(15,23,42,0.96) 0%, rgba(30,41,59,0.96) 100%)",
                padding: 22,
                color: "#fff",
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.70)",
                  marginBottom: 10,
                }}
              >
                Total a cobrar
              </div>
              <div
                style={{
                  fontSize: 34,
                  fontWeight: 900,
                  letterSpacing: "-0.03em",
                  marginBottom: 8,
                }}
              >
                {money(total + subtotalPreview)}
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.70)",
                  fontSize: 14,
                }}
              >
                {items.length} {items.length === 1 ? "producto" : "productos"} agregados
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.82)",
                  fontSize: 14,
                  marginTop: 10,
                  fontWeight: 700,
                }}
              >
                Método: {metodoPago === "efectivo" ? "Efectivo" : "Tarjeta"}
              </div>
            </div>

            <button
              type="button"
              onClick={finalizarVenta}
              disabled={loadingVenta}
              style={{
                ...successButtonStyle,
                opacity: loadingVenta ? 0.8 : 1,
                cursor: loadingVenta ? "not-allowed" : "pointer",
              }}
            >
              {loadingVenta ? (
                <>
                  <Loader2 size={18} className="spin-icon" />
                  Guardando venta...
                </>
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  Finalizar venta
                </>
              )}
            </button>
          </div>
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.82)",
            borderRadius: 28,
            padding: 24,
            border: "1px solid rgba(148,163,184,0.18)",
            boxShadow: "0 18px 45px rgba(15,23,42,0.08)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
              marginBottom: 20,
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 24,
                  fontWeight: 800,
                  color: "#0f172a",
                }}
              >
                Productos en la venta
              </h2>
              <p
                style={{
                  margin: "6px 0 0",
                  color: "#64748b",
                  fontSize: 14,
                }}
              >
                Revisa el detalle antes de confirmar.
              </p>
            </div>

            <div
              style={{
                padding: "10px 14px",
                borderRadius: 999,
                background: "#eff6ff",
                color: "#1d4ed8",
                fontWeight: 700,
                fontSize: 13,
                border: "1px solid #bfdbfe",
              }}
            >
              {items.length} {items.length === 1 ? "registro" : "registros"}
            </div>
          </div>

          {items.length === 0 ? (
            <div
              style={{
                borderRadius: 24,
                border: "1px dashed #cbd5e1",
                padding: "48px 20px",
                textAlign: "center",
                background:
                  "linear-gradient(180deg, rgba(248,250,252,0.95) 0%, rgba(241,245,249,0.95) 100%)",
              }}
            >
              <div
                style={{
                  width: 74,
                  height: 74,
                  borderRadius: 24,
                  margin: "0 auto 16px",
                  display: "grid",
                  placeItems: "center",
                  background: "#e2e8f0",
                  color: "#334155",
                }}
              >
                <ShoppingCart size={30} />
              </div>

              <h3
                style={{
                  margin: 0,
                  fontSize: 22,
                  color: "#0f172a",
                  fontWeight: 800,
                }}
              >
                No hay productos en la venta
              </h3>
              <p
                style={{
                  margin: "8px auto 0",
                  maxWidth: 460,
                  color: "#64748b",
                  lineHeight: 1.6,
                }}
              >
                Selecciona un producto del inventario para comenzar.
              </p>
            </div>
          ) : (
            <div
              style={{
                overflowX: "auto",
                borderRadius: 22,
                border: "1px solid #e2e8f0",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: 840,
                  background: "#fff",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background:
                        "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
                    }}
                  >
                    <th style={thStyle}>Producto</th>
                    <th style={thStyle}>ID</th>
                    <th style={thStyle}>Cantidad</th>
                    <th style={thStyle}>Precio unitario</th>
                    <th style={thStyle}>Subtotal</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>Acción</th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((item, index) => {
                    const subtotal =
                      Number(item.cantidad) * Number(item.precio_unitario);

                    return (
                      <tr key={index} style={{ borderTop: "1px solid #eef2f7" }}>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 800, color: "#0f172a" }}>
                            {item.nombre}
                          </div>
                          <div
                            style={{
                              fontSize: 13,
                              color: "#64748b",
                              marginTop: 3,
                            }}
                          >
                            Código: {item.codigo}
                            {item.presentacion ? ` | ${item.presentacion}` : ""}
                          </div>
                        </td>

                        <td style={tdStyle}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              minWidth: 88,
                              padding: "8px 12px",
                              borderRadius: 999,
                              background: "#f1f5f9",
                              color: "#0f172a",
                              fontWeight: 800,
                              fontSize: 13,
                            }}
                          >
                            {item.producto_id}
                          </span>
                        </td>

                        <td style={tdStyle}>{item.cantidad}</td>
                        <td style={tdStyle}>{money(item.precio_unitario)}</td>
                        <td style={tdStyle}>
                          <span
                            style={{
                              fontWeight: 900,
                              color: "#16a34a",
                              fontSize: 16,
                            }}
                          >
                            {money(subtotal)}
                          </span>
                        </td>

                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={() => eliminarItem(index)}
                            style={dangerButtonStyle}
                          >
                            <Trash2 size={16} />
                            Quitar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot>
                  <tr
                    style={{
                      background: "#fafcff",
                      borderTop: "1px solid #e2e8f0",
                    }}
                  >
                    <td
                      colSpan={4}
                      style={{
                        padding: "18px 20px",
                        textAlign: "right",
                        fontWeight: 800,
                        color: "#334155",
                      }}
                    >
                      Total general
                    </td>
                    <td
                      style={{
                        padding: "18px 20px",
                        fontWeight: 900,
                        fontSize: 22,
                        color: "#16a34a",
                      }}
                    >
                      {money(total)}
                    </td>
                    <td style={{ padding: "18px 20px" }} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      <style>
        {`
          .spin-icon {
            animation: spin 1s linear infinite;
          }

          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }

          @media (max-width: 980px) {
            div[style*="grid-template-columns: 1.3fr 0.7fr"] {
              grid-template-columns: 1fr !important;
            }
          }

          @media (max-width: 860px) {
            div[style*="grid-template-columns: 2fr 1fr 1fr 1fr auto"] {
              grid-template-columns: 1fr !important;
            }

            div[style*="grid-template-columns: repeat(4, 1fr)"] {
              grid-template-columns: 1fr 1fr !important;
            }
          }

          @media (max-width: 640px) {
            section[style] {
              padding: 16px !important;
            }

            div[style*="grid-template-columns: repeat(4, 1fr)"] {
              grid-template-columns: 1fr !important;
            }
          }

          input:focus,
          select:focus {
            outline: none;
            border-color: #60a5fa !important;
            box-shadow: 0 0 0 4px rgba(96,165,250,0.18);
          }
        `}
      </style>
    </section>
  );
}

function InfoBox({ icon, title, value }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 18,
        background: "#fff",
        border: "1px solid #e2e8f0",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: "#64748b",
          fontSize: 12,
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        {icon}
        {title}
      </div>
      <div
        style={{
          color: "#0f172a",
          fontWeight: 800,
          fontSize: 15,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

const labelStyle = {
  display: "block",
  marginBottom: 8,
  fontSize: 13,
  fontWeight: 700,
  color: "#334155",
};

const inputStyle = {
  width: "100%",
  height: 52,
  borderRadius: 16,
  border: "1px solid #dbe2ea",
  background: "#f8fafc",
  padding: "0 14px",
  fontSize: 15,
  color: "#0f172a",
  boxSizing: "border-box",
};

const payButtonStyle = {
  height: 46,
  borderRadius: 14,
  border: "1px solid #dbe2ea",
  background: "#f8fafc",
  color: "#0f172a",
  fontWeight: 800,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
};

const activePayButtonStyle = {
  background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
  color: "#fff",
  border: "1px solid #2563eb",
  boxShadow: "0 10px 20px rgba(37,99,235,0.20)",
};

const primaryButtonStyle = {
  height: 52,
  border: "none",
  borderRadius: 16,
  padding: "0 20px",
  background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
  color: "#fff",
  fontWeight: 800,
  fontSize: 15,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  boxShadow: "0 14px 28px rgba(37,99,235,0.25)",
};

const successButtonStyle = {
  border: "none",
  borderRadius: 18,
  padding: "16px 18px",
  background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
  color: "#fff",
  fontWeight: 800,
  fontSize: 15,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  boxShadow: "0 16px 30px rgba(22,163,74,0.24)",
};

const dangerButtonStyle = {
  border: "none",
  borderRadius: 14,
  padding: "10px 14px",
  background: "#fee2e2",
  color: "#b91c1c",
  fontWeight: 700,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

const thStyle = {
  textAlign: "left",
  padding: "16px 20px",
  fontSize: 13,
  fontWeight: 800,
  color: "#475569",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const tdStyle = {
  padding: "18px 20px",
  fontSize: 15,
  color: "#0f172a",
  verticalAlign: "middle",
};