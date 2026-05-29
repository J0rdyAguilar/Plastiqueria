import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getSession, getToken } from "../lib/auth";
import { rutasApi } from "../lib/rutas";
import { zonasApi } from "../lib/zonas";
import { ubicacionesApi } from "../lib/ubicaciones";
import { clientesApi } from "../lib/clientes";
import { pedidosApi } from "../lib/pedidos";
import { productosApi } from "../lib/productos";
import { notify } from "../lib/notify";

function money(n) {
  return `Q ${Number(n || 0).toFixed(2)}`;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Genera un texto plano uniforme para búsquedas precisas
function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function wordsOf(value) {
  return normalizeText(value)
    .split(/\s+/)
    .filter(Boolean);
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

function estadoBadgeStyle(estado) {
  const base = {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    textTransform: "capitalize",
  };

  switch (estado) {
    case "pendiente_revision":
      return { ...base, background: "#fff7ed", color: "#9a3412" };
    case "aprobado":
      return { ...base, background: "#ecfeff", color: "#155e75" };
    case "preparando":
      return { ...base, background: "#ecfdf5", color: "#166534" };
    case "en_ruta":
      return { ...base, background: "#eff6ff", color: "#1d4ed8" };
    case "entregado":
      return { ...base, background: "#f3f4f6", color: "#374151" };
    default:
      return { ...base, background: "#eef2ff", color: "#3730a3" };
  }
}

function getVistaFromHash(hash) {
  return hash === "#mis-pedidos" ? "mios" : "crear";
}

function normalizarPresentaciones(precios = []) {
  const lista = Array.isArray(precios) ? precios : [];

  const mapped = lista
    .filter((p) => p && (p.activo === undefined || p.activo === true || p.activo === 1))
    .map((p) => ({
      tipo: String(p.presentacion || "unidad").toLowerCase(),
      label: String(p.presentacion || "unidad"),
      factor: num(p.factor_base || 1),
      precioCosto: num(p.precio_costo || 0),
      precioVenta: num(p.precio_venta ?? p.precio ?? 0),
      precioRuta: num(p.precio_ruta ?? p.precio_venta ?? p.precio ?? 0),
      precio: num(p.precio_ruta ?? p.precio_venta ?? p.precio ?? 0),
    }))
    .filter((p) => p.factor > 0);

  if (mapped.length > 0) return mapped;

  return [
    {
      tipo: "unidad",
      label: "unidad",
      factor: 1,
      precioCosto: 0,
      precioVenta: 0,
      precioRuta: 0,
      precio: 0,
    },
  ];
}

function normalizarCliente(c) {
  if (!c) return null;

  return {
    ...c,
    ruta_nombre: c.ruta_nombre || c.ruta?.nombre || "",
    zona_nombre: c.zona_nombre || c.zona?.nombre || "",
  };
}

function extractArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  return [];
}

function normalizarPedido(p) {
  if (!p) return null;

  return {
    ...p,
    cliente_nombre:
      p.cliente_nombre ||
      p.cliente?.nombre ||
      p.cliente?.nombre_tienda ||
      "—",
    detalles: Array.isArray(p.detalles)
      ? p.detalles
      : Array.isArray(p.detalles?.data)
      ? p.detalles.data
      : [],
  };
}

async function fetchProductosConPrecios({ q = "", per_page = 500 }) {
  if (typeof productosApi.catalogo === "function") {
    const res = await productosApi.catalogo();
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.data)) return res.data;
  }

  if (typeof productosApi.list === "function") {
    const res = await productosApi.list({ q, per_page });
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.data)) return res.data;
  }

  if (typeof productosApi.search === "function") {
    const res = await productosApi.search(q, { per_page });
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.data)) return res.data;
  }

  return [];
}

function getRawApiBase() {
  return (
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    "http://127.0.0.1:8000/api/v1"
  );
}

function getApiBaseUrl() {
  let base = String(getRawApiBase()).trim().replace(/\/+$/, "");

  if (base.endsWith("/api")) {
    base = `${base}/v1`;
  } else if (!base.endsWith("/api/v1")) {
    base = `${base}/api/v1`;
  }

  return base;
}

function getAssetBaseUrl() {
  return String(getRawApiBase())
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api\/v1$/i, "")
    .replace(/\/api$/i, "");
}

function resolveImageUrl(path) {
  const raw = String(path || "").trim();

  if (!raw) return "";

  if (
    raw.startsWith("http://") ||
    raw.startsWith("https://") ||
    raw.startsWith("data:") ||
    raw.startsWith("blob:")
  ) {
    return raw;
  }

  const cleanPath = raw.replace(/^\/+/, "");
  const assetBase = getAssetBaseUrl();

  return `${assetBase}/${cleanPath}`;
}

async function fetchApiDirect(path, params = {}) {
  const token = getToken?.();
  const url = new URL(`${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`);

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  const headers = {
    Accept: "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers,
  });

  const text = await res.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const err = new Error(data?.message || data?.error || `Error HTTP ${res.status}`);
    err.response = { status: res.status, data };
    throw err;
  }

  return data;
}

