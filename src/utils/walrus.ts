import { parseContentRef } from "@utils/contentRef";

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function normalizeWalrusBlobId(raw: string): string {
  const { blobId } = parseContentRef(raw);
  let candidate = blobId.trim();
  if (!candidate) return "";

  if (/^https?:\/\//i.test(candidate)) {
    try {
      const url = new URL(candidate);
      const segments = url.pathname.split("/").filter(Boolean);
      const blobIndex = segments.lastIndexOf("blobs");
      if (blobIndex >= 0 && segments[blobIndex + 1]) {
        return safeDecodeURIComponent(segments[blobIndex + 1]).trim();
      }
      const singleBlobIndex = segments.lastIndexOf("blob");
      if (singleBlobIndex >= 0 && segments[singleBlobIndex + 1]) {
        return safeDecodeURIComponent(segments[singleBlobIndex + 1]).trim();
      }
      if (segments.length) {
        return safeDecodeURIComponent(segments[segments.length - 1]).trim();
      }
    } catch {
      // fallback parsing below
    }
  }

  candidate = candidate.split("?")[0].split("#")[0].trim();
  if (candidate.includes("/")) {
    candidate = candidate.slice(candidate.lastIndexOf("/") + 1);
  }

  return safeDecodeURIComponent(candidate).trim();
}
