const express = require("express");
const router = express.Router();

const templateController = require("../controllers/template.controller");
const { verifyToken } = require("../middleware/auth.middleware");
const { uploadTemplate } = require("../middleware/upload.middleware");
const { requirePermission } = require("../middleware/permission.middleware");
const { PERMISSIONS } = require("../utils/permissions");

router.post(
  "/",
  verifyToken,
  requirePermission(PERMISSIONS.MANAGE_TEMPLATES),
  uploadTemplate.fields([
    { name: "templateImage", maxCount: 1 },
    { name: "signatureImage", maxCount: 1 },
  ]),
  templateController.createTemplate,
);

router.get("/", verifyToken, requirePermission(PERMISSIONS.VIEW_TEMPLATES), templateController.getAllTemplates);
router.get("/:id", verifyToken, requirePermission(PERMISSIONS.VIEW_TEMPLATES), templateController.getTemplateById);

router.patch(
  "/:id/signature-position",
  verifyToken,
  requirePermission(PERMISSIONS.MANAGE_TEMPLATES),
  templateController.updateSignaturePosition,
);

router.patch(
  "/:id/qr-position",
  verifyToken,
  requirePermission(PERMISSIONS.MANAGE_TEMPLATES),
  templateController.updateQrPosition,
);

router.delete(
  "/:id",
  verifyToken,
  requirePermission(PERMISSIONS.MANAGE_TEMPLATES),
  templateController.deleteTemplate,
);

router.post(
  "/:id/fields",
  verifyToken,
  requirePermission(PERMISSIONS.MANAGE_TEMPLATES),
  templateController.addField,
);

router.get("/:id/fields", verifyToken, requirePermission(PERMISSIONS.VIEW_TEMPLATES), templateController.getFields);
router.post(
  "/:id/preview",
  verifyToken,
  requirePermission(PERMISSIONS.MANAGE_TEMPLATES),
  templateController.previewTemplateCertificate,
);

router.put(
  "/fields/:fieldId",
  verifyToken,
  requirePermission(PERMISSIONS.MANAGE_TEMPLATES),
  templateController.updateField,
);

router.delete(
  "/fields/:fieldId",
  verifyToken,
  requirePermission(PERMISSIONS.MANAGE_TEMPLATES),
  templateController.deleteField,
);

module.exports = router;