async function cargarClientesActivos() {
  const intentos = [
    () => clientesApi.list({ activo: 1, per_page: 500 }),
    () => clientesApi.list({ per_page: 500 }),
    () => fetchApiDirect("/clientes", { activo: 1, per_page: 500 }),
    () => fetchApiDirect("/clientes", { per_page: 500 }),
  ];

  let ultimoError = null;

  for (const intento of intentos) {
    try {
      const res = await intento();
      const lista = extractArray(res).map(normalizarCliente).filter(Boolean);

      if (lista.length > 0) {
        return lista;
      }

      // Si respondió bien pero vacío, guardamos vacío y seguimos probando otro formato.
      ultimoError = null;
    } catch (err) {
      ultimoError = err;
    }
  }

  if (ultimoError) {
    throw ultimoError;
  }

  return [];
}

function getProductoImagen(producto) {
  if (!producto) return "";

  const fromPrincipal =
    producto?.imagen_principal?.url ||
    producto?.imagenPrincipal?.url ||
    producto?.imagen_principal_url ||
    producto?.imagen_url ||
    producto?.url_imagen ||
    producto?.foto ||
    producto?.imagen ||
    producto?.image ||
    "";

  if (fromPrincipal) return resolveImageUrl(fromPrincipal);

  if (Array.isArray(producto?.imagenes) && producto.imagenes.length > 0) {
    const principal = producto.imagenes.find((img) => Number(img?.es_principal) === 1);
    if (principal?.url) return resolveImageUrl(principal.url);
    if (producto.imagenes[0]?.url) return resolveImageUrl(producto.imagenes[0].url);
  }

  return "";
}

function InlineLoader() {
  return (
    <div className="mini-loader-wrap" aria-label="Cargando">
      <span className="mini-loader"></span>
    </div>
  );
}

function TableLoader() {
  return (
    <div className="table-loader-wrap" aria-label="Cargando">
      <div className="table-loader-ring"></div>
    </div>
  );
}

function ProductoThumb({ src, alt, size = 84 }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const usable = src && !failed;

  if (!failed && !usable) {
    return (
      <div
        style={{
          width: size,
          height: size,
          minWidth: size,
          borderRadius: 14,
          border: "1px solid #e5e7eb",
          background: "linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 28,
        }}
      >
        📦
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || "Producto"}
      onError={() => setFailed(true)}
      style={{
        width: size,
        height: size,
        minWidth: size,
        objectFit: "cover",
        borderRadius: 14,
        border: "1px solid #e5e7eb",
        background: "#fff",
      }}
    />
  );
}

function ClienteThumb({ name = "", size = 48 }) {
  const texto = String(name || "").trim();
  const iniciales = texto
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase())
    .join("") || "CL";

  return (
    <div
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: 14,
        border: "1px solid #dbeafe",
        background: "linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%)",
        color: "#1d4ed8",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size >= 48 ? 15 : 13,
        fontWeight: 800,
      }}
    >
      {iniciales}
    </div>
  );
}

