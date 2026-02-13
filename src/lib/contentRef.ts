const CONTENT_REF_SEPARATOR = "::enc::";

export type ParsedContentRef = {
  blobId: string;
  encryptedId: string | null;
};

export function encodeContentRef(blobId: string, encryptedId: string | null | undefined): string {
  const cleanBlobId = blobId.trim();
  const cleanEncryptedId = encryptedId?.trim();
  if (!cleanEncryptedId) {
    return cleanBlobId;
  }
  return `${cleanBlobId}${CONTENT_REF_SEPARATOR}${cleanEncryptedId}`;
}

export function parseContentRef(value: string): ParsedContentRef {
  const raw = value.trim();
  const splitIndex = raw.indexOf(CONTENT_REF_SEPARATOR);

  if (splitIndex === -1) {
    return { blobId: raw, encryptedId: null };
  }

  const blobId = raw.slice(0, splitIndex).trim();
  const encryptedId = raw.slice(splitIndex + CONTENT_REF_SEPARATOR.length).trim();

  return {
    blobId,
    encryptedId: encryptedId.length > 0 ? encryptedId : null,
  };
}
