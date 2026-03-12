const fs = require("fs");
const path = require("path");
const Certificate = require("../models/certificate.model");
const Template = require("../models/template.model");
const { createZip } = require("../services/zip.service");
const { generateCertificate } = require("../services/certificate.service");
const { generateQR } = require("../services/qr.service");
const PATHS = require("../config/paths");
const env = require("../config/env");

const getTemplateCertificatesDir = (templateId) =>
  path.join(PATHS.GENERATED_CERTIFICATES_DIR, `template_${templateId}`);

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const sanitizeFilenamePart = (value, fallback = "certificate") => {
  const normalized = String(value || "")
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || fallback;
};

const buildCertificateFilename = (certificate) => {
  const certificateNo = sanitizeFilenamePart(certificate?.certificate_no, "CERT");
  const studentName = sanitizeFilenamePart(certificate?.student_name, "student");
  return `${certificateNo}_${studentName}.png`;
};

const parseDataJson = (rawData) => {
  if (!rawData) return {};
  if (typeof rawData === "object") return rawData;

  try {
    return JSON.parse(rawData);
  } catch {
    return {};
  }
};

const normalizeKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

const readValueByAliases = (source, aliases = []) => {
  if (!source || typeof source !== "object") return "";
  const normalizedEntries = new Map(
    Object.entries(source).map(([key, value]) => [normalizeKey(key), value]),
  );

  for (const alias of aliases) {
    const direct = source[alias];
    if (direct !== undefined && direct !== null && String(direct).trim() !== "") {
      return String(direct);
    }

    const normalized = normalizedEntries.get(normalizeKey(alias));
    if (normalized !== undefined && normalized !== null && String(normalized).trim() !== "") {
      return String(normalized);
    }
  }

  return "";
};

const upsertValueByAliases = (target, aliases = [], value) => {
  if (value === undefined || value === null) return target;
  const text = String(value);
  if (text.trim() === "") return target;

  const keys = Object.keys(target || {});
  const normalizedAliases = new Set(aliases.map((alias) => normalizeKey(alias)));
  const next = { ...target };
  let updated = false;

  keys.forEach((key) => {
    if (normalizedAliases.has(normalizeKey(key))) {
      next[key] = text;
      updated = true;
    }
  });

  if (!updated && aliases.length > 0) {
    next[aliases[0]] = text;
  }

  return next;
};

const normalizeMobile = (value) => String(value || "").replace(/\D/g, "").trim();
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const isCoordinateSet = (value) =>
  value !== null &&
  value !== undefined &&
  value !== "" &&
  Number.isFinite(Number(value));
const matchesPublicContact = (certificate, mobile, email) => {
  const data = parseDataJson(certificate?.data_json);
  const rowMobile = normalizeMobile(certificate?.mobile);
  const rowEmail = normalizeEmail(certificate?.email);
  const dataMobile = normalizeMobile(
    readValueByAliases(data, ["mobile", "phone", "mobile_no", "mobile number", "phone_number"]),
  );
  const dataEmail = normalizeEmail(
    readValueByAliases(data, ["email", "email_id", "mail", "e-mail"]),
  );

  if (mobile && rowMobile !== mobile && dataMobile !== mobile) {
    return false;
  }

  if (email && rowEmail !== email && dataEmail !== email) {
    return false;
  }

  return true;
};

// Get all certificates
exports.getAllCertificates = async (req, res, next) => {
  try {
    const pageQuery = req.query.page;
    const limitQuery = req.query.limit;
    const templateIdQuery = req.query.template_id;
    const batchIdQuery = req.query.batch_id;
    const templateId = Number.parseInt(templateIdQuery, 10);
    const batchId = Number.parseInt(batchIdQuery, 10);
    const templateFilter = Number.isFinite(templateId) && templateId > 0 ? templateId : undefined;
    const batchFilter = Number.isFinite(batchId) && batchId > 0 ? batchId : undefined;

    if (pageQuery || limitQuery) {
      const page = toPositiveInt(pageQuery, 1);
      const limit = Math.min(toPositiveInt(limitQuery, 10), 100);
      const [items, total] = await Promise.all([
        Certificate.getPaginated({ page, limit, templateId: templateFilter, batchId: batchFilter }),
        Certificate.countAll({ templateId: templateFilter, batchId: batchFilter }),
      ]);

      return res.json({
        items,
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      });
    }

    const certificates = await Certificate.getAll({ templateId: templateFilter, batchId: batchFilter });
    return res.json(certificates);
  } catch (error) {
    next(error);
  }
};

