import fs from "node:fs";
import path from "node:path";
import winston from "winston";

type LogData = Record<string, unknown>;

type ZkOperationStatus = "INITIATED" | "SUCCESS" | "ERROR";

const logsDir = path.resolve(process.cwd(), "logs");
fs.mkdirSync(logsDir, { recursive: true });

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "suivre-backend" },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const details = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
          return `${timestamp} [${level}] ${message}${details}`;
        })
      ),
    }),
    new winston.transports.File({ filename: path.join(logsDir, "error.log"), level: "error" }),
    new winston.transports.File({ filename: path.join(logsDir, "combined.log") }),
  ],
});

export function maskAddress(address: string): string {
  if (!address || address.length < 12) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function logServer(message: string, data: LogData = {}): void {
  logger.info(message, data);
}

export function logRequest(method: string, endpoint: string, data: LogData = {}): void {
  logger.info("API_REQUEST", {
    method,
    endpoint,
    ...data,
  });
}

export function logZkOperation(operation: string, status: ZkOperationStatus, data: LogData = {}): void {
  const payload = {
    operation,
    status,
    ...data,
  };

  if (status === "ERROR") {
    logger.error("ZK_OPERATION", payload);
    return;
  }

  logger.info("ZK_OPERATION", payload);
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function normalizeErrorStack(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined;
}

export function logError(message: string, error: unknown, data: LogData = {}): void {
  logger.error(message, {
    error: normalizeErrorMessage(error),
    stack: normalizeErrorStack(error),
    ...data,
  });
}

export default logger;
