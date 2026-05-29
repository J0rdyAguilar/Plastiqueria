import React, { useEffect, useMemo, useState } from "react";
import {
  Users,
  Search,
  RefreshCw,
  UserPlus,
  Phone,
  MapPin,
  Route as RouteIcon,
  MapPinned,
  Edit3,
  Trash2,
  X,
  Save,
  Loader2,
  CheckCircle2,
  Ban,
  UserRound,
} from "lucide-react";
import { getSession, getToken } from "../lib/auth";

const API_BASE = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000/api/v1"
).replace(/\/+$/, "");

function getPossibleTokenFromObject(obj) {
  if (!obj || typeof obj !== "object") return "";

  return (
    obj.token ||
    obj.access_token ||
    obj.plainTextToken ||
    obj.plain_text_token ||
    obj.auth_token ||
    obj.bearer ||
    obj?.data?.token ||
    obj?.data?.access_token ||
    obj?.data?.plainTextToken ||
    obj?.data?.plain_text_token ||
    obj?.user?.token ||
    ""
  );
}

function getAuthToken() {
  const directToken = getToken?.();
  if (directToken) return directToken;

  const session = getSession?.();
  const sessionToken = getPossibleTokenFromObject(session);
  if (sessionToken) return sessionToken;

  const commonKeys = [
    "token",
    "access_token",
    "auth_token",
    "session",
    "auth",
    "user",
    "usuario",
  ];

  for (const key of commonKeys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      const token = getPossibleTokenFromObject(parsed);
      if (token) return token;
    } catch {
      if (raw.length > 20 && !raw.includes("{")) return raw;
    }
  }

  return "";
}

