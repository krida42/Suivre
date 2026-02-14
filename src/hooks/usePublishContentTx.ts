import { useState } from "react";
import { useSignAndExecuteTransaction, useSignTransaction, useSuiClient } from "@mysten/dapp-kit";
import type { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { CONTENT_CREATOR_PACKAGE_ID } from "@config/chain";
import { useEnokiAuth } from "@context/EnokiAuthContext";
import { useActiveAddress } from "@hooks/useActiveAddress";
import { executeTransactionWithOptionalSponsor } from "@utils/sui/sponsoredTransactions";
import { extractObjectId, getObjectFields } from "@utils/sui/objectParsing";

type PublishContentArgs = {
  title: string;
  text: string;
  imageBlobId: string | null;
  imageMimeType: string | null;
  videoBlobId: string | null;
  videoMimeType: string | null;
  creatorId: string;
};

type UsePublishContentTxReturn = {
  publishContent: (args: PublishContentArgs) => Promise<{ digest: string }>;
  isPublishing: boolean;
  error: string | null;
};

function normalizeInput(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export function usePublishContentTx(): UsePublishContentTxReturn {
  const { address: activeAddress, isZkLoginConnected } = useActiveAddress();
  const { signSponsoredTransaction } = useEnokiAuth();
  const suiClient = useSuiClient() as SuiClient;
  const { mutate: signTransaction } = useSignTransaction();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publishContent = async ({
    title,
    text,
    imageBlobId,
    imageMimeType,
    videoBlobId,
    videoMimeType,
    creatorId,
  }: PublishContentArgs): Promise<{ digest: string }> => {
    if (!activeAddress) {
      throw new Error("No connected account");
    }

    if (!creatorId) {
      throw new Error("Creator ID is required");
    }

    const trimmedTitle = title.trim();
    const trimmedText = text.trim();
    const normalizedImageBlobId = normalizeInput(imageBlobId);
    const normalizedVideoBlobId = normalizeInput(videoBlobId);
    const resolvedImageMimeType = normalizedImageBlobId ? normalizeInput(imageMimeType) || "application/octet-stream" : "";
    const resolvedVideoMimeType = normalizedVideoBlobId ? normalizeInput(videoMimeType) || "video/mp4" : "";

    const hasText = trimmedTitle.length > 0 || trimmedText.length > 0;
    const hasImage = normalizedImageBlobId.length > 0;
    const hasVideo = normalizedVideoBlobId.length > 0;

    if (!hasText && !hasImage && !hasVideo) {
      throw new Error("A post must contain text, an image, or a video");
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

      // Security guard: publishing is allowed only for creator objects owned by the connected account.
      if (!creatorWallet || creatorWallet !== activeAddress.toLowerCase()) {
        throw new Error("Selected creator does not belong to the connected account");
      }

      const ownedCaps = await suiClient.getOwnedObjects({
        owner: activeAddress,
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
          tx.pure.string(trimmedTitle),
          tx.pure.string(trimmedText),
          tx.pure.string(normalizedImageBlobId),
          tx.pure.string(resolvedImageMimeType),
          tx.pure.string(normalizedVideoBlobId),
          tx.pure.string(resolvedVideoMimeType),
        ],
      });

      const result = await executeTransactionWithOptionalSponsor({
        operation: "PUBLISH_CONTENT",
        transaction: tx,
        client: suiClient,
        sender: activeAddress,
        signSponsoredTransaction: isZkLoginConnected ? signSponsoredTransaction : undefined,
        signTransactionMutate: signTransaction,
        signAndExecuteTransactionMutate: signAndExecuteTransaction as unknown as (
          variables: { transaction: Transaction },
          callbacks: {
            onSuccess: (result: { digest: string }) => void;
            onError: (error: unknown) => void;
          }
        ) => void,
        allowedMoveCallTargets: [`${CONTENT_CREATOR_PACKAGE_ID}::content_creator::upload_content`],
      });

      if (!result.digest) {
        throw new Error("Transaction digest missing after upload_content execution");
      }

      return { digest: result.digest };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error while publishing post";
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
