import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { User, Play, Upload } from "lucide-react";
import { ConnectButton, useCurrentAccount, useCurrentWallet } from "@mysten/dapp-kit";
import { AppRoutes } from "@app/router/AppRoutes";
import { ConnectWalletPage } from "@features/wallet/pages/ConnectWalletPage";
import { api } from "@features/mock/services/mockApi";
import { useUserSubscriptions } from "@features/subscriptions/hooks/useUserSubscriptions";
import { useGetOwnedObjects } from "@features/wallet/hooks/useGetOwnedObjects";
import { Button } from "@shared/ui";
import { CONTENT_CREATOR_PACKAGE_ID } from "@shared/config/chain";
import type { User as UserType } from "@shared/types/domain";
import type { ContentCreator } from "@features/creators/types";

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();

  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const { connectionStatus } = useCurrentWallet();
  const currentAccount = useCurrentAccount();
  const isWalletConnected = Boolean(currentAccount?.address);
  const { subscriptions } = useUserSubscriptions();
  const [isSubscribedGlobal, setIsSubscribedGlobal] = useState(false);
  const [hasCreatorProfile, setHasCreatorProfile] = useState(false);
  const getOwnedObjects = useGetOwnedObjects();

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
    const init = async () => {
      try {
        const userData = await api.getCurrentUser();
        setCurrentUser(userData);
      } catch (error) {
        console.error("Failed to load initial data", error);
      }
    };

    void init();
  }, []);

  const goHome = () => {
    navigate("/app");
  };

  const goToCreator = async (arg: ContentCreator | string) => {
    if (typeof arg === "object" && "id" in arg) {
      navigate(`/app/creator/${arg.id}`, { state: { creator: arg } });
      return;
    }

    if (typeof arg === "string") {
      try {
        const creator = await api.getCreator(arg);
        if (creator) {
          navigate(`/app/creator/${creator.id}`, { state: { premappedCreator: creator } });
        }
      } catch (error) {
        console.error("Creator lookup failed", error);
      }
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

  return (
    <div className="relative min-h-screen pb-20 overflow-hidden font-sans text-slate-100">
      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>
      <div className="blob blob-3"></div>

      <header className="sticky top-0 z-50 w-full border-b border-white/10 glass supports-[backdrop-filter]:bg-white/5">
        <div className="container flex items-center justify-between h-16 px-4 mx-auto">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 cursor-pointer group" onClick={goHome}>
              <div className="flex items-center justify-center w-8 h-8 transition-transform duration-300 rounded-lg shadow-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-500/30 group-hover:scale-110">
                <Play className="w-5 h-5 text-white fill-current" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white transition-colors group-hover:text-indigo-300">
                SuiFan
              </span>
            </div>

            <nav className="items-center hidden gap-6 text-sm font-medium md:flex text-slate-300">
              <button
                onClick={goHome}
                className={`hover:text-white transition-colors ${isHomeActive ? "text-white font-semibold" : ""}`}
              >
                Decouvrir
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
