import { useState, useEffect } from "react";
import { Routes, Route, useNavigate, useParams, useLocation } from "react-router-dom";
import {  User, Play, Upload, CheckCircle } from "lucide-react";
import { api } from "../services/api";
import { Creator, User as UserType, DashboardStats, Video as VideoType } from "../types";
import { Button } from "../components/Button";
import { HomeView } from "./HomeView";
import { VideoPlayerView } from "./VideoPlayerView";
import { CreatorProfileView } from "./CreatorProfileView";
import { ContentDetailView } from "./ContentDetailView";
import { CreatorDashboardView } from "./CreatorDashboardView";
import { UserProfileView } from "./UserProfileView";
import { CreateCreatorView } from "./CreateCreatorView";
import { ConnectWalletView } from "./ConnectWalletView";
import { useCurrentAccount, ConnectButton, useCurrentWallet } from "@mysten/dapp-kit";
import { useUploadContent } from "../lib/useUploadContent";
import { useSubscribeToCreator } from "../lib/useSubscribeToCreator";
import { useUserSubscriptions } from "../lib/useUserSubscriptions";
import type { ContentCreator } from "../lib/useGetCreators";
import type { CreatorContent } from "../lib/useGetCreatorContent";
import { useGetMyObjects } from "../lib/getMyObjects";
import { ContentCreatorpackageId } from "../lib/package_id";

// --- Main Application Component ---

export function AppView() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // --- State Management ---
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);

  // UI State
  const { connectionStatus } = useCurrentWallet();
  const currentAccount = useCurrentAccount();
  const isWalletConnected = Boolean(currentAccount?.address);
  const { subscriptions } = useUserSubscriptions();
  const [isSubscribedGlobal, setIsSubscribedGlobal] = useState(false); 
  
  const [hasCreatorProfile, setHasCreatorProfile] = useState(false);
  const getMyObjects = useGetMyObjects();

  useEffect(() => {
    const checkCreatorCap = async () => {
      if (!isWalletConnected) {
        setHasCreatorProfile(false);
        return;
      }
      
      try {
        const objects = await getMyObjects();
        const creatorCapType = `${ContentCreatorpackageId}::content_creator::CreatorCap`;
        // Check if any object has the CreatorCap type
        const hasCap = objects.some((obj) => obj.data?.type === creatorCapType);
        setHasCreatorProfile(hasCap);
      } catch (error) {
        console.error("Failed to check for creator cap", error);
      }
    };

    checkCreatorCap();
  }, [isWalletConnected, getMyObjects]);

  useEffect(() => {
     // Kept for UserProfileView relying on a boolean. 
     // In a real app this should probably be calculated in the view.
     setIsSubscribedGlobal(subscriptions.length > 0);
  }, [subscriptions]);

  // --- Initial Load ---
  useEffect(() => {
    const init = async () => {
      try {
        const userData = await api.getCurrentUser();
        setCurrentUser(userData);
      } catch (error) {
        console.error("Failed to load initial data", error);
      }
    };
    init();
  }, []);

  // --- Navigation Handlers ---
  const goHome = () => {
    navigate("/app");
  };

  const goToCreator = async (arg: ContentCreator | string) => {
    // Case 1: Argument is a ContentCreator object (from HomeView/Chain)
    if (typeof arg === "object" && "id" in arg) {
       navigate(`/app/creator/${arg.id}`, { state: { creator: arg } });
       return;
    }

    // Case 2: Argument is a string (Name from Mock Video)
    // We try to find it via API (Mock)
    if (typeof arg === "string") {
        try {
            const creator = await api.getCreator(arg);
            // We pass the already mapped creator as 'premappedCreator'
            if (creator) {
                navigate(`/app/creator/${creator.id}`, { state: { premappedCreator: creator } });
            }
        } catch (e) {
            console.error("Creator lookup failed", e);
        }
    }
  };

  const goToPublisher = () => {
    navigate("/app/publish");
  };

  const goToProfile = () => {
    navigate("/app/account");
  };

  const goToCreateCreator = () => {
    navigate("/app/create-profile");
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
    return <ConnectWalletView />;
  }

  const isHomeActive = location.pathname === "/app";
  const isCreatorActive = location.pathname.startsWith("/app/creator");

  return (
    <div className="relative min-h-screen pb-20 overflow-hidden font-sans text-slate-100">
      {/* Background Blobs */}
      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>
      <div className="blob blob-3"></div>

      {/* --- Top Navigation Bar --- */}
      <header className="sticky top-0 z-50 w-full border-b border-white/10 glass supports-[backdrop-filter]:bg-white/5">
        <div className="container flex items-center justify-between h-16 px-4 mx-auto">
          <div className="flex items-center gap-6">
            {/* Logo */}
            <div className="flex items-center gap-2 cursor-pointer group" onClick={goHome}>
              <div className="flex items-center justify-center w-8 h-8 transition-transform duration-300 rounded-lg shadow-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-500/30 group-hover:scale-110">
                <Play className="w-5 h-5 text-white fill-current" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white transition-colors group-hover:text-indigo-300">SuiFan</span>
            </div>

            {/* Desktop Nav */}
            <nav className="items-center hidden gap-6 text-sm font-medium md:flex text-slate-300">
              <button onClick={goHome} className={`hover:text-white transition-colors ${isHomeActive ? "text-white font-semibold" : ""}`}>
                Découvrir
              </button>
            </nav>
          </div>

          {/* User Actions */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="hidden sm:flex text-slate-300 hover:text-white hover:bg-white/10" onClick={goToPublisher}>
              <Upload className="w-4 h-4 mr-2" />
              Créer
            </Button>
            {!hasCreatorProfile && (
              <Button variant="ghost" className="hidden sm:flex text-slate-300 hover:text-white hover:bg-white/10" onClick={goToCreateCreator}>
                <User className="w-4 h-4 mr-2" />
                Compte Créateur
              </Button>
            )}
            {/* Wallet connect / disconnect (ConnectButton handles both states) */}
            <div className="hidden sm:block">
              <ConnectButton />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-white/10 hover:bg-indigo-600 hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-500/30"
              onClick={goToProfile}
            >
              <User className="w-5 h-5 text-slate-200" />
            </Button>
          </div>
        </div>
      </header>

      {/* --- Main Content Area --- */}
      <main className="container px-4 py-8 mx-auto">
        <Routes>
          <Route
            index
            element={<HomeView goToCreator={goToCreator} />}
          />

          <Route
            path="creator/:id"
            element={<CreatorRouteWrapper />}
          />

          <Route
            path="video/:id"
            element={<VideoRouteWrapper currentUser={currentUser} setCurrentUser={setCurrentUser} goHome={goHome} goToCreator={goToCreator} />}
          />

          <Route
            path="content/:id"
            element={<ContentRouteWrapper />}
          />

          <Route
            path="publish"
            element={<DashboardRouteWrapper />}
          />

          <Route
            path="create-profile"
            element={<CreateCreatorView />}
          />

          <Route
            path="account"
            element={<UserProfileView currentUser={currentUser} isSubscribed={isSubscribedGlobal} />}
          />
        </Routes>
      </main>
    </div>
  );
}

