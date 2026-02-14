import { EnokiFlow } from "@mysten/enoki";
import { fromBase64 } from "@mysten/sui/utils";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

type EnokiAuthContextValue = {
  accountAddress: string | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  isSigning: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  signSponsoredTransaction: (transactionBytes: string) => Promise<string>;
};

const EnokiAuthContext = createContext<EnokiAuthContextValue | undefined>(undefined);
const POST_LOGIN_PATH_STORAGE_KEY = "enoki_logic:post_login_path";
let authInitializationPromise: Promise<string | null> | null = null;

const enokiFlow = new EnokiFlow({
  apiKey: import.meta.env.VITE_ENOKI_PUBLIC_KEY,
  experimental_nativeCryptoSigner: true,
});

function clearAuthHash() {
  if (!window.location.hash) return;
  window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
}

function persistPostLoginPath(path: string) {
  try {
    window.sessionStorage.setItem(POST_LOGIN_PATH_STORAGE_KEY, path);
  } catch {
    // Ignore storage failures.
  }
}

function consumePostLoginPath(): string {
  try {
    const storedPath = window.sessionStorage.getItem(POST_LOGIN_PATH_STORAGE_KEY);
    window.sessionStorage.removeItem(POST_LOGIN_PATH_STORAGE_KEY);
    if (storedPath && storedPath.startsWith("/")) {
      return storedPath;
    }
  } catch {
    // Ignore storage failures.
  }

  return "/";
}

export function EnokiAuthProvider({ children }: { children: ReactNode }) {
  const [accountAddress, setAccountAddress] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isSigning, setIsSigning] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = enokiFlow.$zkLoginState.subscribe((state) => {
      if (!isMounted) return;
      setAccountAddress(state.address ?? null);
    });

    async function initializeAuth() {
      setIsAuthLoading(true);

      try {
        authInitializationPromise ??= (async () => {
          await enokiFlow.getSession();

          if (window.location.hash.includes("id_token=") || window.location.hash.includes("error=")) {
            const callbackParams = new URLSearchParams(window.location.hash.slice(1));
            const oauthError = callbackParams.get("error");
            if (oauthError) {
              throw new Error(`OAuth callback error: ${oauthError}`);
            }

            await enokiFlow.handleAuthCallback(window.location.hash);
            clearAuthHash();

            const targetPath = consumePostLoginPath();
            const currentPath = `${window.location.pathname}${window.location.search}`;

            if (targetPath !== currentPath) {
              window.location.replace(targetPath);
            }
          }

          return enokiFlow.$zkLoginState.get().address ?? null;
        })().finally(() => {
          authInitializationPromise = null;
        });

        const address = await authInitializationPromise;
        if (isMounted) {
          setAccountAddress(address);
        }
      } catch (error) {
        console.error("Enoki auth initialization failed:", error);
        clearAuthHash();
        if (isMounted) {
          setAccountAddress(null);
        }
      } finally {
        if (isMounted) {
          setIsAuthLoading(false);
        }
      }
    }

    void initializeAuth();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const loginWithGoogle = async () => {
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!googleClientId) {
      throw new Error("Missing VITE_GOOGLE_CLIENT_ID in frontend environment.");
    }

    persistPostLoginPath(`${window.location.pathname}${window.location.search}`);
    setIsAuthLoading(true);

    try {
      // Support both current and legacy env variable names for redirect URL.
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
    await enokiFlow.logout();
    setAccountAddress(null);
  };

  const signSponsoredTransaction = async (transactionBytes: string) => {
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

  const value = useMemo<EnokiAuthContextValue>(
    () => ({
      accountAddress,
      isAuthenticated: !!accountAddress,
      isAuthLoading,
      isSigning,
      loginWithGoogle,
      logout,
      signSponsoredTransaction,
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
