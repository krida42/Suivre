import { useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { ContentCreatorpackageId } from "./package_id";

type UploadContentArgs = {
  title: string;
  description: string;
  blobId: string;
  creatorId: string;
};

type UseUploadContentReturn = {
  uploadContent: (args: UploadContentArgs) => Promise<{ digest: string }>;
  isUploading: boolean;
  error: string | null;
};

/**
 * Hook to publish encrypted content metadata on-chain using the `upload_content` Move function.
 *
 * It:
 * - Finds a `CreatorCap` owned by the current wallet
 * - Calls `${ContentCreatorpackageId}::content_creator::upload_content`
 * - Passes `title`, `description` and `blobId` as strings
 */
export const useUploadContent = (): UseUploadContentReturn => {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadContent = async ({ title, description, blobId }: UploadContentArgs): Promise<{ digest: string }> => {
    if (!currentAccount?.address) {
      throw new Error("Wallet not connected");
    }

    setIsUploading(true);
    setError(null);

    try {
      // Find a CreatorCap owned by the current account.
      // NOTE: If multiple creator caps exist, this currently uses the first one.
      const ownedCaps = await suiClient.getOwnedObjects({
        owner: currentAccount.address,
        filter: {
          StructType: `${ContentCreatorpackageId}::content_creator::CreatorCap`,
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
        target: `${ContentCreatorpackageId}::content_creator::upload_content`,
        arguments: [
          tx.object(creatorCapId), // &CreatorCap
          tx.pure.string(title), // arg1: content_name
          tx.pure.string(description), // arg2: content_description
          tx.pure.string(blobId), // arg3: blob_id
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
      setIsUploading(false);
    }
  };

  return {
    uploadContent,
    isUploading,
    error,
  };
};
