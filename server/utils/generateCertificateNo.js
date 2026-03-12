const { v4: uuidv4 } = require("uuid");

/**
 * Generate certificate number
 * Format: CERT-2025-XXXXX
 */
const generateCertificateNo = () => {
  const year = new Date().getFullYear();
  const uniquePart = uuidv4().split("-")[0].toUpperCase();

  return `CERT-${year}-${uniquePart}`;
};

module.exports = generateCertificateNo;
