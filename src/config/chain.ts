const FALLBACK_CONTENT_CREATOR_PACKAGE_ID = "0x13edc4ead50d8b67ac30ab5caf1d2342d7fd5376b836dd8aa73aaba7d8f6b8b4";
const FALLBACK_ALL_CREATOR_OBJECT_ID = "0xd6f5d9c3808fdd06b4ebf53746e8b20c50a539120862d90507d525993a2b4eb8";

function sanitizeHexId(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const cleaned = value.trim().replace(/['";]/g, "");
  if (!cleaned.startsWith("0x")) return null;
  if (!/^0x[0-9a-fA-F]+$/.test(cleaned)) return null;

  return cleaned;
}

export const CONTENT_CREATOR_PACKAGE_ID =
  sanitizeHexId(import.meta.env.VITE_CONTENT_CREATOR_PACKAGE_ID) ?? FALLBACK_CONTENT_CREATOR_PACKAGE_ID;

export const ALL_CREATOR_OBJECT_ID = sanitizeHexId(import.meta.env.VITE_ALL_CREATOR_OBJECT_ID) ?? FALLBACK_ALL_CREATOR_OBJECT_ID;
