const path = require("path");
const dotenv = require("dotenv");

const envCandidates = [
  path.resolve(__dirname, ".env"),
  path.resolve(__dirname, "..", ".env"),
];

envCandidates.some((candidate) => {
  const loaded = dotenv.config({ path: candidate });
  return !loaded.error;
});

const parseIntOrDefault = (value, fallback) => {
  const num = Number.parseInt(value, 10);
  return Number.isNaN(num) ? fallback : num;
};

const requireEnv = (name) => {
  const value = process.env[name];
  if (!value || String(value).trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseIntOrDefault(process.env.PORT, 5000),
  APP_BASE_URL: process.env.APP_BASE_URL || "",
  CORS_ORIGINS: process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:3000",
  JWT_SECRET: requireEnv("JWT_SECRET"),
  DB_HOST: requireEnv("DB_HOST"),
  DB_USER: requireEnv("DB_USER"),
  DB_PASSWORD: process.env.DB_PASSWORD || "",
  DB_NAME: requireEnv("DB_NAME"),
  DB_PORT: parseIntOrDefault(process.env.DB_PORT, 3306),
  EMAIL_USER: process.env.EMAIL_USER || "",
  EMAIL_PASS: process.env.EMAIL_PASS || "",
  RATE_LIMIT_WINDOW_MS: parseIntOrDefault(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  RATE_LIMIT_MAX: parseIntOrDefault(process.env.RATE_LIMIT_MAX, 200),
  RATE_LIMIT_AUTH_MAX: parseIntOrDefault(process.env.RATE_LIMIT_AUTH_MAX, 20),
  STORAGE_DIR: process.env.STORAGE_DIR || "storage",
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
};

module.exports = Object.freeze(env);
