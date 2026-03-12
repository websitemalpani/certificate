const fs = require("fs");
const path = require("path");
const env = require("../config/env");
const PATHS = require("../config/paths");

const levels = ["debug", "info", "warn", "error"];
const minLevelIndex = levels.indexOf(env.LOG_LEVEL) >= 0 ? levels.indexOf(env.LOG_LEVEL) : 1;

const ensureDir = (filePath) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const writeLine = (filePath, payload) => {
  ensureDir(filePath);
  fs.appendFile(filePath, `${JSON.stringify(payload)}\n`, () => {});
};

const shouldLog = (level) => levels.indexOf(level) >= minLevelIndex;

const baseLog = (level, message, meta = {}) => {
  if (!shouldLog(level)) return;

  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...meta,
  };

  if (level === "error") {
    writeLine(PATHS.LOGS_ERROR_FILE, payload);
    console.error(`[${payload.ts}] ${message}`);
    return;
  }

  writeLine(PATHS.LOGS_APP_FILE, payload);
  if (level === "warn") {
    console.warn(`[${payload.ts}] ${message}`);
  } else {
    console.log(`[${payload.ts}] ${message}`);
  }
};

const http = (meta) => {
  const payload = {
    ts: new Date().toISOString(),
    ...meta,
  };
  writeLine(PATHS.LOGS_HTTP_FILE, payload);
};

module.exports = {
  debug: (message, meta) => baseLog("debug", message, meta),
  info: (message, meta) => baseLog("info", message, meta),
  warn: (message, meta) => baseLog("warn", message, meta),
  error: (message, meta) => baseLog("error", message, meta),
  http,
};
