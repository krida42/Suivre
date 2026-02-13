import { useSuiClient } from "@mysten/dapp-kit";
import { ContentCreatorpackageId } from "./package_id";

export type CreatorContent = {
  id: string;
  contentName: string;
  contentDescription: string;
  blobId: string;
};

/**
 * Hook to fetch on-chain uploaded content for a given creator.
 *
 * Flow:
 * 1. Given a Creator object ID (`creatorId`), load the `ContentCreator` object to get its `owner` address.
 * 2. Query all `Content` objects of type `${ContentCreatorpackageId}::content_creator::Content`
 *    owned by that address.
 */
export const useGetCreatorContent = () => {
  const suiClient = useSuiClient();

  return async function getCreatorContent(creatorId: string): Promise<CreatorContent[]> {
    if (!creatorId) {
      console.warn("getCreatorContent called without a creatorId; returning empty list.");
      return [];
    }

    // 1) Resolve the creator object to find the creator's wallet address
    const creatorObject = await suiClient.getObject({
      id: creatorId,
      options: {
        showContent: true,
      },
    });

    const creatorFields = (creatorObject.data?.content as { fields: any } | null)?.fields;
    const walletAddress = creatorFields?.wallet as string | undefined;

    if (!walletAddress) {
      console.warn("Unable to resolve wallet address from creator object", creatorId, creatorObject);
      return [];
    }

    // 2) Fetch all Content objects owned by this wallet
    const res = await suiClient.getOwnedObjects({
      owner: walletAddress,
      options: {
        showContent: true,
        showType: true,
      },
      filter: {
        StructType: `${ContentCreatorpackageId}::content_creator::Content`,
      },
    });

    const contents = res.data
      .map((obj) => {
        const fields = (obj.data?.content as { fields: any } | null)?.fields;
        if (!fields) return null;

        return {
          id: fields.id.id as string,
          contentName: fields.content_name as string,
          contentDescription: fields.content_description as string,
          blobId: fields.blob_id as string,
        } as CreatorContent;
      })
      .filter((item) => item !== null) as CreatorContent[];

    return contents;
  };
};
