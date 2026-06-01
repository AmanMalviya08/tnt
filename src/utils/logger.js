const { createLogger, format, transports } = require("winston");
const path = require("path");
const fs = require("fs");

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const { combine, timestamp, printf, colorize, errors } = format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let log = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  if (Object.keys(meta).length > 0) {
    log += ` | ${JSON.stringify(meta)}`;
  }
  if (stack) {
    log += `\n${stack}`;
  }
  return log;
});

// Single shared log file — sare logs yahan
const sharedFileTransport = new transports.File({
  filename: path.join(logsDir, "app.log"),
  maxsize: 10 * 1024 * 1024, // 10MB
  maxFiles: 10,
});

// ── Main Application Logger ──────────────────────────────────────────────────
const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(
    errors({ stack: true }),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
    logFormat
  ),
  transports: [
    new transports.Console({
      format: combine(
        colorize({ all: true }),
        timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
        logFormat
      ),
    }),
    sharedFileTransport,
  ],
});

// ── PDF / Puppeteer Logger ────────────────────────────────────────────────────
const pdfLogger = createLogger({
  level: "debug",
  format: combine(
    errors({ stack: true }),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
    logFormat
  ),
  transports: [
    new transports.Console({
      format: combine(
        colorize({ all: true }),
        timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
        logFormat
      ),
    }),
    sharedFileTransport, // same app.log file
  ],
});

// Helper: measure elapsed time
function elapsedMs(startTime) {
  return `${Date.now() - startTime}ms`;
}

module.exports = { logger, pdfLogger, elapsedMs };
