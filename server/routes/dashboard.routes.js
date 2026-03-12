const express = require("express");
const router = express.Router();

const dashboardController = require("../controllers/dashboard.controller");
const { verifyToken } = require("../middleware/auth.middleware");
const { requirePermission } = require("../middleware/permission.middleware");
const { PERMISSIONS } = require("../utils/permissions");

router.get(
  "/stats",
  verifyToken,
  requirePermission(PERMISSIONS.VIEW_DASHBOARD),
  dashboardController.getStats,
);

module.exports = router;
