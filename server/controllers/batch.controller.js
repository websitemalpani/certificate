const pLimitModule = require("p-limit");
const pLimit = pLimitModule.default || pLimitModule;
const fs = require("fs");
const Batch = require("../models/batch.model");
const Template = require("../models/template.model");
const Certificate = require("../models/certificate.model");
const path = require("path");
const { parseCSV } = require("../services/csv.service");
const { generateCertificate } = require("../services/certificate.service");
const generateCertificateNo = require("../utils/generateCertificateNo");
const { generateQR } = require("../services/qr.service");
const PATHS = require("../config/paths");
const env = require("../config/env");

const getTemplateCertificatesDir = (templateId) =>
  path.join(PATHS.GENERATED_CERTIFICATES_DIR, `template_${templateId}`);

const liveGenerationState = new Map();
const terminalStatuses = new Set(["generated", "failed", "partial_generated"]);

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

const normalizeMobile = (value) => String(value || "").replace(/\D/g, "").trim();
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const mapCsvRowToFieldKeys = (row = {}) => {
  const entries = Object.entries(row);
  const mapped = {};
  entries.forEach(([_, value], index) => {
    mapped[`field_${index + 1}`] = value ?? "";
  });

  // Keep contact aliases when present for public lookup support.
  const mobileCandidate = normalizeMobile(
    readValueByAliases(row, ["mobile", "phone", "mobile_no", "mobile number", "phone_number"]),
  );
  const emailCandidate = normalizeEmail(
    readValueByAliases(row, ["email", "email_id", "mail", "e-mail"]),
  );
  if (mobileCandidate) mapped.mobile = mobileCandidate;
  if (emailCandidate) mapped.email = emailCandidate;

  return mapped;
};

const buildProgressPayload = (batchProgress, liveState) => {
  const total = Number(liveState?.total ?? batchProgress.total_records ?? 0);
  const rawGenerated = Number(
    liveState?.generated ?? batchProgress.generated_count ?? 0,
  );
  const generated =
    total > 0 ? Math.min(Math.max(rawGenerated, 0), total) : Math.max(rawGenerated, 0);
  const persistedStatus = String(batchProgress.status || "").toLowerCase();
  const failedFromStatus =
    persistedStatus === "failed" || persistedStatus === "partial_generated"
      ? Math.max(total - generated, 0)
      : 0;
  const failed = Number(liveState?.failed ?? failedFromStatus);
  const pending = Math.max(total - generated - failed, 0);
  const percentage = total > 0 ? Math.min(Math.round((generated / total) * 100), 100) : 0;
  const status = liveState?.status || batchProgress.status || "pending";

  return {
    batchId: Number(batchProgress.id),
    status,
    totalRecords: total,
    generated,
    failed,
    pending,
    percentage,
    updatedAt: liveState?.updatedAt || new Date().toISOString(),
  };
};

// Upload CSV
exports.uploadCSV = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "CSV file required" });
    }

    if (!req.body.template_id) {
      return res.status(400).json({ message: "template_id is required" });
    }

    const filePath = req.file.path;
    const records = await parseCSV(filePath);
    if (!records.length) {
      if (fs.existsSync(filePath)) {
        fs.unlink(filePath, () => {});
      }
      return res.status(400).json({ message: "CSV has no data rows. Add at least one record." });
    }

    const batchId = await Batch.create({
      template_id: req.body.template_id,
      uploaded_by: req.user.id,
      total_records: records.length,
      csv_file_path: filePath,
    });

    res.status(201).json({
      success: true,
      batchId,
      totalRecords: records.length,
    });
  } catch (error) {
    next(error);
  }
};

// Get all batches
exports.getAllBatches = async (req, res, next) => {
  try {
    const batches = await Batch.getAll();
    res.json(batches);
  } catch (error) {
    next(error);
  }
};

