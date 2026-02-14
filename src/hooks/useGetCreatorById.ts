import { useSuiClient } from "@mysten/dapp-kit";
import type { SuiClient } from "@mysten/sui/client";
import { useQuery } from "@tanstack/react-query";
import { mapOnChainCreatorObjectToContentCreator } from "@mappers/mapOnChainCreator";
import type { ContentCreator } from "@models/creators";

async function fetchCreatorById(suiClient: SuiClient, creatorId: string): Promise<ContentCreator | null> {
  if (!creatorId) return null;

  const response = await suiClient.getObject({
    id: creatorId,
    options: {
      showContent: true,
    },
  });

  return mapOnChainCreatorObjectToContentCreator(response);
}

export function useGetCreatorById(creatorId: string | undefined) {
  const suiClient = useSuiClient() as SuiClient;

  return useQuery({
    queryKey: ["creator-by-id", creatorId],
    queryFn: () => fetchCreatorById(suiClient, creatorId ?? ""),
    enabled: Boolean(creatorId),
    staleTime: 30_000,
  });
}
