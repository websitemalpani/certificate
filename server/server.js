const express = require("express");
const cors = require("cors");
const env = require("./config/env");
const PATHS = require("./config/paths");
const logger = require("./utils/logger");
const initFolders = require("./utils/initFolders");
const initAuthSchema = require("./utils/initAuthSchema");
const { requestId, requestLogger } = require("./middleware/request.middleware");
const {
  globalApiLimiter,
  authLimiter,
} = require("./middleware/rateLimit.middleware");
const { notFound } = require("./middleware/notFound.middleware");
const { errorHandler } = require("./middleware/error.middleware");

require("./config/db");

const server = express();
initFolders();

server.disable("x-powered-by");
server.disable("etag");
const allowedOrigins = env.CORS_ORIGINS.split(",")
  .map((item) => item.trim())
  .filter(Boolean);

// Middlewares
server.use(cors());
server.use(express.json());

// CORS Headers
server.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});
server.use(express.json({ limit: "2mb" }));
server.use(requestId);
server.use(requestLogger);
server.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});
server.use("/api", (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }
  return globalApiLimiter(req, res, next);
});
server.use("/storage", express.static(PATHS.STORAGE_DIR));

server.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "ok",
    env: env.NODE_ENV,
    time: new Date().toISOString(),
  });
});

// Routes
server.use("/api/auth", authLimiter, require("./routes/auth.routes"));
server.use("/api/users", require("./routes/user.routes"));
server.use("/api/templates", require("./routes/template.routes"));
server.use("/api/certificates", require("./routes/certificate.routes"));
server.use("/api/batches", require("./routes/batch.routes"));
server.use("/api/dashboard", require("./routes/dashboard.routes"));

server.use(notFound);
server.use(errorHandler);

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", {
    message: error.message,
    stack: error.stack,
  });
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection", {
    message: reason?.message || "Unhandled promise rejection",
    stack: reason?.stack,
  });
});

const startServer = async () => {
  await initAuthSchema();

  server.listen(env.PORT, () => {
    logger.info(`Server running on http://localhost:${env.PORT}`, {
      env: env.NODE_ENV,
    });
  });
};

startServer().catch((error) => {
  logger.error("Failed to start server", {
    message: error.message,
    stack: error.stack,
  });
  process.exit(1);
});
