import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import type { SuiClient } from "@mysten/sui/client";
import { useQuery } from "@tanstack/react-query";
import { CONTENT_CREATOR_PACKAGE_ID } from "@config/chain";
import type { UserSubscription } from "@models/subscriptions";
import { extractObjectId, getObjectFields } from "@utils/sui/objectParsing";

type UseUserSubscriptionsReturn = {
  subscriptions: UserSubscription[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

async function fetchUserSubscriptions(suiClient: SuiClient, address: string): Promise<UserSubscription[]> {
  const res = await suiClient.getOwnedObjects({
    owner: address,
    filter: {
      StructType: `${CONTENT_CREATOR_PACKAGE_ID}::content_creator::Subscription`,
    },
    options: {
      showContent: true,
      showType: true,
    },
  });

  return res.data
    .map((obj) => {
      const fields = getObjectFields(obj.data?.content);
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
}

export function useUserSubscriptions(): UseUserSubscriptionsReturn {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient() as SuiClient;

  const query = useQuery({
    queryKey: ["user-subscriptions", currentAccount?.address],
    queryFn: () => fetchUserSubscriptions(suiClient, currentAccount!.address),
    enabled: Boolean(currentAccount?.address),
    staleTime: 15_000,
  });

  return {
    subscriptions: query.data ?? [],
    isLoading: query.isLoading || query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: async () => {
      await query.refetch();
    },
  };
}
