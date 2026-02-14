import { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { toBase64 } from "@mysten/sui/utils";
import { executeTransactionAPI, sponsorTransactionAPI } from "./api";

type SignSponsoredTransaction = (transactionBytes: string) => Promise<string>;

type SponsorAndExecuteTransactionInput = {
  transaction: Transaction;
  client: SuiClient;
  sender: string;
  signSponsoredTransaction: SignSponsoredTransaction;
  allowedMoveCallTargets?: string[];
  allowedAddresses?: string[];
};

export async function sponsorAndExecuteTransaction({
  transaction,
  client,
  sender,
  signSponsoredTransaction,
  allowedMoveCallTargets,
  allowedAddresses,
}: SponsorAndExecuteTransactionInput) {
  const transactionKindBytes = await transaction.build({
    client,
    onlyTransactionKind: true,
  });

  const sponsored = await sponsorTransactionAPI({
    sender,
    transactionKindBytes: toBase64(transactionKindBytes),
    allowedMoveCallTargets,
    allowedAddresses,
  });

  const signature = await signSponsoredTransaction(sponsored.bytes);
  return executeTransactionAPI(sponsored.digest, signature);
}
