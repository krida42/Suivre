import { EnokiFlow } from "@mysten/enoki";
import { fromBase64 } from "@mysten/sui/utils";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

type EnokiAuthContextValue = {
  accountAddress: string | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  isSigning: boolean;
  isConfigured: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  signSponsoredTransaction: (transactionBytes: string) => Promise<string>;
  signPersonalMessage: (messageBytes: Uint8Array) => Promise<string>;
};

const EnokiAuthContext = createContext<EnokiAuthContextValue | undefined>(undefined);
const POST_LOGIN_PATH_STORAGE_KEY = "suivre:postLoginPath";

const enokiPublicKey = typeof import.meta.env.VITE_ENOKI_PUBLIC_KEY === "string" ? import.meta.env.VITE_ENOKI_PUBLIC_KEY.trim() : "";
const enokiFlow = enokiPublicKey
  ? new EnokiFlow({
      apiKey: enokiPublicKey,
      experimental_nativeCryptoSigner: true,
    })
  : null;

function clearAuthHash() {
  if (!window.location.hash) return;
  window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
}

function getSafePostLoginPath(): string {
  try {
    const value = window.sessionStorage.getItem(POST_LOGIN_PATH_STORAGE_KEY);
    window.sessionStorage.removeItem(POST_LOGIN_PATH_STORAGE_KEY);

    if (typeof value === "string" && value.startsWith("/")) {
      return value;
    }
  } catch {
    // Ignore storage access errors and fallback to default route.
  }

  return "/app";
}

export function EnokiAuthProvider({ children }: { children: ReactNode }) {
  const [accountAddress, setAccountAddress] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isSigning, setIsSigning] = useState(false);

  useEffect(() => {
    if (!enokiFlow) {
      setIsAuthLoading(false);
      return;
    }

    const flow = enokiFlow;

    const unsubscribe = flow.$zkLoginState.subscribe((state) => {
      setAccountAddress(state.address ?? null);
    });

    async function initializeAuth() {
      setIsAuthLoading(true);

      try {
        await flow.getSession();

        if (window.location.hash.includes("id_token=") || window.location.hash.includes("error=")) {
          const callbackParams = new URLSearchParams(window.location.hash.slice(1));
          const oauthError = callbackParams.get("error");
          if (oauthError) {
            throw new Error(`OAuth callback error: ${oauthError}`);
          }

          await flow.handleAuthCallback(window.location.hash);
          clearAuthHash();

          const postLoginPath = getSafePostLoginPath();
          const currentPath = `${window.location.pathname}${window.location.search}`;

          if (currentPath !== postLoginPath) {
            window.location.replace(postLoginPath);
            return;
          }
        }

        setAccountAddress(flow.$zkLoginState.get().address ?? null);
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
    if (!enokiFlow) {
      throw new Error("Missing VITE_ENOKI_PUBLIC_KEY in frontend environment.");
    }

    const googleClientId = typeof import.meta.env.VITE_GOOGLE_CLIENT_ID === "string" ? import.meta.env.VITE_GOOGLE_CLIENT_ID.trim() : "";

    if (!googleClientId) {
      throw new Error("Missing VITE_GOOGLE_CLIENT_ID in frontend environment.");
    }

    setIsAuthLoading(true);

    try {
      try {
        const postLoginPath = `${window.location.pathname}${window.location.search}`;
        window.sessionStorage.setItem(POST_LOGIN_PATH_STORAGE_KEY, postLoginPath);
      } catch {
        // Ignore storage access errors, login can continue without path restoration.
      }

      const redirectUrl =
        import.meta.env.VITE_GOOGLE_REDIRECT_URL ||
        import.meta.env.VITE_ENOKI_REDIRECT_URL ||
        window.location.origin;

      const authorizationUrl = await enokiFlow.createAuthorizationURL({
        provider: "google",
        clientId: googleClientId,
        redirectUrl,
        network: "testnet",
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
    if (!enokiFlow) {
      setAccountAddress(null);
      return;
    }

    await enokiFlow.logout();
    setAccountAddress(null);
  };

  const signSponsoredTransaction = async (transactionBytes: string) => {
    if (!enokiFlow) {
      throw new Error("zkLogin is not configured.");
    }

    setIsSigning(true);

    try {
      const keypair = await enokiFlow.getKeypair({ network: "testnet" });
      const { signature } = await keypair.signTransaction(fromBase64(transactionBytes));

      if (!signature) {
        throw new Error("Failed to sign sponsored transaction.");
      }

      return signature;
    } finally {
      setIsSigning(false);
    }
  };

  const signPersonalMessage = async (messageBytes: Uint8Array) => {
    if (!enokiFlow) {
      throw new Error("zkLogin is not configured.");
    }

    setIsSigning(true);

    try {
      const keypair = await enokiFlow.getKeypair({ network: "testnet" });
      const { signature } = await keypair.signPersonalMessage(messageBytes);

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
      isConfigured: !!enokiFlow,
      loginWithGoogle,
      logout,
      signSponsoredTransaction,
      signPersonalMessage,
    }),
    [accountAddress, isAuthLoading, isSigning]
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
