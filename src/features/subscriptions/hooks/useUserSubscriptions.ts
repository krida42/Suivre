import { useEffect, useState } from "react";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { CONTENT_CREATOR_PACKAGE_ID } from "@shared/config/chain";
import type { UserSubscription } from "@features/subscriptions/types";

type UseUserSubscriptionsReturn = {
  subscriptions: UserSubscription[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

function getFields(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return ((value as { fields?: Record<string, unknown> }).fields ?? null) as Record<string, unknown> | null;
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
    const nested = [fields.id, fields.value];
    for (const candidate of nested) {
      const extracted = extractObjectId(candidate, depth + 1);
      if (extracted) return extracted;
    }
  }

  const fallback = [record.id, record.fields, record.value];
  for (const candidate of fallback) {
    const extracted = extractObjectId(candidate, depth + 1);
    if (extracted) return extracted;
  }

  return null;
}

export function useUserSubscriptions(): UseUserSubscriptionsReturn {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();

  const [subscriptions, setSubscriptions] = useState<UserSubscription[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSubscriptions = async () => {
    if (!currentAccount?.address) {
      setSubscriptions([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await suiClient.getOwnedObjects({
        owner: currentAccount.address,
        filter: {
          StructType: `${CONTENT_CREATOR_PACKAGE_ID}::content_creator::Subscription`,
        },
        options: {
          showContent: true,
          showType: true,
        },
      });

      const mapped: UserSubscription[] = res.data
        .map((obj) => {
          const fields = getFields(obj.data?.content);
          if (!fields) return null;

          const subscriptionId = extractObjectId(fields.id);
          const creatorId = extractObjectId(fields.creator_id);

          return {
            id: String(subscriptionId ?? ""),
            creatorId: String(creatorId ?? ""),
            createdAt: Number(fields.created_at ?? 0),
          };
        })
        .filter((item): item is UserSubscription => item !== null && item.id.length > 0);

      setSubscriptions(mapped);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load subscriptions";
      setError(message);
      console.error("useUserSubscriptions error", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSubscriptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAccount?.address]);

  return {
    subscriptions,
    isLoading,
    error,
    refetch: loadSubscriptions,
  };
}