// Get certificate by ID
exports.getCertificateById = async (req, res, next) => {
  try {
    const certificate = await Certificate.getById(req.params.id);

    if (!certificate) {
      return res.status(404).json({ message: "Certificate not found" });
    }

    return res.json(certificate);
  } catch (error) {
    next(error);
  }
};

// Download certificate
exports.downloadCertificate = async (req, res, next) => {
  try {
    const certificate = await Certificate.getById(req.params.id);

    if (!certificate) {
      return res.status(404).json({ message: "Certificate not found" });
    }

    const filePath = path.resolve(certificate.file_path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Certificate file not found" });
    }

    const filename = buildCertificateFilename(certificate);
    return res.download(filePath, filename);
  } catch (error) {
    next(error);
  }
};

// Certificate preview API
exports.previewCertificate = async (req, res, next) => {
  try {
    const { template_id, data } = req.body;

    if (!template_id) {
      return res.status(400).json({ message: "template_id is required" });
    }

    const template = await Template.getById(template_id);
    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    const fields = await Template.getFields(template_id);
    const baseUrl = env.APP_BASE_URL || `http://localhost:${env.PORT}`;
    const qrPath = path.join(
      PATHS.TEMP_DIR,
      `qr_preview_template_${template_id}_${Date.now()}.png`,
    );
    const qrEnabled =
      isCoordinateSet(template?.qr_x) &&
      isCoordinateSet(template?.qr_y) &&
      Number(template?.qr_x) >= 0 &&
      Number(template?.qr_y) >= 0;

    if (qrEnabled) {
      const verificationURL = `${baseUrl}/api/templates/${template_id}`;
      await generateQR(verificationURL, qrPath);
    }

    const previewPath = await generateCertificate({
      templatePath: template.image_path,
      outputDir: PATHS.TEMP_DIR,
      fields,
      data: data || {},
      qrPath: qrEnabled ? qrPath : null,
      template,
    });
    const previewFileName = path.basename(previewPath);
    const origin = baseUrl;

    if (qrEnabled && fs.existsSync(qrPath)) {
      fs.unlink(qrPath, () => {});
    }

    return res.json({
      success: true,
      previewUrl: `${origin}/storage/temp/${previewFileName}`,
      previewPath,
    });
  } catch (error) {
    next(error);
  }
};

// Certificate search by serial
exports.searchBySerial = async (req, res, next) => {
  try {
    const term = String(req.params.serial || "").trim();
    if (!term) {
      return res.status(400).json({ message: "Search text is required" });
    }

    const items = await Certificate.searchByTerm(term, 50);
    if (!items.length) {
      return res.status(404).json({ message: "Certificate not found" });
    }

    return res.json({ success: true, items });
  } catch (error) {
    next(error);
  }
};

// Bulk ZIP download
exports.bulkDownload = async (req, res, next) => {
  try {
    const { certificateIds } = req.body;

    if (!Array.isArray(certificateIds) || certificateIds.length === 0) {
      return res.status(400).json({ message: "No certificates selected" });
    }

    const fileCandidates = await Promise.all(
      certificateIds.map((id) => Certificate.getById(id)),
    );

    const files = fileCandidates
      .filter(Boolean)
      .map((certificate) => {
        const filePath = path.resolve(certificate.file_path);
        return {
          filePath,
          fileName: buildCertificateFilename(certificate),
        };
      })
      .filter((item) => fs.existsSync(item.filePath));

    if (files.length === 0) {
      return res.status(404).json({ message: "No certificate files found" });
    }

    const zipPath = path.join(PATHS.GENERATED_ZIPS_DIR, `bulk_${Date.now()}.zip`);
    await createZip(files, zipPath);

    return res.download(zipPath, "certificates.zip", (downloadError) => {
      if (!downloadError && fs.existsSync(zipPath)) {
        fs.unlink(zipPath, () => {});
      }
    });
  } catch (error) {
    next(error);
  }
};

