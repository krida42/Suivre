import type { PropsWithChildren } from "react";
import { createNetworkConfig, SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import { getFullnodeUrl } from "@mysten/sui/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const testnetRpcUrl =
  import.meta.env.VITE_SUI_TESTNET_RPC_URL ?? (import.meta.env.DEV ? "/rpc/sui/testnet" : getFullnodeUrl("testnet"));

const mainnetRpcUrl =
  import.meta.env.VITE_SUI_MAINNET_RPC_URL ?? (import.meta.env.DEV ? "/rpc/sui/mainnet" : getFullnodeUrl("mainnet"));

const { networkConfig } = createNetworkConfig({
  testnet: { url: testnetRpcUrl },
  mainnet: { url: mainnetRpcUrl },
});

const queryClient = new QueryClient();

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        <WalletProvider autoConnect>{children}</WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
