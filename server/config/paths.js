const path = require("path");
const env = require("./env");

const ROOT_DIR = path.resolve(__dirname, "..");
const STORAGE_DIR = path.resolve(ROOT_DIR, env.STORAGE_DIR);

const PATHS = {
  ROOT_DIR,
  STORAGE_DIR,
  UPLOADS_DIR: path.join(STORAGE_DIR, "uploads"),
  UPLOADS_TEMPLATES_DIR: path.join(STORAGE_DIR, "uploads", "templates"),
  UPLOADS_CSV_DIR: path.join(STORAGE_DIR, "uploads", "csv"),
  GENERATED_DIR: path.join(STORAGE_DIR, "generated"),
  GENERATED_CERTIFICATES_DIR: path.join(STORAGE_DIR, "generated", "certificates"),
  GENERATED_ZIPS_DIR: path.join(STORAGE_DIR, "generated", "zips"),
  TEMP_DIR: path.join(STORAGE_DIR, "temp"),
  LOGS_DIR: path.join(ROOT_DIR, "logs"),
  LOGS_APP_FILE: path.join(ROOT_DIR, "logs", "app.log"),
  LOGS_HTTP_FILE: path.join(ROOT_DIR, "logs", "http.log"),
  LOGS_ERROR_FILE: path.join(ROOT_DIR, "logs", "error.log"),
};

module.exports = PATHS;
