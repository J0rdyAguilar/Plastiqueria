// src/lib/auth.js
const KEY = "plastiqueria_session";

export function setSession({ token, user }) {
  const data = { token, user };
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

export function clearSession() {
  localStorage.removeItem(KEY);
}

export function isLoggedIn() {
  return !!getToken();
}
