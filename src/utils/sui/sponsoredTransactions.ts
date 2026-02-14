import type { SuiClient } from "@mysten/sui/client";
import type { Transaction } from "@mysten/sui/transactions";
import { toBase64 } from "@mysten/sui/utils";
import { BACKEND_URL, SPONSORED_TX_ENABLED } from "@config/transactions";
import { mutateAsync } from "@utils/sui/mutateAsync";
import { zkLogger } from "@utils/sui/zkLogger";

export type TransactionDigestResult = {
  digest: string;
};

type SponsorTransactionResponse = {
  bytes: string;
  digest: string;
};

type ExecuteSponsoredTransactionResponse = {
  result: unknown;
};

type MutationCallbacks<TResult> = {
  onSuccess: (result: TResult) => void;
  onError: (error: unknown) => void;
};

export type SignTransactionMutate = (
  variables: { transaction: string },
  callbacks: MutationCallbacks<{ signature: string }>
) => void;

export type SignAndExecuteTransactionMutate = (
  variables: { transaction: Transaction },
  callbacks: MutationCallbacks<TransactionDigestResult>
) => void;

export type SignSponsoredTransaction = (transactionBytes: string) => Promise<string>;

type SponsorTransactionRequest = {
  sender: string;
  transactionKindBytes: string;
  allowedMoveCallTargets?: string[];
  allowedAddresses?: string[];
  operation: string;
};

type ExecuteSponsoredTransactionRequest = {
  digest: string;
  signature: string;
  operation: string;
};

export type ExecuteTransactionWithSponsorInput = {
  transaction: Transaction;
  client: SuiClient;
  sender: string;
  operation: string;
  signTransactionMutate?: SignTransactionMutate;
  signAndExecuteTransactionMutate?: SignAndExecuteTransactionMutate;
  signSponsoredTransaction?: SignSponsoredTransaction;
  allowedMoveCallTargets?: string[];
  allowedAddresses?: string[];
};

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractDigest(result: unknown): string | null {
  if (!isRecord(result)) {
    return null;
  }

  const directDigest = result.digest;
  if (typeof directDigest === "string" && directDigest.trim().length > 0) {
    return directDigest;
  }

  const nestedDigest = result.effects;
  if (!isRecord(nestedDigest)) {
    return null;
  }

  const maybeTxDigest = nestedDigest.transactionDigest;
  if (typeof maybeTxDigest === "string" && maybeTxDigest.trim().length > 0) {
    return maybeTxDigest;
  }

  return null;
}

async function postJson<TResponse, TRequest>(endpoint: string, payload: TRequest): Promise<TResponse> {
  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;

    try {
      const body = (await response.json()) as { error?: unknown };
      if (typeof body.error === "string" && body.error.trim().length > 0) {
        errorMessage = body.error;
      }
    } catch {
      // Fallback to HTTP status error message.
    }

    throw new Error(errorMessage);
  }

  return response.json() as Promise<TResponse>;
}

async function sponsorAndExecuteTransaction({
  transaction,
  client,
  sender,
  operation,
  signTransactionMutate,
  signSponsoredTransaction,
  allowedMoveCallTargets,
  allowedAddresses,
}: Omit<ExecuteTransactionWithSponsorInput, "signAndExecuteTransactionMutate">): Promise<TransactionDigestResult> {
  const transactionKindBytes = await transaction.build({
    client,
    onlyTransactionKind: true,
  });

  const sponsored = await postJson<SponsorTransactionResponse, SponsorTransactionRequest>("/api/sponsor", {
    sender,
    transactionKindBytes: toBase64(transactionKindBytes),
    allowedMoveCallTargets,
    allowedAddresses,
    operation,
  });

  let signature: string;
  if (signSponsoredTransaction) {
    signature = await signSponsoredTransaction(sponsored.bytes);
  } else if (signTransactionMutate) {
    const signed = await mutateAsync<{ transaction: string }, { signature: string }>(
      signTransactionMutate as unknown as (
        variables: { transaction: string },
        callbacks: MutationCallbacks<{ signature: string }>
      ) => void,
      {
        transaction: sponsored.bytes,
      }
    );

    signature = signed.signature;
  } else {
    throw new Error("No signer available for sponsored transaction.");
  }

  const executed = await postJson<ExecuteSponsoredTransactionResponse, ExecuteSponsoredTransactionRequest>(
    "/api/execute-transaction",
    {
      digest: sponsored.digest,
      signature,
      operation,
    }
  );

  const digest = extractDigest(executed.result) ?? sponsored.digest;

  return {
    digest,
  };
}

async function executeWithWallet({
  transaction,
  signAndExecuteTransactionMutate,
}: Pick<ExecuteTransactionWithSponsorInput, "transaction" | "signAndExecuteTransactionMutate">): Promise<TransactionDigestResult> {
  if (!signAndExecuteTransactionMutate) {
    throw new Error("Wallet signer unavailable for direct execution.");
  }

  return mutateAsync<{ transaction: Transaction }, TransactionDigestResult>(
    signAndExecuteTransactionMutate as unknown as (
      variables: { transaction: Transaction },
      callbacks: MutationCallbacks<TransactionDigestResult>
    ) => void,
    {
      transaction,
    }
  );
}

export async function executeTransactionWithOptionalSponsor(
  input: ExecuteTransactionWithSponsorInput
): Promise<TransactionDigestResult> {
  const {
    operation,
    transaction,
    client,
    sender,
    signTransactionMutate,
    signAndExecuteTransactionMutate,
    signSponsoredTransaction,
    allowedMoveCallTargets,
    allowedAddresses,
  } = input;

  if (!SPONSORED_TX_ENABLED) {
    zkLogger.info("sponsored_tx_disabled", { operation });
    return executeWithWallet({
      transaction,
      signAndExecuteTransactionMutate,
    });
  }

  try {
    zkLogger.info("sponsored_tx_initiated", {
      operation,
      sender,
      allowedMoveCallTargets,
      allowedAddresses,
    });

    const result = await sponsorAndExecuteTransaction({
      transaction,
      client,
      sender,
      operation,
      signTransactionMutate,
      signSponsoredTransaction,
      allowedMoveCallTargets,
      allowedAddresses,
    });

    zkLogger.info("sponsored_tx_success", {
      operation,
      digest: result.digest,
    });

    return result;
  } catch (error) {
    if (!signAndExecuteTransactionMutate) {
      zkLogger.error("sponsored_tx_failed_no_wallet_fallback", {
        operation,
        error: extractErrorMessage(error),
      });
      throw error;
    }

    zkLogger.warn("sponsored_tx_failed_fallback_wallet", {
      operation,
      error: extractErrorMessage(error),
    });

    return executeWithWallet({
      transaction,
      signAndExecuteTransactionMutate,
    });
  }
}
