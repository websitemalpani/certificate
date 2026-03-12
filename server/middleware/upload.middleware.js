const multer = require("multer");
const path = require("path");
const fs = require("fs");
const PATHS = require("../config/paths");

const ensureFolder = (folderPath) => {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
};

ensureFolder(PATHS.UPLOADS_TEMPLATES_DIR);
ensureFolder(PATHS.UPLOADS_CSV_DIR);

const templateStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, PATHS.UPLOADS_TEMPLATES_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, uniqueName + path.extname(file.originalname));
  },
});

const csvStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, PATHS.UPLOADS_CSV_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, uniqueName + path.extname(file.originalname));
  },
});

const imageFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
  if (!allowedTypes.includes(file.mimetype)) {
    const error = new Error("Only JPG, JPEG, and PNG images are allowed");
    error.statusCode = 400;
    return cb(error, false);
  }
  cb(null, true);
};

const csvFilter = (req, file, cb) => {
  const allowedTypes = ["text/csv", "application/vnd.ms-excel"];
  if (!allowedTypes.includes(file.mimetype)) {
    const error = new Error("Only CSV files are allowed");
    error.statusCode = 400;
    return cb(error, false);
  }
  cb(null, true);
};

const uploadTemplate = multer({
  storage: templateStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
});

const uploadCSV = multer({
  storage: csvStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: csvFilter,
});

module.exports = {
  uploadTemplate,
  uploadCSV,
};
