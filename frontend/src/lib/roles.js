export function hasRole(user, roles = []) {
  const r = (user?.rol || "").toLowerCase();
  return roles.map(x => x.toLowerCase()).includes(r);
}

export function isCajaOnly(user) {
  return hasRole(user, ["caja"]);
}

export function canSeeCaja(user) {
  return hasRole(user, ["admin", "superadmin", "caja"]);
}

export function canSeeAdminPanel(user) {
  return hasRole(user, ["admin", "superadmin"]);
}
