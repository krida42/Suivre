import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { User, Upload } from "lucide-react";
import { ConnectButton, useCurrentAccount, useCurrentWallet, useSuiClient } from "@mysten/dapp-kit";
import type { SuiClient } from "@mysten/sui/client";
import { AppRoutes } from "@router/AppRoutes";
import { ConnectWalletPage } from "@pages/ConnectWalletPage";
import { useGetAllCreators } from "@hooks/useGetAllCreators";
import { fetchCreatorContent } from "@hooks/useGetCreatorContent";
import { useDecryptContent } from "@hooks/useDecryptContent";
import { useUserSubscriptions } from "@hooks/useUserSubscriptions";
import { useGetOwnedObjects } from "@hooks/useGetOwnedObjects";
import { Button } from "@ui";
import { CONTENT_CREATOR_PACKAGE_ID } from "@config/chain";
import type { User as UserType } from "@models/domain";
import type { ContentCreator } from "@models/creators";

const PREFETCH_CREATOR_CONCURRENCY = 2;
const PREFETCH_MEDIA_CONCURRENCY = 4;

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const suiClient = useSuiClient() as SuiClient;

  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const { connectionStatus } = useCurrentWallet();
  const currentAccount = useCurrentAccount();
  const isWalletConnected = Boolean(currentAccount?.address);
  const { data: allCreators = [] } = useGetAllCreators();
  const { decryptContent: decryptForPrefetch } = useDecryptContent();
  const { subscriptions } = useUserSubscriptions();
  const [isSubscribedGlobal, setIsSubscribedGlobal] = useState(false);
  const [hasCreatorProfile, setHasCreatorProfile] = useState(false);
  const getOwnedObjects = useGetOwnedObjects();
  const scheduledPrefetchMediaKeysRef = useRef<Set<string>>(new Set());
  const subscribedCreatorIds = useMemo(
    () => new Set(subscriptions.map((subscription) => subscription.creatorId.toLowerCase())),
    [subscriptions]
  );

  useEffect(() => {
    const checkCreatorCap = async () => {
      if (!isWalletConnected) {
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
  }, [isWalletConnected, getOwnedObjects]);

  useEffect(() => {
    setIsSubscribedGlobal(subscriptions.length > 0);
  }, [subscriptions]);

  useEffect(() => {
    scheduledPrefetchMediaKeysRef.current.clear();
  }, [currentAccount?.address]);

  useEffect(() => {
    if (!currentAccount?.address) {
      setCurrentUser(null);
      return;
    }

    setCurrentUser((previous) => ({
      id: previous?.id ?? currentAccount.address,
      name: previous?.name ?? "Utilisateur Sui",
      email: previous?.email ?? `${currentAccount.address.slice(0, 8)}...@wallet.local`,
      avatarUrl: previous?.avatarUrl ?? "",
      isVerified: previous?.isVerified ?? true,
      unlockedVideoIds: previous?.unlockedVideoIds ?? [],
      subscribedCreatorIds: previous?.subscribedCreatorIds ?? [],
    }));
  }, [currentAccount?.address]);

  useEffect(() => {
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

  if (connectionStatus === "connecting") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0f172a]">
        <div className="w-12 h-12 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
        <p className="mt-4 text-slate-400">Connexion en cours...</p>
      </div>
    );
  }

  if (!isWalletConnected) {
    return <ConnectWalletPage />;
  }

  const isHomeActive = location.pathname === "/app";
  const isMyCreatorsActive = location.pathname === "/app/my-creators";
  const shouldUseCreatorBackground =
    location.pathname === "/app" ||
    location.pathname === "/app/my-creators" ||
    location.pathname.startsWith("/app/creator/") ||
    location.pathname.startsWith("/app/content/");

  return (
    <div className="relative min-h-screen pb-20 overflow-hidden font-sans text-slate-100">
      {shouldUseCreatorBackground && (
        <>
          <div className="creator-scene-bg" />
          <div className="creator-scene-vignette" />
        </>
      )}
      <header className="sticky top-0 z-50 w-full border-b border-white/10 glass supports-[backdrop-filter]:bg-white/5">
        <div className="container flex items-center justify-between h-16 px-4 mx-auto">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 cursor-pointer group" onClick={goHome}>
              <img 
                src="/images/dark_suivre.png" 
                alt="Suivre" 
                className="h-16 mt-2 transition-opacity duration-300 group-hover:opacity-80" 
              />
            </div>

            <nav className="items-center hidden gap-6 text-sm font-medium md:flex text-slate-300">
              <button
                onClick={goHome}
                className={`hover:text-white transition-colors ${isHomeActive ? "text-white font-semibold" : ""}`}
              >
                Decouvrir
              </button>
              <button
                onClick={() => navigate("/app/my-creators")}
                className={`hover:text-white transition-colors ${isMyCreatorsActive ? "text-white font-semibold" : ""}`}
              >
                Mes abonnements
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              className="hidden sm:flex text-slate-300 hover:text-white hover:bg-white/10"
              onClick={() => navigate("/app/publish")}
            >
              <Upload className="w-4 h-4 mr-2" />
              Creer
            </Button>
            {!hasCreatorProfile && (
              <Button
                variant="ghost"
                className="hidden sm:flex text-slate-300 hover:text-white hover:bg-white/10"
                onClick={() => navigate("/app/create-profile")}
              >
                <User className="w-4 h-4 mr-2" />
                Compte Createur
              </Button>
            )}
            <div className="hidden sm:block">
              <ConnectButton />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-white/10 hover:bg-indigo-600 hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-500/30"
              onClick={() => navigate("/app/account")}
            >
              <User className="w-5 h-5 text-slate-200" />
            </Button>
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
