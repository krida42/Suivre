import { useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { ContentCreatorpackageId } from "./package_id";
import { useEnokiAuth } from "../context/EnokiAuthContext";
import { sponsorAndExecuteTransaction } from "./sponsoredTransactions";

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
 * Hook to publish encrypted content metadata on-chain using sponsored zkLogin transaction flow.
 */
export const useUploadContent = (): UseUploadContentReturn => {
  const { accountAddress, signSponsoredTransaction } = useEnokiAuth();
  const walletAccount = useCurrentAccount();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const suiClient = useSuiClient();

  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadContent = async ({ title, description, blobId }: UploadContentArgs): Promise<{ digest: string }> => {
    const activeAddress = accountAddress || walletAccount?.address;
    if (!activeAddress) {
      throw new Error("Aucun compte connecté (zkLogin ou wallet)");
    }

    setIsUploading(true);
    setError(null);

    try {
      // Find a CreatorCap owned by the active account.
      const ownedCaps = await suiClient.getOwnedObjects({
        owner: activeAddress,
        filter: {
          StructType: `${ContentCreatorpackageId}::content_creator::CreatorCap`,
        },
        options: {
          showType: true,
        },
      });

      const creatorCapId = ownedCaps.data[0]?.data?.objectId;

      if (!creatorCapId) {
        throw new Error("No CreatorCap found for the current connected address");
      }

      const tx = new Transaction();

      tx.moveCall({
        target: `${ContentCreatorpackageId}::content_creator::upload_content`,
        arguments: [
          tx.object(creatorCapId),
          tx.pure.string(title),
          tx.pure.string(description),
          tx.pure.string(blobId),
        ],
      });

      const isZkLoginMode = Boolean(accountAddress);
      if (isZkLoginMode) {
        const result = await sponsorAndExecuteTransaction({
          transaction: tx,
          client: suiClient,
          sender: activeAddress,
          signSponsoredTransaction,
          moveCallTarget: `${ContentCreatorpackageId}::content_creator::upload_content`,
        });

        const digest = (result?.result as { digest?: string } | undefined)?.digest;
        if (!digest) {
          throw new Error("Transaction digest missing after upload_content execution");
        }
        return { digest };
      }

      let walletDigest: string | null = null;
      await new Promise<void>((resolve, reject) => {
        signAndExecuteTransaction(
          { transaction: tx },
          {
            onSuccess: (result: { digest?: string }) => {
              walletDigest = result.digest || null;
              resolve();
            },
            onError: (err: Error) => reject(err),
          },
        );
      });

      if (!walletDigest) {
        throw new Error("Transaction digest missing after wallet execution");
      }
      return { digest: walletDigest };
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
