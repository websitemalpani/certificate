const { randomUUID } = require("crypto");
const logger = require("../utils/logger");

const requestId = (req, res, next) => {
  const incoming = req.headers["x-request-id"];
  req.requestId = incoming || randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
};

const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - start;
    logger.http({
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      ip: req.ip,
      userId: req.user?.id || null,
    });
  });

  next();
};

module.exports = {
  requestId,
  requestLogger,
};