// Bulk delete certificates
exports.bulkDelete = async (req, res, next) => {
  try {
    const { certificateIds } = req.body;

    if (!Array.isArray(certificateIds) || certificateIds.length === 0) {
      return res.status(400).json({ message: "No certificates selected" });
    }

    const uniqueIds = [...new Set(certificateIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];
    if (!uniqueIds.length) {
      return res.status(400).json({ message: "No valid certificate ids provided" });
    }

    const certificates = await Promise.all(uniqueIds.map((id) => Certificate.getById(id)));
    const existingCertificates = certificates.filter(Boolean);

    await Promise.all(
      existingCertificates.map(async (certificate) => {
        await Certificate.delete(certificate.id);
        const filePath = certificate.file_path ? path.resolve(certificate.file_path) : null;
        if (filePath && fs.existsSync(filePath)) {
          fs.unlink(filePath, () => {});
        }
      }),
    );

    return res.json({
      success: true,
      message: `${existingCertificates.length} certificate(s) deleted`,
      deletedCount: existingCertificates.length,
    });
  } catch (error) {
    next(error);
  }
};

exports.bulkDownloadByBatch = async (req, res, next) => {
  try {
    const batchId = Number.parseInt(req.params.batchId, 10);
    if (Number.isNaN(batchId) || batchId <= 0) {
      return res.status(400).json({ message: "Invalid batch id" });
    }

    const certificates = await Certificate.getByBatchId(batchId);
    if (!certificates.length) {
      return res.status(404).json({ message: "No certificates found for this batch" });
    }

    const files = certificates
      .map((certificate) => {
        const filePath = path.resolve(certificate.file_path);
        return {
          filePath,
          fileName: buildCertificateFilename(certificate),
        };
      })
      .filter((item) => fs.existsSync(item.filePath));

    if (!files.length) {
      return res.status(404).json({ message: "No certificate files found for this batch" });
    }

    const zipPath = path.join(PATHS.GENERATED_ZIPS_DIR, `batch_${batchId}_${Date.now()}.zip`);
    await createZip(files, zipPath);

    return res.download(zipPath, `batch_${batchId}_certificates.zip`, (downloadError) => {
      if (!downloadError && fs.existsSync(zipPath)) {
        fs.unlink(zipPath, () => {});
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.bulkDownloadByTemplate = async (req, res, next) => {
  try {
    const templateId = Number.parseInt(req.params.templateId, 10);
    if (Number.isNaN(templateId) || templateId <= 0) {
      return res.status(400).json({ message: "Invalid template id" });
    }

    const certificates = await Certificate.getByTemplateId(templateId);
    if (!certificates.length) {
      return res.status(404).json({ message: "No certificates found for this template" });
    }

    const files = certificates
      .map((certificate) => {
        const filePath = path.resolve(certificate.file_path);
        return {
          filePath,
          fileName: buildCertificateFilename(certificate),
        };
      })
      .filter((item) => fs.existsSync(item.filePath));

    if (!files.length) {
      return res.status(404).json({ message: "No certificate files found for this template" });
    }

    const zipPath = path.join(PATHS.GENERATED_ZIPS_DIR, `template_${templateId}_${Date.now()}.zip`);
    await createZip(files, zipPath);

    return res.download(zipPath, `template_${templateId}_certificates.zip`, (downloadError) => {
      if (!downloadError && fs.existsSync(zipPath)) {
        fs.unlink(zipPath, () => {});
      }
    });
  } catch (error) {
    next(error);
  }
};

// Update certificate details and regenerate file
exports.updateCertificate = async (req, res, next) => {
  try {
    const certificate = await Certificate.getById(req.params.id);
    if (!certificate) {
      return res.status(404).json({ message: "Certificate not found" });
    }

    const template = await Template.getById(certificate.template_id);
    if (!template) {
      return res.status(404).json({ message: "Template not found for this certificate" });
    }

    const fields = await Template.getFields(certificate.template_id);
    const existingData = parseDataJson(certificate.data_json);
    const incomingData = req.body?.data && typeof req.body.data === "object" ? req.body.data : {};

    const resolvedStudentName =
      req.body.student_name ??
      (readValueByAliases(incomingData, ["student_name", "student name", "student", "name"]) ||
        readValueByAliases(existingData, ["student_name", "student name", "student", "name"]) ||
        certificate.student_name ||
        "");

    const resolvedSchoolName =
      req.body.school_name ??
      (readValueByAliases(incomingData, ["school_name", "school name", "school", "institute"]) ||
        readValueByAliases(existingData, ["school_name", "school name", "school", "institute"]) ||
        certificate.school_name ||
        "");

    const resolvedMobile =
      normalizeMobile(req.body.mobile) ||
      normalizeMobile(readValueByAliases(incomingData, ["mobile", "phone", "mobile_no", "mobile number", "phone_number"])) ||
      normalizeMobile(readValueByAliases(existingData, ["mobile", "phone", "mobile_no", "mobile number", "phone_number"])) ||
      normalizeMobile(certificate.mobile);

    const resolvedEmail =
      normalizeEmail(req.body.email) ||
      normalizeEmail(readValueByAliases(incomingData, ["email", "email_id", "mail", "e-mail"])) ||
      normalizeEmail(readValueByAliases(existingData, ["email", "email_id", "mail", "e-mail"])) ||
      normalizeEmail(certificate.email);

    let mergedData = {
      ...existingData,
      ...incomingData,
    };

    mergedData = upsertValueByAliases(
      mergedData,
      ["student_name", "student name", "student", "name", "studentName"],
      resolvedStudentName,
    );
    mergedData = upsertValueByAliases(
      mergedData,
      ["school_name", "school name", "school", "institute", "schoolName"],
      resolvedSchoolName,
    );
    mergedData = upsertValueByAliases(
      mergedData,
      ["mobile", "phone", "mobile_no", "mobile number", "phone_number"],
      resolvedMobile,
    );
    mergedData = upsertValueByAliases(
      mergedData,
      ["email", "email_id", "mail", "e-mail"],
      resolvedEmail,
    );

    const baseUrl = env.APP_BASE_URL || `http://localhost:${env.PORT}`;
    const templateOutputDir = getTemplateCertificatesDir(certificate.template_id);
    const qrPath = path.join(templateOutputDir, `qr_${certificate.certificate_no}.png`);
    const verificationURL = `${baseUrl}/api/certificates/verify/${certificate.certificate_no}`;
    await generateQR(verificationURL, qrPath);

    const newFilePath = await generateCertificate({
      templatePath: template.image_path,
      outputDir: templateOutputDir,
      fields,
      data: mergedData,
      qrPath,
      template,
    });

    const oldFilePath = certificate.file_path ? path.resolve(certificate.file_path) : null;
    await Certificate.update(certificate.id, {
      student_name: resolvedStudentName,
      school_name: resolvedSchoolName,
      mobile: resolvedMobile,
      email: resolvedEmail,
      data_json: mergedData,
      file_path: newFilePath,
    });

    if (
      oldFilePath && oldFilePath !== path.resolve(newFilePath) && fs.existsSync(oldFilePath)
    ) {
      fs.unlink(oldFilePath, () => {});
    }

    const updated = await Certificate.getById(certificate.id);
    return res.json({ success: true, message: "Certificate updated", certificate: updated });
  } catch (error) {
    next(error);
  }
};

exports.publicLookupByContact = async (req, res, next) => {
  try {
    const mobile = normalizeMobile(req.body?.mobile);
    const email = normalizeEmail(req.body?.email);

    if (!mobile && !email) {
      return res.status(400).json({ message: "Provide mobile or email" });
    }

    const columnMatches = await Certificate.getByPublicContact({ mobile, email });
    const all = await Certificate.getAll();
    const fallbackMatches = all.filter((item) => matchesPublicContact(item, mobile, email));
    const certificatesMap = new Map();
    [...columnMatches, ...fallbackMatches].forEach((item) => certificatesMap.set(item.id, item));
    const certificates = Array.from(certificatesMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    if (!certificates.length) {
      return res.status(404).json({ message: "No certificate found for provided details" });
    }

    const items = certificates.map((item) => ({
      id: item.id,
      certificate_no: item.certificate_no,
      student_name: item.student_name,
      school_name: item.school_name,
      created_at: item.created_at,
    }));

    return res.json({ success: true, items });
  } catch (error) {
    next(error);
  }
};

exports.publicDownloadByContact = async (req, res, next) => {
  try {
    const certificateId = Number.parseInt(req.params.id, 10);
    const mobile = normalizeMobile(req.query.mobile);
    const email = normalizeEmail(req.query.email);

    if (!Number.isFinite(certificateId) || certificateId <= 0) {
      return res.status(400).json({ message: "Invalid certificate id" });
    }
    if (!mobile && !email) {
      return res.status(400).json({ message: "Provide mobile or email" });
    }

    const certificate = await Certificate.getById(certificateId);

    if (!certificate || !matchesPublicContact(certificate, mobile, email)) {
      return res.status(404).json({ message: "Certificate not found for provided contact details" });
    }

    let filePath = certificate.file_path ? path.resolve(certificate.file_path) : null;
    if (!filePath || !fs.existsSync(filePath)) {
      const template = await Template.getById(certificate.template_id);
      if (!template) {
        return res.status(404).json({ message: "Template not found for certificate" });
      }

      const fields = await Template.getFields(certificate.template_id);
      const data = parseDataJson(certificate.data_json);
      const templateOutputDir = getTemplateCertificatesDir(certificate.template_id);
      const qrPath = path.join(templateOutputDir, `qr_${certificate.certificate_no}.png`);
      const baseUrl = env.APP_BASE_URL || `http://localhost:${env.PORT}`;
      const verificationURL = `${baseUrl}/api/certificates/verify/${certificate.certificate_no}`;
      await generateQR(verificationURL, qrPath);

      const regeneratedPath = await generateCertificate({
        templatePath: template.image_path,
        outputDir: templateOutputDir,
        fields,
        data,
        qrPath,
        template,
      });

      await Certificate.update(certificate.id, {
        student_name: certificate.student_name,
        school_name: certificate.school_name,
        mobile: certificate.mobile,
        email: certificate.email,
        data_json: data,
        file_path: regeneratedPath,
      });

      filePath = path.resolve(regeneratedPath);
    }

    const filename = buildCertificateFilename(certificate);
    return res.download(filePath, filename);
  } catch (error) {
    next(error);
  }
};

// Delete certificate
exports.deleteCertificate = async (req, res, next) => {
  try {
    const certificate = await Certificate.getById(req.params.id);
    if (!certificate) {
      return res.status(404).json({ message: "Certificate not found" });
    }

    await Certificate.delete(certificate.id);

    const filePath = certificate.file_path ? path.resolve(certificate.file_path) : null;
    if (filePath && fs.existsSync(filePath)) {
      fs.unlink(filePath, () => {});
    }

    const qrPath = path.join(
      getTemplateCertificatesDir(certificate.template_id),
      `qr_${certificate.certificate_no}.png`,
    );
    if (fs.existsSync(qrPath)) {
      fs.unlink(qrPath, () => {});
    }

    return res.json({ success: true, message: "Certificate deleted" });
  } catch (error) {
    next(error);
  }
};

// Public certificate verification API
exports.verifyCertificate = async (req, res, next) => {
  try {
    const certificateNo = String(req.params.certificateNo || "").trim();
    if (!certificateNo) {
      return res.status(400).json({ valid: false, message: "certificateNo is required" });
    }

    const certificate = await Certificate.getByCertificateNo(certificateNo);
    if (!certificate) {
      return res.status(404).json({
        valid: false,
        message: "Certificate not found",
      });
    }

    return res.json({
      valid: true,
      certificate,
    });
  } catch (error) {
    next(error);
  }
};