// Get batch by ID
exports.getBatchById = async (req, res, next) => {
  try {
    const batch = await Batch.getById(req.params.id);

    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    res.json(batch);
  } catch (error) {
    next(error);
  }
};

// Delete batch and related generated files/certificates
exports.deleteBatch = async (req, res, next) => {
  try {
    const batchId = String(req.params.id);
    const batch = await Batch.getById(batchId);

    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    if (batch.status === "generating") {
      return res.status(400).json({ message: "Cannot remove a batch while generation is in progress" });
    }

    const certificates = await Certificate.getByBatchId(batchId);

    await Promise.all(
      certificates.map(async (certificate) => {
        await Certificate.delete(certificate.id);

        const certificateFile = certificate.file_path ? path.resolve(certificate.file_path) : null;
        if (certificateFile && fs.existsSync(certificateFile)) {
          fs.unlink(certificateFile, () => {});
        }

        const qrPath = path.join(
          getTemplateCertificatesDir(certificate.template_id),
          `qr_${certificate.certificate_no}.png`,
        );
        if (fs.existsSync(qrPath)) {
          fs.unlink(qrPath, () => {});
        }
      }),
    );

    const csvFilePath = batch.csv_file_path ? path.resolve(batch.csv_file_path) : null;
    if (csvFilePath && fs.existsSync(csvFilePath)) {
      fs.unlink(csvFilePath, () => {});
    }

    await Batch.delete(batchId);
    liveGenerationState.delete(batchId);

    res.json({ success: true, message: "Batch removed successfully" });
  } catch (error) {
    next(error);
  }
};

// Batch progress API
exports.getBatchProgress = async (req, res, next) => {
  try {
    const batchId = String(req.params.id);
    const batchProgress = await Batch.getProgress(batchId);

    if (!batchProgress) {
      return res.status(404).json({ message: "Batch not found" });
    }

    const liveState = liveGenerationState.get(batchId);
    res.json(buildProgressPayload(batchProgress, liveState));
  } catch (error) {
    next(error);
  }
};

