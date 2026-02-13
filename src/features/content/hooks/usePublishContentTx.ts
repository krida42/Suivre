import { useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { CONTENT_CREATOR_PACKAGE_ID } from "@shared/config/chain";

type PublishContentArgs = {
  title: string;
  description: string;
  blobId: string;
};

type UsePublishContentTxReturn = {
  publishContent: (args: PublishContentArgs) => Promise<{ digest: string }>;
  isPublishing: boolean;
  error: string | null;
};

export function usePublishContentTx(): UsePublishContentTxReturn {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publishContent = async ({ title, description, blobId }: PublishContentArgs): Promise<{ digest: string }> => {
    if (!currentAccount?.address) {
      throw new Error("Wallet not connected");
    }

    setIsPublishing(true);
    setError(null);

    try {
      const ownedCaps = await suiClient.getOwnedObjects({
        owner: currentAccount.address,
        filter: {
          StructType: `${CONTENT_CREATOR_PACKAGE_ID}::content_creator::CreatorCap`,
        },
        options: {
          showType: true,
        },
      });

      const creatorCapId = ownedCaps.data[0]?.data?.objectId;

      if (!creatorCapId) {
        throw new Error("No CreatorCap found for the current wallet");
      }

      const tx = new Transaction();

      tx.moveCall({
        target: `${CONTENT_CREATOR_PACKAGE_ID}::content_creator::upload_content`,
        arguments: [
          tx.object(creatorCapId),
          tx.pure.string(title),
          tx.pure.string(description),
          tx.pure.string(blobId),
        ],
      });

      let txDigest: string | null = null;

      await new Promise<void>((resolve, reject) => {
        signAndExecuteTransaction(
          { transaction: tx },
          {
            onSuccess: (result: { digest: string }) => {
              txDigest = result.digest;
              resolve();
            },
            onError: (err: Error) => reject(err),
          }
        );
      });

      if (!txDigest) {
        throw new Error("Transaction digest missing after upload_content execution");
      }

      return { digest: txDigest };
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
