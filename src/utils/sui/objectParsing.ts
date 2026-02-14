export function getObjectFields(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return ((value as { fields?: Record<string, unknown> }).fields ?? null) as Record<string, unknown> | null;
}

export function extractObjectId(value: unknown, depth = 0): string | null {
  if (depth > 6 || value == null) return null;

  if (typeof value === "string") {
    return value.startsWith("0x") ? value : null;
  }

  if (typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.id === "string" && record.id.startsWith("0x")) {
    return record.id;
  }

  const fields = getObjectFields(value);
  if (fields) {
    const nestedCandidates: unknown[] = [fields.id, fields.value];
    for (const candidate of nestedCandidates) {
      const extracted = extractObjectId(candidate, depth + 1);
      if (extracted) return extracted;
    }
  }

  const fallbackCandidates: unknown[] = [record.id, record.fields, record.value];
  for (const candidate of fallbackCandidates) {
    const extracted = extractObjectId(candidate, depth + 1);
    if (extracted) return extracted;
  }

  return null;
}
