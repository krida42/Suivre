const DEFAULT_BACKEND_URL = "http://localhost:3001";

function parseBooleanFlag(value: unknown, fallback: boolean): boolean {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") {
    return true;
  }

  if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") {
    return false;
  }

  return fallback;
}

const rawBackendUrl = typeof import.meta.env.VITE_BACKEND_URL === "string" ? import.meta.env.VITE_BACKEND_URL.trim() : "";

export const BACKEND_URL = rawBackendUrl.length > 0 ? rawBackendUrl : DEFAULT_BACKEND_URL;

export const SPONSORED_TX_ENABLED = parseBooleanFlag(import.meta.env.VITE_USE_SPONSORED_TX, rawBackendUrl.length > 0);
