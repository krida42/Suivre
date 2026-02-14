const MAX_RETRIES = 4;
const BASE_RETRY_DELAY_MS = 350;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableRpcError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("429") ||
    message.includes("too many requests") ||
    message.includes("rate limit") ||
    message.includes("failed to fetch")
  );
}

export async function withRpcRetry<T>(operation: () => Promise<T>, label: string): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const canRetry = isRetryableRpcError(error) && attempt < MAX_RETRIES - 1;

      if (!canRetry) {
        throw error;
      }

      const retryDelay = BASE_RETRY_DELAY_MS * 2 ** attempt;
      console.warn(`${label} rate-limited (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${retryDelay}ms`);
      await sleep(retryDelay);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`RPC call failed: ${label}`);
}
