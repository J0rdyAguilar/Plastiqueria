import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getSession } from "../lib/auth";
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
      precio: num(p.precio_venta ?? p.precio ?? 0),
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

function ModalLoader({ text = "Cargando..." }) {
  return (
    <div className="modal-loader-wrap" aria-label={text}>
      <div className="modal-loader-ring"></div>
      <div className="modal-loader-text">{text}</div>
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
  const [searchMode, setSearchMode] = useState("todos");
  const [onlyConPrecio, setOnlyConPrecio] = useState(false);

  const searchBoxRef = useRef(null);

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
        clientesApi.list({ vendedor_id: vendedorId, activo: 1, per_page: 200 }),
      ]);

      const [resUbicaciones, resRutas, resZonas, resClientes] = results;

      let arrUbicaciones = [];
      if (resUbicaciones.status === "fulfilled") {
        arrUbicaciones = extractArray(resUbicaciones.value);
      } else {
        console.error("ubicaciones ERROR", resUbicaciones.reason);
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
      } else {
        console.error("rutas ERROR", resRutas.reason);
      }

      if (resZonas.status === "fulfilled") {
        setZonas(extractArray(resZonas.value));
      } else {
        console.error("zonas ERROR", resZonas.reason);
      }

      if (resClientes.status === "fulfilled") {
        const arrClientes = extractArray(resClientes.value)
          .map(normalizarCliente)
          .filter(Boolean);
        setClientes(arrClientes);
      } else {
        console.error("clientes ERROR", resClientes.reason);
      }

      if (results.some((r) => r.status === "rejected")) {
        setError("Algunos datos no cargaron. Revisa la consola.");
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
              precio: 0,
            };

          next[producto.id] = {
            ...actual,
            presentacion: presentacionExiste ? actual.presentacion : p0.tipo,
            factor: num(p0.factor || 1),
            precioBase: num(p0.precio || 0),
            montoVariable: actual.usaMontoVariable
              ? num(actual.montoVariable)
              : num(p0.precio || 0),
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
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const clienteSeleccionado = useMemo(() => {
    return clientes.find((c) => String(c.id) === String(clienteId)) || null;
  }, [clientes, clienteId]);

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
    if (presentaciones.startsWith(term)) score += 70;

    const termWords = wordsOf(term);
    const targetWords = wordsOf(target);

    for (const word of termWords) {
      if (targetWords.includes(word)) score += 18;
      if (target.startsWith(word)) score += 10;
      if (target.includes(word)) score += 6;
    }

    score += Math.max(0, 40 - target.indexOf(term));
    score += Math.max(0, 30 - Math.abs(target.length - term.length));

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
      .map((p) => ({
        ...p,
        __score: getSearchScore(p, term, searchMode),
      }))
      .filter((p) => p.__score >= 0)
      .sort((a, b) => {
        if (b.__score !== a.__score) return b.__score - a.__score;
        return String(a.nombre).localeCompare(String(b.nombre));
      });
  }, [productos, q, searchMode, onlyConPrecio]);

  const sugerencias = useMemo(() => {
    if (!q.trim()) return [];
    return productosFiltrados.slice(0, 6);
  }, [productosFiltrados, q]);

  function getPresentacionDefault(producto) {
    return producto.presentaciones?.[0] || {
      tipo: "unidad",
      label: "unidad",
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
        precioBase: num(encontrada?.precioVenta ?? encontrada?.precio ?? 0),
        montoVariable: linea.usaMontoVariable
          ? num(linea.montoVariable)
          : num(encontrada?.precioVenta ?? encontrada?.precio ?? 0),
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
    return linea.usaMontoVariable ? num(linea.montoVariable) : num(linea.precioBase);
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
      notify.error("Debes completar nombre, ruta y zona.");
      return;
    }

    try {
      setGuardandoCliente(true);

      const effectiveUbicacionId = isVendedor ? userUbicacionId : ubicacionId;

      const payload = {
        nombre: nuevoCliente.nombre?.trim(),
        propietario: nuevoCliente.propietario?.trim() || "",
        telefono: nuevoCliente.telefono?.trim() || "",
        ruta_id: Number(nuevoCliente.ruta_id),
        zona_id: Number(nuevoCliente.zona_id),
        direccion: nuevoCliente.direccion?.trim() || "Sin dirección",
        referencia: nuevoCliente.referencia?.trim() || "",
        activo: 1,
        vendedor_id: vendedorId ? Number(vendedorId) : undefined,
        ubicacion_id: effectiveUbicacionId ? Number(effectiveUbicacionId) : undefined,
      };

      Object.keys(payload).forEach((k) => {
        if (payload[k] === undefined || payload[k] === null || payload[k] === "") {
          delete payload[k];
        }
      });

      const res = await clientesApi.create(payload);
      const creado = normalizarCliente(res?.data?.data || res?.data || res);

      if (!creado?.id) {
        notify.error("El backend no devolvió el cliente creado correctamente.");
        return;
      }

      const clientesRes = await clientesApi.list({
        vendedor_id: vendedorId,
        activo: 1,
        per_page: 200,
      });

      const clientesActualizados = extractArray(clientesRes)
        .map(normalizarCliente)
        .filter(Boolean);

      setClientes(clientesActualizados);
      setClienteId(String(creado.id));

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

      notify.success("Cliente creado correctamente");
    } catch (err) {
      console.error("ERROR CREANDO CLIENTE:", err?.response?.data || err);
      notify.error(getErrorMessage(err, "No se pudo crear el cliente"));
    } finally {
      setGuardandoCliente(false);
    }
  }

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
      detalles: detalles.map((d) => ({
        producto_id: Number(d.producto_id),
        presentacion: d.presentacion,
        cantidad: Number(d.cantidad),
        cantidad_base: Number(d.cantidad_base),
        precio_unitario: Number(d.precio_unitario),
        subtotal: Number(d.subtotal),
        es_monto_variable: d.es_monto_variable ? 1 : 0,
      })),
    };

    Object.keys(payload).forEach((k) => {
      if (payload[k] === undefined || payload[k] === null || payload[k] === "") {
        delete payload[k];
      }
    });

    try {
      setEnviando(true);

      await pedidosApi.create(payload);

      notify.success("Pedido enviado al administrador");

      setClienteId("");
      setObservaciones("");
      setLineas({});
      setQ("");

      navigate("/pedidos#mis-pedidos", { replace: true });
    } catch (err) {
      console.error("ERROR ENVIANDO PEDIDO:", err?.response?.data || err);
      notify.error(getErrorMessage(err, "No se pudo enviar el pedido"));
    } finally {
      setEnviando(false);
    }
  }

  if (loadingInit) {
    return (
      <div className="page">
        <div className="card pad">
          <ModalLoader text="Cargando datos..." />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h2>Pedidos</h2>
          <p className="muted">
            Sesión: <b>{me?.nombre || me?.usuario || "—"}</b> ({me?.rol || me?.role || "—"})
          </p>
        </div>
      </header>

      {error ? (
        <div className="card pad" style={{ marginTop: 12, border: "1px solid #f5c2c7" }}>
          <div style={{ color: "#842029", fontWeight: 600 }}>{error}</div>
        </div>
      ) : null}

      {vista === "crear" && (
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

                    {isVendedor ? (
                      <input
                        readOnly
                        value={ubicaciones[0]?.nombre || "Sucursal asignada"}
                        style={{ ...inputStyle, background: "#f7f7f7" }}
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
                          <option key={u.id} value={u.id}>
                            {u.nombre}
                          </option>
                        ))}
                      </select>
                    )}
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
                      disabled={guardandoCliente || enviando}
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
                        disabled={guardandoCliente || enviando}
                      >
                        <option value="">Selecciona cliente</option>
                        {clientes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : guardandoCliente ? (
                    <div style={{ marginTop: 12 }}>
                      <ModalLoader text="Guardando cliente..." />
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
                        <button
                          type="button"
                          onClick={handleCrearCliente}
                          style={saveBtn}
                          disabled={guardandoCliente}
                        >
                          {guardandoCliente ? <InlineLoader /> : "Guardar cliente"}
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
                    disabled={enviando}
                  />
                </div>
              </div>

              <div className="card pad">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0 }}>Productos</h3>
                    <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
                      Busca por nombre, código o presentación
                    </div>
                  </div>

                  <div
                    ref={searchBoxRef}
                    style={{
                      width: "100%",
                      maxWidth: 430,
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        gap: 8,
                      }}
                    >
                      <div style={{ position: "relative" }}>
                        <input
                          type="text"
                          value={q}
                          onChange={(e) => setQ(e.target.value)}
                          onFocus={() => setSearchFocus(true)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              setSearchFocus(false);
                            }

                            if (e.key === "Enter" && sugerencias.length > 0) {
                              e.preventDefault();
                              setQ(sugerencias[0].nombre || "");
                              setSearchFocus(false);
                            }
                          }}
                          placeholder="Ej: fosforos, CAPLA-001, bolsa, docena..."
                          style={{
                            ...inputStyle,
                            paddingLeft: 42,
                            paddingRight: q ? 42 : 12,
                            boxShadow: searchFocus
                              ? "0 0 0 4px rgba(37, 99, 235, 0.10)"
                              : "none",
                            borderColor: searchFocus ? "#3b82f6" : "#d1d5db",
                            transition: "all .2s ease",
                          }}
                          disabled={loadingProductos || enviando}
                        />

                        <span
                          style={{
                            position: "absolute",
                            left: 14,
                            top: "50%",
                            transform: "translateY(-50%)",
                            fontSize: 16,
                            opacity: 0.7,
                          }}
                        >
                          🔎
                        </span>

                        {q ? (
                          <button
                            type="button"
                            onClick={() => {
                              setQ("");
                              setSearchFocus(false);
                            }}
                            style={{
                              position: "absolute",
                              right: 10,
                              top: "50%",
                              transform: "translateY(-50%)",
                              border: 0,
                              background: "transparent",
                              cursor: "pointer",
                              fontSize: 16,
                              opacity: 0.7,
                            }}
                          >
                            ✕
                          </button>
                        ) : null}

                        {searchFocus && sugerencias.length > 0 ? (
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
                            }}
                          >
                            {sugerencias.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                  setQ(item.nombre || "");
                                  setSearchFocus(false);
                                }}
                                style={{
                                  textAlign: "left",
                                  border: "1px solid #eef2f7",
                                  background: "#fff",
                                  borderRadius: 10,
                                  padding: "10px 12px",
                                  cursor: "pointer",
                                }}
                              >
                                <div style={{ fontWeight: 700 }}>{item.nombre}</div>
                                <div className="muted" style={{ fontSize: 12 }}>
                                  Código: {item.sku || "—"}
                                </div>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        onClick={loadProductos}
                        style={miniBtn}
                        disabled={loadingProductos || enviando}
                      >
                        {loadingProductos ? <InlineLoader /> : "Recargar"}
                      </button>
                    </div>

                    <div
                      style={{
                        marginTop: 10,
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setSearchMode("todos")}
                        style={searchMode === "todos" ? chipActive : chipBtn}
                      >
                        Todo
                      </button>
                      <button
                        type="button"
                        onClick={() => setSearchMode("nombre")}
                        style={searchMode === "nombre" ? chipActive : chipBtn}
                      >
                        Nombre
                      </button>
                      <button
                        type="button"
                        onClick={() => setSearchMode("codigo")}
                        style={searchMode === "codigo" ? chipActive : chipBtn}
                      >
                        Código
                      </button>
                      <button
                        type="button"
                        onClick={() => setSearchMode("presentacion")}
                        style={searchMode === "presentacion" ? chipActive : chipBtn}
                      >
                        Presentación
                      </button>

                      <label
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          marginLeft: "auto",
                          fontSize: 13,
                          color: "#475569",
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderRadius: 999,
                          padding: "8px 12px",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={onlyConPrecio}
                          onChange={(e) => setOnlyConPrecio(e.target.checked)}
                        />
                        Solo con precio
                      </label>
                    </div>

                    <div
                      style={{
                        marginTop: 10,
                        fontSize: 13,
                        color: "#64748b",
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <span>
                        {q.trim()
                          ? `${productosFiltrados.length} resultado(s) para "${q}"`
                          : `${productosFiltrados.length} producto(s) disponibles`}
                      </span>

                      {q.trim() ? (
                        <button
                          type="button"
                          onClick={() => setQ("")}
                          style={{
                            border: 0,
                            background: "transparent",
                            color: "#2563eb",
                            cursor: "pointer",
                            fontWeight: 700,
                          }}
                        >
                          Limpiar búsqueda
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                  {loadingProductos ? (
                    <TableLoader />
                  ) : productosFiltrados.map((producto) => {
                    const linea = ensureLinea(producto);
                    const subtotal = getSubtotal(producto);

                    return (
                      <div
                        key={producto.id}
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: 14,
                          padding: 14,
                          opacity: enviando ? 0.7 : 1,
                          background: "#fff",
                          boxShadow: "0 4px 18px rgba(15, 23, 42, 0.03)",
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
                            <div style={{ fontWeight: 800 }}>{producto.nombre}</div>
                            <div className="muted" style={{ fontSize: 13 }}>
                              Código: {producto.sku || "—"}
                            </div>
                            <div className="muted" style={{ fontSize: 13 }}>
                              Presentaciones:{" "}
                              {(producto.presentaciones || [])
                                .map((p) => p.label || p.tipo)
                                .join(", ")}
                            </div>
                          </div>

                          <div style={{ fontWeight: 800, color: "#0f172a" }}>
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
                              disabled={enviando}
                            >
                              {(producto.presentaciones || []).map((p) => (
                                <option key={p.tipo} value={p.tipo}>
                                  {p.label || p.tipo} — factor {p.factor} — {money(p.precioVenta ?? p.precio)}
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
                              disabled={enviando}
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
                              disabled={!linea.usaMontoVariable || enviando}
                              style={{
                                ...inputStyle,
                                background: linea.usaMontoVariable ? "#fff" : "#f7f7f7",
                              }}
                            />
                          </div>
                        </div>

                        <div style={{ marginTop: 12 }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input
                              type="checkbox"
                              checked={!!linea.usaMontoVariable}
                              onChange={(e) => toggleMontoVariable(producto, e.target.checked)}
                              disabled={enviando}
                            />
                            <span>Usar monto variable</span>
                          </label>
                        </div>
                      </div>
                    );
                  })}

                  {!loadingProductos && productosFiltrados.length === 0 && (
                    <div
                      style={{
                        border: "1px dashed #cbd5e1",
                        borderRadius: 14,
                        padding: 18,
                        textAlign: "center",
                        color: "#64748b",
                        background: "#f8fafc",
                      }}
                    >
                      No se encontraron productos con esa búsqueda.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 16, position: "sticky", top: 12 }}>
              <div className="card pad">
                <h3 style={{ marginTop: 0 }}>Resumen del pedido</h3>

                <div style={{ display: "grid", gap: 10 }}>
                  <div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      Cliente
                    </div>
                    <div style={{ fontWeight: 600 }}>
                      {clienteSeleccionado?.nombre || "No seleccionado"}
                    </div>
                  </div>

                  <div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      Ruta / Zona
                    </div>
                    <div style={{ fontWeight: 600 }}>
                      {(clienteSeleccionado?.ruta_nombre || "—") +
                        " / " +
                        (clienteSeleccionado?.zona_nombre || "—")}
                    </div>
                  </div>

                  <div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      Productos agregados
                    </div>
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
                  disabled={enviando || (isVendedor && !userUbicacionId)}
                  style={{
                    ...submitBtn,
                    cursor: enviando ? "not-allowed" : "pointer",
                    opacity: enviando ? 0.85 : 1,
                  }}
                >
                  {enviando ? <InlineLoader /> : "Enviar pedido al admin"}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {vista === "mios" && (
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
                disabled={loadingMisPedidos}
              >
                <option value="">Todos los estados</option>
                <option value="pendiente_revision">Pendiente revisión</option>
                <option value="aprobado">Aprobado</option>
                <option value="preparando">Preparando</option>
                <option value="en_ruta">En ruta</option>
                <option value="entregado">Entregado</option>
              </select>
            </div>
          </div>

          {loadingMisPedidos ? (
            <TableLoader />
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
                      <div style={estadoBadgeStyle(pedido.estado)}>
                        {String(pedido.estado || "").replaceAll("_", " ")}
                      </div>
                      <div style={{ marginTop: 8, fontWeight: 800 }}>{money(pedido.total)}</div>
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
                            {d.cantidad} × {d.presentacion || "unidad"} ×{" "}
                            {money(d.precio_unitario)}
                          </div>
                          <div style={{ marginTop: 4, fontWeight: 700 }}>{money(d.subtotal)}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {pedido.observaciones ? (
                    <div style={{ marginTop: 10 }}>
                      <div className="muted" style={{ fontSize: 13 }}>
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
  boxShadow: "0 4px 14px rgba(37, 99, 235, 0.12)",
};

const saveBtn = {
  border: 0,
  background: "#111827",
  color: "#fff",
  borderRadius: 10,
  padding: "12px 14px",
  cursor: "pointer",
  fontWeight: 700,
  minHeight: 44,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
};

const submitBtn = {
  width: "100%",
  marginTop: 14,
  border: 0,
  borderRadius: 10,
  padding: "12px 14px",
  fontWeight: 700,
  minHeight: 46,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};