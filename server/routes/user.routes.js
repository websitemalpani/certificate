const express = require("express");
const router = express.Router();

const userController = require("../controllers/user.controller");
const { verifyToken } = require("../middleware/auth.middleware");
const { requirePermission, requireAnyPermission } = require("../middleware/permission.middleware");
const { PERMISSIONS } = require("../utils/permissions");

router.get("/me", verifyToken, userController.getCurrentUserProfile);
router.get(
  "/meta/facilities",
  verifyToken,
  requireAnyPermission([PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_FACILITIES]),
  userController.getAllFacilities,
);
router.post("/meta/facilities", verifyToken, requirePermission(PERMISSIONS.MANAGE_FACILITIES), userController.createFacility);

router.get("/", verifyToken, requirePermission(PERMISSIONS.MANAGE_USERS), userController.getAllUsers);
router.post("/", verifyToken, requirePermission(PERMISSIONS.MANAGE_USERS), userController.createUser);
router.get("/:id", verifyToken, requirePermission(PERMISSIONS.MANAGE_USERS), userController.getUserById);
router.put("/:id", verifyToken, requirePermission(PERMISSIONS.MANAGE_USERS), userController.updateUser);
router.delete("/:id", verifyToken, requirePermission(PERMISSIONS.MANAGE_USERS), userController.deleteUser);

module.exports = router;
