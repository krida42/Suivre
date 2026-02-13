import { useEffect, useState } from "react";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { ContentCreatorpackageId } from "./package_id";

export type UserSubscription = {
  id: string;
  creatorId: string;
  createdAt: number;
};

type UseUserSubscriptionsReturn = {
  subscriptions: UserSubscription[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export const useUserSubscriptions = (): UseUserSubscriptionsReturn => {
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
          StructType: `${ContentCreatorpackageId}::content_creator::Subscription`,
        },
        options: {
          showContent: true,
          showType: true,
        },
      });

      const mapped: UserSubscription[] = res.data
        .map((obj) => {
          const fields = (obj!.data!.content as { fields: any }).fields;
          if (!fields) return null;

          return {
            id: fields.id.id,
            creatorId: fields.creator_id,
            createdAt: Number(fields.created_at),
          };
        })
        .filter((item) => item !== null) as UserSubscription[];

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
};


