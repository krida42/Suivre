import { useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import type { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { CONTENT_CREATOR_PACKAGE_ID } from "@config/chain";
import { mutateAsync } from "@utils/sui/mutateAsync";
import { extractObjectId, getObjectFields } from "@utils/sui/objectParsing";

type PublishContentArgs = {
  title: string;
  description: string;
  blobId: string;
  creatorId: string;
};

type UsePublishContentTxReturn = {
  publishContent: (args: PublishContentArgs) => Promise<{ digest: string }>;
  isPublishing: boolean;
  error: string | null;
};

type ExecuteTransactionResult = {
  digest: string;
};

export function usePublishContentTx(): UsePublishContentTxReturn {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient() as SuiClient;
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publishContent = async ({ title, description, blobId, creatorId }: PublishContentArgs): Promise<{ digest: string }> => {
    if (!currentAccount?.address) {
      throw new Error("Wallet not connected");
    }

    if (!creatorId) {
      throw new Error("Creator ID is required");
    }

    setIsPublishing(true);
    setError(null);

    try {
      const creatorObject = await suiClient.getObject({
        id: creatorId,
        options: {
          showContent: true,
        },
      });

      const creatorFields = getObjectFields(creatorObject.data?.content);
      const creatorWallet = String(creatorFields?.wallet ?? "").toLowerCase();

      // Security guard: publishing is allowed only for creator objects owned by the connected wallet.
      if (!creatorWallet || creatorWallet !== currentAccount.address.toLowerCase()) {
        throw new Error("Selected creator does not belong to the connected wallet");
      }

      const ownedCaps = await suiClient.getOwnedObjects({
        owner: currentAccount.address,
        filter: {
          StructType: `${CONTENT_CREATOR_PACKAGE_ID}::content_creator::CreatorCap`,
        },
        options: {
          showType: true,
          showContent: true,
        },
      });

      const creatorCapId = ownedCaps.data
        .map((capObject) => {
          const capObjectId = capObject.data?.objectId;
          const capFields = getObjectFields(capObject.data?.content);
          const capCreatorId = extractObjectId(capFields?.creator_id);

          return {
            capObjectId: capObjectId ? String(capObjectId) : "",
            capCreatorId: capCreatorId ? String(capCreatorId).toLowerCase() : "",
          };
        })
        .find((cap) => cap.capObjectId.length > 0 && cap.capCreatorId === creatorId.toLowerCase())?.capObjectId;

      // New Move contract binds CreatorCap to a single creator_id.
      if (!creatorCapId) {
        throw new Error("No CreatorCap found for the selected creator");
      }

      const tx = new Transaction();

      tx.moveCall({
        target: `${CONTENT_CREATOR_PACKAGE_ID}::content_creator::upload_content`,
        arguments: [
          tx.object(creatorCapId),
          tx.object(creatorId),
          tx.pure.string(title),
          tx.pure.string(description),
          tx.pure.string(blobId),
        ],
      });

      const result = await mutateAsync<{ transaction: Transaction }, ExecuteTransactionResult>(
        signAndExecuteTransaction as unknown as (
          variables: { transaction: Transaction },
          callbacks: {
            onSuccess: (result: ExecuteTransactionResult) => void;
            onError: (error: unknown) => void;
          }
        ) => void,
        { transaction: tx }
      );

      if (!result.digest) {
        throw new Error("Transaction digest missing after upload_content execution");
      }

      return { digest: result.digest };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error while uploading content";
      setError(message);
      throw e;
    } finally {
      setIsPublishing(false);
    }
  };

  return {
    publishContent,
    isPublishing,
    error,
  };
}
