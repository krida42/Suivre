type ZkLogPayload = Record<string, unknown>;

type ZkLogLevel = "info" | "warn" | "error";

function cleanPayload(payload: ZkLogPayload = {}): ZkLogPayload {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

function log(level: ZkLogLevel, event: string, payload: ZkLogPayload = {}): void {
  const details = cleanPayload(payload);

  if (level === "error") {
    console.error("[zk]", event, details);
    return;
  }

  if (level === "warn") {
    console.warn("[zk]", event, details);
    return;
  }

  console.info("[zk]", event, details);
}

export const zkLogger = {
  info: (event: string, payload: ZkLogPayload = {}) => log("info", event, payload),
  warn: (event: string, payload: ZkLogPayload = {}) => log("warn", event, payload),
  error: (event: string, payload: ZkLogPayload = {}) => log("error", event, payload),
};
