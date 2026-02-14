import { EnokiFlow } from "@mysten/enoki";
import { fromBase64 } from "@mysten/sui/utils";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

type EnokiNetwork = "mainnet" | "testnet" | "devnet";

type EnokiAuthContextValue = {
  accountAddress: string | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  isSigning: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  signSponsoredTransaction: (transactionBytes: string) => Promise<string>;
  signPersonalMessage: (message: Uint8Array) => Promise<string>;
};

const EnokiAuthContext = createContext<EnokiAuthContextValue | undefined>(undefined);

const enokiFlow = new EnokiFlow({
  apiKey: import.meta.env.VITE_ENOKI_PUBLIC_KEY,
  experimental_nativeCryptoSigner: true,
});

function clearAuthHash() {
  if (!window.location.hash) return;
  window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
}

function getNetwork(): EnokiNetwork {
  const candidate = (import.meta.env.VITE_SUI_NETWORK || "testnet").toLowerCase();
  if (candidate === "mainnet" || candidate === "devnet" || candidate === "testnet") {
    return candidate;
  }
  return "testnet";
}

export function EnokiAuthProvider({ children }: { children: ReactNode }) {
  const [accountAddress, setAccountAddress] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isSigning, setIsSigning] = useState(false);

  useEffect(() => {
    const unsubscribe = enokiFlow.$zkLoginState.subscribe((state) => {
      setAccountAddress(state.address ?? null);
    });

    async function initializeAuth() {
      setIsAuthLoading(true);

      try {
        await enokiFlow.getSession();

        if (window.location.hash.includes("id_token=") || window.location.hash.includes("error=")) {
          const callbackParams = new URLSearchParams(window.location.hash.slice(1));
          const oauthError = callbackParams.get("error");
          if (oauthError) {
            throw new Error(`OAuth callback error: ${oauthError}`);
          }

          await enokiFlow.handleAuthCallback(window.location.hash);
          clearAuthHash();
        }

        setAccountAddress(enokiFlow.$zkLoginState.get().address ?? null);
      } catch (error) {
        console.error("Enoki auth initialization failed:", error);
        clearAuthHash();
      } finally {
        setIsAuthLoading(false);
      }
    }

    void initializeAuth();
    return unsubscribe;
  }, []);

  const loginWithGoogle = async () => {
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!googleClientId) {
      throw new Error("Missing VITE_GOOGLE_CLIENT_ID in frontend environment.");
    }

    setIsAuthLoading(true);

    try {
      const redirectUrl = import.meta.env.VITE_GOOGLE_REDIRECT_URL || import.meta.env.VITE_ENOKI_REDIRECT_URL || window.location.origin;
      const authorizationUrl = await enokiFlow.createAuthorizationURL({
        provider: "google",
        clientId: googleClientId,
        redirectUrl,
        network: getNetwork(),
        extraParams: {
          prompt: "select_account",
        },
      });

      window.location.assign(authorizationUrl);
    } catch (error) {
      setIsAuthLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    await enokiFlow.logout();
    setAccountAddress(null);
  };

  const signSponsoredTransaction = async (transactionBytes: string) => {
    setIsSigning(true);

    try {
      const keypair = await enokiFlow.getKeypair({ network: getNetwork() });
      const { signature } = await keypair.signTransaction(fromBase64(transactionBytes));

      if (!signature) {
        throw new Error("Failed to sign sponsored transaction.");
      }

      return signature;
    } finally {
      setIsSigning(false);
    }
  };

  const signPersonalMessage = async (message: Uint8Array) => {
    setIsSigning(true);

    try {
      const keypair = await enokiFlow.getKeypair({ network: getNetwork() });
      const { signature } = await keypair.signPersonalMessage(message);

      if (!signature) {
        throw new Error("Failed to sign personal message.");
      }

      return signature;
    } finally {
      setIsSigning(false);
    }
  };

  const value = useMemo<EnokiAuthContextValue>(
    () => ({
      accountAddress,
      isAuthenticated: !!accountAddress,
      isAuthLoading,
      isSigning,
      loginWithGoogle,
      logout,
      signSponsoredTransaction,
      signPersonalMessage,
    }),
    [accountAddress, isAuthLoading, isSigning],
  );

  return <EnokiAuthContext.Provider value={value}>{children}</EnokiAuthContext.Provider>;
}

export function useEnokiAuth() {
  const context = useContext(EnokiAuthContext);

  if (!context) {
    throw new Error("useEnokiAuth must be used within an EnokiAuthProvider.");
  }

  return context;
}
