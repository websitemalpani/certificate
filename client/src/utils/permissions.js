export const PERMISSIONS = Object.freeze({
  VIEW_DASHBOARD: "view_dashboard",
  VIEW_TEMPLATES: "view_templates",
  MANAGE_TEMPLATES: "manage_templates",
  VIEW_BATCHES: "view_batches",
  MANAGE_BATCHES: "manage_batches",
  VIEW_CERTIFICATES: "view_certificates",
  MANAGE_CERTIFICATES: "manage_certificates",
  MANAGE_USERS: "manage_users",
  MANAGE_FACILITIES: "manage_facilities",
});

export const hasPermission = (permissions = [], requiredPermission) => {
  const normalized = (permissions || []).map((item) => String(item || "").toLowerCase());
  if (normalized.includes("*")) return true;
  return normalized.includes(String(requiredPermission || "").toLowerCase());
};
