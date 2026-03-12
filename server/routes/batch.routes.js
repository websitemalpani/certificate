const express = require("express");
const router = express.Router();

const batchController = require("../controllers/batch.controller");
const { verifyToken } = require("../middleware/auth.middleware");
const { uploadCSV } = require("../middleware/upload.middleware");
const { requirePermission } = require("../middleware/permission.middleware");
const { PERMISSIONS } = require("../utils/permissions");

router.post(
  "/upload",
  verifyToken,
  requirePermission(PERMISSIONS.MANAGE_BATCHES),
  uploadCSV.single("file"),
  batchController.uploadCSV,
);

router.post("/:id/generate", verifyToken, requirePermission(PERMISSIONS.MANAGE_BATCHES), batchController.generateCertificates);
router.get("/:id/progress", verifyToken, requirePermission(PERMISSIONS.VIEW_BATCHES), batchController.getBatchProgress);
router.get(
  "/:id/progress/stream",
  verifyToken,
  requirePermission(PERMISSIONS.VIEW_BATCHES),
  batchController.streamBatchProgress,
);

router.get("/", verifyToken, requirePermission(PERMISSIONS.VIEW_BATCHES), batchController.getAllBatches);
router.delete("/:id", verifyToken, requirePermission(PERMISSIONS.MANAGE_BATCHES), batchController.deleteBatch);

router.get("/:id", verifyToken, requirePermission(PERMISSIONS.VIEW_BATCHES), batchController.getBatchById);

module.exports = router;
