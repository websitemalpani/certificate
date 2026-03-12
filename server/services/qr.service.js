const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");

const generateQR = async (text, outputPath) => {
  try {
    const folder = path.dirname(outputPath);
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }

    await QRCode.toFile(outputPath, text);
    return outputPath;
  } catch (error) {
    throw error;
  }
};

module.exports = { generateQR };
