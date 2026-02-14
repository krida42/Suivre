const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

export type SponsorTransactionRequest = {
  sender: string;
  transactionKindBytes: string;
  allowedMoveCallTargets?: string[];
  allowedAddresses?: string[];
};

export type SponsoredTransactionResponse = {
  bytes: string;
  digest: string;
};

export type ExecuteTransactionResponse = {
  result: unknown;
};

export type WalrusAccessResponse = {
  walrusObjectIds: string[];
};

// Simple API call helper
export async function makeApiCall<TResponse = unknown, TRequest = unknown>(
  endpoint: string,
  data: TRequest,
): Promise<TResponse> {
  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    let errorMessage = `API call failed: ${response.statusText}`;

    try {
      const errorBody = await response.json();
      if (errorBody?.error) {
        errorMessage = errorBody.error;
      }
    } catch {
      // Ignore JSON parsing issues and keep the status text fallback.
    }

    throw new Error(errorMessage);
  }

  return response.json() as Promise<TResponse>;
}

export async function sponsorTransactionAPI(payload: SponsorTransactionRequest) {
  return makeApiCall<SponsoredTransactionResponse, SponsorTransactionRequest>("/api/sponsor", payload);
}

export async function executeTransactionAPI(digest: string, signature: string) {
  return makeApiCall<ExecuteTransactionResponse, { digest: string; signature: string }>(
    "/api/execute-transaction",
    { digest, signature },
  );
}

export async function getWalrusAccessAPI(address: string) {
  return makeApiCall<WalrusAccessResponse, { address: string }>("/api/walrus/access", { address });
}