async function requestApi(path, options = {}) {
  const token = getAuthToken();

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  const text = await res.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const message =
      data?.message ||
      data?.error ||
      getValidationError(data) ||
      `Error HTTP ${res.status}`;

    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

function getValidationError(data) {
  if (!data?.errors || typeof data.errors !== "object") return "";
  const firstKey = Object.keys(data.errors)[0];
  const firstVal = firstKey ? data.errors[firstKey] : null;

  if (Array.isArray(firstVal) && firstVal[0]) return firstVal[0];
  if (typeof firstVal === "string" && firstVal.trim()) return firstVal;

  return "";
}

function normalizeRows(resp) {
  if (Array.isArray(resp)) return resp;
  if (Array.isArray(resp?.data)) return resp.data;
  if (Array.isArray(resp?.data?.data)) return resp.data.data;
  if (Array.isArray(resp?.clientes)) return resp.clientes;
  if (Array.isArray(resp?.rows)) return resp.rows;
  return [];
}

function normalizePagination(resp) {
  const source = resp?.data?.data ? resp.data : resp;

  return {
    current_page: Number(source?.current_page || 1),
    last_page: Number(source?.last_page || 1),
    per_page: Number(source?.per_page || 20),
    total: Number(source?.total || normalizeRows(resp).length || 0),
  };
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

const emptyForm = {
  nombre: "",
  propietario: "",
  telefono: "",
  direccion: "",
  referencia: "",
  ruta_id: "",
  zona_id: "",
  activo: true,
};

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0,
  });

  const [filters, setFilters] = useState({
    q: "",
    activo: "",
    page: 1,
    per_page: 20,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  async function loadClientes(nextFilters = filters) {
    try {
      setLoading(true);

      const params = new URLSearchParams();

      Object.entries(nextFilters).forEach(([key, value]) => {
        if (value !== "" && value !== null && value !== undefined) {
          params.set(key, value);
        }
      });

      const resp = await requestApi(`/clientes?${params.toString()}`, {
        method: "GET",
      });

      setClientes(normalizeRows(resp));
      setPagination(normalizePagination(resp));
    } catch (error) {
      console.error("ERROR CLIENTES:", error);
      alert(error?.message || "No se pudo cargar clientes.");
      setClientes([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, filters.per_page, filters.activo]);

  const metrics = useMemo(() => {
    const activos = clientes.filter((c) => !!c.activo).length;
    const inactivos = clientes.filter((c) => !c.activo).length;

    return {
      total: pagination.total || clientes.length,
      activos,
      inactivos,
    };
  }, [clientes, pagination.total]);

  function onSearchSubmit(e) {
    e.preventDefault();
    const next = {
      ...filters,
      page: 1,
    };

    setFilters(next);
    loadClientes(next);
  }

  function resetFilters() {
    const next = {
      q: "",
      activo: "",
      page: 1,
      per_page: 20,
    };

    setFilters(next);
    loadClientes(next);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(cliente) {
    setEditing(cliente);
    setForm({
      nombre: cliente?.nombre || "",
      propietario: cliente?.propietario || "",
      telefono: cliente?.telefono || "",
      direccion: cliente?.direccion || "",
      referencia: cliente?.referencia || "",
      ruta_id: cliente?.ruta_id ? String(cliente.ruta_id) : "",
      zona_id: cliente?.zona_id ? String(cliente.zona_id) : "",
      activo: !!cliente?.activo,
    });
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm);
  }

  function updateForm(key, value) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function submitForm(e) {
    e.preventDefault();

    if (!form.nombre.trim()) {
      alert("El nombre del cliente es obligatorio.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        nombre: form.nombre.trim(),
        propietario: form.propietario.trim() || "",
        telefono: form.telefono.trim() || "",
        direccion: form.direccion.trim() || "Sin dirección",
        referencia: form.referencia.trim() || "",
        ruta_id: form.ruta_id ? Number(form.ruta_id) : null,
        zona_id: form.zona_id ? Number(form.zona_id) : null,
        activo: !!form.activo,
      };

      if (editing?.id) {
        await requestApi(`/clientes/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });

        alert("Cliente actualizado correctamente.");
      } else {
        await requestApi("/clientes", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        alert("Cliente creado correctamente.");
      }

      closeModal();
      await loadClientes();
    } catch (error) {
      console.error("ERROR GUARDANDO CLIENTE:", error);
      alert(error?.message || "No se pudo guardar el cliente.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCliente(cliente) {
    if (!cliente?.id) return;

    if (
      !window.confirm(
        `¿Eliminar el cliente "${cliente.nombre}"? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }

    try {
      await requestApi(`/clientes/${cliente.id}`, {
        method: "DELETE",
      });

      alert("Cliente eliminado correctamente.");
      await loadClientes();
    } catch (error) {
      console.error("ERROR ELIMINANDO CLIENTE:", error);
      alert(error?.message || "No se pudo eliminar el cliente.");
    }
  }

  function goPage(page) {
    const nextPage = Math.max(1, Math.min(Number(page), pagination.last_page || 1));
    setFilters((prev) => ({
      ...prev,
      page: nextPage,
    }));
  }

  return (
    <section style={pageStyle}>
      <div style={shellStyle}>
        <div style={heroStyle}>
          <div>
            <div style={chipTopStyle}>
              <Users size={16} />
              Administración de clientes
            </div>

            <h1 style={heroTitleStyle}>Clientes</h1>

            <p style={heroTextStyle}>
              Consulta, busca y administra los clientes registrados en el sistema.
            </p>
          </div>

          <button type="button" onClick={openCreate} style={heroButtonStyle}>
            <UserPlus size={18} />
            Nuevo cliente
          </button>
        </div>

        <div style={metricsGridStyle}>
          <MetricCard
            icon={<Users size={18} />}
            title="Total clientes"
            value={metrics.total}
            subtitle="Clientes registrados"
          />
          <MetricCard
            icon={<CheckCircle2 size={18} />}
            title="Activos visibles"
            value={metrics.activos}
            subtitle="Según la página actual"
            accent="green"
          />
          <MetricCard
            icon={<Ban size={18} />}
            title="Inactivos visibles"
            value={metrics.inactivos}
            subtitle="Según la página actual"
            accent="red"
          />
        </div>

        <div style={filterCardStyle}>
          <form onSubmit={onSearchSubmit} style={filtersGridStyle}>
            <div>
              <label style={labelStyle}>Buscar cliente</label>
              <div style={{ position: "relative" }}>
                <Search size={18} style={leadingIconStyle} />
                <input
                  value={filters.q}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      q: e.target.value,
                    }))
                  }
                  placeholder="Nombre, propietario, teléfono, dirección..."
                  style={{ ...inputStyle, paddingLeft: 42 }}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Estado</label>
              <select
                value={filters.activo}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    activo: e.target.value,
                    page: 1,
                  }))
                }
                style={inputStyle}
              >
                <option value="">Todos</option>
                <option value="1">Activos</option>
                <option value="0">Inactivos</option>
              </select>
            </div>

            <button type="submit" style={primaryButtonStyle}>
              <Search size={18} />
              Buscar
            </button>

            <button type="button" onClick={resetFilters} style={secondaryButtonStyle}>
              <RefreshCw size={18} />
              Limpiar
            </button>
          </form>
        </div>

        <div style={tableCardStyle}>
          <div style={tableHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>Listado de clientes</h2>
              <p style={sectionTextStyle}>
                Vista disponible para superadmin.
              </p>
            </div>

            <button type="button" onClick={() => loadClientes()} style={miniButtonStyle}>
              <RefreshCw size={16} />
              Actualizar
            </button>
          </div>

          {loading ? (
            <div style={emptyStyle}>
              <Loader2 size={20} className="spin-icon" />
              Cargando clientes...
            </div>
          ) : clientes.length === 0 ? (
            <div style={emptyStyle}>
              No hay clientes registrados con los filtros seleccionados.
            </div>
          ) : (
            <div style={cardsGridStyle}>
              {clientes.map((cliente) => (
                <article key={cliente.id} style={clientCardStyle}>
                  <div style={clientTopStyle}>
                    <div>
                      <div style={idLabelStyle}>Cliente #{cliente.id}</div>
                      <h3 style={clientNameStyle}>{cliente.nombre || "Sin nombre"}</h3>
                      <div style={ownerStyle}>
                        <UserRound size={14} />
                        {cliente.propietario || "Sin propietario"}
                      </div>
                    </div>

                    <span style={estadoBadgeStyle(cliente.activo)}>
                      {cliente.activo ? "Activo" : "Inactivo"}
                    </span>
                  </div>

                  <div style={infoGridStyle}>
                    <InfoItem
                      icon={<Phone size={15} />}
                      label="Teléfono"
                      value={cliente.telefono || "—"}
                    />
                    <InfoItem
                      icon={<MapPin size={15} />}
                      label="Dirección"
                      value={cliente.direccion || "—"}
                    />
                    <InfoItem
                      icon={<RouteIcon size={15} />}
                      label="Ruta"
                      value={cliente.ruta?.nombre || cliente.ruta_nombre || "—"}
                    />
                    <InfoItem
                      icon={<MapPinned size={15} />}
                      label="Zona"
                      value={cliente.zona?.nombre || cliente.zona_nombre || "—"}
                    />
                  </div>

                  {cliente.referencia ? (
                    <div style={referenceStyle}>
                      <strong>Referencia:</strong> {cliente.referencia}
                    </div>
                  ) : null}

                  <div style={dateStyle}>
                    Creado: {formatDate(cliente.creado_en || cliente.created_at)}
                  </div>

                  <div style={actionsStyle}>
                    <button
                      type="button"
                      onClick={() => openEdit(cliente)}
                      style={editButtonStyle}
                    >
                      <Edit3 size={16} />
                      Editar
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteCliente(cliente)}
                      style={deleteButtonStyle}
                    >
                      <Trash2 size={16} />
                      Eliminar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div style={paginationStyle}>
            <button
              type="button"
              disabled={pagination.current_page <= 1}
              onClick={() => goPage(pagination.current_page - 1)}
              style={{
                ...pageButtonStyle,
                opacity: pagination.current_page <= 1 ? 0.5 : 1,
              }}
            >
              Anterior
            </button>

            <span style={pageTextStyle}>
              Página {pagination.current_page} de {pagination.last_page} ·{" "}
              {pagination.total} registro(s)
            </span>

            <button
              type="button"
              disabled={pagination.current_page >= pagination.last_page}
              onClick={() => goPage(pagination.current_page + 1)}
              style={{
                ...pageButtonStyle,
                opacity:
                  pagination.current_page >= pagination.last_page ? 0.5 : 1,
              }}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div style={modalOverlayStyle}>
          <form onSubmit={submitForm} style={modalStyle}>
            <div style={modalHeaderStyle}>
              <div>
                <h2 style={modalTitleStyle}>
                  {editing ? "Editar cliente" : "Nuevo cliente"}
                </h2>
                <p style={modalTextStyle}>
                  Los campos de ruta y zona pueden quedar vacíos si quieres usar los valores por defecto.
                </p>
              </div>

              <button type="button" onClick={closeModal} style={closeButtonStyle}>
                <X size={18} />
              </button>
            </div>

            <div style={modalGridStyle}>
              <div>
                <label style={labelStyle}>Nombre *</label>
                <input
                  value={form.nombre}
                  onChange={(e) => updateForm("nombre", e.target.value)}
                  style={inputStyle}
                  placeholder="Nombre del cliente o tienda"
                />
              </div>

              <div>
                <label style={labelStyle}>Propietario</label>
                <input
                  value={form.propietario}
                  onChange={(e) => updateForm("propietario", e.target.value)}
                  style={inputStyle}
                  placeholder="Nombre del propietario"
                />
              </div>

              <div>
                <label style={labelStyle}>Teléfono</label>
                <input
                  value={form.telefono}
                  onChange={(e) => updateForm("telefono", e.target.value)}
                  style={inputStyle}
                  placeholder="Teléfono"
                />
              </div>

              <div>
                <label style={labelStyle}>Activo</label>
                <select
                  value={form.activo ? "1" : "0"}
                  onChange={(e) => updateForm("activo", e.target.value === "1")}
                  style={inputStyle}
                >
                  <option value="1">Activo</option>
                  <option value="0">Inactivo</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Ruta ID</label>
                <input
                  type="number"
                  value={form.ruta_id}
                  onChange={(e) => updateForm("ruta_id", e.target.value)}
                  style={inputStyle}
                  placeholder="Opcional"
                />
              </div>

              <div>
                <label style={labelStyle}>Zona ID</label>
                <input
                  type="number"
                  value={form.zona_id}
                  onChange={(e) => updateForm("zona_id", e.target.value)}
                  style={inputStyle}
                  placeholder="Opcional"
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Dirección</label>
                <input
                  value={form.direccion}
                  onChange={(e) => updateForm("direccion", e.target.value)}
                  style={inputStyle}
                  placeholder="Dirección"
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Referencia</label>
                <textarea
                  rows={3}
                  value={form.referencia}
                  onChange={(e) => updateForm("referencia", e.target.value)}
                  style={textareaStyle}
                  placeholder="Referencia o indicaciones"
                />
              </div>
            </div>

            <div style={modalActionsStyle}>
              <button type="button" onClick={closeModal} style={secondaryButtonStyle}>
                Cancelar
              </button>

              <button
                type="submit"
                disabled={saving}
                style={{
                  ...primaryButtonStyle,
                  opacity: saving ? 0.75 : 1,
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? <Loader2 size={18} className="spin-icon" /> : <Save size={18} />}
                {saving ? "Guardando..." : "Guardar cliente"}
              </button>
            </div>
          </form>
        </div>
      )}

      <style>
        {`
          .spin-icon {
            animation: spin 1s linear infinite;
          }

          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }

          @media (max-width: 900px) {
            div[style*="grid-template-columns: 1.2fr 0.45fr auto auto"] {
              grid-template-columns: 1fr !important;
            }

            div[style*="grid-template-columns: repeat(3, 1fr)"] {
              grid-template-columns: 1fr !important;
            }

            div[style*="grid-template-columns: repeat(2, 1fr)"] {
              grid-template-columns: 1fr !important;
            }
          }
        `}
      </style>
    </section>
  );
}

function MetricCard({ icon, title, value, subtitle, accent = "blue" }) {
  const tones = {
    blue: {
      bg: "linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%)",
      border: "#bfdbfe",
      color: "#1d4ed8",
      iconBg: "#2563eb",
    },
    green: {
      bg: "linear-gradient(180deg, #ecfdf5 0%, #d1fae5 100%)",
      border: "#a7f3d0",
      color: "#047857",
      iconBg: "#059669",
    },
    red: {
      bg: "linear-gradient(180deg, #fef2f2 0%, #fee2e2 100%)",
      border: "#fecaca",
      color: "#b91c1c",
      iconBg: "#dc2626",
    },
  };

  const tone = tones[accent] || tones.blue;

  return (
    <div
      style={{
        borderRadius: 24,
        padding: 18,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        boxShadow: "0 12px 28px rgba(15,23,42,0.06)",
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 14,
          display: "grid",
          placeItems: "center",
          background: tone.iconBg,
          color: "#fff",
          marginBottom: 14,
        }}
      >
        {icon}
      </div>

      <div style={{ color: "#64748b", fontSize: 13, marginBottom: 6 }}>
        {title}
      </div>
      <div
        style={{
          color: "#0f172a",
          fontWeight: 900,
          fontSize: 26,
          letterSpacing: "-0.03em",
          marginBottom: 4,
        }}
      >
        {value}
      </div>
      <div style={{ color: "#64748b", fontSize: 13 }}>{subtitle}</div>
    </div>
  );
}

function InfoItem({ icon, label, value }) {
  return (
    <div style={infoItemStyle}>
      <div style={infoLabelStyle}>
        {icon}
        {label}
      </div>
      <div style={infoValueStyle}>{value}</div>
    </div>
  );
}

function estadoBadgeStyle(activo) {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 800,
    border: `1px solid ${activo ? "#bbf7d0" : "#fecaca"}`,
    background: activo ? "#dcfce7" : "#fee2e2",
    color: activo ? "#166534" : "#b91c1c",
  };
}

const pageStyle = {
  minHeight: "100%",
  padding: 28,
};

const shellStyle = {
  maxWidth: 1400,
  margin: "0 auto",
  display: "grid",
  gap: 24,
};

const heroStyle = {
  borderRadius: 28,
  padding: "30px 28px",
  background:
    "linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.96) 45%, rgba(59,130,246,0.84) 100%)",
  boxShadow: "0 20px 60px rgba(15,23,42,0.20)",
  border: "1px solid rgba(255,255,255,0.10)",
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  alignItems: "center",
  flexWrap: "wrap",
};

const chipTopStyle = {
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
};

const heroTitleStyle = {
  margin: 0,
  color: "#fff",
  fontSize: "clamp(28px, 4vw, 40px)",
  fontWeight: 800,
  letterSpacing: "-0.03em",
};

const heroTextStyle = {
  margin: "10px 0 0",
  color: "rgba(255,255,255,0.78)",
  fontSize: 15,
  maxWidth: 760,
  lineHeight: 1.6,
};

const heroButtonStyle = {
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.12)",
  color: "#fff",
  height: 52,
  borderRadius: 16,
  padding: "0 18px",
  fontWeight: 800,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
};

const metricsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 16,
};

const filterCardStyle = {
  background: "rgba(255,255,255,0.88)",
  borderRadius: 28,
  padding: 24,
  border: "1px solid rgba(148,163,184,0.18)",
  boxShadow: "0 18px 45px rgba(15,23,42,0.08)",
};

const filtersGridStyle = {
  display: "grid",
  gridTemplateColumns: "1.2fr 0.45fr auto auto",
  gap: 14,
  alignItems: "end",
};

const tableCardStyle = {
  background: "rgba(255,255,255,0.88)",
  borderRadius: 28,
  padding: 24,
  border: "1px solid rgba(148,163,184,0.18)",
  boxShadow: "0 18px 45px rgba(15,23,42,0.08)",
};

const tableHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  flexWrap: "wrap",
  marginBottom: 18,
};

const sectionTitleStyle = {
  margin: 0,
  fontSize: 24,
  fontWeight: 800,
  color: "#0f172a",
};

const sectionTextStyle = {
  margin: "6px 0 0",
  color: "#64748b",
  fontSize: 14,
};

const cardsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: 16,
};

const clientCardStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 24,
  background: "#fff",
  padding: 20,
  display: "grid",
  gap: 16,
};

const clientTopStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
};

const idLabelStyle = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 6,
};

