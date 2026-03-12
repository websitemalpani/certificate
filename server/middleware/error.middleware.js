const logger = require("../utils/logger");
const env = require("../config/env");

const normalizeError = (err) => {
  if (!err) return { statusCode: 500, message: "Internal Server Error" };

  if (err.name === "MulterError") {
    return { statusCode: 400, message: err.message };
  }

  if (err.code === "ER_DUP_ENTRY") {
    return { statusCode: 409, message: "Duplicate record already exists" };
  }

  if (err.code === "ER_NO_REFERENCED_ROW_2") {
    return { statusCode: 400, message: "Invalid reference id provided" };
  }

  if (err.statusCode || err.status) {
    return {
      statusCode: err.statusCode || err.status,
      message: err.message || "Request failed",
    };
  }

  return {
    statusCode: 500,
    message: err.message || "Internal Server Error",
  };
};

exports.errorHandler = (err, req, res, next) => {
  const normalized = normalizeError(err);

  logger.error(normalized.message, {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    statusCode: normalized.statusCode,
    stack: err?.stack,
  });

  res.status(normalized.statusCode).json({
    success: false,
    message: normalized.message,
    requestId: req.requestId,
    ...(env.NODE_ENV !== "production" && err?.stack
      ? { stack: err.stack.split("\n").map((line) => line.trim()) }
      : {}),
  });
};
