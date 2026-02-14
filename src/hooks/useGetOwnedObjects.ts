import { useSuiClient } from "@mysten/dapp-kit";
import { useActiveAddress } from "@hooks/useActiveAddress";
import { useCallback } from "react";

export function useGetOwnedObjects() {
  const suiClient = useSuiClient();
  const { address: activeAddress } = useActiveAddress();

  return useCallback(async () => {
    if (!activeAddress) {
      console.warn("useGetOwnedObjects called without a connected account; returning empty list.");
      return [];
    }

    const res = await suiClient.getOwnedObjects({
      owner: activeAddress,
      options: {
        showContent: true,
        showType: true,
      },
    });

    console.log(res.data);

    return res.data || [];
  }, [suiClient, activeAddress]);
}