const clientNameStyle = {
  margin: 0,
  fontSize: 22,
  fontWeight: 900,
  color: "#0f172a",
  letterSpacing: "-0.03em",
};

const ownerStyle = {
  marginTop: 8,
  display: "flex",
  alignItems: "center",
  gap: 7,
  color: "#64748b",
  fontSize: 14,
  fontWeight: 700,
};

const infoGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: 12,
};

const infoItemStyle = {
  borderRadius: 18,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  padding: 14,
};

const infoLabelStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "#64748b",
  fontSize: 12,
  fontWeight: 800,
  marginBottom: 8,
};

const infoValueStyle = {
  color: "#0f172a",
  fontWeight: 800,
  fontSize: 14,
  lineHeight: 1.4,
  wordBreak: "break-word",
};

const referenceStyle = {
  borderRadius: 16,
  background: "#f8fafc",
  border: "1px dashed #cbd5e1",
  padding: 12,
  color: "#475569",
  fontSize: 14,
  lineHeight: 1.5,
};

const dateStyle = {
  color: "#64748b",
  fontSize: 12,
};

const actionsStyle = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
};

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

const leadingIconStyle = {
  position: "absolute",
  left: 14,
  top: "50%",
  transform: "translateY(-50%)",
  color: "#64748b",
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
};

