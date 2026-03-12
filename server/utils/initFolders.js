const fs = require("fs");
const PATHS = require("../config/paths");
const logger = require("./logger");

const folders = [
  PATHS.STORAGE_DIR,
  PATHS.UPLOADS_DIR,
  PATHS.UPLOADS_TEMPLATES_DIR,
  PATHS.UPLOADS_CSV_DIR,
  PATHS.GENERATED_DIR,
  PATHS.GENERATED_CERTIFICATES_DIR,
  PATHS.GENERATED_ZIPS_DIR,
  PATHS.TEMP_DIR,
  PATHS.LOGS_DIR,
];

const initFolders = () => {
  folders.forEach((folder) => {
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
      logger.info("Created folder", { folder });
    }
  });
};

module.exports = initFolders;
