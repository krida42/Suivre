import { useSuiClient } from "@mysten/dapp-kit";
import type { SuiClient } from "@mysten/sui/client";
import { useQuery } from "@tanstack/react-query";
import type { CreatorContent } from "@models/content";
import { extractObjectId, getObjectFields } from "@utils/sui/objectParsing";
import { withRpcRetry } from "@utils/sui/rpcRetry";

type ObjectLike = {
  data?: {
    content?: unknown;
    type?: string | null;
    objectId?: string;
  } | null;
};

const PAGE_LIMIT = 50;
const ENTRY_FETCH_CHUNK_SIZE = 25;
const CONTENT_FETCH_CHUNK_SIZE = 50;

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [items];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

function mapContentObjectsToCreatorContent(data: ObjectLike[]): CreatorContent[] {
  return data
    .map((obj) => {
      const fields = getObjectFields(obj.data?.content);
      if (!fields) return null;

      const objectId = obj.data?.objectId ?? "";
      const resolvedId = extractObjectId(fields.id) ?? String(objectId);

      return {
        id: resolvedId,
        contentName: String(fields.content_name ?? ""),
        contentDescription: String(fields.content_description ?? ""),
        blobId: String(fields.blob_id ?? ""),
      };
    })
    .filter((item): item is CreatorContent => item !== null && item.id.length > 0);
}

async function fetchContentIdsFromCreatorTable(suiClient: SuiClient, contentsTableId: string): Promise<string[]> {
  const contentIdSet = new Set<string>();
  let cursor: string | null = null;

  while (true) {
    const page = await withRpcRetry(
      () =>
        suiClient.getDynamicFields({
          parentId: contentsTableId,
          cursor: cursor ?? undefined,
          limit: PAGE_LIMIT,
        }),
      "getDynamicFields(ContentCreator.contents)"
    );

    if (!page.data.length) break;

    const entryObjectIds = page.data.map((field) => field.objectId);
    for (const entryChunk of chunkArray(entryObjectIds, ENTRY_FETCH_CHUNK_SIZE)) {
      const entryObjects = await withRpcRetry(
        () =>
          suiClient.multiGetObjects({
            ids: entryChunk,
            options: {
              showContent: true,
            },
          }),
        "multiGetObjects(ContentCreator.contents entries)"
      );

      for (const entryObject of entryObjects) {
        const entryFields = getObjectFields(entryObject.data?.content);
        if (!entryFields) continue;

        const contentId = extractObjectId(entryFields.value);
        if (contentId) {
          contentIdSet.add(contentId);
        }
      }
    }

    if (!page.hasNextPage || !page.nextCursor) break;
    cursor = page.nextCursor;
  }

  return [...contentIdSet];
}

async function fetchContentObjectsByIds(suiClient: SuiClient, contentIds: string[]): Promise<ObjectLike[]> {
  const contentObjects: ObjectLike[] = [];
  for (const contentIdChunk of chunkArray(contentIds, CONTENT_FETCH_CHUNK_SIZE)) {
    const chunkObjects = await withRpcRetry(
      () =>
        suiClient.multiGetObjects({
          ids: contentIdChunk,
          options: {
            showContent: true,
            showType: true,
          },
        }),
      "multiGetObjects(Content)"
    );
    contentObjects.push(...chunkObjects);
  }
  return contentObjects;
}

function filterContentObjectsByPackage(data: ObjectLike[], creatorPackageId: string | null): ObjectLike[] {
  const contentTypeSuffix = `::content_creator::Content`;
  return data.filter((obj) => {
    const type = obj.data?.type;
    if (!type) return false;
    const normalized = type.toLowerCase();
    if (!normalized.endsWith(contentTypeSuffix.toLowerCase())) return false;
    if (!creatorPackageId) return true;
    return normalized.startsWith(`${creatorPackageId}::`);
  });
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
  const contentsTableId = extractObjectId(creatorFields?.contents);
  const creatorType = creatorObject.data?.type;
  const creatorPackageId =
    typeof creatorType === "string" && creatorType.includes("::") ? creatorType.split("::")[0].toLowerCase() : null;

  if (contentsTableId) {
    const contentIds = await fetchContentIdsFromCreatorTable(suiClient, contentsTableId);
    if (contentIds.length > 0) {
      const contentObjects = await fetchContentObjectsByIds(suiClient, contentIds);
      const filtered = filterContentObjectsByPackage(contentObjects, creatorPackageId);
      const mapped = mapContentObjectsToCreatorContent(filtered);
      if (mapped.length > 0) {
        return mapped;
      }
    }
  }

  // Backward compatibility with older contract state where content objects were owned by the creator wallet.
  if (typeof walletAddress !== "string" || !walletAddress) {
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

  const fallbackCandidates = filterContentObjectsByPackage(allOwnedObjects, creatorPackageId);

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