export default function Pedidos() {
  const session = getSession();
  const me = session?.user || {};
  const location = useLocation();
  const navigate = useNavigate();

  const rol = String(me?.rol || me?.role || "").toLowerCase();
  const isVendedor = rol === "vendedor";
  const userUbicacionId = String(me?.ubicacion_id || "");
  const vendedorId = me?.vendedor_id || "";

  const [vista, setVista] = useState(getVistaFromHash(location.hash));

  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingProductos, setLoadingProductos] = useState(false);
  const [guardandoCliente, setGuardandoCliente] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [searchFocus, setSearchFocus] = useState(false);
  const [searchMode] = useState("todos");
  const [onlyConPrecio] = useState(false);

  const [qCliente, setQCliente] = useState("");
  const [clienteSearchFocus, setClienteSearchFocus] = useState(false);
  const [clienteSearchMode] = useState("todos");

  const searchBoxRef = useRef(null);
  const clienteSearchBoxRef = useRef(null);

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

  async function loadInicial() {
    try {
      setLoadingInit(true);
      setError("");

      const results = await Promise.allSettled([
        ubicacionesApi.list({ activa: 1, per_page: 200 }),
        rutasApi.list({ per_page: 200 }),
        zonasApi.list({ per_page: 200 }),
        cargarClientesActivos(),
      ]);

      const [resUbicaciones, resRutas, resZonas, resClientes] = results;

      let arrUbicaciones = [];
      if (resUbicaciones.status === "fulfilled") {
        arrUbicaciones = extractArray(resUbicaciones.value);
      }

      if (isVendedor) {
        const propia = arrUbicaciones.find((u) => String(u.id) === userUbicacionId);
        const soloPropia = propia ? [propia] : [];
        setUbicaciones(soloPropia);
        setUbicacionId(propia ? String(propia.id) : "");
      } else {
        setUbicaciones(arrUbicaciones);
      }

      if (resRutas.status === "fulfilled") {
        setRutas(extractArray(resRutas.value));
      }
      if (resZonas.status === "fulfilled") {
        setZonas(extractArray(resZonas.value));
      }

      if (resClientes.status === "fulfilled") {
        const arrClientes = extractArray(resClientes.value)
          .map(normalizarCliente)
          .filter(Boolean);
        setClientes(arrClientes);
      }

      if (results.some((r) => r.status === "rejected")) {
        setError("Algunos datos auxiliares no cargaron de forma completa.");
      }

      if (isVendedor && !userUbicacionId) {
        setError("Tu usuario no tiene una sucursal asignada.");
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
      setLoadingProductos(true);
      setError("");

      const productosRows = await fetchProductosConPrecios({ q: "", per_page: 500 });
      const rows = Array.isArray(productosRows) ? productosRows : [];

      const merged = rows.map((p) => {
        const presentaciones = normalizarPresentaciones(p.precios);
        const palabrasPresentacion = presentaciones
          .map((pr) => `${pr.label} ${pr.tipo} factor ${pr.factor}`)
          .join(" ");

        return {
          id: Number(p.id),
          nombre: p.nombre,
          sku: p.sku,
          imagen: getProductoImagen(p),
          imagen_principal: p.imagen_principal || null,
          imagenes: Array.isArray(p.imagenes) ? p.imagenes : [],
          cantidad_base: 999999,
          presentaciones,
          permite_monto_variable: true,
          __search: normalizeText(
            `${p.nombre || ""} ${p.sku || ""} ${palabrasPresentacion}`
          ),
        };
      });

      setProductos(merged);

      setLineas((prev) => {
        const next = {};
        for (const producto of merged) {
          const actual = prev[producto.id];
          if (!actual) continue;

          const presentacionExiste = producto.presentaciones.some(
            (p) => p.tipo === actual.presentacion
          );

          const p0 =
            producto.presentaciones.find((p) => p.tipo === actual.presentacion) ||
            producto.presentaciones[0] || {
              tipo: "unidad",
              factor: 1,
              precioRuta: 0,
              precio: 0,
            };

          next[producto.id] = {
            ...actual,
            productoId: producto.id,
            nombre: producto.nombre,
            sku: producto.sku,
            imagen: producto.imagen,
            presentacion: presentacionExiste ? actual.presentacion : p0.tipo,
            factor: num(p0.factor || 1),
            precioBase: num(p0.precioRuta ?? p0.precio ?? 0),
            montoVariable: actual.usaMontoVariable
              ? num(actual.montoVariable)
              : num(p0.precioRuta ?? p0.precio ?? 0),
            stockDisponible: 999999,
          };
        }
        return next;
      });
    } catch (err) {
      console.error(err);
      setError("No se pudieron cargar los productos.");
    } finally {
      setLoadingProductos(false);
    }
  }

  async function loadMisPedidos() {
    try {
      setLoadingMisPedidos(true);

      const res = await pedidosApi.misPedidos({
        estado: estadoFiltroPedidos,
        page: 1,
        per_page: 20,
      });

      const pedidos = extractArray(res).map(normalizarPedido).filter(Boolean);
      setMisPedidos(pedidos);
    } catch (err) {
      console.error("mis pedidos ERROR", err?.response?.data || err);
      setMisPedidos([]);
    } finally {
      setLoadingMisPedidos(false);
    }
  }

  useEffect(() => {
    loadInicial();
    loadProductos();
  }, []);

  useEffect(() => {
    setVista(getVistaFromHash(location.hash));
  }, [location.hash]);

  useEffect(() => {
    if (vista === "mios") {
      loadMisPedidos();
    }
  }, [vista, estadoFiltroPedidos]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (!searchBoxRef.current?.contains(e.target)) {
        setSearchFocus(false);
      }
      if (!clienteSearchBoxRef.current?.contains(e.target)) {
        setClienteSearchFocus(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const clienteSeleccionado = useMemo(() => {
    return clientes.find((c) => String(c.id) === String(clienteId)) || null;
  }, [clientes, clienteId]);

  useEffect(() => {
    if (clienteSeleccionado) {
      setQCliente(clienteSeleccionado.nombre || "");
    }
  }, [clienteId]);

  function getSearchScore(producto, rawTerm, mode) {
    const term = normalizeText(rawTerm);
    if (!term) return 1;

    const nombre = normalizeText(producto.nombre);
    const sku = normalizeText(producto.sku);
    const presentaciones = normalizeText(
      (producto.presentaciones || [])
        .map((p) => `${p.label} ${p.tipo} factor ${p.factor}`)
        .join(" ")
    );

    const target =
      mode === "nombre"
        ? nombre
        : mode === "codigo"
        ? sku
        : mode === "presentacion"
        ? presentaciones
        : normalizeText(`${nombre} ${sku} ${presentaciones}`);

    if (!target.includes(term)) return -1;

    let score = 0;
    if (sku === term) score += 200;
    if (nombre === term) score += 180;
    if (sku.startsWith(term)) score += 120;
    if (nombre.startsWith(term)) score += 100;

    const termWords = wordsOf(term);
    const targetWords = wordsOf(target);

    for (const word of termWords) {
      if (targetWords.includes(word)) score += 18;
      if (target.includes(word)) score += 6;
    }
    return score;
  }

  function getClienteSearchScore(cliente, rawTerm, mode) {
    const term = normalizeText(rawTerm);
    if (!term) return 1;

    const nombre = normalizeText(cliente.nombre || cliente.nombre_tienda || "");
    const propietario = normalizeText(cliente.propietario || "");
    const telefono = normalizeText(cliente.telefono || "");
    const ruta = normalizeText(cliente.ruta_nombre || cliente.ruta?.nombre || "");
    const zona = normalizeText(cliente.zona_nombre || cliente.zona?.nombre || "");

    const target =
      mode === "nombre"
        ? nombre
        : mode === "propietario"
        ? propietario
        : mode === "telefono"
        ? telefono
        : normalizeText(`${nombre} ${propietario} ${telefono} ${ruta} ${zona}`);

    if (!target.includes(term)) return -1;

    let score = 0;
    if (nombre === term) score += 220;
    if (telefono === term) score += 180;
    if (nombre.startsWith(term)) score += 130;

    const termWords = wordsOf(term);
    const targetWords = wordsOf(target);

    for (const word of termWords) {
      if (targetWords.includes(word)) score += 18;
      if (target.includes(word)) score += 6;
    }
    return score;
  }

  const productosFiltrados = useMemo(() => {
    let lista = [...productos];
    if (onlyConPrecio) {
      lista = lista.filter((p) =>
        (p.presentaciones || []).some((pr) => num(pr.precio) > 0)
      );
    }

    const term = q.trim();
    if (!term) {
      return lista.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
    }

    return lista
      .map((p) => ({ ...p, __score: getSearchScore(p, term, searchMode) }))
      .filter((p) => p.__score >= 0)
      .sort((a, b) => b.__score - a.__score);
  }, [productos, q, searchMode, onlyConPrecio]);

  const clientesFiltrados = useMemo(() => {
    const lista = [...clientes];
    const term = qCliente.trim();

    if (!term) {
      return lista.sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || "")));
    }

    return lista
      .map((c) => ({ ...c, __score: getClienteSearchScore(c, term, clienteSearchMode) }))
      .filter((c) => c.__score >= 0)
      .sort((a, b) => b.__score - a.__score);
  }, [clientes, qCliente, clienteSearchMode]);

  const sugerencias = useMemo(() => {
    if (!q.trim()) return [];
    return productosFiltrados.slice(0, 6);
  }, [productosFiltrados, q]);

  const sugerenciasClientes = useMemo(() => {
    if (!qCliente.trim()) return [];
    return clientesFiltrados.slice(0, 6);
  }, [clientesFiltrados, qCliente]);

  function getPresentacionDefault(producto) {
    return producto.presentaciones?.[0] || {
      tipo: "unidad",
      label: "unidad",
      factor: 1,
      precioRuta: 0,
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
      sku: producto.sku,
      imagen: producto.imagen,
      presentacion: p0.tipo,
      factor: num(p0.factor || 1),
      cantidad: 0,
      precioBase: num(p0.precioRuta ?? p0.precio ?? 0),
      usaMontoVariable: false,
      montoVariable: num(p0.precioRuta ?? p0.precio ?? 0),
      stockDisponible: 999999,
    };
  }

  function changeCantidad(producto, cantidad) {
    const linea = ensureLinea(producto);
    const cant = Math.max(0, num(cantidad));

    setLineas((prev) => ({
      ...prev,
      [producto.id]: {
        ...linea,
        productoId: producto.id,
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
        precioBase: num(encontrada?.precioRuta ?? encontrada?.precio ?? 0),
        montoVariable: linea.usaMontoVariable
          ? num(linea.montoVariable)
          : num(encontrada?.precioRuta ?? encontrada?.precio ?? 0),
      },
    }));
  }

  // LOGICA CORREGIDA: Habilita el flujo asíncrono hacia el superadmin de inmediato
  function toggleMontoVariable(producto, checked) {
    const linea = ensureLinea(producto);

    setLineas((prev) => ({
      ...prev,
      [producto.id]: {
        ...linea,
        usaMontoVariable: !!checked,
        // Forzamos internamente un estado 'aprobado' ficticio para que el input de precio no se bloquee,
        // pero al enviar el pedido, se guardará con la bandera 'es_monto_variable: 1'.
        estadoPermiso: checked ? "aprobado" : null,
        montoVariable: checked ? num(linea.precioBase) : num(linea.precioBase),
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
    const aprobado = linea.usaMontoVariable && linea.estadoPermiso === "aprobado";
    return aprobado ? num(linea.montoVariable) : num(linea.precioBase);
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
          producto_sku: producto.sku,
          producto_imagen: producto.imagen,
          presentacion: linea?.presentacion || "unidad",
          cantidad,
          textFormat: `x ${cantidad} ${linea?.presentacion || "unidad"}`,
          cantidad_base: cantidad * num(linea?.factor || 1),
          precio_unitario: getPrecioFinal(producto),
          subtotal: getSubtotal(producto),
          // Guardamos temporalmente si esta línea usó monto variable para el mapeo final
          es_monto_variable: linea?.usaMontoVariable ? 1 : 0
        };
      })
      .filter(Boolean);
  }, [productos, lineas]);

  const totalPedido = useMemo(() => {
    return detalles.reduce((acc, curr) => acc + num(curr.subtotal), 0);
  }, [detalles]);

  async function handleCrearCliente() {
    if (!nuevoCliente.nombre.trim()) {
      notify.error("El nombre del cliente o tienda es obligatorio");
      return;
    }
    if (!nuevoCliente.ruta_id) {
      notify.error("Debes seleccionar una ruta");
      return;
    }
    if (!nuevoCliente.zona_id) {
      notify.error("Debes seleccionar una zona");
      return;
    }

    try {
      setGuardandoCliente(true);
      const res = await clientesApi.create({
        nombre: nuevoCliente.nombre,
        propietario: nuevoCliente.propietario || undefined,
        telefono: nuevoCliente.telefono || undefined,
        ruta_id: Number(nuevoCliente.ruta_id),
        zona_id: Number(nuevoCliente.zona_id),
        direccion: nuevoCliente.direccion || undefined,
        referencia: nuevoCliente.referencia || undefined,
        vendedor_id: vendedorId ? Number(vendedorId) : undefined,
      });

      const creado = normalizarCliente(res?.data?.data || res?.data || res);
      if (!creado?.id) {
        notify.error("Error al procesar la respuesta del servidor.");
        return;
      }

      const clientesActualizados = await cargarClientesActivos();
      setClientes(clientesActualizados);

      setClienteId(String(creado.id));
      setQCliente(creado.nombre || "");
      setMostrarNuevoCliente(false);
      setNuevoCliente({
        nombre: "",
        propietario: "",
        telefono: "",
        ruta_id: "",
        zona_id: "",
        direccion: "",
        referencia: ""
      });

      notify.success("Cliente creado correctamente");
    } catch (err) {
      notify.error(getErrorMessage(err, "No se pudo crear el cliente"));
    } finally {
      setGuardandoCliente(false);
    }
  }

  // LOGICA CORREGIDA: Construye el payload mapeando el estado de monto variable hacia el Superadmin
  async function handleSubmit(e) {
    e.preventDefault();

    const effectiveUbicacionId = isVendedor ? userUbicacionId : ubicacionId;
    if (!effectiveUbicacionId) {
      notify.error("Debes tener una sucursal asignada.");
      return;
    }
    if (!clienteId) {
      notify.error("Debes seleccionar un cliente.");
      return;
    }
    if (detalles.length === 0) {
      notify.error("Debes agregar al menos un producto.");
      return;
    }

    const payload = {
      ubicacion_id: Number(effectiveUbicacionId),
      cliente_id: Number(clienteId),
      ruta_id: clienteSeleccionado?.ruta_id ? Number(clienteSeleccionado.ruta_id) : undefined,
      zona_id: clienteSeleccionado?.zona_id ? Number(clienteSeleccionado.zona_id) : undefined,
      observaciones,
      total: Number(totalPedido),
      detalles: detalles.map((d) => {
        const lineaProducto = lineas[d.producto_id];
        
        // El precio real será el monto variable ingresado, o en su defecto el precio unitario por defecto
        const precioReal = lineaProducto?.usaMontoVariable 
          ? Number(lineaProducto.montoVariable || 0) 
          : Number(d.precio_unitario || 0);

        return {
          producto_id: Number(d.producto_id),
          presentacion: d.presentacion,
          cantidad: Number(d.cantidad),
          cantidad_base: Number(d.cantidad_base),
          precio_unitario: precioReal,
          subtotal: Number(d.cantidad) * precioReal,
          // Enviamos explícitamente el flag en 1 o 0 para que el backend dispare la alerta de aprobación
          es_monto_variable: lineaProducto?.usaMontoVariable ? 1 : 0,
        };
      }),
    };

    try {
      setEnviando(true);
      await pedidosApi.create(payload);

      notify.success("Pedido enviado. Los montos variables quedaron en espera de confirmación del Superadmin.");
      setClienteId("");
      setQCliente("");
      setObservaciones("");
      setLineas({});
      navigate("/pedidos#mis-pedidos", { replace: true });
    } catch (err) {
      notify.error(getErrorMessage(err, "No se pudo crear el pedido"));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="view-container">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ margin: "0 0 4px 0" }}>Gestión de Pedidos</h2>
          <div className="muted" style={{ fontSize: 13 }}>
            Levanta solicitudes o consulta el historial de ventas en campo.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, background: "#f1f5f9", padding: 4, borderRadius: 12 }}>
          <button
            onClick={() => {
              navigate("/pedidos#crear-pedido");
              setVista("crear");
            }}
            style={vista === "crear" ? chipActive : chipBtn}
          >
            ➕ Crear Pedido
          </button>
          <button
            onClick={() => {
              navigate("/pedidos#mis-pedidos");
              setVista("mios");
            }}
            style={vista === "mios" ? chipActive : chipBtn}
          >
            📋 Mis Pedidos en Ruta
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", color: "#b91c1c", padding: 12, borderRadius: 10, marginBottom: 16, fontSize: 13, fontWeight: 600 }}>
          ⚠️ {error}
        </div>
      )}

      {loadingInit && (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <TableLoader />
          <div className="muted" style={{ marginTop: 12, fontSize: 14 }}>Cargando datos maestros de rutas y clientes...</div>
        </div>
      )}

      {!loadingInit && vista === "crear" && (
        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr min(360px, 100%)", gap: 20, alignItems: "start" }}>
            
            <div style={{ display: "grid", gap: 20 }}>
              <div className="card pad">
                <h3 style={{ marginTop: 0, marginBottom: 16 }}>Información General</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label className="muted" style={{ display: "block", marginBottom: 6 }}>Sucursal / Ubicación</label>
                    {isVendedor ? (
                      <input
                        type="text"
                        readOnly
                        value={ubicaciones.find((u) => String(u.id) === userUbicacionId)?.nombre || "Asignada"}
                        style={{ ...inputStyle, background: "#f7f7f7", fontWeight: 600 }}
                      />
                    ) : (
                      <select
                        value={ubicacionId}
                        onChange={(e) => setUbicacionId(e.target.value)}
                        style={inputStyle}
                        disabled={enviando || guardandoCliente}
                      >
                        <option value="">Selecciona sucursal</option>
                        {ubicaciones.map((u) => (
                          <option key={u.id} value={u.id}>{u.nombre}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="muted" style={{ display: "block", marginBottom: 6 }}>Fecha</label>
                    <input type="text" readOnly value={new Date().toLocaleDateString()} style={{ ...inputStyle, background: "#f7f7f7" }} />
                  </div>
                </div>

                <div style={{ marginTop: 16, borderTop: "1px solid #eee", paddingTop: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <h4 style={{ margin: 0 }}>Cliente / Tienda</h4>
                    <button type="button" onClick={() => setMostrarNuevoCliente((v) => !v)} style={miniBtn} disabled={guardandoCliente || enviando}>
                      {mostrarNuevoCliente ? "Cancelar" : "Nuevo cliente"}
                    </button>
                  </div>

                  {!mostrarNuevoCliente ? (
                    <div style={{ marginTop: 12 }}>
                      <label className="muted" style={{ display: "block", marginBottom: 6 }}>Cliente</label>
                      <div ref={clienteSearchBoxRef} style={{ position: "relative" }}>
                        <input
                          type="text"
                          value={qCliente}
                          onChange={(e) => {
                            const value = e.target.value;
                            setQCliente(value);
                            setClienteSearchFocus(true);
                            if (!value.trim()) setClienteId("");
                          }}
                          onFocus={() => setClienteSearchFocus(true)}
                          placeholder="Ej: tienda la bendición, propietario, teléfono..."
                          style={inputStyle}
                          disabled={guardandoCliente || enviando}
                        />

                        {clienteSearchFocus && sugerenciasClientes.length > 0 && (
                          <div
                            style={{
                              position: "absolute",
                              top: "calc(100% + 8px)",
                              left: 0,
                              right: 0,
                              background: "#fff",
                              border: "1px solid #e5e7eb",
                              borderRadius: 14,
                              boxShadow: "0 18px 50px rgba(15, 23, 42, 0.12)",
                              padding: 8,
                              zIndex: 30,
                              display: "grid",
                              gap: 6,
                              maxHeight: 320,
                              overflowY: "auto",
                            }}
                          >
                            {sugerenciasClientes.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setClienteId(String(c.id));
                                  setQCliente(c.nombre || "");
                                  setClienteSearchFocus(false);
                                }}
                                style={{
                                  textAlign: "left",
                                  border: 0,
                                  background: "none",
                                  padding: "8px 12px",
                                  cursor: "pointer",
                                  borderRadius: 8,
                                  fontSize: 13,
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                              >
                                <div style={{ fontWeight: 700 }}>{c.nombre}</div>
                                <div style={{ fontSize: 11, color: "#64748b" }}>
                                  Prop: {c.propietario || "—"} | Tel: {c.telefono || "—"} | Ruta: {c.ruta_nombre || "—"}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {clienteSeleccionado && (
                        <div style={{ marginTop: 12, background: "#f8fafc", padding: 12, borderRadius: 10, border: "1px solid #e2e8f0", display: "grid", gap: 4, fontSize: 13 }}>
                          <div><strong>Propietario:</strong> {clienteSeleccionado.propietario || "—"}</div>
                          <div><strong>Teléfono:</strong> {clienteSeleccionado.telefono || "—"}</div>
                          <div><strong>Ubicación:</strong> Ruta {clienteSeleccionado.ruta_nombre || "—"} — Zona {clienteSeleccionado.zona_nombre || "—"}</div>
                          {clienteSeleccionado.direccion && <div><strong>Dirección:</strong> {clienteSeleccionado.direccion}</div>}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ marginTop: 12, display: "grid", gap: 12, background: "#f8fafc", padding: 16, borderRadius: 14, border: "1px solid #e2e8f0" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>
                          <label className="muted" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Nombre / Tienda *</label>
                          <input type="text" value={nuevoCliente.nombre} onChange={(e) => setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })} style={inputStyle} />
                        </div>
                        <div>
                          <label className="muted" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Teléfono</label>
                          <input type="text" value={nuevoCliente.telefono} onChange={(e) => setNuevoCliente({ ...nuevoCliente, telefono: e.target.value })} style={inputStyle} />
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>
                          <label className="muted" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Ruta *</label>
                          <select value={nuevoCliente.ruta_id} onChange={(e) => setNuevoCliente({ ...nuevoCliente, ruta_id: e.target.value })} style={inputStyle}>
                            <option value="">Selecciona...</option>
                            {rutas.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="muted" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Zona *</label>
                          <select value={nuevoCliente.zona_id} onChange={(e) => setNuevoCliente({ ...nuevoCliente, zona_id: e.target.value })} style={inputStyle}>
                            <option value="">Selecciona...</option>
                            {zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
                          </select>
                        </div>
                      </div>
                      <button type="button" onClick={handleCrearCliente} disabled={guardandoCliente} style={{ ...miniBtn, background: "#2563eb", color: "#fff", border: 0 }}>
                        {guardandoCliente ? <InlineLoader /> : "Guardar y seleccionar cliente"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="card pad">
                <h3 style={{ marginTop: 0, marginBottom: 12 }}>Selección de Productos</h3>
                <div ref={searchBoxRef} style={{ position: "relative" }}>
                  <input
                    type="text"
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value);
                      setSearchFocus(true);
                    }}
                    onFocus={() => setSearchFocus(true)}
                    placeholder="Buscar producto por nombre o SKU..."
                    style={inputStyle}
                    disabled={loadingProductos}
                  />

                  {searchFocus && sugerencias.length > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 8px)",
                        left: 0,
                        right: 0,
                        background: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: 14,
                        boxShadow: "0 18px 50px rgba(15, 23, 42, 0.12)",
                        padding: 8,
                        zIndex: 30,
                        display: "grid",
                        gap: 4,
                      }}
                    >
                      {sugerencias.map((p) => {
                        const l = ensureLinea(p);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              changeCantidad(p, num(l.cantidad) + 1);
                              setSearchFocus(false);
                              setQ("");
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              textAlign: "left",
                              border: 0,
                              background: "none",
                              padding: 8,
                              borderRadius: 10,
                              cursor: "pointer",
                              width: "100%",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                          >
                            <ProductoThumb src={p.imagen} size={40} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: 13 }}>{p.nombre}</div>
                              <div style={{ fontSize: 11, color: "#64748b" }}>SKU: {p.sku || "—"}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {loadingProductos ? (
                  <div style={{ textAlign: "center", padding: "30px 0" }}>
                    <InlineLoader />
                    <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>Sincronizando catálogo...</div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 12, marginTop: 16, maxHeight: 600, overflowY: "auto", paddingRight: 4 }}>
                    {productosFiltrados.length === 0 ? (
                      <div className="muted" style={{ textAlign: "center", padding: 20, fontSize: 13 }}>No se encontraron productos disponibles.</div>
                    ) : (
                      productosFiltrados.map((p) => {
                        const l = ensureLinea(p);
                        return (
                          <div
                            key={p.id}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "84px 1fr auto",
                              gap: 16,
                              alignItems: "center",
                              padding: 12,
                              background: num(l.cantidad) > 0 ? "#eff6ff" : "#fff",
                              border: num(l.cantidad) > 0 ? "1px solid #bfdbfe" : "1px solid #e2e8f0",
                              borderRadius: 14,
                            }}
                          >
                            <ProductoThumb src={p.imagen} size={84} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{p.nombre}</div>
                              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>SKU: {p.sku || "—"}</div>
                              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                {p.presentaciones.map((pr) => (
                                  <button
                                    key={pr.tipo}
                                    type="button"
                                    onClick={() => changePresentacion(p, pr.tipo)}
                                    style={{
                                      border: l.presentacion === pr.tipo ? "1px solid #3b82f6" : "1px solid #cbd5e1",
                                      background: l.presentacion === pr.tipo ? "#3b82f6" : "#fff",
                                      color: l.presentacion === pr.tipo ? "#fff" : "#334155",
                                      borderRadius: 8,
                                      padding: "4px 8px",
                                      fontSize: 11,
                                      fontWeight: 700,
                                      cursor: "pointer",
                                    }}
                                  >
                                    {pr.label} · Ruta {money(pr.precioRuta ?? pr.precio)}
                                  </button>
                                ))}
                              </div>

                              {p.permite_monto_variable && (
                                <div style={{ marginTop: 8, background: "#f8fafc", padding: 8, borderRadius: 8, border: "1px solid #edf2f7" }}>
                                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                                    <input
                                      type="checkbox"
                                      checked={!!l.usaMontoVariable}
                                      onChange={(e) => toggleMontoVariable(p, e.target.checked)}
                                    />
                                    Usar Precio Variable Especial
                                  </label>

                                  {l.usaMontoVariable && (
                                    <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                                      <span style={{ fontSize: 11, fontWeight: 700, color: "#1e3a8a" }}>Precio Solicitado (Q):</span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={l.montoVariable || ""}
                                        onChange={(e) => setMontoVariable(p, e.target.value)}
                                        placeholder="0.00"
                                        style={{
                                          width: 90,
                                          padding: "4px 8px",
                                          border: "1px solid #93c5fd",
                                          borderRadius: 6,
                                          outline: "none",
                                          fontSize: 12,
                                          fontWeight: 700
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => changeCantidad(p, num(l.cantidad) - 1)}
                                disabled={num(l.cantidad) <= 0}
                                style={{
                                  border: "1px solid #cbd5e1",
                                  background: "#fff",
                                  borderRadius: 8,
                                  width: 32,
                                  height: 32,
                                  cursor: "pointer",
                                  fontWeight: 700
                                }}
                              >
                                -
                              </button>
                              <input
                                type="number"
                                value={l.cantidad || ""}
                                onChange={(e) => changeCantidad(p, e.target.value)}
                                placeholder="0"
                                style={{
                                  width: 50,
                                  textAlign: "center",
                                  border: "1px solid #cbd5e1",
                                  borderRadius: 8,
                                  padding: "6px 0",
                                  outline: "none"
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => changeCantidad(p, num(l.cantidad) + 1)}
                                style={{
                                  border: "1px solid #cbd5e1",
                                  background: "#fff",
                                  borderRadius: 8,
                                  width: 32,
                                  height: 32,
                                  cursor: "pointer",
                                  fontWeight: 700
                                }}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>

            <div style={{ position: "sticky", top: 20, display: "grid", gap: 20 }}>
              <div className="card pad" style={{ background: "linear-gradient(180deg, #fff 0%, #f8fafc 100%)" }}>
                <h3 style={{ marginTop: 0, borderBottom: "1px solid #e2e8f0", paddingBottom: 10 }}>Resumen</h3>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                  <span style={{ fontWeight: 700 }}>TOTAL</span>
                  <span style={{ fontSize: 20, fontWeight: 900 }}>{money(totalPedido)}</span>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label className="muted" style={{ display: "block", marginBottom: 6, fontSize: 12 }}>Observaciones</label>
                  <textarea rows={3} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} style={{ ...inputStyle, resize: "none" }} />
                </div>
                <button type="submit" disabled={enviando || detalles.length === 0 || !clienteId} style={{ width: "100%", background: "#10b981", color: "#fff", border: 0, borderRadius: 10, padding: "12px", fontWeight: 700, cursor: "pointer" }}>
                  {enviando ? <InlineLoader /> : "Enviar Pedido"}
                </button>
              </div>
            </div>

          </div>
        </form>
      )}

      {vista === "mios" && (
        <div style={{ marginTop: 12 }}>
          <div className="card pad" style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "center" }}>
            <span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>Filtrar Estado:</span>
            <select
              value={estadoFiltroPedidos}
              onChange={(e) => setEstadoFiltroPedidos(e.target.value)}
              style={{ ...inputStyle, width: "auto", padding: "6px 12px" }}
            >
              <option value="">Todos los pedidos</option>
              <option value="pendiente_revision">Pendientes revisión</option>
              <option value="aprobado">Aprobados</option>
              <option value="preparando">En preparación</option>
              <option value="en_ruta">En ruta de entrega</option>
              <option value="entregado">Entregados</option>
            </select>
          </div>

          {loadingMisPedidos ? (
            <div style={{ textAlign: "center", padding: "50px 0" }}>
              <TableLoader />
              <div className="muted" style={{ marginTop: 12 }}>Buscando tus solicitudes de ruta...</div>
            </div>
          ) : misPedidos.length === 0 ? (
            <div className="card pad" style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📂</div>
              <h4 style={{ margin: "0 0 4px 0" }}>No hay pedidos registrados</h4>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>Tus pedidos levantados bajo el filtro actual aparecerán enlistados aquí.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {misPedidos.map((pedido) => (
                <div key={pedido.id} className="card pad" style={{ borderLeft: "4px solid #94a3b8" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 800, fontSize: 15 }}>{pedido.cliente_nombre}</span>
                        <span style={estadoBadgeStyle(pedido.estado)}>{pedido.estado?.replace("_", " ")}</span>
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        ID Pedido: #{pedido.id} | Fecha: {pedido.created_at ? new Date(pedido.created_at).toLocaleDateString() : "—"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>{money(pedido.total)}</div>
                      <div className="muted" style={{ fontSize: 11 }}>{pedido.detalles?.length || 0} ítems vinculados</div>
                    </div>
                  </div>

                  <div style={{ background: "#f8fafc", borderRadius: 10, padding: 10, border: "1px solid #f1f5f9" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>Artículos Solicitados</div>
                    <div style={{ display: "grid", gap: 6 }}>
                      {(pedido.detalles || []).map((det, idx) => {
                        const cantidadSaneada = num(det.cantidad);
                        const precioSaneado = num(det.precio_unitario);
                        const subtotalCalculado = det.subtotal ? num(det.subtotal) : (cantidadSaneada * precioSaneado);

                        return (
                          <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, background: "#f8fafc", padding: "6px 10px", borderRadius: 8 }}>
                            <div>
                              <span>{det.producto_nombre || det.producto?.nombre || "Producto"}</span>
                              <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>({cantidadSaneada} {det.presentacion || "unidad"})</span>
                            </div>
                            <div style={{ fontWeight: 600 }}>
                              {money(subtotalCalculado)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {pedido.observaciones ? (
                    <div style={{ marginTop: 10, fontSize: 12, color: "#475569", paddingLeft: 4 }}>
                      <div className="muted" style={{ fontWeight: 700, marginBottom: 2 }}>
                        Observaciones
                      </div>
                      <div>{pedido.observaciones}</div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
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
  borderRadius: 10,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
};

const chipBtn = {
  border: "1px solid #dbe4f0",
  background: "#fff",
  color: "#334155",
  borderRadius: 999,
  padding: "8px 12px",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13,
};

const chipActive = {
  ...chipBtn,
  background: "#eff6ff",
  border: "1px solid #93c5fd",
  color: "#1d4ed8",
  boxShadow: "0 4px 14px rgba(37, 99, 235, 0.1)",
};