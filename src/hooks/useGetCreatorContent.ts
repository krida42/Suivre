import { useSuiClient } from "@mysten/dapp-kit";
import type { SuiClient } from "@mysten/sui/client";
import { useQuery } from "@tanstack/react-query";
import type { CreatorContent } from "@models/content";
import { getObjectFields } from "@utils/sui/objectParsing";
import { withRpcRetry } from "@utils/sui/rpcRetry";

type ObjectLike = {
  data?: {
    content?: unknown;
    type?: string | null;
    objectId?: string;
  } | null;
};

const PAGE_LIMIT = 50;

function mapContentObjectsToCreatorContent(data: ObjectLike[]): CreatorContent[] {
  return data
    .map((obj) => {
      const fields = getObjectFields(obj.data?.content);
      if (!fields) return null;

      const idFields = getObjectFields(fields.id);
      const objectId = obj.data?.objectId;
      const resolvedId = String(idFields?.id ?? objectId ?? "");

      return {
        id: resolvedId,
        contentName: String(fields.content_name ?? ""),
        contentDescription: String(fields.content_description ?? ""),
        blobId: String(fields.blob_id ?? ""),
      };
    })
    .filter((item): item is CreatorContent => item !== null && item.id.length > 0);
}

export async function fetchCreatorContent(suiClient: SuiClient, creatorId: string): Promise<CreatorContent[]> {
  if (!creatorId) {
    return [];
  }

  const creatorObject = await withRpcRetry(
    () =>
      suiClient.getObject({
        id: creatorId,
        options: {
          showContent: true,
          showType: true,
        },
      }),
    "getObject(ContentCreator)"
  );

  const creatorFields = getObjectFields(creatorObject.data?.content);
  const walletAddress = creatorFields?.wallet;
  const creatorType = creatorObject.data?.type;
  const creatorPackageId =
    typeof creatorType === "string" && creatorType.includes("::") ? creatorType.split("::")[0].toLowerCase() : null;

  if (typeof walletAddress !== "string" || !walletAddress) {
    console.warn("Unable to resolve wallet address from creator object", creatorId, creatorObject);
    return [];
  }

  const filteredObjects: ObjectLike[] = [];
  let cursor: string | null = null;

  // Strategy A: server-side type filter for the creator package.
  while (true) {
    const page = await withRpcRetry(
      () =>
        suiClient.getOwnedObjects({
          owner: walletAddress,
          cursor: cursor ?? undefined,
          limit: PAGE_LIMIT,
          options: {
            showContent: true,
            showType: true,
          },
          filter: {
            StructType: `${creatorPackageId ?? "0x0"}::content_creator::Content`,
          },
        }),
      "getOwnedObjects(Content, filtered)"
    );

    filteredObjects.push(...page.data);

    if (!page.hasNextPage || !page.nextCursor) break;
    cursor = page.nextCursor;
  }

  const mappedFiltered = mapContentObjectsToCreatorContent(filteredObjects);
  if (mappedFiltered.length > 0) {
    return mappedFiltered;
  }

  const allOwnedObjects: ObjectLike[] = [];
  let unfilteredCursor: string | null = null;

  // Strategy B fallback: fetch all objects, then filter client-side by type suffix.
  while (true) {
    const page = await withRpcRetry(
      () =>
        suiClient.getOwnedObjects({
          owner: walletAddress,
          cursor: unfilteredCursor ?? undefined,
          limit: PAGE_LIMIT,
          options: {
            showContent: true,
            showType: true,
          },
        }),
      "getOwnedObjects(all, fallback)"
    );

    allOwnedObjects.push(...page.data);

    if (!page.hasNextPage || !page.nextCursor) break;
    unfilteredCursor = page.nextCursor;
  }

  const contentTypeSuffix = `::content_creator::Content`;
  const fallbackCandidates = allOwnedObjects.filter((obj) => {
    const type = obj.data?.type;
    if (!type) return false;
    const normalized = type.toLowerCase();
    if (!normalized.endsWith(contentTypeSuffix.toLowerCase())) return false;
    if (!creatorPackageId) return true;
    return normalized.startsWith(`${creatorPackageId}::`);
  });

  return mapContentObjectsToCreatorContent(fallbackCandidates);
}

export function useGetCreatorContent(creatorId: string | null | undefined) {
  const suiClient = useSuiClient() as SuiClient;

  return useQuery({
    queryKey: ["creator-content", creatorId],
    queryFn: () => fetchCreatorContent(suiClient, creatorId ?? ""),
    enabled: Boolean(creatorId),
    staleTime: 30_000,
  });
}
