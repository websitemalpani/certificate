const path = require("path");

/**
 * Extract file name from path
 */
const getFileName = (filePath) => {
  return path.basename(filePath);
};

/**
 * Format Date (DD-MM-YYYY)
 */
const formatDate = (date) => {
  const d = new Date(date);

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  return `${day}-${month}-${year}`;
};

/**
 * Generate random numeric serial
 */
const generateSerialNumber = (length = 6) => {
  let result = "";
  const numbers = "0123456789";

  for (let i = 0; i < length; i++) {
    result += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }

  return result;
};

module.exports = {
  getFileName,
  formatDate,
  generateSerialNumber,
};
