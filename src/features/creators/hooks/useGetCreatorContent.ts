import { useCallback } from "react";
import { useSuiClient } from "@mysten/dapp-kit";
import type { CreatorContent } from "@features/content/types";

type MaybeFields = {
  fields?: Record<string, unknown>;
};

function getFields(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const maybeFields = value as MaybeFields;
  return maybeFields.fields ?? null;
}

const MAX_RETRIES = 4;
const BASE_RETRY_DELAY_MS = 350;
const PAGE_LIMIT = 50;

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

type ObjectLike = {
  data?: {
    content?: unknown;
    type?: string | null;
    objectId?: string;
  } | null;
};

function mapContentObjectsToCreatorContent(data: ObjectLike[]): CreatorContent[] {
  return data
    .map((obj) => {
      const fields = getFields(obj.data?.content);
      if (!fields) return null;

      const idFields = getFields(fields.id);
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

export function useGetCreatorContent() {
  const suiClient = useSuiClient();

  return useCallback(
    async function getCreatorContent(creatorId: string): Promise<CreatorContent[]> {
      if (!creatorId) {
        console.warn("getCreatorContent called without a creatorId; returning empty list.");
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

      const creatorFields = getFields(creatorObject.data?.content);
      const walletAddress = creatorFields?.wallet;
      const creatorType = creatorObject.data?.type;
      const creatorPackageId =
        typeof creatorType === "string" && creatorType.includes("::")
          ? creatorType.split("::")[0].toLowerCase()
          : null;

      if (typeof walletAddress !== "string" || !walletAddress) {
        console.warn("Unable to resolve wallet address from creator object", creatorId, creatorObject);
        return [];
      }

      // Strategy A: direct StructType filter + pagination.
      const filteredObjects: ObjectLike[] = [];
      let cursor: string | null = null;

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

      // Strategy B fallback: fetch all owned objects and filter type locally.
      const allOwnedObjects: ObjectLike[] = [];
      let unfilteredCursor: string | null = null;

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
    },
    [suiClient]
  );
}
