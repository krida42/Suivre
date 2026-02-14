import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useEnokiAuth } from "@context/EnokiAuthContext";
import { useActiveAddress } from "@hooks/useActiveAddress";
import { CheckCircle, Loader2, Plus, Upload } from "lucide-react";
import { ConnectButton, useCurrentAccount, useCurrentWallet, useSuiClient } from "@mysten/dapp-kit";
import type { SuiClient } from "@mysten/sui/client";
import { AppRoutes } from "@router/AppRoutes";
import { ConnectWalletPage } from "@pages/ConnectWalletPage";
import { useGetAllCreators } from "@hooks/useGetAllCreators";
import { fetchCreatorContent } from "@hooks/useGetCreatorContent";
import { useDecryptContent } from "@hooks/useDecryptContent";
import { useGetCreatorById } from "@hooks/useGetCreatorById";
import { useSubscribeToCreator } from "@hooks/useSubscribeToCreator";
import { useUserSubscriptions } from "@hooks/useUserSubscriptions";
import { useGetOwnedObjects } from "@hooks/useGetOwnedObjects";
import { Button } from "@ui";
import { CONTENT_CREATOR_PACKAGE_ID } from "@config/chain";
import { mapCreatorToProfile } from "@mappers/mapCreatorToProfile";
import type { Creator as CreatorProfile, User as UserType } from "@models/domain";
import type { ContentCreator } from "@models/creators";

const PREFETCH_CREATOR_CONCURRENCY = 2;
const PREFETCH_MEDIA_CONCURRENCY = 4;
const PREFETCH_DECRYPT_ON_LOAD = import.meta.env.VITE_PREFETCH_DECRYPT_ON_LOAD === "true";

