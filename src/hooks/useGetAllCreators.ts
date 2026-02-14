import { useSuiClient } from "@mysten/dapp-kit";
import type { SuiClient } from "@mysten/sui/client";
import { useQuery } from "@tanstack/react-query";
import { ALL_CREATOR_OBJECT_ID } from "@config/chain";
import { mapOnChainCreatorObjectToContentCreator } from "@mappers/mapOnChainCreator";
import type { ContentCreator } from "@models/creators";
import { extractObjectId, getObjectFields } from "@utils/sui/objectParsing";
import { withRpcRetry } from "@utils/sui/rpcRetry";

const ENTRY_FETCH_CHUNK_SIZE = 25;
const CREATOR_FETCH_CHUNK_SIZE = 50;

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [items];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

type CreatorObjectResponse = {
  data?: {
    content?: unknown;
    objectId?: string | null;
  } | null;
};

export async function fetchAllCreators(suiClient: SuiClient): Promise<ContentCreator[]> {
  const allCreatorsObject = await withRpcRetry(
    () =>
      suiClient.getObject({
        id: ALL_CREATOR_OBJECT_ID,
        options: {
          showContent: true,
        },
      }),
    "getObject(AllCreators)"
  );

  const allCreatorsFields = getObjectFields(allCreatorsObject.data?.content);
  if (!allCreatorsFields) {
    console.warn("AllCreators object not found or has no fields", allCreatorsObject);
    return [];
  }

  const tableId = extractObjectId(allCreatorsFields.creators);

  if (!tableId || typeof tableId !== "string") {
    console.warn("Unable to resolve table ID from AllCreators.creators", allCreatorsFields);
    return [];
  }

  const creatorIdSet = new Set<string>();
  let cursor: string | null = null;

  // Walk the shared AllCreators table through dynamic fields, page by page.
  while (true) {
    const page = await withRpcRetry(
      () =>
        suiClient.getDynamicFields({
          parentId: tableId,
          cursor: cursor ?? undefined,
          limit: 50,
        }),
      "getDynamicFields(AllCreators)"
    );

    if (!page.data.length) break;

    const tableEntryObjectIds = page.data.map((field) => field.objectId);

    // Batch fetch table entry objects to reduce RPC pressure and avoid large payload spikes.
    for (const objectIdChunk of chunkArray(tableEntryObjectIds, ENTRY_FETCH_CHUNK_SIZE)) {
      try {
        const entryObjects = await withRpcRetry(
          () =>
            suiClient.multiGetObjects({
              ids: objectIdChunk,
              options: { showContent: true },
            }),
          "multiGetObjects(AllCreators table entries)"
        );

        for (const entryObject of entryObjects) {
          const entryFields = getObjectFields(entryObject.data?.content);
          if (!entryFields) continue;

          const creatorId = extractObjectId(entryFields.value);
          if (creatorId) {
            creatorIdSet.add(creatorId);
          }
        }
      } catch (error) {
        console.warn("Failed to load AllCreators table entries chunk", objectIdChunk, error);
      }
    }

    if (!page.hasNextPage || !page.nextCursor) break;
    cursor = page.nextCursor;
  }

  if (!creatorIdSet.size) {
    return [];
  }

  const creatorIds = [...creatorIdSet];
  const creatorObjects: CreatorObjectResponse[] = [];

  // Resolve creator object IDs in chunks before mapping to frontend shape.
  for (const creatorIdChunk of chunkArray(creatorIds, CREATOR_FETCH_CHUNK_SIZE)) {
    const chunkObjects = await withRpcRetry(
      () =>
        suiClient.multiGetObjects({
          ids: creatorIdChunk,
          options: {
            showContent: true,
          },
        }),
      "multiGetObjects(ContentCreator)"
    );

    creatorObjects.push(...chunkObjects);
  }

  return creatorObjects
    .map((obj) => mapOnChainCreatorObjectToContentCreator(obj))
    .filter((item): item is ContentCreator => item !== null && item.id.length > 0);
}

export function useGetAllCreators() {
  const suiClient = useSuiClient() as SuiClient;

  return useQuery({
    queryKey: ["all-creators", ALL_CREATOR_OBJECT_ID],
    queryFn: () => fetchAllCreators(suiClient),
    staleTime: 30_000,
  });
}
