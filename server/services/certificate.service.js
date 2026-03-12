const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const normalizeKey = (value) =>
  String(value || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

const escapeXml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const resolveFieldValue = (fieldName, data, normalizedData) => {
  if (!fieldName) return "";

  const exact = data?.[fieldName];
  if (exact !== undefined && exact !== null) return String(exact);

  const trimmedKey = String(fieldName).trim();
  const trimmedMatch = data?.[trimmedKey];
  if (trimmedMatch !== undefined && trimmedMatch !== null) {
    return String(trimmedMatch);
  }

  const normalizedKey = normalizeKey(fieldName);
  const normalizedMatch = normalizedData[normalizedKey];
  if (normalizedMatch !== undefined && normalizedMatch !== null) {
    return String(normalizedMatch);
  }

  const compactTarget = normalizedKey.replace(/_/g, "");
  const fallbackKey = Object.keys(normalizedData).find((candidate) => {
    const compactCandidate = String(candidate).replace(/_/g, "");
    return (
      compactCandidate === compactTarget ||
      compactCandidate.includes(compactTarget) ||
      compactTarget.includes(compactCandidate)
    );
  });

  if (fallbackKey) {
    const fallbackValue = normalizedData[fallbackKey];
    if (fallbackValue !== undefined && fallbackValue !== null) {
      return String(fallbackValue);
    }
  }

  return "";
};

const generateCertificate = async ({
  templatePath,
  outputDir,
  fields,
  data,
  qrPath,
  template,
}) => {
  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputFileName = `${uuidv4()}.png`;
    const outputPath = path.join(outputDir, outputFileName);

    const normalizedData = Object.entries(data || {}).reduce((acc, [key, value]) => {
      const normalizedKey = normalizeKey(key);
      if (!normalizedKey) return acc;
      if (acc[normalizedKey] === undefined || acc[normalizedKey] === null) {
        acc[normalizedKey] = value;
      }
      return acc;
    }, {});

    const baseImage = sharp(templatePath);
    const metadata = await baseImage.metadata();
    const canvasWidth = Number(metadata?.width || 0);
    const canvasHeight = Number(metadata?.height || 0);
    const clampCoordinate = (value, maxValue) => {
      const num = Number(value || 0);
      if (!Number.isFinite(num)) return 0;
      const nonNegative = Math.max(num, 0);
      if (!Number.isFinite(maxValue) || maxValue <= 0) return nonNegative;
      return Math.min(nonNegative, maxValue);
    };
    const parseOptionalCoordinate = (value) => {
      if (value === null || value === undefined || value === "") return null;
      const num = Number(value);
      if (!Number.isFinite(num)) return null;
      return Math.max(num, 0);
    };

    const overlays = [];

    /* ==========================
       1️⃣ WATERMARK (Optional)
    =========================== */

    if (template?.watermark_enabled) {
      overlays.push({
        input: Buffer.from(
          `<svg width="1200" height="800">
            <text x="50%" y="50%"
              text-anchor="middle"
              font-size="100"
              fill="rgba(0,0,0,0.08)"
              font-family="Arial"
              transform="rotate(-30, 600, 400)">
              ${template.watermark_text || "VERIFIED"}
            </text>
          </svg>`,
        ),
        top: 0,
        left: 0,
      });
    }

    /* ==========================
       2️⃣ DYNAMIC TEXT FIELDS
    =========================== */

    fields.forEach((field) => {
      const text = resolveFieldValue(field.field_name, data, normalizedData);
      const safeText = escapeXml(text);
      const fontSize = Math.max(Number(field.font_size || 30), 8);
      const top = clampCoordinate(field.y_position, canvasHeight - 1);
      const left = clampCoordinate(field.x_position, canvasWidth - 1);

      overlays.push({
        input: Buffer.from(
          `<svg width="1000" height="200">
            <text x="0" y="50"
              font-size="${fontSize}"
              fill="${field.font_color || "#000"}"
              font-family="${field.font_family || "Arial"}">
              ${safeText}
            </text>
          </svg>`,
        ),
        top,
        left,
      });
    });

    /* ==========================
       3️⃣ QR CODE (Configurable Position)
    =========================== */

    const parsedQrX = parseOptionalCoordinate(template?.qr_x);
    const parsedQrY = parseOptionalCoordinate(template?.qr_y);
    const qrEnabled =
      Number.isFinite(parsedQrX) &&
      Number.isFinite(parsedQrY) &&
      parsedQrX >= 0 &&
      parsedQrY >= 0;
    if (qrEnabled && qrPath && fs.existsSync(qrPath)) {
      const qrX = clampCoordinate(parsedQrX, canvasWidth - 1);
      const qrY = clampCoordinate(parsedQrY, canvasHeight - 1);
      const requestedQrSize = Math.max(Number(template?.qr_size || 120), 20);
      const maxWidth = Math.max(canvasWidth - qrX, 20);
      const maxHeight = Math.max(canvasHeight - qrY, 20);
      const finalQrSize = Math.round(Math.min(requestedQrSize, maxWidth, maxHeight));
      const qrBuffer = await sharp(qrPath)
        .resize(finalQrSize, finalQrSize, { fit: "fill" })
        .png()
        .toBuffer();

      overlays.push({
        input: qrBuffer,
        top: qrY,
        left: qrX,
      });
    }

    /* ==========================
       4️⃣ DIGITAL SIGNATURE (Drag Position)
    =========================== */

    if (template?.signature_path && fs.existsSync(template.signature_path)) {
      overlays.push({
        input: template.signature_path,
        top: template.signature_y ?? 600,
        left: template.signature_x ?? 800,
      });
    }

    /* ==========================
       5️⃣ FINAL IMAGE OUTPUT
    =========================== */

    await baseImage.composite(overlays).toFile(outputPath);

    return outputPath;
  } catch (error) {
    throw error;
  }
};

module.exports = { generateCertificate };