function DashboardRouteWrapper() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [showUploadToast, setShowUploadToast] = useState(false);
  const { uploadContent } = useUploadContent();

  useEffect(() => {
    api.getCreatorDashboard().then(setStats);
  }, []);

  const handleUpload = async (payload: { title: string; description: string; blobId: string; creatorId: string; fileName: string | null }) => {
    try {
      const result = await uploadContent({
        title: payload.title,
        description: payload.description,
        blobId: payload.blobId,
        creatorId: payload.creatorId,
      });

      setShowUploadToast(true);
      setTimeout(() => setShowUploadToast(false), 3000);

      return result;
    } finally {
      // 
    }
  };

  return (
    <>
        <CreatorDashboardView dashboardStats={stats} handleUpload={handleUpload} />
         {/* --- Floating Notifications --- */}
        {showUploadToast && (
            <div className="fixed z-50 flex items-center gap-3 px-6 py-3 text-white duration-300 rounded-lg shadow-xl bottom-8 right-8 bg-slate-900 animate-in slide-in-from-bottom-10">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <div>
                <p className="font-medium">Succès !</p>
                <p className="text-xs text-slate-300">Votre vidéo a été publiée.</p>
            </div>
            </div>
        )}
    </>
  );
}

function CreatorRouteWrapper() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { subscriptions, refetch: refetchSubscriptions } = useUserSubscriptions();
  const { subscribeToCreator, isSubscribing } = useSubscribeToCreator();
  const [activeCreator, setActiveCreator] = useState<Creator | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (location.state?.premappedCreator) {
        setActiveCreator(location.state.premappedCreator);
        return;
    }

    if (location.state?.creator) {
      // Map ContentCreator to Creator type if needed, or use directly
      const creator = location.state.creator as ContentCreator;
      // Reconstitute Creator object
      // Logic duplicated from old AppView because CreatorProfileView expects 'Creator' type
      const pseudoFirstChar = creator.pseudo.charAt(0);
      const pseudoSecondChar = creator.pseudo.charAt(1);
      const imageUrl = `https://avatar.iran.liara.run/username?username=${pseudoFirstChar}+${pseudoSecondChar}`;

      const mappedCreator: Creator = {
        id: creator.id,
        name: creator.pseudo || "Créateur",
        handle: creator.pseudo?.toLowerCase().replace(/\s+/g, "") || creator.owner,
        avatarUrl: creator.image_url || imageUrl || "https://placehold.co/128x128/1e40af/ffffff",
        bannerUrl: creator.image_url || imageUrl || "https://placehold.co/1200x400/312e81/ffffff",
        bio: creator.description || "",
        subscribers: "0",
        isVerified: false,
        videos: [], // In a real app we would check for videos here or in a separate fetch
        pricePerMonth: Number(creator.price_per_month).toFixed(2) || "0",
      };
      setActiveCreator(mappedCreator);
    } else {
        // Here we should fetch creator by ID if not in state
        // This part is tricky if api doesn't support getById well.
        // Assuming we rely on navigation state for now as per previous prototype pattern.
    }
  }, [id, location.state]);

  useEffect(() => {
    if (!activeCreator) {
      setIsSubscribed(false);
      return;
    }
    const subscribed = subscriptions.some((sub) => sub.creatorId === activeCreator.id);
    setIsSubscribed(subscribed);
  }, [activeCreator, subscriptions]);

  const handleSubscribe = async () => {
    if (!activeCreator) return;
    try {
      await subscribeToCreator({ creatorId: activeCreator.id });
      await refetchSubscriptions();
    } finally {
        //
    }
  };

  const goToContent = (content: CreatorContent) => {
    navigate(`/app/content/${content.id}`, { state: { content, creatorId: activeCreator?.id } });
  };

  if (!activeCreator) return <div className="p-8 text-center text-slate-400">Chargement du créateur... ou données manquantes.</div>;

  return (
    <CreatorProfileView
      activeCreator={activeCreator}
      isSubscribed={isSubscribed}
      isSubscribing={isSubscribing}
      handleSubscribe={handleSubscribe}
      goToContent={goToContent}
    />
  );
}

