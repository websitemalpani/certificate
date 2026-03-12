const express = require("express");
const router = express.Router();

const certificateController = require("../controllers/certificate.controller");
const { verifyToken } = require("../middleware/auth.middleware");
const { requirePermission } = require("../middleware/permission.middleware");
const { PERMISSIONS } = require("../utils/permissions");

router.post("/public/lookup", certificateController.publicLookupByContact);
router.get("/public/download/:id", certificateController.publicDownloadByContact);

// Get all certificates
router.get("/", verifyToken, requirePermission(PERMISSIONS.VIEW_CERTIFICATES), certificateController.getAllCertificates);

// Search by serial number
router.get(
  "/search/:serial",
  verifyToken,
  requirePermission(PERMISSIONS.VIEW_CERTIFICATES),
  certificateController.searchBySerial,
);

// Preview certificate
router.post("/preview", verifyToken, requirePermission(PERMISSIONS.MANAGE_CERTIFICATES), certificateController.previewCertificate);

// Bulk download
router.post("/bulk-download", verifyToken, requirePermission(PERMISSIONS.MANAGE_CERTIFICATES), certificateController.bulkDownload);
router.post(
  "/bulk-delete",
  verifyToken,
  requirePermission(PERMISSIONS.MANAGE_CERTIFICATES),
  certificateController.bulkDelete,
);
router.get(
  "/batch/:batchId/bulk-download",
  verifyToken,
  requirePermission(PERMISSIONS.VIEW_CERTIFICATES),
  certificateController.bulkDownloadByBatch,
);
router.get(
  "/template/:templateId/bulk-download",
  verifyToken,
  requirePermission(PERMISSIONS.VIEW_CERTIFICATES),
  certificateController.bulkDownloadByTemplate,
);

// Public verification (NO auth)
router.get("/verify/:certificateNo", certificateController.verifyCertificate);

// Download certificate
router.get(
  "/:id/download",
  verifyToken,
  requirePermission(PERMISSIONS.VIEW_CERTIFICATES),
  certificateController.downloadCertificate,
);

router.put(
  "/:id",
  verifyToken,
  requirePermission(PERMISSIONS.MANAGE_CERTIFICATES),
  certificateController.updateCertificate,
);

router.delete(
  "/:id",
  verifyToken,
  requirePermission(PERMISSIONS.MANAGE_CERTIFICATES),
  certificateController.deleteCertificate,
);

// Get single certificate
router.get("/:id", verifyToken, requirePermission(PERMISSIONS.VIEW_CERTIFICATES), certificateController.getCertificateById);

module.exports = router;
