import { useCallback } from "react";
import { useSuiClient } from "@mysten/dapp-kit";
import { ALL_CREATOR_OBJECT_ID } from "@config/chain";
import type { ContentCreator } from "@models/creators";

type MaybeFields = {
  fields?: Record<string, unknown>;
};

function getFields(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const maybeFields = value as MaybeFields;
  return maybeFields.fields ?? null;
}

function extractObjectId(value: unknown, depth = 0): string | null {
  if (depth > 6 || value == null) return null;

  if (typeof value === "string") {
    return value.startsWith("0x") ? value : null;
  }

  if (typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.id === "string" && record.id.startsWith("0x")) {
    return record.id;
  }

  const fields = getFields(value);
  if (fields) {
    const nestedCandidates: unknown[] = [fields.id, fields.value];
    for (const candidate of nestedCandidates) {
      const extracted = extractObjectId(candidate, depth + 1);
      if (extracted) return extracted;
    }
  }

  // Last fallback for common nested UID shapes.
  const fallbackCandidates: unknown[] = [record.id, record.fields, record.value];
  for (const candidate of fallbackCandidates) {
    const extracted = extractObjectId(candidate, depth + 1);
    if (extracted) return extracted;
  }

  return null;
}

const MAX_RETRIES = 4;
const BASE_RETRY_DELAY_MS = 350;
const ENTRY_FETCH_CHUNK_SIZE = 25;
const CREATOR_FETCH_CHUNK_SIZE = 50;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableRpcError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("429") ||
    message.includes("too many requests") ||
    message.includes("rate limit") ||
    message.includes("failed to fetch")
  );
}

async function withRpcRetry<T>(operation: () => Promise<T>, label: string): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const canRetry = isRetryableRpcError(error) && attempt < MAX_RETRIES - 1;

      if (!canRetry) {
        throw error;
      }

      const retryDelay = BASE_RETRY_DELAY_MS * 2 ** attempt;
      console.warn(`${label} rate-limited (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${retryDelay}ms`);
      await sleep(retryDelay);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`RPC call failed: ${label}`);
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [items];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

export function useGetAllCreators() {
  const suiClient = useSuiClient();

  return useCallback(async function getAllCreators(): Promise<ContentCreator[]> {
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

    const allCreatorsFields = getFields(allCreatorsObject.data?.content);
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
          const entryFields = getFields(entryObject.data?.content);
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
    const creatorObjects = [];

    for (const creatorIdChunk of chunkArray(creatorIds, CREATOR_FETCH_CHUNK_SIZE)) {
      const chunkObjects = await withRpcRetry(
        () =>
          suiClient.multiGetObjects({
            ids: creatorIdChunk,
            options: {
              showContent: true,
              showType: true,
            },
          }),
        "multiGetObjects(ContentCreator)"
      );

      creatorObjects.push(...chunkObjects);
    }

    return creatorObjects
      .map((obj) => {
        const fields = getFields(obj.data?.content);
        if (!fields) return null;

        const pseudo = String(fields.pseudo ?? "");
        const first = pseudo.charAt(0);
        const second = pseudo.charAt(1);
        const fallbackImage = `https://avatar.iran.liara.run/username?username=${first}+${second}`;

        const creatorId = extractObjectId(fields.id);

        return {
          id: String(creatorId ?? ""),
          pseudo,
          description: String(fields.description ?? ""),
          owner: String(fields.wallet ?? ""),
          image_url: String(fields.image_url ?? fallbackImage),
          price_per_month: String(fields.price_per_month ?? "0"),
        } as ContentCreator;
      })
      .filter((item): item is ContentCreator => item !== null && item.id.length > 0);
  }, [suiClient]);
}
