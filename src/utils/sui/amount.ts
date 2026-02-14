const MIST_PER_SUI = 1_000_000_000n;

function normalizeSuiInput(value: string): string | null {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;
  if (!/^\d+(\.\d{0,9})?$/.test(trimmed)) return null;
  return trimmed;
}

export function parseSuiToMist(value: string): bigint | null {
  const normalized = normalizeSuiInput(value);
  if (!normalized) return null;

  const [wholePart, fractionPart = ""] = normalized.split(".");
  const whole = BigInt(wholePart) * MIST_PER_SUI;
  const fraction = BigInt((fractionPart + "000000000").slice(0, 9));

  return whole + fraction;
}

export function formatMistToSui(value: bigint | string | number, maxDecimals = 2): string {
  let mist: bigint;

  try {
    mist = typeof value === "bigint" ? value : BigInt(String(value));
  } catch {
    return "0";
  }

  if (mist < 0n) return "0";

  const whole = mist / MIST_PER_SUI;
  const fraction = mist % MIST_PER_SUI;

  if (maxDecimals <= 0) {
    return whole.toString();
  }

  const paddedFraction = fraction.toString().padStart(9, "0");
  const clippedFraction = paddedFraction.slice(0, Math.min(9, maxDecimals));
  const trimmedFraction = clippedFraction.replace(/0+$/, "");

  return trimmedFraction.length ? `${whole}.${trimmedFraction}` : whole.toString();
}
