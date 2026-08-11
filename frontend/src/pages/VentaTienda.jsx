import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ShoppingCart,
  Package,
  Boxes,
  Trash2,
  Plus,
  Loader2,
  CheckCircle2,
  Store,
  ClipboardList,
  Search,
  ScanSearch,
  CreditCard,
  Banknote,
  ReceiptText,
  UserRound,
  ChevronDown,
  ChevronUp,
  Wallet,
  Users,
  Tag,
  Hash,
  Building2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ventasTienda } from "../api/ventasTienda";
import { stockApi } from "../lib/stock";
import { clientesApi } from "../lib/clientes";
import { getSession } from "../lib/auth";

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

function normalizeRole(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

function wordsOf(value) {
  return normalizeText(value)
    .split(/\s+/)
    .filter(Boolean);
}

function scoreProducto(prod, rawTerm, mode = "todos") {
  const term = normalizeText(rawTerm);
  if (!term) return 0;

  const nombre = normalizeText(prod.nombre);
  const codigo = normalizeText(prod.codigo);
  const id = normalizeText(prod.producto_id);
  const presentacion = normalizeText(prod.presentacion);
  const sucursal = normalizeText(prod.ubicacion_nombre);

  const target =
    mode === "nombre"
      ? nombre
      : mode === "codigo"
      ? codigo
      : mode === "id"
      ? id
      : mode === "presentacion"
      ? presentacion
      : mode === "sucursal"
      ? sucursal
      : normalizeText(`${nombre} ${codigo} ${id} ${presentacion} ${sucursal}`);

  if (!target.includes(term)) return -1;

  let score = 0;

  if (id === term) score += 1000;
  if (codigo === term) score += 900;
  if (nombre === term) score += 850;
  if (presentacion === term) score += 650;
  if (sucursal === term) score += 500;

  if (id.startsWith(term)) score += 500;
  if (codigo.startsWith(term)) score += 450;
  if (nombre.startsWith(term)) score += 400;
  if (presentacion.startsWith(term)) score += 250;
  if (sucursal.startsWith(term)) score += 180;

  const termWords = wordsOf(term);
  const targetWords = wordsOf(target);

  for (const word of termWords) {
    if (targetWords.includes(word)) score += 22;
    if (target.startsWith(word)) score += 12;
    if (target.includes(word)) score += 8;
  }

  score += Math.max(0, 40 - target.indexOf(term));
  score += Math.max(0, 25 - Math.abs(target.length - term.length));

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

function formatDate(value) {
  if (!value) return new Date().toLocaleString();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function safeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getMetodoPagoLabel(value) {
  if (value === "tarjeta") return "Tarjeta";
  if (value === "cuotas") return "Crédito";
  return "Efectivo";
}

function extractArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  return [];
}

function getErrorMessage(err, fallback = "Ocurrió un error") {
  const data = err?.response?.data;

  if (data?.errors && typeof data.errors === "object") {
    const firstKey = Object.keys(data.errors)[0];
    const firstVal = firstKey ? data.errors[firstKey] : null;

    if (Array.isArray(firstVal) && firstVal[0]) return firstVal[0];
    if (typeof firstVal === "string" && firstVal.trim()) return firstVal;
  }

  if (typeof data?.message === "string" && data.message.trim()) {
    return data.message;
  }

  if (typeof err?.message === "string" && err.message.trim()) {
    return err.message;
  }

  return fallback;
}

function imprimirTicketVenta({
  venta = null,
  items = [],
  total = 0,
  metodoPago = "",
  nombreComprador = "",
  clienteNombre = "",
  saldoPendiente = 0,
}) {
  const fecha =
    venta?.creado_en ||
    venta?.fecha ||
    venta?.created_at ||
    new Date().toISOString();

  const codigo = venta?.codigo || venta?.id || `VT-${new Date().getTime()}`;

  const html = `
    <!doctype html>
    <html lang="es">
    <head>
      <meta charset="utf-8" />
      <title>Ticket venta #${safeHtml(codigo)}</title>
      <style>
        * { box-sizing: border-box; }
        html, body {
          margin: 0;
          padding: 0;
          background: #ffffff;
          color: #111827;
          font-family: Arial, Helvetica, sans-serif;
        }
        body { padding: 12px; }
        .ticket { width: 80mm; margin: 0 auto; }
        .center { text-align: center; }
        .title { font-size: 20px; font-weight: 800; margin-bottom: 2px; }
        .subtitle { font-size: 12px; color: #4b5563; margin-bottom: 10px; }
        .box {
          border-top: 1px dashed #9ca3af;
          border-bottom: 1px dashed #9ca3af;
          padding: 8px 0;
          margin: 8px 0;
        }
        .row {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          margin: 4px 0;
          font-size: 12px;
        }
        .label { color: #4b5563; }
        .line-item {
          padding: 7px 0;
          border-bottom: 1px dashed #d1d5db;
        }
        .prod {
          font-size: 13px;
          font-weight: 700;
          margin-bottom: 4px;
        }
        .muted {
          color: #6b7280;
          font-size: 11px;
        }
        .totals {
          margin-top: 10px;
          border-top: 2px solid #111827;
          padding-top: 8px;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          font-size: 18px;
          font-weight: 800;
        }
        .footer {
          margin-top: 14px;
          text-align: center;
          font-size: 11px;
          color: #6b7280;
        }
        @media print {
          body { padding: 0; }
          .ticket { width: 80mm; }
        }
      </style>
    </head>
    <body>
      <div class="ticket">
        <div class="center">
          <div class="title">PLASTIMAX</div>
          <div class="subtitle">Ticket de venta</div>
        </div>

        <div class="box">
          <div class="row"><span class="label">Venta:</span><strong>#${safeHtml(codigo)}</strong></div>
          <div class="row"><span class="label">Fecha:</span><strong>${safeHtml(formatDate(fecha))}</strong></div>
          <div class="row"><span class="label">Comprador:</span><strong>${safeHtml(nombreComprador || clienteNombre || "Consumidor final")}</strong></div>
          <div class="row"><span class="label">Pago:</span><strong>${safeHtml(getMetodoPagoLabel(metodoPago))}</strong></div>
          ${
            metodoPago === "cuotas"
              ? `
                <div class="row"><span class="label">Saldo pendiente:</span><strong>${safeHtml(
                  money(saldoPendiente || total)
                )}</strong></div>
              `
              : ""
          }
        </div>

        <div>
          ${items
            .map(
              (d) => `
            <div class="line-item">
              <div class="prod">${safeHtml(
                `${d.nombre || "Producto"}${
                  d.presentacion ? ` - ${d.presentacion}` : ""
                }`
              )}</div>
              <div class="row">
                <span class="muted">${safeHtml(
                  Number(d.cantidad || 0)
                )} x ${safeHtml(money(d.precio_unitario))}</span>
                <strong>${safeHtml(
                  money(Number(d.cantidad || 0) * Number(d.precio_unitario || 0))
                )}</strong>
              </div>
            </div>
          `
            )
            .join("")}
        </div>

        <div class="totals">
          <div class="total-row">
            <span>Total</span>
            <span>${safeHtml(money(total))}</span>
          </div>
        </div>

        <div class="footer">
          Impreso el ${safeHtml(new Date().toLocaleString())}<br/>
          Gracias por su compra
        </div>
      </div>

      <script>
        window.onload = function() {
          window.print();
          window.onafterprint = function() {
            window.close();
          };
        };
      </script>
    </body>
    </html>
  `;

  const win = window.open("", "_blank", "width=420,height=760");
  if (!win) {
    alert("El navegador bloqueó la ventana de impresión.");
    return;
  }

  win.document.open();
  win.document.write(html);
  win.document.close();
}

export default function VentaTienda() {
  const nav = useNavigate();

  const session = getSession?.() || {};
  const sessionUser = session?.user || session || {};
  const role = normalizeRole(sessionUser?.rol || sessionUser?.role || "");
  const isSuperAdmin = role === "super_admin";
  const isVendedorTienda = role === "vendedor_tienda";

  const [inventario, setInventario] = useState([]);
  const [items, setItems] = useState([]);
  const [expandedItems, setExpandedItems] = useState({});

  const [productoPrecioId, setProductoPrecioId] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [q, setQ] = useState("");
  const [searchMode, setSearchMode] = useState("todos");
  const [metodoPago, setMetodoPago] = useState("efectivo");
  const [nombreComprador, setNombreComprador] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [clientes, setClientes] = useState([]);
  const [referenciaPago, setReferenciaPago] = useState("");
  const [usaMontoVariable, setUsaMontoVariable] = useState(false);
  const [montoVariable, setMontoVariable] = useState("");

  const [ubicacionId, setUbicacionId] = useState(
    isSuperAdmin
      ? ""
      : String(sessionUser?.ubicacion_id || sessionUser?.sucursal_id || "")
  );

  const [mostrarNuevoCliente, setMostrarNuevoCliente] = useState(false);
  const [guardandoCliente, setGuardandoCliente] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState({
    nombre: "",
    propietario: "",
    telefono: "",
    direccion: "",
    referencia: "",
  });

  const [loadingInventario, setLoadingInventario] = useState(true);
  const [loadingVenta, setLoadingVenta] = useState(false);
  const [loadingClientes, setLoadingClientes] = useState(false);

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);

  const searchWrapRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    cargarClientes();
  }, []);

  useEffect(() => {
    cargarInventario();
  }, [ubicacionId]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (!searchWrapRef.current?.contains(e.target)) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function cargarClientes() {
    try {
      setLoadingClientes(true);

      const resp = await clientesApi.list({
        activo: 1,
        per_page: 500,
      });

      const rows = extractArray(resp);
      setClientes(rows);
    } catch (error) {
      console.error("ERROR CLIENTES:", error);
      setClientes([]);
    } finally {
      setLoadingClientes(false);
    }
  }

  async function cargarInventario() {
    try {
      setLoadingInventario(true);

      const params = {
        q: "",
        page: 1,
        per_page: 200,
      };

      if (ubicacionId) {
        params.ubicacion_id = ubicacionId;
      }

      const resp = await stockApi.list(params);

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
        const precioVenta = Number(row?.precio_venta ?? row?.precio ?? 0);

        return {
          key:
            row?.id ??
            `${row?.producto_id ?? index}-${row?.producto_precio_id ?? index}`,
          producto_id: String(row?.producto_id ?? ""),
          producto_precio_id: Number(row?.producto_precio_id ?? 0),
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
            row?.cantidad ??
              row?.stock ??
              row?.existencia ??
              row?.cantidad_base ??
              0
          ),
          precio: precioVenta,
          presentacion: row?.presentacion || "",
          categoria: row?.categoria || "",
          ubicacion_id: row?.ubicacion_id ?? null,
          ubicacion_nombre:
            row?.ubicacion_nombre ||
            row?.sucursal_nombre ||
            row?.ubicacion?.nombre ||
            "",
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

  async function handleCrearCliente() {
    if (!nuevoCliente.nombre.trim()) {
      alert("Debes ingresar el nombre de la tienda.");
      return;
    }

    try {
      setGuardandoCliente(true);

      const payload = {
        nombre: nuevoCliente.nombre.trim(),
        propietario: nuevoCliente.propietario.trim() || "",
        telefono: nuevoCliente.telefono.trim() || "",
        direccion: nuevoCliente.direccion.trim() || "Sin dirección",
        referencia: nuevoCliente.referencia.trim() || "",
        activo: 1,
      };

      const res = await clientesApi.create(payload);
      const creado = res?.data?.data || res?.data || res;

      await cargarClientes();

      if (creado?.id) {
        setClienteId(String(creado.id));
      }

      setMostrarNuevoCliente(false);
      setNuevoCliente({
        nombre: "",
        propietario: "",
        telefono: "",
        direccion: "",
        referencia: "",
      });

      alert("Cliente creado correctamente.");
    } catch (error) {
      console.error("ERROR CREANDO CLIENTE:", error);
      alert(getErrorMessage(error, "No se pudo crear el cliente."));
    } finally {
      setGuardandoCliente(false);
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
        _score: scoreProducto(prod, term, searchMode),
      }))
      .filter((prod) => prod._score > -1)
      .sort((a, b) => {
        if (b._score !== a._score) return b._score - a._score;
        if (Number(b.stock) !== Number(a.stock)) {
          return Number(b.stock) - Number(a.stock);
        }
        return String(a.nombre).localeCompare(String(b.nombre));
      })
      .slice(0, 12);
  }, [inventario, q, searchMode]);

  useEffect(() => {
    setSelectedSuggestionIndex(0);
  }, [q, searchMode]);

  const productoSeleccionado = useMemo(() => {
    return (
      inventario.find(
        (p) => String(p.producto_precio_id) === String(productoPrecioId)
      ) || null
    );
  }, [inventario, productoPrecioId]);

  const clienteSeleccionado = useMemo(() => {
    return clientes.find((c) => String(c.id) === String(clienteId)) || null;
  }, [clientes, clienteId]);

  const subtotalPreview = useMemo(() => {
    if (!productoSeleccionado) return 0;

    const cantidadNum = Number(cantidad || 0);
    const precioNum = usaMontoVariable
      ? Number(montoVariable || 0)
      : Number(productoSeleccionado?.precio || 0);

    if (cantidadNum <= 0 || precioNum <= 0) return 0;

    return cantidadNum * precioNum;
  }, [productoSeleccionado, cantidad, usaMontoVariable, montoVariable]);

  const total = useMemo(() => {
    return items.reduce((acc, item) => {
      return acc + Number(item.cantidad) * Number(item.precio_unitario);
    }, 0);
  }, [items]);

  function seleccionarProducto(prodOrId) {
    const prod =
      typeof prodOrId === "string"
        ? inventario.find(
            (p) => String(p.producto_precio_id) === String(prodOrId)
          )
        : prodOrId;

    if (!prod) return;

    setProductoPrecioId(String(prod.producto_precio_id));
    setQ(`${prod.nombre}${prod.presentacion ? ` - ${prod.presentacion}` : ""}`);
    setUsaMontoVariable(false);
    setMontoVariable(String(prod.precio || ""));
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

  function toggleItemDetail(key) {
    setExpandedItems((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  function precioFinalSeleccionado(prod) {
    if (!prod) return 0;
    return usaMontoVariable
      ? Number(montoVariable || 0)
      : Number(prod.precio || 0);
  }

  function agregarItem() {
    if (!productoPrecioId) {
      alert("Selecciona un producto.");
      return;
    }

    if (!cantidad || Number(cantidad) <= 0) {
      alert("La cantidad debe ser mayor a 0.");
      return;
    }

    const prod = inventario.find(
      (p) => String(p.producto_precio_id) === String(productoPrecioId)
    );

    if (!prod) {
      alert("El producto no existe en el inventario.");
      return;
    }

    const cantidadNum = Number(cantidad);
    const precioNum = precioFinalSeleccionado(prod);

    if (!precioNum || Number(precioNum) <= 0) {
      alert("El producto no tiene un precio válido.");
      return;
    }

    if (cantidadNum > Number(prod.stock)) {
      alert(`Stock insuficiente. Disponible: ${prod.stock}`);
      return;
    }

    const indexExistente = items.findIndex(
      (item) => Number(item.producto_precio_id) === Number(prod.producto_precio_id)
    );

    if (indexExistente >= 0) {
      const nuevos = [...items];
      const nuevaCantidad = Number(nuevos[indexExistente].cantidad) + cantidadNum;

      if (nuevaCantidad > Number(prod.stock)) {
        alert(`Stock insuficiente. Disponible: ${prod.stock}`);
        return;
      }

      nuevos[indexExistente] = {
        ...nuevos[indexExistente],
        cantidad: nuevaCantidad,
        precio_unitario: precioNum,
        es_monto_variable: usaMontoVariable ? 1 : 0,
        precio_catalogo: Number(prod.precio || 0),
      };

      setItems(nuevos);
    } else {
      setItems((prev) => [
        ...prev,
        {
          key: `${prod.producto_id}-${prod.producto_precio_id}`,
          producto_id: String(prod.producto_id),
          producto_precio_id: Number(prod.producto_precio_id),
          nombre: prod.nombre,
          codigo: prod.codigo,
          presentacion: prod.presentacion,
          cantidad: cantidadNum,
          precio_unitario: precioNum,
          precio_catalogo: Number(prod.precio || 0),
          es_monto_variable: usaMontoVariable ? 1 : 0,
          ubicacion_id: prod.ubicacion_id ?? null,
          ubicacion_nombre: prod.ubicacion_nombre ?? "",
        },
      ]);
    }

    setProductoPrecioId("");
    setCantidad(1);
    setQ("");
    setUsaMontoVariable(false);
    setMontoVariable("");
    setShowSuggestions(false);
    searchInputRef.current?.focus();
  }

  function eliminarItem(index) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function finalizarVenta() {
    if (items.length === 0) {
      alert("Agrega al menos un producto.");
      return;
    }

    if (isVendedorTienda && !clienteId) {
      alert("Selecciona el cliente del pedido.");
      return;
    }

    if (!isVendedorTienda && !nombreComprador.trim() && metodoPago !== "cuotas") {
      alert("Ingresa el nombre del comprador.");
      return;
    }

    if (!isVendedorTienda && !metodoPago) {
      alert("Selecciona un método de pago.");
      return;
    }

    if (!isVendedorTienda && metodoPago === "cuotas" && !clienteId) {
      alert("Selecciona un cliente para crédito.");
      return;
    }

    if (isSuperAdmin && !ubicacionId) {
      alert("Selecciona la sucursal donde se realizará la venta.");
      return;
    }

    try {
      setLoadingVenta(true);

      const payload = {
        metodo_pago: isVendedorTienda ? null : metodoPago,
        nombre_comprador: isVendedorTienda
          ? clienteSeleccionado?.nombre || ""
          : metodoPago === "cuotas"
            ? clienteSeleccionado?.nombre || nombreComprador.trim() || ""
            : nombreComprador.trim(),
        cliente_id:
          isVendedorTienda || metodoPago === "cuotas" ? Number(clienteId) : null,
        referencia_pago: isVendedorTienda ? null : referenciaPago.trim() || null,
        ubicacion_id: ubicacionId ? Number(ubicacionId) : null,
        items: items.map((item) => ({
          producto_id: Number(item.producto_id),
          producto_precio_id: Number(item.producto_precio_id),
          presentacion: item.presentacion,
          cantidad: Number(item.cantidad),
          precio_unitario: Number(item.precio_unitario),
          es_monto_variable: item.es_monto_variable ? 1 : 0,
        })),
      };

      const resp = await ventasTienda.crear(payload);
      const ventaCreada = resp?.data || resp?.venta || resp || null;

      if (isVendedorTienda) {
        alert("Pedido registrado y enviado a Caja para cobro.");
      } else {
        imprimirTicketVenta({
          venta: ventaCreada,
          items,
          total,
          metodoPago,
          nombreComprador:
            metodoPago === "cuotas"
              ? clienteSeleccionado?.nombre || nombreComprador.trim()
              : nombreComprador.trim(),
          clienteNombre: clienteSeleccionado?.nombre || "",
          saldoPendiente:
            metodoPago === "cuotas"
              ? Number(ventaCreada?.saldo_pendiente ?? total)
              : 0,
        });

        alert(
          metodoPago === "cuotas"
            ? "Venta a crédito realizada correctamente."
            : "Venta realizada correctamente."
        );
      }

      setItems([]);
      setExpandedItems({});
      setMetodoPago("efectivo");
      setNombreComprador("");
      setClienteId("");
      setReferenciaPago("");
      setMostrarNuevoCliente(false);

      await cargarInventario();
      await cargarClientes();
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
    <section className="venta-tienda-page">
      <div className="venta-shell">
        <div className="venta-hero">
          <div className="venta-hero-content">
            <div>
              <div className="venta-chip-top">
                <Store size={16} />
                {isVendedorTienda
                  ? "Pedido conectado al inventario"
                  : "Venta conectada al inventario"}
              </div>

              <h1 className="venta-hero-title">
                {isVendedorTienda ? "Pedidos tienda" : "Ventas tienda"}
              </h1>

              <p className="venta-hero-text">
                {isVendedorTienda
                  ? "Crea el pedido para el cliente y envíalo a Caja para realizar el cobro."
                  : "Registra ventas por sucursal, indicando comprador, cliente y método de pago."}
              </p>
            </div>

            <div className="venta-hero-side">
              {isSuperAdmin ? (
                <div className="venta-hero-box">
                  <div className="venta-hero-box-label">Sucursal a visualizar</div>

                  <select
                    value={ubicacionId}
                    onChange={(e) => setUbicacionId(e.target.value)}
                    className="venta-hero-select"
                  >
                    <option value="">Todas las tiendas</option>
                    <option value="1">Tienda 1</option>
                    <option value="2">Tienda 2</option>
                  </select>
                </div>
              ) : null}

              <div className="venta-hero-box">
                <div className="venta-hero-box-label">Total actual</div>
                <div className="venta-hero-total">{money(total + subtotalPreview)}</div>
              </div>

              <button
                type="button"
                onClick={() => nav("/registro-ventas-tienda")}
                className="venta-hero-btn"
              >
                <ReceiptText size={18} />
                Ver mi registro del día
              </button>
            </div>
          </div>
        </div>

        <div className="venta-main-grid">
          <div className="venta-card">
            <div className="venta-card-head">
              <div className="venta-card-icon blue">
                <Package size={22} />
              </div>

              <div>
                <h2 className="venta-card-title">Agregar producto</h2>
                <p className="venta-card-subtitle">
                  Busca por nombre, código, presentación o ID y selecciona rápido.
                </p>
              </div>
            </div>

            {loadingInventario ? (
              <div style={loaderWrapStyle}>
                <Loader2 size={18} className="spin-icon" />
                Cargando inventario...
              </div>
            ) : (
              <>
                <div className="venta-block">
                  <label style={labelStyle}>Buscador inteligente</label>

                  <div ref={searchWrapRef} style={{ position: "relative" }}>
                    <div style={{ position: "relative" }}>
                      <Search size={18} style={leadingSearchIconStyle} />

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

                      <ScanSearch size={18} style={trailingSearchIconStyle} />
                    </div>

                    <div className="venta-search-modes">
                      <button
                        type="button"
                        className={searchMode === "todos" ? "chip chip-active" : "chip"}
                        onClick={() => setSearchMode("todos")}
                      >
                        Todo
                      </button>
                      <button
                        type="button"
                        className={searchMode === "nombre" ? "chip chip-active" : "chip"}
                        onClick={() => setSearchMode("nombre")}
                      >
                        Nombre
                      </button>
                      <button
                        type="button"
                        className={searchMode === "codigo" ? "chip chip-active" : "chip"}
                        onClick={() => setSearchMode("codigo")}
                      >
                        Código
                      </button>
                      <button
                        type="button"
                        className={searchMode === "presentacion" ? "chip chip-active" : "chip"}
                        onClick={() => setSearchMode("presentacion")}
                      >
                        Presentación
                      </button>
                      <button
                        type="button"
                        className={searchMode === "id" ? "chip chip-active" : "chip"}
                        onClick={() => setSearchMode("id")}
                      >
                        ID
                      </button>
                    </div>

                    {showSuggestions && (
                      <div style={suggestionsStyle}>
                        {inventarioFiltrado.length === 0 ? (
                          <div style={suggestionEmptyStyle}>
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
                                  ...suggestionButtonStyle,
                                  background: active
                                    ? "linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%)"
                                    : "#fff",
                                  borderBottom:
                                    index !== inventarioFiltrado.length - 1
                                      ? "1px solid #eef2f7"
                                      : "none",
                                }}
                              >
                                <div style={suggestionTopStyle}>
                                  <div style={suggestionTitleStyle}>
                                    {highlightText(prod.nombre, q)}
                                    {prod.presentacion ? ` - ${prod.presentacion}` : ""}
                                  </div>

                                  <div
                                    style={{
                                      ...stockBadgeStyle,
                                      background:
                                        Number(prod.stock) > 0 ? "#ecfdf5" : "#fef2f2",
                                      color:
                                        Number(prod.stock) > 0 ? "#047857" : "#b91c1c",
                                    }}
                                  >
                                    Stock: {prod.stock}
                                  </div>
                                </div>

                                <div style={suggestionMetaStyle}>
                                  <span>ID: {highlightText(prod.producto_id, q)}</span>
                                  <span>Código: {highlightText(prod.codigo, q)}</span>
                                  {prod.ubicacion_nombre ? (
                                    <span>Sucursal: {prod.ubicacion_nombre}</span>
                                  ) : null}
                                  <span>Venta: {money(prod.precio)}</span>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {productoSeleccionado ? (
                  <div style={selectedProductCardStyle}>
                    <div style={selectedProductHeaderStyle}>
                      <div>
                        <div style={selectedProductLabelStyle}>Producto seleccionado</div>
                        <div style={selectedProductNameStyle}>
                          {productoSeleccionado.nombre}
                          {productoSeleccionado.presentacion
                            ? ` - ${productoSeleccionado.presentacion}`
                            : ""}
                        </div>
                      </div>

                      <div
                        style={{
                          ...stockBadgeStyle,
                          background:
                            Number(productoSeleccionado.stock) > 0 ? "#ecfdf5" : "#fef2f2",
                          color:
                            Number(productoSeleccionado.stock) > 0 ? "#047857" : "#b91c1c",
                          fontSize: 13,
                          padding: "8px 12px",
                        }}
                      >
                        Stock disponible: {productoSeleccionado.stock}
                      </div>
                    </div>

                    <div style={selectedProductMetaGridStyle}>
                      <MiniMeta
                        icon={<Hash size={15} />}
                        label="Producto ID"
                        value={productoSeleccionado.producto_id}
                      />
                      <MiniMeta
                        icon={<Tag size={15} />}
                        label="Presentación ID"
                        value={productoSeleccionado.producto_precio_id}
                      />
                      <MiniMeta
                        icon={<Package size={15} />}
                        label="Código"
                        value={productoSeleccionado.codigo}
                      />
                      <MiniMeta
                        icon={<Building2 size={15} />}
                        label="Sucursal"
                        value={productoSeleccionado.ubicacion_nombre || "No definida"}
                      />
                    </div>
                  </div>
                ) : (
                  <div style={selectedPlaceholderStyle}>
                    <Package size={18} />
                    Selecciona un producto desde el buscador para ver sus detalles.
                  </div>
                )}


                {productoSeleccionado && (
                  <div style={montoVariableBoxStyle}>
                    <label style={montoVariableCheckStyle}>
                      <input
                        type="checkbox"
                        checked={usaMontoVariable}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setUsaMontoVariable(checked);
                          if (checked && !montoVariable) {
                            setMontoVariable(String(productoSeleccionado?.precio || ""));
                          }
                        }}
                      />
                      Usar monto variable
                    </label>

                    {usaMontoVariable && (
                      <div style={montoVariableInputWrapStyle}>
                        <span style={montoVariableLabelStyle}>Precio solicitado Q</span>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={montoVariable}
                          onChange={(e) => setMontoVariable(e.target.value)}
                          placeholder="0.00"
                          style={montoVariableInputStyle}
                        />
                      </div>
                    )}
                  </div>
                )}

                <div style={productEntryGridStyle}>
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
                    <label style={labelStyle}>Precio venta</label>
                    <input
                      type="text"
                      value={productoSeleccionado ? money(productoSeleccionado.precio) : ""}
                      readOnly
                      disabled
                      style={disabledInputStyle}
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
                      style={disabledInputStyle}
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
              <div style={selectedInfoGridStyle}>
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
                  icon={<Package size={16} />}
                  title="Precio venta"
                  value={money(productoSeleccionado.precio)}
                />
              </div>
            )}
          </div>

          <div style={summaryPanelStyle}>
            <div style={summaryHeaderStyle}>
              <div style={summaryIconStyle}>
                <ReceiptText size={22} />
              </div>

              <div>
                <h2 style={summaryTitleStyle}>Resumen</h2>
                <p style={summaryTextStyle}>Estado actual de la venta.</p>
              </div>
            </div>

            {!isVendedorTienda ? <div style={cardBlockStyle}>
              <label style={labelStyle}>
                {metodoPago === "cuotas" ? "Nombre de referencia" : "Nombre del comprador"}
              </label>
              <div style={{ position: "relative" }}>
                <UserRound size={18} style={leadingIconStyle} />
                <input
                  type="text"
                  value={nombreComprador}
                  onChange={(e) => setNombreComprador(e.target.value)}
                  placeholder={
                    metodoPago === "cuotas"
                      ? "Ej. nombre visible en ticket"
                      : "Ej. Juan Pérez"
                  }
                  style={{
                    ...inputStyle,
                    paddingLeft: 42,
                  }}
                />
              </div>
            </div> : null}

            {!isVendedorTienda ? <div style={cardBlockStyle}>
              <label style={labelStyle}>Método de pago</label>
              <div style={payGridStyle}>
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

                <button
                  type="button"
                  onClick={() => setMetodoPago("cuotas")}
                  style={{
                    ...payButtonStyle,
                    ...(metodoPago === "cuotas" ? activePayButtonStyle : {}),
                  }}
                >
                  <Wallet size={18} />
                  Crédito
                </button>
              </div>
            </div> : null}

            {(isVendedorTienda || metodoPago === "cuotas") && (
              <>
                <div style={cardBlockStyle}>
                  <div style={cardBlockHeaderStyle}>
                    <label style={{ ...labelStyle, marginBottom: 0 }}>
                      {isVendedorTienda ? "Cliente del pedido" : "Cliente"}
                    </label>

                    {!isVendedorTienda ? (
                      <button
                        type="button"
                        onClick={() => setMostrarNuevoCliente((v) => !v)}
                        style={miniButtonStyle}
                      >
                        {mostrarNuevoCliente ? "Cancelar" : "Nuevo cliente"}
                      </button>
                    ) : null}
                  </div>

                  {isVendedorTienda || !mostrarNuevoCliente ? (
                    <>
                      <div style={{ position: "relative" }}>
                        <Users size={18} style={leadingIconStyle} />
                        <select
                          value={clienteId}
                          onChange={(e) => setClienteId(e.target.value)}
                          style={{
                            ...inputStyle,
                            paddingLeft: 42,
                            appearance: "none",
                            background: "#f8fafc",
                          }}
                          disabled={loadingClientes}
                        >
                          <option value="">
                            {loadingClientes ? "Cargando clientes..." : "Selecciona cliente"}
                          </option>
                          {clientes.map((cliente) => (
                            <option key={cliente.id} value={cliente.id}>
                              {cliente.nombre}
                            </option>
                          ))}
                        </select>
                      </div>

                      {clienteSeleccionado ? (
                        <div style={clientPreviewStyle}>
                          <div>
                            <strong>Cliente:</strong> {clienteSeleccionado.nombre || "—"}
                          </div>
                          {clienteSeleccionado.propietario ? (
                            <div>
                              <strong>Propietario:</strong> {clienteSeleccionado.propietario}
                            </div>
                          ) : null}
                          {clienteSeleccionado.telefono ? (
                            <div>
                              <strong>Teléfono:</strong> {clienteSeleccionado.telefono}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      <input
                        type="text"
                        value={nuevoCliente.nombre}
                        onChange={(e) =>
                          setNuevoCliente((p) => ({ ...p, nombre: e.target.value }))
                        }
                        placeholder="Nombre tienda"
                        style={inputStyle}
                      />

                      <input
                        type="text"
                        value={nuevoCliente.propietario}
                        onChange={(e) =>
                          setNuevoCliente((p) => ({ ...p, propietario: e.target.value }))
                        }
                        placeholder="Propietario"
                        style={inputStyle}
                      />

                      <input
                        type="text"
                        value={nuevoCliente.telefono}
                        onChange={(e) =>
                          setNuevoCliente((p) => ({ ...p, telefono: e.target.value }))
                        }
                        placeholder="Teléfono"
                        style={inputStyle}
                      />

                      <textarea
                        rows={2}
                        value={nuevoCliente.direccion}
                        onChange={(e) =>
                          setNuevoCliente((p) => ({ ...p, direccion: e.target.value }))
                        }
                        placeholder="Dirección"
                        style={textareaStyle}
                      />

                      <input
                        type="text"
                        value={nuevoCliente.referencia}
                        onChange={(e) =>
                          setNuevoCliente((p) => ({ ...p, referencia: e.target.value }))
                        }
                        placeholder="Referencia"
                        style={inputStyle}
                      />

                      <button
                        type="button"
                        onClick={handleCrearCliente}
                        disabled={guardandoCliente}
                        style={{
                          ...successButtonStyle,
                          padding: "12px 16px",
                          borderRadius: 14,
                          boxShadow: "none",
                        }}
                      >
                        {guardandoCliente ? (
                          <>
                            <Loader2 size={18} className="spin-icon" />
                            Guardando cliente...
                          </>
                        ) : (
                          <>
                            <Plus size={18} />
                            Guardar cliente
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {!isVendedorTienda ? (
                  <div style={cardBlockStyle}>
                    <label style={labelStyle}>Referencia de crédito</label>
                    <input
                      type="text"
                      value={referenciaPago}
                      onChange={(e) => setReferenciaPago(e.target.value)}
                      placeholder="Ej. Crédito tienda, libreta, acuerdo verbal..."
                      style={inputStyle}
                    />
                  </div>
                ) : null}
              </>
            )}

            <div style={totalCardStyle}>
              <div style={totalCardLabelStyle}>
                {isVendedorTienda ? "Total del pedido" : "Total a cobrar"}
              </div>
              <div style={totalCardValueStyle}>{money(total + subtotalPreview)}</div>
              <div style={totalCardMetaStyle}>
                {items.length} {items.length === 1 ? "producto" : "productos"} agregados
              </div>
              {!isVendedorTienda ? (
                <div style={totalCardLineStyle}>
                  Método: {getMetodoPagoLabel(metodoPago)}
                </div>
              ) : null}
              {!isVendedorTienda ? (
                <div style={totalCardLineStyle}>
                  Comprador: {nombreComprador.trim() || "Sin ingresar"}
                </div>
              ) : null}
              {isSuperAdmin ? (
                <div style={totalCardLineStyle}>
                  Sucursal: {ubicacionId ? `Tienda ${ubicacionId}` : "Todas las tiendas"}
                </div>
              ) : null}
              {isVendedorTienda || metodoPago === "cuotas" ? (
                <div style={totalCardLineStyle}>
                  Cliente: {clienteSeleccionado?.nombre || "No seleccionado"}
                </div>
              ) : null}
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
                  {isVendedorTienda
                    ? "Enviar pedido a caja"
                    : metodoPago === "cuotas"
                    ? "Guardar venta a crédito"
                    : "Finalizar venta"}
                </>
              )}
            </button>
          </div>
        </div>

        <div style={itemsPanelStyle}>
          <div style={itemsPanelHeaderStyle}>
            <div>
              <h2 style={itemsPanelTitleStyle}>Productos en la venta</h2>
              <p style={itemsPanelTextStyle}>
                Revisa el detalle antes de confirmar.
              </p>
            </div>

            <div style={itemsBadgeStyle}>
              {items.length} {items.length === 1 ? "registro" : "registros"}
            </div>
          </div>

          {items.length === 0 ? (
            <div style={emptyWrapStyle}>
              <div style={emptyIconStyle}>
                <ShoppingCart size={30} />
              </div>

              <h3 style={emptyTitleStyle}>No hay productos en la venta</h3>
              <p style={emptyTextStyle}>
                Selecciona un producto del inventario para comenzar.
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {items.map((item, index) => {
                const subtotal =
                  Number(item.cantidad) * Number(item.precio_unitario);
                const isOpen = !!expandedItems[item.key || index];

                return (
                  <div key={item.key || index} style={itemCardStyle}>
                    <div style={itemCardHeaderStyle}>
                      <div>
                        <div style={itemNameStyle}>{item.nombre}</div>
                        <div style={itemMetaStyle}>
                          Código: {item.codigo}
                          {item.presentacion ? ` · ${item.presentacion}` : ""}
                          {item.ubicacion_nombre ? ` · ${item.ubicacion_nombre}` : ""}
                          {item.es_monto_variable ? " · Monto variable" : ""}
                        </div>
                      </div>

                      <div style={itemActionsStyle}>
                        <span style={salePillBlue}>
                          {item.cantidad} unidad(es)
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleItemDetail(item.key || index)}
                          style={secondaryButtonStyle}
                        >
                          {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          {isOpen ? "Ocultar detalle" : "Ver detalle"}
                        </button>
                        <button
                          type="button"
                          onClick={() => eliminarItem(index)}
                          style={dangerButtonStyle}
                        >
                          <Trash2 size={16} />
                          Quitar
                        </button>
                      </div>
                    </div>

                    {isOpen ? (
                      <div style={itemDetailGridStyle}>
                        <InfoBox
                          icon={<Package size={16} />}
                          title="Cantidad"
                          value={String(item.cantidad)}
                        />
                        <InfoBox
                          icon={<Package size={16} />}
                          title="Precio venta"
                          value={money(item.precio_unitario)}
                        />
                        <InfoBox
                          icon={<ReceiptText size={16} />}
                          title="Subtotal"
                          value={money(subtotal)}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style>
        {`
          .spin-icon {
            animation: spin 1s linear infinite;
          }

          .venta-tienda-page{
            min-height:100%;
            padding:28px;
          }

          .venta-shell{
            max-width:1280px;
            margin:0 auto;
            display:grid;
            gap:24px;
          }

          .venta-hero{
            position:relative;
            overflow:hidden;
            border-radius:28px;
            padding:30px 28px;
            background:
              linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.96) 45%, rgba(59,130,246,0.88) 100%);
            box-shadow:0 20px 60px rgba(15,23,42,0.20);
            border:1px solid rgba(255,255,255,0.10);
          }

          .venta-hero-content{
            position:relative;
            z-index:1;
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:20px;
            flex-wrap:wrap;
          }

          .venta-chip-top{
            display:inline-flex;
            align-items:center;
            gap:10px;
            padding:10px 14px;
            border-radius:999px;
            background:rgba(255,255,255,0.10);
            color:#e2e8f0;
            font-size:13px;
            font-weight:700;
            margin-bottom:16px;
          }

          .venta-hero-title{
            margin:0;
            color:#fff;
            font-size:clamp(28px, 4vw, 40px);
            font-weight:800;
            letter-spacing:-0.03em;
          }

          .venta-hero-text{
            margin:10px 0 0;
            color:rgba(255,255,255,0.78);
            font-size:15px;
            max-width:700px;
            line-height:1.6;
          }

          .venta-hero-side{
            min-width:280px;
            display:grid;
            gap:12px;
          }

          .venta-hero-box{
            border-radius:24px;
            padding:18px 20px;
            background:rgba(255,255,255,0.10);
            border:1px solid rgba(255,255,255,0.14);
          }

          .venta-hero-box-label{
            color:rgba(255,255,255,0.72);
            font-size:13px;
            margin-bottom:8px;
          }

          .venta-hero-select{
            width:100%;
            height:48px;
            border-radius:14px;
            border:1px solid rgba(255,255,255,0.18);
            background:rgba(255,255,255,0.14);
            color:#fff;
            padding:0 14px;
            font-weight:800;
          }

          .venta-hero-select option{
            color:#111827;
          }

          .venta-hero-total{
            color:#fff;
            font-weight:900;
            font-size:30px;
            letter-spacing:-0.03em;
          }

          .venta-hero-btn{
            border:none;
            border-radius:16px;
            height:48px;
            background:rgba(255,255,255,0.14);
            color:#fff;
            font-weight:800;
            cursor:pointer;
            display:inline-flex;
            align-items:center;
            justify-content:center;
            gap:10px;
          }

          .venta-main-grid{
            display:grid;
            grid-template-columns:1.3fr 0.7fr;
            gap:24px;
          }

          .venta-card{
            background:rgba(255,255,255,0.82);
            border-radius:28px;
            padding:24px;
            border:1px solid rgba(148,163,184,0.18);
            box-shadow:0 18px 45px rgba(15,23,42,0.08);
          }

          .venta-card-head{
            display:flex;
            align-items:center;
            gap:12px;
            margin-bottom:22px;
          }

          .venta-card-icon{
            width:46px;
            height:46px;
            border-radius:16px;
            display:grid;
            place-items:center;
            color:#fff;
          }

          .venta-card-icon.blue{
            background:linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          }

          .venta-card-title{
            margin:0;
            font-size:22px;
            font-weight:800;
            color:#0f172a;
          }

          .venta-card-subtitle{
            margin:4px 0 0;
            color:#64748b;
            font-size:14px;
          }

          .venta-block{
            margin-bottom:18px;
          }

          .venta-search-modes{
            margin-top:10px;
            display:flex;
            gap:8px;
            flex-wrap:wrap;
            align-items:center;
          }

          .chip{
            border:1px solid #dbe4f0;
            background:#fff;
            color:#334155;
            border-radius:999px;
            padding:8px 12px;
            cursor:pointer;
            font-weight:700;
            font-size:13px;
            transition:.18s ease;
          }

          .chip:hover{
            background:#f8fafc;
          }

          .chip-active{
            background:#eff6ff;
            border:1px solid #93c5fd;
            color:#1d4ed8;
            box-shadow:0 4px 14px rgba(37, 99, 235, 0.12);
          }

          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }

          @media (max-width: 980px) {
            .venta-main-grid{
              grid-template-columns:1fr;
            }
          }

          @media (max-width: 860px) {
            .selected-grid-4,
            .venta-grid-4,
            div[style*="grid-template-columns: repeat(4, 1fr)"] {
              grid-template-columns:1fr 1fr !important;
            }

            div[style*="grid-template-columns: repeat(3, 1fr)"] {
              grid-template-columns:1fr 1fr !important;
            }
          }

          @media (max-width: 720px) {
            div[style*="grid-template-columns: 1fr 1fr 1fr auto"] {
              grid-template-columns:1fr !important;
            }
          }

          @media (max-width: 640px) {
            .venta-tienda-page{
              padding:16px !important;
            }

            div[style*="grid-template-columns: repeat(4, 1fr)"] {
              grid-template-columns:1fr !important;
            }

            div[style*="grid-template-columns: repeat(3, 1fr)"] {
              grid-template-columns:1fr !important;
            }
          }

          input:focus,
          select:focus,
          textarea:focus {
            outline:none;
            border-color:#60a5fa !important;
            box-shadow:0 0 0 4px rgba(96,165,250,0.18);
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

function MiniMeta({ icon, label, value }) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid #dbe7f3",
        background: "#ffffff",
        padding: "12px 14px",
        minHeight: 72,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          color: "#64748b",
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        {icon}
        {label}
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 800,
          color: "#0f172a",
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

const disabledInputStyle = {
  ...inputStyle,
  background: "#eef2f7",
  color: "#0f172a",
  cursor: "not-allowed",
  fontWeight: 800,
  opacity: 1,
};

const textareaStyle = {
  width: "100%",
  borderRadius: 16,
  border: "1px solid #dbe2ea",
  background: "#f8fafc",
  padding: "12px 14px",
  fontSize: 15,
  color: "#0f172a",
  boxSizing: "border-box",
  resize: "vertical",
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
  justifyContent: "center",
  gap: 10,
  boxShadow: "0 14px 28px rgba(37,99,235,0.25)",
};

const secondaryButtonStyle = {
  height: 44,
  border: "1px solid #dbe2ea",
  borderRadius: 14,
  padding: "0 14px",
  background: "#fff",
  color: "#0f172a",
  fontWeight: 700,
  fontSize: 14,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  cursor: "pointer",
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

const salePillBlue = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "8px 12px",
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 800,
  border: "1px solid #bfdbfe",
  background: "#dbeafe",
  color: "#1d4ed8",
};

const miniButtonStyle = {
  border: "1px solid #dbe2ea",
  background: "#fff",
  borderRadius: 12,
  padding: "8px 12px",
  cursor: "pointer",
  fontWeight: 700,
  color: "#0f172a",
};

const loaderWrapStyle = {
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
};

const suggestionsStyle = {
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
};

const suggestionEmptyStyle = {
  padding: 18,
  color: "#64748b",
  fontSize: 14,
};

const suggestionButtonStyle = {
  width: "100%",
  border: "none",
  padding: "14px 16px",
  textAlign: "left",
  cursor: "pointer",
  display: "grid",
  gap: 6,
};

const suggestionTopStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  alignItems: "center",
};

const suggestionTitleStyle = {
  fontWeight: 800,
  color: "#0f172a",
  fontSize: 15,
};

const stockBadgeStyle = {
  flexShrink: 0,
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
};

const suggestionMetaStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  fontSize: 13,
  color: "#64748b",
};

const selectedProductCardStyle = {
  marginBottom: 18,
  borderRadius: 22,
  padding: 18,
  border: "1px solid #dbe7f3",
  background: "linear-gradient(180deg, #f8fbff 0%, #eef5ff 100%)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
};

const selectedProductHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  flexWrap: "wrap",
  marginBottom: 14,
};

const selectedProductLabelStyle = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "#2563eb",
  marginBottom: 6,
};

const selectedProductNameStyle = {
  fontSize: 20,
  fontWeight: 900,
  color: "#0f172a",
  lineHeight: 1.25,
  wordBreak: "break-word",
};

const selectedProductMetaGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 12,
};

const selectedPlaceholderStyle = {
  marginBottom: 18,
  borderRadius: 20,
  padding: "16px 18px",
  border: "1px dashed #cbd5e1",
  background: "#f8fafc",
  color: "#64748b",
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontWeight: 700,
};


const montoVariableBoxStyle = {
  marginBottom: 18,
  borderRadius: 18,
  padding: 14,
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  display: "grid",
  gap: 10,
};

const montoVariableCheckStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "#1e3a8a",
  fontWeight: 800,
  fontSize: 14,
  cursor: "pointer",
};

const montoVariableInputWrapStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const montoVariableLabelStyle = {
  color: "#1d4ed8",
  fontSize: 13,
  fontWeight: 800,
};

const montoVariableInputStyle = {
  width: 140,
  height: 42,
  borderRadius: 12,
  border: "1px solid #93c5fd",
  background: "#fff",
  padding: "0 12px",
  fontSize: 15,
  color: "#0f172a",
  fontWeight: 800,
  boxSizing: "border-box",
};

const productEntryGridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr auto",
  gap: 14,
  alignItems: "end",
};

const selectedInfoGridStyle = {
  marginTop: 18,
  padding: 18,
  borderRadius: 20,
  background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
  border: "1px solid #e2e8f0",
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 14,
};

const summaryPanelStyle = {
  background: "rgba(255,255,255,0.82)",
  borderRadius: 28,
  padding: 24,
  border: "1px solid rgba(148,163,184,0.18)",
  boxShadow: "0 18px 45px rgba(15,23,42,0.08)",
  display: "grid",
  gap: 16,
  alignContent: "start",
};

const summaryHeaderStyle = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const summaryIconStyle = {
  width: 46,
  height: 46,
  borderRadius: 16,
  display: "grid",
  placeItems: "center",
  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
  color: "#fff",
};

const summaryTitleStyle = {
  margin: 0,
  fontSize: 22,
  fontWeight: 800,
  color: "#0f172a",
};

const summaryTextStyle = {
  margin: "4px 0 0",
  color: "#64748b",
  fontSize: 14,
};

const cardBlockStyle = {
  borderRadius: 18,
  border: "1px solid #e2e8f0",
  background: "#fff",
  padding: 16,
};

const cardBlockHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "center",
  marginBottom: 8,
  flexWrap: "wrap",
};

const clientPreviewStyle = {
  marginTop: 10,
  padding: "10px 12px",
  borderRadius: 14,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  fontSize: 13,
  color: "#475569",
};

const leadingIconStyle = {
  position: "absolute",
  left: 14,
  top: "50%",
  transform: "translateY(-50%)",
  color: "#64748b",
};

const leadingSearchIconStyle = {
  position: "absolute",
  left: 14,
  top: "50%",
  transform: "translateY(-50%)",
  color: "#64748b",
};

const trailingSearchIconStyle = {
  position: "absolute",
  right: 14,
  top: "50%",
  transform: "translateY(-50%)",
  color: "#94a3b8",
};

const payGridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: 12,
};

const totalCardStyle = {
  borderRadius: 22,
  background:
    "linear-gradient(135deg, rgba(15,23,42,0.96) 0%, rgba(30,41,59,0.96) 100%)",
  padding: 22,
  color: "#fff",
};

const totalCardLabelStyle = {
  fontSize: 13,
  color: "rgba(255,255,255,0.70)",
  marginBottom: 10,
};

const totalCardValueStyle = {
  fontSize: 34,
  fontWeight: 900,
  letterSpacing: "-0.03em",
  marginBottom: 8,
};

const totalCardMetaStyle = {
  color: "rgba(255,255,255,0.70)",
  fontSize: 14,
};

const totalCardLineStyle = {
  color: "rgba(255,255,255,0.82)",
  fontSize: 14,
  marginTop: 6,
  fontWeight: 700,
};

const itemsPanelStyle = {
  background: "rgba(255,255,255,0.82)",
  borderRadius: 28,
  padding: 24,
  border: "1px solid rgba(148,163,184,0.18)",
  boxShadow: "0 18px 45px rgba(15,23,42,0.08)",
};

const itemsPanelHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  flexWrap: "wrap",
  marginBottom: 20,
};

const itemsPanelTitleStyle = {
  margin: 0,
  fontSize: 24,
  fontWeight: 800,
  color: "#0f172a",
};

const itemsPanelTextStyle = {
  margin: "6px 0 0",
  color: "#64748b",
  fontSize: 14,
};

const itemsBadgeStyle = {
  padding: "10px 14px",
  borderRadius: 999,
  background: "#eff6ff",
  color: "#1d4ed8",
  fontWeight: 700,
  fontSize: 13,
  border: "1px solid #bfdbfe",
};

const emptyWrapStyle = {
  borderRadius: 24,
  border: "1px dashed #cbd5e1",
  padding: "48px 20px",
  textAlign: "center",
  background:
    "linear-gradient(180deg, rgba(248,250,252,0.95) 0%, rgba(241,245,249,0.95) 100%)",
};

const emptyIconStyle = {
  width: 74,
  height: 74,
  borderRadius: 24,
  margin: "0 auto 16px",
  display: "grid",
  placeItems: "center",
  background: "#e2e8f0",
  color: "#334155",
};

const emptyTitleStyle = {
  margin: 0,
  fontSize: 22,
  color: "#0f172a",
  fontWeight: 800,
};

const emptyTextStyle = {
  margin: "8px auto 0",
  maxWidth: 460,
  color: "#64748b",
  lineHeight: 1.6,
};

const itemCardStyle = {
  borderRadius: 22,
  border: "1px solid #e2e8f0",
  background: "#fff",
  overflow: "hidden",
};

const itemCardHeaderStyle = {
  padding: 18,
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "center",
  flexWrap: "wrap",
};

const itemNameStyle = {
  fontWeight: 900,
  color: "#0f172a",
  fontSize: 18,
};

const itemMetaStyle = {
  fontSize: 13,
  color: "#64748b",
  marginTop: 4,
};

const itemActionsStyle = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const itemDetailGridStyle = {
  borderTop: "1px solid #eef2f7",
  background: "#f8fafc",
  padding: 18,
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 14,
};