type AppShellRouteState = {
  creatorId?: string;
  creator?: ContentCreator;
  premappedCreator?: CreatorProfile;
} | null;

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const suiClient = useSuiClient() as SuiClient;

  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const { connectionStatus } = useCurrentWallet();
  const { isAuthenticated: isZkLoginConnected, isAuthLoading, logout: logoutZkLogin } = useEnokiAuth();
  const { address: activeAddress, zkLoginAddress, isConnected } = useActiveAddress();
  const currentAccount = useCurrentAccount();
  const isWalletConnected = Boolean(currentAccount?.address);
  const { data: allCreators = [] } = useGetAllCreators();
  const { decryptContent: decryptForPrefetch } = useDecryptContent();
  const { subscriptions, refetch: refetchSubscriptions } = useUserSubscriptions();
  const { subscribeToCreator, isSubscribing: isTopbarSubscribing } = useSubscribeToCreator();
  const [isSubscribedGlobal, setIsSubscribedGlobal] = useState(false);
  const [hasCreatorProfile, setHasCreatorProfile] = useState(false);
  const [creatorTopbarError, setCreatorTopbarError] = useState<string | null>(null);
  const getOwnedObjects = useGetOwnedObjects();
  const scheduledPrefetchMediaKeysRef = useRef<Set<string>>(new Set());
  const routeState = (location.state as AppShellRouteState) ?? null;
  const creatorPathMatch = location.pathname.match(/^\/app\/creator\/([^/]+)$/);
  const creatorContextId = creatorPathMatch?.[1] || routeState?.creatorId || undefined;
  const isOnCreatorContext = Boolean(creatorContextId);
  const { data: creatorContextData, isLoading: isLoadingCreatorContext } = useGetCreatorById(creatorContextId);
  const subscribedCreatorIds = useMemo(
    () => new Set(subscriptions.map((subscription) => subscription.creatorId.toLowerCase())),
    [subscriptions]
  );
  const creatorContext = useMemo<CreatorProfile | null>(() => {
    if (routeState?.premappedCreator) return routeState.premappedCreator;
    if (routeState?.creator) return mapCreatorToProfile(routeState.creator);
    if (creatorContextData) return mapCreatorToProfile(creatorContextData);
    return null;
  }, [creatorContextData, routeState?.creator, routeState?.premappedCreator]);
  const isSubscribedToCreatorContext = creatorContext
    ? subscribedCreatorIds.has(creatorContext.id.toLowerCase())
    : false;
  const shouldShowCreatorTopbar = isOnCreatorContext && (Boolean(creatorContext) || isLoadingCreatorContext);

  useEffect(() => {
    setCreatorTopbarError(null);
  }, [creatorContextId]);

  useEffect(() => {
    const checkCreatorCap = async () => {
      if (!isConnected) {
        setHasCreatorProfile(false);
        return;
      }

      try {
        const objects = await getOwnedObjects();
        const creatorCapType = `${CONTENT_CREATOR_PACKAGE_ID}::content_creator::CreatorCap`;
        const hasCap = objects.some((obj) => obj.data?.type === creatorCapType);
        setHasCreatorProfile(hasCap);
      } catch (error) {
        console.error("Failed to check for creator cap", error);
      }
    };

    void checkCreatorCap();
  }, [isConnected, getOwnedObjects]);

  useEffect(() => {
    setIsSubscribedGlobal(subscriptions.length > 0);
  }, [subscriptions]);

  useEffect(() => {
    scheduledPrefetchMediaKeysRef.current.clear();
  }, [currentAccount?.address]);

  useEffect(() => {
    if (!activeAddress) {
      setCurrentUser(null);
      return;
    }

    setCurrentUser((previous) => ({
      id: previous?.id ?? activeAddress,
      name: previous?.name ?? "Utilisateur Sui",
      email: previous?.email ?? `${activeAddress.slice(0, 8)}...@wallet.local`,
      avatarUrl: previous?.avatarUrl ?? "",
      isVerified: previous?.isVerified ?? true,
      unlockedVideoIds: previous?.unlockedVideoIds ?? [],
      subscribedCreatorIds: previous?.subscribedCreatorIds ?? [],
    }));
  }, [activeAddress]);

  useEffect(() => {
    if (!PREFETCH_DECRYPT_ON_LOAD) return;
    if (!isWalletConnected || !currentAccount?.address) return;
    if (!allCreators.length) return;

    let cancelled = false;
    const creatorIdsQueue = [...allCreators]
      .sort((left, right) => {
        const leftSubscribed = subscribedCreatorIds.has(left.id.toLowerCase()) ? 1 : 0;
        const rightSubscribed = subscribedCreatorIds.has(right.id.toLowerCase()) ? 1 : 0;
        return rightSubscribed - leftSubscribed;
      })
      .map((creator) => creator.id);
    const mediaTasks: Array<() => Promise<void>> = [];

    const pushMediaTask = (creatorId: string, blobId: string, mimeType: string | null) => {
      const mediaTaskKey = `${creatorId.toLowerCase()}::${blobId}::${(mimeType ?? "").toLowerCase()}`;
      if (scheduledPrefetchMediaKeysRef.current.has(mediaTaskKey)) {
        return;
      }

      scheduledPrefetchMediaKeysRef.current.add(mediaTaskKey);
      mediaTasks.push(async () => {
        if (cancelled) return;
        try {
          await decryptForPrefetch({
            blobId,
            creatorId,
            mimeType,
          });
        } catch (error) {
          // Failing silently here keeps prefetch best-effort while UI remains responsive.
          console.debug("Global media prefetch skipped", { creatorId, blobId, error });
        }
      });
    };

    const run = async () => {
      const creatorWorkers = Array.from(
        { length: Math.min(PREFETCH_CREATOR_CONCURRENCY, creatorIdsQueue.length) },
        async () => {
          while (creatorIdsQueue.length > 0 && !cancelled) {
            const creatorId = creatorIdsQueue.shift();
            if (!creatorId) break;

            try {
              const creatorContents = await fetchCreatorContent(suiClient, creatorId);
              if (cancelled) return;

              for (const content of creatorContents) {
                if (content.imageBlobId) {
                  pushMediaTask(creatorId, content.imageBlobId, content.imageMimeType);
                }

                if (content.videoBlobId) {
                  pushMediaTask(creatorId, content.videoBlobId, content.videoMimeType);
                }
              }
            } catch (error) {
              console.debug("Global content prefetch skipped for creator", { creatorId, error });
            }
          }
        }
      );

      await Promise.all(creatorWorkers);
      if (cancelled || mediaTasks.length === 0) return;

      const mediaWorkers = Array.from(
        { length: Math.min(PREFETCH_MEDIA_CONCURRENCY, mediaTasks.length) },
        async () => {
          while (mediaTasks.length > 0 && !cancelled) {
            const task = mediaTasks.shift();
            if (!task) break;
            await task();
          }
        }
      );

      await Promise.all(mediaWorkers);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [allCreators, currentAccount?.address, decryptForPrefetch, isWalletConnected, subscribedCreatorIds, suiClient]);

  const goHome = () => {
    navigate("/app");
  };

  const goToCreator = async (arg: ContentCreator | string) => {
    if (typeof arg === "object" && "id" in arg) {
      navigate(`/app/creator/${arg.id}`, { state: { creator: arg } });
      return;
    }

    if (typeof arg === "string") {
      navigate(`/app/creator/${arg}`);
    }
  };

  const handleCreatorTopbarSubscribe = async () => {
    if (!creatorContext || isSubscribedToCreatorContext) return;

    setCreatorTopbarError(null);
    try {
      await subscribeToCreator({ creatorId: creatorContext.id });
      await refetchSubscriptions();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Echec de l'abonnement";
      setCreatorTopbarError(message);
    }
  };

  if (isAuthLoading || (connectionStatus === "connecting" && !isZkLoginConnected)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0f172a]">
        <div className="w-12 h-12 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
        <p className="mt-4 text-slate-400">Connexion en cours...</p>
      </div>
    );
  }

  if (!isConnected) {
    return <ConnectWalletPage />;
  }

  const isHomeActive = location.pathname === "/app";
  const isMyCreatorsActive = location.pathname === "/app/my-creators";
  const shortZkLoginAddress =
    zkLoginAddress && zkLoginAddress.length > 12
      ? `${zkLoginAddress.slice(0, 6)}...${zkLoginAddress.slice(-4)}`
      : zkLoginAddress;
  const shouldUseCreatorBackground =
    location.pathname === "/app" ||
    location.pathname === "/app/my-creators" ||
    location.pathname.startsWith("/app/creator/") ||
    location.pathname.startsWith("/app/content/") ||
    location.pathname.startsWith("/app/publish");

  return (
    <div className="relative min-h-screen pb-20 overflow-hidden font-sans text-slate-100">
      {shouldUseCreatorBackground && (
        <>
          <div className="creator-scene-bg" />
          <div className="creator-scene-vignette" />
        </>
      )}
      <header className="sticky top-2 z-50 px-3 md:px-4">
        <div className="mx-auto flex w-full max-w-6xl items-start gap-0">
          <div className="min-w-0 flex-1 transition-all duration-300">
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[rgba(6,10,16,0.44)] px-2 py-1.5 shadow-[0_10px_24px_rgba(0,0,0,0.2)] backdrop-blur-sm">
              <button
                onClick={goHome}
                className="flex h-8 items-center rounded-lg px-1.5 transition-colors hover:bg-white/[0.08]"
                aria-label="Aller a l'accueil"
              >
                <img src="/images/dark_suivre.png" alt="Suivre" className="h-7 w-auto opacity-[0.85]" />
              </button>

              <nav className="flex min-w-0 flex-1 items-center gap-1">
                <button
                  onClick={goHome}
                  className={`h-8 rounded-lg px-2.5 text-[11px] font-semibold tracking-wide transition-colors ${
                    isHomeActive ? "bg-white/12 text-[#f8f5ef]" : "text-[#d9d1bf] hover:text-[#f8f5ef]"
                  }`}
                >
                  Decouvrir
                </button>
                <button
                  onClick={() => navigate("/app/my-creators")}
                  className={`h-8 rounded-lg px-2.5 text-[11px] font-semibold tracking-wide transition-colors ${
                    isMyCreatorsActive ? "bg-white/12 text-[#f8f5ef]" : "text-[#d9d1bf] hover:text-[#f8f5ef]"
                  }`}
                >
                  Mes abonnements
                </button>
              </nav>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg border border-white/10 bg-white/[0.03] text-[#d9d1bf] hover:bg-white/[0.12] hover:text-[#f8f5ef]"
                  onClick={() => navigate("/app/publish")}
                  title="Publier"
                >
                  <Upload className="w-3.5 h-3.5" />
                </Button>
                {!hasCreatorProfile && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg border border-white/10 bg-white/[0.03] text-[#d9d1bf] hover:bg-white/[0.12] hover:text-[#f8f5ef]"
                    onClick={() => navigate("/app/create-profile")}
                    title="Creer un profil createur"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                )}
                <div className="wallet-topbar hidden sm:block [&_button]:!h-8 [&_button]:!min-h-8 [&_button]:!rounded-lg [&_button]:!border [&_button]:!border-white/10 [&_button]:!bg-white/[0.03] [&_button]:!px-2 [&_button]:!text-xs [&_button]:!font-semibold [&_button]:!text-[#f8f5ef]">
                  <ConnectButton />
                </div>
                {isZkLoginConnected && (
                  <div className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-300/35 bg-emerald-500/10 px-2 text-[10px] font-semibold text-emerald-200 sm:text-[11px]">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                    <span className="hidden md:inline">Connecte zkLogin {shortZkLoginAddress}</span>
                    <span className="md:hidden">zkLogin</span>
                  </div>
                )}
                {isZkLoginConnected && !isWalletConnected && (
                  <Button
                    variant="ghost"
                    className="h-8 rounded-lg border border-white/10 bg-white/[0.03] px-2 text-[10px] font-semibold text-[#f8f5ef] hover:bg-white/[0.12] sm:text-[11px]"
                    onClick={() => {
                      void logoutZkLogin();
                    }}
                  >
                    Deconnexion
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div
            className={`hidden shrink-0 overflow-hidden transition-[width,margin,opacity,transform] duration-300 ease-out md:block ${
              shouldShowCreatorTopbar ? "w-[320px] ml-2 opacity-100 translate-x-0" : "w-0 ml-0 opacity-0 translate-x-3"
            }`}
          >
            {shouldShowCreatorTopbar && (
              <aside className="w-[320px] rounded-2xl border border-white/10 bg-[rgba(8,14,22,0.6)] px-3 py-2 shadow-[0_10px_24px_rgba(0,0,0,0.22)] backdrop-blur-sm">
                {creatorContext ? (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 overflow-hidden border rounded-full border-white/20 bg-slate-900 shrink-0">
                        <img
                          src={creatorContext.avatarUrl || "https://avatar.iran.liara.run/public"}
                          alt="Creator avatar"
                          className="object-cover w-full h-full"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1 text-xs font-bold tracking-wide text-[#f8f5ef]">
                          <span className="truncate">{creatorContext.name}</span>
                          {creatorContext.isVerified && <CheckCircle className="w-3.5 h-3.5 text-emerald-300 fill-current shrink-0" />}
                        </p>
                        <p className="text-[11px] text-[#d6cebb] truncate">
                          {creatorContext.pricePerMonth ? `${creatorContext.pricePerMonth} SUI / mois` : "Prix inconnu"}
                        </p>
                      </div>
                      <Button
                        variant={isSubscribedToCreatorContext ? "outline" : "accent"}
                        className="h-7 px-2.5 text-[11px] border-[rgba(250,235,201,0.28)] text-[#f8f5ef] shrink-0"
                        onClick={handleCreatorTopbarSubscribe}
                        disabled={isSubscribedToCreatorContext || isTopbarSubscribing}
                      >
                        {isTopbarSubscribing ? "..." : isSubscribedToCreatorContext ? "Abonne" : "S'abonner"}
                      </Button>
                    </div>
                    {creatorTopbarError && <p className="mt-2 text-[11px] text-red-300 line-clamp-1">{creatorTopbarError}</p>}
                  </>
                ) : (
                  <div className="flex items-center gap-2 py-1 text-xs text-[#d6cebb]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Chargement du createur...</span>
                  </div>
                )}
              </aside>
            )}
          </div>
        </div>
      </header>

      <main className="container px-4 py-8 mx-auto">
        <AppRoutes
          currentUser={currentUser}
          setCurrentUser={setCurrentUser}
          goHome={goHome}
          goToCreator={goToCreator}
          isSubscribedGlobal={isSubscribedGlobal}
        />
      </main>
    </div>
  );
}
