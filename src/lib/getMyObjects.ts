import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { useCallback } from "react";

export const useGetMyObjects = () => {
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();

  return useCallback(async () => {
    console.log("🚀 ~ getMyObjects called");

    if (!currentAccount?.address) {
      console.warn("getMyObjects called without a connected Sui account; returning empty list.");
      return [];
    }

    // get all owned cap objects
    const res = await suiClient.getOwnedObjects({
      owner: currentAccount.address,
      options: {
        showContent: true,
        showType: true,
      },
    });
    console.log("🚀 ~ getMyObjects ~ res:", res);
    
    return res.data || [];
  }, [suiClient, currentAccount]);
};
