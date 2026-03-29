import React, { useEffect, useMemo, useState } from "react";
import { getSession } from "../lib/auth";
import { perfilApi } from "../lib/perfil";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Shield,
  Lock,
  Camera,
  Save,
  BadgeCheck,
  CalendarDays,
  Briefcase,
  Sparkles,
  Activity,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";


function getInitials(name = "") {
  const parts = String(name).trim().split(" ").filter(Boolean);
  if (!parts.length) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function prettyRole(role = "") {
  const r = String(role || "").toLowerCase();
  if (r.includes("super")) return "Super administrador";
  if (r.includes("admin")) return "Administrador";
  if (r.includes("vendedor_tienda")) return "Vendedor tienda";
  if (r.includes("vendedor")) return "Vendedor";
  if (r.includes("caja")) return "Caja";
  return role || "Usuario";
}

function formatDate(date) {
  try {
    return new Intl.DateTimeFormat("es-GT", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(date);
  } catch {
    return "";
  }
}

function getPasswordStrength(password = "") {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) return { label: "Baja", className: "is-weak" };
  if (score <= 4) return { label: "Media", className: "is-medium" };
  return { label: "Alta", className: "is-strong" };
}

export default function PerfilUsuario() {
  const session = getSession();
  const me = session?.user || {};

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState(null);

  const [showPasswords, setShowPasswords] = useState({
    actual: false,
    nueva: false,
    confirmar: false,
  });

  const [passwordForm, setPasswordForm] = useState({
    password_actual: "",
    password_nueva: "",
    password_confirmar: "",
  });

  const [passwordMsg, setPasswordMsg] = useState({
    type: "",
    text: "",
  });

  const [form, setForm] = useState({
    nombre: me?.name || me?.nombre || "",
    correo: me?.email || me?.correo || "",
    telefono: me?.telefono || "",
    direccion: me?.direccion || "",
    puesto: prettyRole(me?.role || me?.rol || ""),
    sucursal: me?.sucursal?.nombre || me?.sucursal || "Sucursal principal",
    bio: me?.bio || "Usuario del sistema con acceso a operaciones y control interno.",
  });

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    try {
      const data = await perfilApi.me();
      const user = data?.user || data || {};

      setForm({
        nombre: user?.nombre || user?.name || "",
        correo: user?.correo || user?.email || "",
        telefono: user?.telefono || "",
        direccion: user?.direccion || "",
        puesto: prettyRole(user?.rol || user?.role || ""),
        sucursal: user?.sucursal?.nombre || user?.sucursal_nombre || "Sucursal principal",
        bio: user?.bio || "Usuario del sistema con acceso a operaciones y control interno.",
      });

      setPreview(user?.foto_url || user?.avatar_url || user?.foto || null);
    } catch (error) {
      console.error(error);
      setPreview(me?.foto_url || me?.avatar || me?.foto || null);
    } finally {
      setLoading(false);
    }
  }

  const initials = useMemo(() => getInitials(form.nombre), [form.nombre]);
  const memberSince = useMemo(() => formatDate(new Date()), []);
  const passwordStrength = useMemo(
    () => getPasswordStrength(passwordForm.password_nueva),
    [passwordForm.password_nueva]
  );

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handlePasswordChange(e) {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({
      ...prev,
      [name]: value,
    }));
    setPasswordMsg({ type: "", text: "" });
  }

  function togglePassword(field) {
    setShowPasswords((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  }

  function handleFotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Selecciona una imagen válida.");
      return;
    }

    setFoto(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
    };
    reader.readAsDataURL(file);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSavingProfile(true);

    try {
      const data = new FormData();
      data.append("nombre", form.nombre);
      data.append("correo", form.correo);
      data.append("telefono", form.telefono);
      data.append("direccion", form.direccion);
      data.append("bio", form.bio);

      if (foto) {
        data.append("foto", foto);
      }

      const resp = await perfilApi.update(data);
      const user = resp?.user || resp || {};

      setForm((prev) => ({
        ...prev,
        nombre: user?.nombre || prev.nombre,
        correo: user?.correo || prev.correo,
        telefono: user?.telefono || prev.telefono,
        direccion: user?.direccion || prev.direccion,
        bio: user?.bio || prev.bio,
        sucursal: user?.sucursal?.nombre || user?.sucursal_nombre || prev.sucursal,
        puesto: prettyRole(user?.rol || user?.role || prev.puesto),
      }));

      if (user?.foto_url || user?.avatar_url || user?.foto) {
        setPreview(user?.foto_url || user?.avatar_url || user?.foto);
      }

      setFoto(null);
      alert("Perfil actualizado correctamente.");
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.message || "No se pudo guardar el perfil.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword() {
    setPasswordMsg({ type: "", text: "" });

    if (!passwordForm.password_actual.trim()) {
      setPasswordMsg({ type: "error", text: "Debes escribir tu contraseña actual." });
      return;
    }

    if (!passwordForm.password_nueva.trim()) {
      setPasswordMsg({ type: "error", text: "Debes escribir una nueva contraseña." });
      return;
    }

    if (passwordForm.password_nueva.length < 8) {
      setPasswordMsg({
        type: "error",
        text: "La nueva contraseña debe tener al menos 8 caracteres.",
      });
      return;
    }

    if (passwordForm.password_nueva !== passwordForm.password_confirmar) {
      setPasswordMsg({
        type: "error",
        text: "La confirmación no coincide con la nueva contraseña.",
      });
      return;
    }

    if (passwordForm.password_actual === passwordForm.password_nueva) {
      setPasswordMsg({
        type: "error",
        text: "La nueva contraseña no puede ser igual a la actual.",
      });
      return;
    }

    setSavingPassword(true);

    try {
      await perfilApi.changePassword({
        password_actual: passwordForm.password_actual,
        password_nueva: passwordForm.password_nueva,
        password_nueva_confirmation: passwordForm.password_confirmar,
      });

      setPasswordForm({
        password_actual: "",
        password_nueva: "",
        password_confirmar: "",
      });

      setPasswordMsg({
        type: "success",
        text: "Contraseña actualizada correctamente.",
      });
    } catch (error) {
      console.error(error);
      setPasswordMsg({
        type: "error",
        text: error?.response?.data?.message || "No se pudo actualizar la contraseña.",
      });
    } finally {
      setSavingPassword(false);
    }
  }

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-loading">Cargando perfil...</div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-shell">
        <section className="profile-hero">
          <div className="profile-hero__bg" />
          <div className="profile-hero__content">
            <div className="profile-avatar-wrap">
              <div className="profile-avatar profile-avatar--premium">
                {preview ? (
                  <img
                    src={preview}
                    alt="Foto de perfil"
                    className="profile-avatar-img"
                  />
                ) : (
                  <span className="profile-avatar-text">{initials}</span>
                )}
              </div>

              <label className="profile-avatar-btn" title="Cambiar foto">
                <Camera size={16} />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFotoChange}
                  hidden
                />
              </label>
            </div>

            <div className="profile-hero__info">
              <div className="profile-badge">
                <Sparkles size={14} />
                Perfil premium
              </div>

              <h1>{form.nombre || "Usuario del sistema"}</h1>
              <p>
                {form.puesto} · {form.sucursal}
              </p>

              <div className="profile-hero__meta">
                <span>
                  <BadgeCheck size={16} />
                  Cuenta activa
                </span>
                <span>
                  <CalendarDays size={16} />
                  Miembro desde {memberSince}
                </span>
              </div>
            </div>

            <div className="profile-hero__stats">
              <div className="profile-stat-card">
                <span>Acceso</span>
                <strong>Completo</strong>
                <small>Seguridad validada</small>
              </div>
              <div className="profile-stat-card">
                <span>Estado</span>
                <strong>En línea</strong>
                <small>Sesión actual activa</small>
              </div>
            </div>
          </div>
        </section>

        <div className="profile-grid">
          <div className="profile-main">
            <form className="profile-card" onSubmit={handleSave}>
              <div className="profile-card__head">
                <div>
                  <h2>Información personal</h2>
                  <p>Edita tus datos visibles dentro del sistema.</p>
                </div>
                <div className="profile-card__icon">
                  <User size={18} />
                </div>
              </div>

              <div className="profile-form-grid">
                <div className="field">
                  <label>Nombre completo</label>
                  <div className="field-control">
                    <User size={17} />
                    <input
                      type="text"
                      name="nombre"
                      value={form.nombre}
                      onChange={handleChange}
                      placeholder="Tu nombre"
                    />
                  </div>
                </div>

                <div className="field">
                  <label>Correo electrónico</label>
                  <div className="field-control">
                    <Mail size={17} />
                    <input
                      type="email"
                      name="correo"
                      value={form.correo}
                      onChange={handleChange}
                      placeholder="correo@ejemplo.com"
                    />
                  </div>
                </div>

                <div className="field">
                  <label>Teléfono</label>
                  <div className="field-control">
                    <Phone size={17} />
                    <input
                      type="text"
                      name="telefono"
                      value={form.telefono}
                      onChange={handleChange}
                      placeholder="Tu número"
                    />
                  </div>
                </div>

                <div className="field">
                  <label>Dirección</label>
                  <div className="field-control">
                    <MapPin size={17} />
                    <input
                      type="text"
                      name="direccion"
                      value={form.direccion}
                      onChange={handleChange}
                      placeholder="Tu dirección"
                    />
                  </div>
                </div>

                <div className="field">
                  <label>Puesto</label>
                  <div className="field-control field-control--readonly">
                    <Briefcase size={17} />
                    <input type="text" value={form.puesto} readOnly />
                  </div>
                </div>

                <div className="field">
                  <label>Sucursal</label>
                  <div className="field-control field-control--readonly">
                    <Shield size={17} />
                    <input type="text" value={form.sucursal} readOnly />
                  </div>
                </div>

                <div className="field field--full">
                  <label>Biografía / descripción</label>
                  <div className="textarea-control">
                    <textarea
                      name="bio"
                      value={form.bio}
                      onChange={handleChange}
                      rows={4}
                      placeholder="Escribe una breve descripción..."
                    />
                  </div>
                </div>
              </div>

              <div className="profile-actions">
                <button className="btn-save" type="submit" disabled={savingProfile}>
                  <Save size={17} />
                  {savingProfile ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </form>

            <div className="profile-card">
              <div className="profile-card__head">
                <div>
                  <h2>Cambiar contraseña</h2>
                  <p>Actualiza tu acceso de forma segura.</p>
                </div>
                <div className="profile-card__icon">
                  <Lock size={18} />
                </div>
              </div>

              <div className="profile-form-grid">
                <div className="field">
                  <label>Contraseña actual</label>
                  <div className="field-control field-control--password">
                    <Lock size={17} />
                    <input
                      type={showPasswords.actual ? "text" : "password"}
                      name="password_actual"
                      value={passwordForm.password_actual}
                      onChange={handlePasswordChange}
                      placeholder="Ingresa tu contraseña actual"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => togglePassword("actual")}
                    >
                      {showPasswords.actual ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="field">
                  <label>Nueva contraseña</label>
                  <div className="field-control field-control--password">
                    <Lock size={17} />
                    <input
                      type={showPasswords.nueva ? "text" : "password"}
                      name="password_nueva"
                      value={passwordForm.password_nueva}
                      onChange={handlePasswordChange}
                      placeholder="Nueva contraseña"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => togglePassword("nueva")}
                    >
                      {showPasswords.nueva ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {!!passwordForm.password_nueva && (
                    <div className="password-strength">
                      <div className="password-strength__label">
                        Seguridad:{" "}
                        <strong className={passwordStrength.className}>
                          {passwordStrength.label}
                        </strong>
                      </div>
                      <div className="password-strength__bar">
                        <span className={passwordStrength.className} />
                      </div>
                    </div>
                  )}
                </div>

                <div className="field">
                  <label>Confirmar contraseña</label>
                  <div className="field-control field-control--password">
                    <Lock size={17} />
                    <input
                      type={showPasswords.confirmar ? "text" : "password"}
                      name="password_confirmar"
                      value={passwordForm.password_confirmar}
                      onChange={handlePasswordChange}
                      placeholder="Repite la nueva contraseña"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => togglePassword("confirmar")}
                    >
                      {showPasswords.confirmar ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              {passwordMsg.text ? (
                <div
                  className={`profile-alert ${
                    passwordMsg.type === "success"
                      ? "profile-alert--success"
                      : "profile-alert--error"
                  }`}
                >
                  {passwordMsg.type === "success" ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <AlertCircle size={16} />
                  )}
                  <span>{passwordMsg.text}</span>
                </div>
              ) : null}

              <div className="profile-actions">
                <button
                  className="btn-save"
                  type="button"
                  onClick={handleChangePassword}
                  disabled={savingPassword}
                >
                  <Lock size={17} />
                  {savingPassword ? "Actualizando..." : "Actualizar contraseña"}
                </button>
              </div>
            </div>
          </div>

          <aside className="profile-side">
            <div className="profile-card profile-card--compact">
              <div className="mini-title">
                <Lock size={16} />
                Seguridad
              </div>

              <div className="security-box">
                <div className="security-row">
                  <span>Contraseña</span>
                  <strong>Protegida</strong>
                </div>
                <div className="security-row">
                  <span>Rol del sistema</span>
                  <strong>{form.puesto}</strong>
                </div>
                <div className="security-row">
                  <span>Estado de sesión</span>
                  <strong>Activa</strong>
                </div>
                <div className="security-row">
                  <span>Foto de perfil</span>
                  <strong>{preview ? "Configurada" : "Sin foto"}</strong>
                </div>
              </div>
            </div>

            <div className="profile-card profile-card--compact">
              <div className="mini-title">
                <Activity size={16} />
                Actividad reciente
              </div>

              <div className="timeline">
                <div className="timeline-item">
                  <div className="timeline-dot" />
                  <div>
                    <strong>Inicio de sesión</strong>
                    <span>Acceso exitoso al panel administrativo.</span>
                  </div>
                </div>

                <div className="timeline-item">
                  <div className="timeline-dot" />
                  <div>
                    <strong>Perfil consultado</strong>
                    <span>Se cargó correctamente tu información de usuario.</span>
                  </div>
                </div>

                <div className="timeline-item">
                  <div className="timeline-dot" />
                  <div>
                    <strong>Cuenta lista</strong>
                    <span>Tu cuenta está lista para actualizar datos y foto.</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="profile-card profile-card--compact premium-banner">
              <div className="premium-banner__icon">
                <Sparkles size={20} />
              </div>
              <div>
                <h3>Cuenta destacada</h3>
                <p>
                  Tu perfil premium está listo para administrar mejor tu cuenta
                  dentro del sistema.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}