// src/lib/auth.js
const KEY = "plastiqueria_session";

export function setSession({ token, user }) {
  const data = {
    token: token || "",
    user: user || null,
  };

  localStorage.setItem(KEY, JSON.stringify(data));
  return data;
}

export function getSession() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getToken() {
  return getSession()?.token || "";
}

export function getUser() {
  return getSession()?.user || null;
}

export function getUserRole() {
  const user = getUser();
  return String(user?.role || user?.rol || "").toLowerCase();
}

export function getUserUbicacionId() {
  const user = getUser();
  return user?.ubicacion_id ?? user?.sucursal_id ?? "";
}

export function clearSession() {
  localStorage.removeItem(KEY);
}

export function isLoggedIn() {
  return !!getToken();
}

export function isSuperAdmin() {
  return getUserRole() === "superadmin";
}