const secondaryButtonStyle = {
  height: 52,
  border: "1px solid #dbe2ea",
  borderRadius: 16,
  padding: "0 20px",
  background: "#fff",
  color: "#0f172a",
  fontWeight: 800,
  fontSize: 15,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
};

const miniButtonStyle = {
  height: 42,
  border: "1px solid #dbe2ea",
  borderRadius: 14,
  padding: "0 14px",
  background: "#fff",
  color: "#0f172a",
  fontWeight: 800,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

const editButtonStyle = {
  height: 42,
  border: "1px solid #bfdbfe",
  borderRadius: 14,
  padding: "0 14px",
  background: "#eff6ff",
  color: "#1d4ed8",
  fontWeight: 800,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

const deleteButtonStyle = {
  height: 42,
  border: "1px solid #fecaca",
  borderRadius: 14,
  padding: "0 14px",
  background: "#fef2f2",
  color: "#b91c1c",
  fontWeight: 800,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

const emptyStyle = {
  borderRadius: 22,
  border: "1px dashed #cbd5e1",
  padding: "36px 20px",
  textAlign: "center",
  color: "#64748b",
  background:
    "linear-gradient(180deg, rgba(248,250,252,0.95) 0%, rgba(241,245,249,0.95) 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
};

const paginationStyle = {
  marginTop: 18,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  flexWrap: "wrap",
};

const pageButtonStyle = {
  height: 40,
  border: "1px solid #dbe2ea",
  borderRadius: 12,
  padding: "0 14px",
  background: "#fff",
  color: "#0f172a",
  fontWeight: 800,
  cursor: "pointer",
};

const pageTextStyle = {
  color: "#64748b",
  fontSize: 14,
  fontWeight: 700,
};

const modalOverlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 999999999,
  background: "rgba(15,23,42,0.55)",
  display: "grid",
  placeItems: "center",
  padding: 18,
};

const modalStyle = {
  width: "min(880px, 100%)",
  maxHeight: "92vh",
  overflowY: "auto",
  borderRadius: 28,
  background: "#fff",
  boxShadow: "0 30px 80px rgba(15,23,42,0.35)",
  padding: 24,
};

const modalHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 20,
};

const modalTitleStyle = {
  margin: 0,
  color: "#0f172a",
  fontSize: 26,
  fontWeight: 900,
};

const modalTextStyle = {
  margin: "6px 0 0",
  color: "#64748b",
  fontSize: 14,
};

const closeButtonStyle = {
  width: 42,
  height: 42,
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  background: "#fff",
  color: "#0f172a",
  cursor: "pointer",
  display: "grid",
  placeItems: "center",
};

const modalGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: 14,
};

const modalActionsStyle = {
  marginTop: 20,
  display: "flex",
  justifyContent: "flex-end",
  gap: 12,
  flexWrap: "wrap",
};
