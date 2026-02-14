import { useSuiClient } from "@mysten/dapp-kit";
import { useQuery } from "@tanstack/react-query";
import { CONTENT_CREATOR_PACKAGE_ID } from "@config/chain";
import { useActiveAddress } from "@hooks/useActiveAddress";
import { mapOnChainCreatorObjectToContentCreator } from "@mappers/mapOnChainCreator";
import { getObjectFields } from "@utils/sui/objectParsing";

export function useGetMyCreators() {
  const { address: activeAddress } = useActiveAddress();
  const client = useSuiClient();

  console.log("useGetMyCreators - current account:", activeAddress);

  return useQuery({
    queryKey: ["my-creators", activeAddress],
    enabled: !!activeAddress,
    queryFn: async () => {
      if (!activeAddress) return [];

      // 1. Get owned objects
      // Note: In a real production app with many objects, you would need to handle pagination.
      // For this hackathon/demo context, fetching the first page (or assume limit is high enough) is acceptable.
      const ownedObjectsResponse = await client.getOwnedObjects({
        owner: activeAddress,
        options: {
          showContent: true,
          showType: true,
        },
      });

      const ownedObjects = ownedObjectsResponse.data;

      // 2. Filter subscriptions
      const subscriptionType = `${CONTENT_CREATOR_PACKAGE_ID}::content_creator::Subscription`;
      const subscriptions = ownedObjects.filter((obj) => obj.data?.type === subscriptionType);

      // 3. Extract creator IDs
      const creatorIds = subscriptions
        .map((sub) => {
          const fields = getObjectFields(sub.data?.content);
          return fields?.creator_id as string | undefined;
        })
        .filter((id): id is string => !!id);

      if (creatorIds.length === 0) return [];

      // Deduplicate IDs
      const uniqueCreatorIds = Array.from(new Set(creatorIds));

      // 4. Fetch creators
      const creatorsData = await client.multiGetObjects({
        ids: uniqueCreatorIds,
        options: {
          showContent: true,
        },
      });

      // 5. Map creators
      return creatorsData
        .map(mapOnChainCreatorObjectToContentCreator)
        .filter((c): c is NonNullable<typeof c> => c !== null);
    },
  });
}
