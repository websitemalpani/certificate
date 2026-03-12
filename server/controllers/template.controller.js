const path = require("path");
const fs = require("fs");
const Template = require("../models/template.model");
const { generateCertificate } = require("../services/certificate.service");
const { generateQR } = require("../services/qr.service");
const PATHS = require("../config/paths");
const env = require("../config/env");
const clampNonNegative = (value, fallback = 0) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(num, 0);
};
const isCoordinateSet = (value) =>
  value !== null &&
  value !== undefined &&
  value !== "" &&
  Number.isFinite(Number(value));

/* ==========================
   CREATE TEMPLATE
========================== */
exports.createTemplate = async (req, res, next) => {
  try {
    const {
      title,
      qr_x = 900,
      qr_y = 500,
      qr_size = 120,
      signature_x = 800,
      signature_y = 600,
      watermark_enabled = true,
      watermark_text = "VERIFIED",
    } = req.body;

    const imagePath = req.files?.templateImage?.[0]?.path || null;
    const signaturePath = req.files?.signatureImage?.[0]?.path || null;

    const templateId = await Template.create({
      title,
      image_path: imagePath,
      signature_path: signaturePath,
      qr_x,
      qr_y,
      qr_size: clampNonNegative(qr_size, 120) || 120,
      signature_x,
      signature_y,
      watermark_enabled,
      watermark_text,
      created_by: req.user.id,
    });

    res.status(201).json({
      success: true,
      templateId,
    });
  } catch (error) {
    next(error);
  }
};

/* ==========================
   GET ALL
========================== */
exports.getAllTemplates = async (req, res, next) => {
  try {
    const templates = await Template.getAll();
    res.json(templates);
  } catch (error) {
    next(error);
  }
};

/* ==========================
   GET BY ID
========================== */
exports.getTemplateById = async (req, res, next) => {
  try {
    const template = await Template.getById(req.params.id);

    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    res.json(template);
  } catch (error) {
    next(error);
  }
};

/* ==========================
   DELETE
========================== */
exports.deleteTemplate = async (req, res, next) => {
  try {
    await Template.delete(req.params.id);
    res.json({ message: "Template deleted" });
  } catch (error) {
    next(error);
  }
};

/* ==========================
   UPDATE SIGNATURE POSITION
========================== */
exports.updateSignaturePosition = async (req, res, next) => {
  try {
    const { signature_x, signature_y } = req.body;

    await Template.updateSignaturePosition(req.params.id, {
      signature_x: clampNonNegative(signature_x, 0),
      signature_y: clampNonNegative(signature_y, 0),
    });

    res.json({ message: "Signature position updated" });
  } catch (error) {
    next(error);
  }
};

/* ==========================
   UPDATE QR POSITION / TOGGLE
========================== */
exports.updateQrPosition = async (req, res, next) => {
  try {
    const template = await Template.getById(req.params.id);
    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    const rawX = req.body?.qr_x;
    const rawY = req.body?.qr_y;
    const rawSize = req.body?.qr_size;
    const qr_x = rawX === null || rawX === "" ? null : clampNonNegative(rawX, 0);
    const qr_y = rawY === null || rawY === "" ? null : clampNonNegative(rawY, 0);
    const qr_size =
      rawSize === null || rawSize === ""
        ? clampNonNegative(template?.qr_size, 120) || 120
        : Math.max(20, clampNonNegative(rawSize, 120) || 120);

    const bothNull = qr_x === null && qr_y === null;
    const bothNumbers = Number.isFinite(qr_x) && Number.isFinite(qr_y);
    if (!bothNull && !bothNumbers) {
      return res.status(400).json({
        message: "qr_x and qr_y must both be numbers or both be null",
      });
    }

    await Template.updateQrPosition(req.params.id, { qr_x, qr_y, qr_size });

    res.json({ message: "QR settings updated" });
  } catch (error) {
    next(error);
  }
};

/* ==========================
   ADD FIELD
========================== */
exports.addField = async (req, res, next) => {
  try {
    const templateId = req.params.id;
    const template = await Template.getById(templateId);

    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    const {
      field_name,
      x_position,
      y_position,
      font_size = 30,
      font_family = "Arial",
      font_color = "#000000",
    } = req.body;

    if (!field_name) {
      return res.status(400).json({ message: "field_name is required" });
    }

    const fieldId = await Template.addField({
      template_id: templateId,
      field_name,
      x_position: clampNonNegative(x_position, 0),
      y_position: clampNonNegative(y_position, 0),
      font_size: Number(font_size) || 30,
      font_family,
      font_color,
    });

    res.status(201).json({
      success: true,
      message: "Field added successfully",
      fieldId,
    });
  } catch (error) {
    next(error);
  }
};

/* ==========================
   GET FIELDS
========================== */
exports.getFields = async (req, res, next) => {
  try {
    const templateId = req.params.id;
    const template = await Template.getById(templateId);

    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    const fields = await Template.getFields(templateId);

    res.json({
      success: true,
      fields,
    });
  } catch (error) {
    next(error);
  }
};

/* ==========================
   TEMPLATE PREVIEW
========================== */
exports.previewTemplateCertificate = async (req, res, next) => {
  try {
    const templateId = req.params.id;
    const template = await Template.getById(templateId);

    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    const fields = await Template.getFields(templateId);
    const baseUrl = env.APP_BASE_URL || `http://localhost:${env.PORT}`;
    const qrPath = path.join(
      PATHS.TEMP_DIR,
      `qr_preview_template_${templateId}_${Date.now()}.png`,
    );

    const qrEnabled =
      isCoordinateSet(template?.qr_x) &&
      isCoordinateSet(template?.qr_y) &&
      Number(template?.qr_x) >= 0 &&
      Number(template?.qr_y) >= 0;

    if (qrEnabled) {
      const verificationURL = `${baseUrl}/api/templates/${templateId}`;
      await generateQR(verificationURL, qrPath);
    }

    const previewPath = await generateCertificate({
      templatePath: template.image_path,
      outputDir: PATHS.TEMP_DIR,
      fields,
      data: req.body?.data || {},
      qrPath: qrEnabled ? qrPath : null,
      template,
    });

    const previewFileName = path.basename(previewPath);
    const origin = baseUrl;

    if (qrEnabled && fs.existsSync(qrPath)) {
      fs.unlink(qrPath, () => {});
    }

    res.json({
      success: true,
      previewUrl: `${origin}/storage/temp/${previewFileName}`,
      previewPath,
    });
  } catch (error) {
    next(error);
  }
};

/* ==========================
   UPDATE FIELD
========================== */
exports.updateField = async (req, res, next) => {
  try {
    const { field_name, x_position, y_position, font_size, font_family, font_color } =
      req.body;

    await Template.updateField(req.params.fieldId, {
      field_name,
      x_position: clampNonNegative(x_position, 0),
      y_position: clampNonNegative(y_position, 0),
      font_size: Number(font_size) || 30,
      font_family: font_family || "Arial",
      font_color: font_color || "#000000",
    });

    res.json({
      success: true,
      message: "Field updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

/* ==========================
   DELETE FIELD
========================== */
exports.deleteField = async (req, res, next) => {
  try {
    await Template.deleteField(req.params.fieldId);

    res.json({
      success: true,
      message: "Field deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
