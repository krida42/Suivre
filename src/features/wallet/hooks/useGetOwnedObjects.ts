import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { useCallback } from "react";

export function useGetOwnedObjects() {
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();

  return useCallback(async () => {
    if (!currentAccount?.address) {
      console.warn("useGetOwnedObjects called without a connected Sui account; returning empty list.");
      return [];
    }

    const res = await suiClient.getOwnedObjects({
      owner: currentAccount.address,
      options: {
        showContent: true,
        showType: true,
      },
    });

    return res.data || [];
  }, [suiClient, currentAccount]);
}
