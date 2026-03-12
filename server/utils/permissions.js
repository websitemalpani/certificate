const PERMISSIONS = Object.freeze({
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

const ROLE_DEFAULT_PERMISSIONS = Object.freeze({
  admin: ["*"],
  facility_manager: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_TEMPLATES,
    PERMISSIONS.MANAGE_TEMPLATES,
    PERMISSIONS.VIEW_BATCHES,
    PERMISSIONS.MANAGE_BATCHES,
    PERMISSIONS.VIEW_CERTIFICATES,
    PERMISSIONS.MANAGE_CERTIFICATES,
  ],
  user: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_TEMPLATES,
    PERMISSIONS.VIEW_BATCHES,
    PERMISSIONS.MANAGE_BATCHES,
    PERMISSIONS.VIEW_CERTIFICATES,
  ],
});

const normalizeRole = (role) => String(role || "user").trim().toLowerCase();

const normalizePermissionList = (permissions) => {
  if (!Array.isArray(permissions)) return [];
  return [...new Set(
    permissions
      .map((permission) => String(permission || "").trim().toLowerCase())
      .filter(Boolean),
  )];
};

const resolvePermissions = (role, customPermissions = []) => {
  const normalizedRole = normalizeRole(role);
  const normalizedCustom = normalizePermissionList(customPermissions);
  if (normalizedCustom.length) {
    if (normalizedCustom.includes("*")) return ["*"];
    return normalizedCustom;
  }

  const rolePermissions = ROLE_DEFAULT_PERMISSIONS[normalizedRole] || ROLE_DEFAULT_PERMISSIONS.user;
  const merged = normalizePermissionList(rolePermissions);
  if (merged.includes("*")) return ["*"];
  return merged;
};

const hasPermission = (permissions, requiredPermission) => {
  const normalizedPermissions = normalizePermissionList(permissions);
  if (normalizedPermissions.includes("*")) return true;
  return normalizedPermissions.includes(String(requiredPermission || "").trim().toLowerCase());
};

module.exports = {
  PERMISSIONS,
  ROLE_DEFAULT_PERMISSIONS,
  normalizeRole,
  normalizePermissionList,
  resolvePermissions,
  hasPermission,
};