// Real-time generation counter (SSE)
exports.streamBatchProgress = async (req, res, next) => {
  try {
    const batchId = String(req.params.id);
    const batchProgress = await Batch.getProgress(batchId);

    if (!batchProgress) {
      return res.status(404).json({ message: "Batch not found" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let intervalId = null;

    const sendUpdate = async () => {
      const latest = await Batch.getProgress(batchId);
      if (!latest) {
        res.write(`event: error\ndata: ${JSON.stringify({ message: "Batch not found" })}\n\n`);
        clearInterval(intervalId);
        res.end();
        return;
      }

      const liveState = liveGenerationState.get(batchId);
      const payload = buildProgressPayload(latest, liveState);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);

      if (terminalStatuses.has(payload.status)) {
        clearInterval(intervalId);
        res.end();
        setTimeout(() => liveGenerationState.delete(batchId), 5 * 60 * 1000);
      }
    };

    await sendUpdate();
    intervalId = setInterval(sendUpdate, 1000);

    req.on("close", () => {
      clearInterval(intervalId);
    });
  } catch (error) {
    next(error);
  }
};

// Generate certificates
exports.generateCertificates = async (req, res, next) => {
  let batchId = null;

  try {
    batchId = String(req.params.id);

    const batch = await Batch.getById(batchId);
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }
    if (batch.status === "generating") {
      return res.status(409).json({ message: "Generation already in progress for this batch" });
    }

    const existingGeneratedCount = Number(await Certificate.countByBatchId(batchId) || 0);
    if (existingGeneratedCount > 0 && ["generated", "partial_generated"].includes(String(batch.status || "").toLowerCase())) {
      return res.status(400).json({
        message: "Certificates already generated for this batch. Create a new batch for re-generation.",
      });
    }

    const csvRecords = await parseCSV(batch.csv_file_path);
    const records = csvRecords.map(mapCsvRowToFieldKeys);
    const template = await Template.getById(batch.template_id);

    if (!template) {
      return res.status(404).json({ message: "Template not found for this batch" });
    }

    const fields = await Template.getFields(batch.template_id);
    await Batch.updateStatus(batchId, "generating");

    const totalRecords = records.length;
    liveGenerationState.set(batchId, {
      total: totalRecords,
      generated: 0,
      failed: 0,
      status: "generating",
      updatedAt: new Date().toISOString(),
    });

    if (totalRecords === 0) {
      await Batch.updateStatus(batchId, "generated");
      liveGenerationState.set(batchId, {
        total: 0,
        generated: 0,
        failed: 0,
        status: "generated",
        updatedAt: new Date().toISOString(),
      });

      return res.json({
        success: true,
        message: "No records found in CSV",
        totalRecords: 0,
        totalGenerated: 0,
        totalFailed: 0,
      });
    }

    const baseUrl = env.APP_BASE_URL || `http://localhost:${env.PORT}`;
    const limit = pLimit(5);
    const templateOutputDir = getTemplateCertificatesDir(batch.template_id);

    const tasks = records.map((row) =>
      limit(async () => {
        const liveState = liveGenerationState.get(batchId);

        try {
          const certificateNo = generateCertificateNo();
          const verificationURL = `${baseUrl}/api/certificates/verify/${certificateNo}`;
          const qrPath = path.join(
            templateOutputDir,
            `qr_${certificateNo}.png`,
          );

          await generateQR(verificationURL, qrPath);

          const filePath = await generateCertificate({
            templatePath: template.image_path,
            outputDir: templateOutputDir,
            fields,
            data: row,
            qrPath,
            template,
          });

          await Certificate.create({
            batch_id: batchId,
            template_id: batch.template_id,
            certificate_no: certificateNo,
            student_name:
              readValueByAliases(row, ["field_1"]) ||
              readValueByAliases(row, [
              "student_name",
              "student name",
              "student",
              "name",
              "studentName",
            ]),
            school_name:
              readValueByAliases(row, ["field_2"]) ||
              readValueByAliases(row, [
              "school_name",
              "school name",
              "school",
              "institute",
              "schoolName",
            ]),
            mobile: normalizeMobile(
              readValueByAliases(row, ["mobile", "phone", "mobile_no", "mobile number", "phone_number"]),
            ),
            email: normalizeEmail(
              readValueByAliases(row, ["email", "email_id", "mail", "e-mail"]),
            ),
            data_json: row,
            file_path: filePath,
          });

          liveState.generated += 1;
          liveState.updatedAt = new Date().toISOString();
          return { success: true };
        } catch (taskError) {
          liveState.failed += 1;
          liveState.updatedAt = new Date().toISOString();
          return { success: false, error: taskError.message };
        }
      }),
    );

    const results = await Promise.all(tasks);
    const totalGenerated = results.filter((item) => item.success).length;
    const totalFailed = results.length - totalGenerated;
    const finalStatus =
      totalFailed === 0
        ? "generated"
        : totalGenerated === 0
          ? "failed"
          : "partial_generated";

    await Batch.updateStatus(batchId, finalStatus);
    liveGenerationState.set(batchId, {
      ...liveGenerationState.get(batchId),
      status: finalStatus,
      updatedAt: new Date().toISOString(),
    });

    res.json({
      success: totalGenerated > 0,
      message:
        finalStatus === "generated"
          ? "Certificates generated successfully"
          : "Certificate generation completed with failures",
      totalRecords: totalRecords,
      totalGenerated,
      totalFailed,
      status: finalStatus,
    });
  } catch (error) {
    if (batchId) {
      try {
        await Batch.updateStatus(batchId, "failed");
      } catch (_) {}

      const current = liveGenerationState.get(batchId);
      if (current) {
        liveGenerationState.set(batchId, {
          ...current,
          status: "failed",
          updatedAt: new Date().toISOString(),
        });
      }
    }

    next(error);
  }
};
