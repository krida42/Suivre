const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

export type SponsorTransactionRequest = {
  sender: string;
  transactionKindBytes: string;
  moveCallTarget?: string;
  allowedAddresses?: string[];
};

export type SponsoredTransactionResponse = {
  bytes: string;
  digest: string;
};

export type ExecuteTransactionResponse = {
  result: unknown;
};

export type SuiNsEntry = {
  name: string;
  status: "PENDING" | "ACTIVE";
};

export type SuiNsStatusResponse = {
  domain: string;
  network: "testnet" | "mainnet";
  hasSubname: boolean;
  primaryName: string | null;
  subnames: SuiNsEntry[];
};

export type SuiNsRegisterResponse = {
  created: boolean;
  primaryName: string | null;
  handle: string;
  subname: string;
  status?: "PENDING" | "ACTIVE";
};

async function makeApiCall<TResponse = unknown, TRequest = unknown>(endpoint: string, data: TRequest): Promise<TResponse> {
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
      // Keep status text fallback.
    }

    throw new Error(errorMessage);
  }

  return response.json() as Promise<TResponse>;
}

export async function sponsorTransactionAPI(payload: SponsorTransactionRequest) {
  return makeApiCall<SponsoredTransactionResponse, SponsorTransactionRequest>("/api/sponsor", payload);
}

export async function executeTransactionAPI(digest: string, signature: string) {
  return makeApiCall<ExecuteTransactionResponse, { digest: string; signature: string }>("/api/execute-transaction", {
    digest,
    signature,
  });
}

export async function getSuiNsStatusAPI(address: string) {
  return makeApiCall<SuiNsStatusResponse, { address: string }>("/api/suins/status", { address });
}

export async function registerSuiNsAPI(address: string, handle: string) {
  return makeApiCall<SuiNsRegisterResponse, { address: string; handle: string }>("/api/suins/register", { address, handle });
}