function ContentRouteWrapper() {
    const location = useLocation();
    const navigate = useNavigate();
    const { content, creatorId } = location.state || {}; // Expecting content passed in state

    const goBack = () => {
        navigate(-1);
    };

    if (!content) return <div className="p-8 text-center text-slate-400">Contenu inaccessible directement. Veuillez passer par la page du créateur.</div>;

    return <ContentDetailView content={content} creatorId={creatorId || ""} goBack={goBack} />;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function VideoRouteWrapper({ currentUser, setCurrentUser, goHome, goToCreator }: any) {
    const { id } = useParams();
    const [activeVideo, setActiveVideo] = useState<VideoType | null>(null);
    const [isUnlocking, setIsUnlocking] = useState(false);
    
    // We need to know if subscribed. We can't easily know without the creator ID of the video 
    // and checking subscriptions.
    // For this prototype, `VideoPlayerView` uses `isSubscribed` to show lock/unlock status?
    // Actually `VideoPlayerView` takes `isSubscribed`.
    // But `api.getVideoById` returns a mock video. It doesn't tell us the Creator ID easily 
    // unless mapped. 
    // In `AppView` (old), `isSubscribed` was global for the `activeCreator`.
    // We might need to fetch the creator of the video to check subscription.
    // For now, I'll default to false or pass it if I can.
    
    useEffect(() => {
      if (id) {
        api.getVideoById(Number(id)).then(v => setActiveVideo(v || null));
      }
    }, [id]);

    const handleUnlock = async () => {
        if (activeVideo && currentUser) {
          setIsUnlocking(true);
          try {
            await api.unlockVideo(activeVideo.id);
            // Update local state
            const updatedUser = {
              ...currentUser,
              unlockedVideoIds: [...currentUser.unlockedVideoIds, activeVideo.id],
            };
            setCurrentUser(updatedUser);
            // Refresh video
            const refreshedVideo = await api.getVideoById(activeVideo.id);
            if (refreshedVideo) setActiveVideo(refreshedVideo);
          } finally {
            setIsUnlocking(false);
          }
        }
      };

      const handleSubscribe = async () => {
        // Placeholder as VideoPlayerView might request it
        // But from Video Player, subscribing usually requires knowing the creator.
        console.log("Subscribe from video player request");
      };

      if (!activeVideo) return <div className="p-8 text-center text-slate-400">Chargement de la vidéo...</div>;

      return (
        <VideoPlayerView
            activeVideo={activeVideo}
            currentUser={currentUser}
            isSubscribed={false} // Todo: fetch creator and check sub
            isUnlocking={isUnlocking}
            goHome={goHome}
            goToCreator={goToCreator}
            handleUnlock={handleUnlock}
            handleSubscribe={handleSubscribe}
        />
      );
}
