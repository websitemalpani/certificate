const { hasPermission } = require("../utils/permissions");

exports.requirePermission = (requiredPermission) => {
  return (req, res, next) => {
    const userPermissions = req.user?.permissions || [];

    if (!hasPermission(userPermissions, requiredPermission)) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. Missing required permission.",
      });
    }

    next();
  };
};

exports.requireAnyPermission = (requiredPermissions = []) => {
  return (req, res, next) => {
    const userPermissions = req.user?.permissions || [];
    const needed = Array.isArray(requiredPermissions) ? requiredPermissions : [];

    if (!needed.some((permission) => hasPermission(userPermissions, permission))) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. Missing required permission.",
      });
    }

    next();
  };
};
