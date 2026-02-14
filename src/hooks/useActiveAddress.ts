import { useCurrentAccount } from "@mysten/dapp-kit";
import { useEnokiAuth } from "@context/EnokiAuthContext";

type UseActiveAddressReturn = {
  address: string | null;
  walletAddress: string | null;
  zkLoginAddress: string | null;
  isWalletConnected: boolean;
  isZkLoginConnected: boolean;
  isConnected: boolean;
};

export function useActiveAddress(): UseActiveAddressReturn {
  const currentAccount = useCurrentAccount();
  const { accountAddress } = useEnokiAuth();

  const walletAddress = currentAccount?.address ?? null;
  const zkLoginAddress = accountAddress ?? null;
  const address = walletAddress ?? zkLoginAddress;

  return {
    address,
    walletAddress,
    zkLoginAddress,
    isWalletConnected: !!walletAddress,
    isZkLoginConnected: !!zkLoginAddress,
    isConnected: !!address,
  };
}
