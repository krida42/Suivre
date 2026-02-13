import { useState, useEffect } from "react";
import { Search, Bell, User, Play, Upload, CheckCircle } from "lucide-react";
import { api } from "./services/api";
import { Creator, User as UserType, DashboardStats, Video as VideoType } from "./types";
import { Button } from "./components/Button";
import { HomeView } from "./views/HomeView";
import { VideoPlayerView } from "./views/VideoPlayerView";
import { CreatorProfileView } from "./views/CreatorProfileView";
import { ContentDetailView } from "./views/ContentDetailView";
import { CreatorDashboardView } from "./views/CreatorDashboardView";
import { UserProfileView } from "./views/UserProfileView";
import { CreateCreatorView } from "./views/CreateCreatorView";
import { ConnectWalletView } from "./views/ConnectWalletView";
import { useCurrentAccount, ConnectButton } from "@mysten/dapp-kit";
import { useUploadContent } from "./lib/useUploadContent";
import { useSubscribeToCreator } from "./lib/useSubscribeToCreator";
import { useUserSubscriptions } from "./lib/useUserSubscriptions";
import type { ContentCreator } from "./lib/useGetCreators";
import type { CreatorContent } from "./lib/useGetCreatorContent";

// --- Main Application Component ---

export default function VideoPlatformPrototype() {
  // --- State Management ---
  const [currentView, setCurrentView] = useState("home"); // home, video, creator, dashboard, profile, content
  const [isLoading, setIsLoading] = useState(false);

  // Data State
  const [activeVideo, setActiveVideo] = useState<VideoType | null>(null);
  const [activeCreator, setActiveCreator] = useState<Creator | null>(null);
  const [activeContent, setActiveContent] = useState<CreatorContent | null>(null);
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);

  // UI State
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showUploadToast, setShowUploadToast] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const currentAccount = useCurrentAccount();
  const isWalletConnected = Boolean(currentAccount?.address);
  const { uploadContent } = useUploadContent();
  const { subscribeToCreator, isSubscribing } = useSubscribeToCreator();
  const { subscriptions, refetch: refetchSubscriptions } = useUserSubscriptions();

  const formatSuiFromMist = (value: string | number | bigint | null | undefined): string | null => {
    if (value === null || value === undefined) return null;
    try {
      const big = BigInt(value);
      const sui = Number(big) / 1_000_000_000;
      return sui.toFixed(2);
    } catch {
      return null;
    }
  };

  // --- Initial Load ---
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        const userData = await api.getCurrentUser();
        setCurrentUser(userData);
      } catch (error) {
        console.error("Failed to load initial data", error);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  // --- Navigation Handlers ---
  const goHome = () => {
    setCurrentView("home");
  };

  const goToCreator = async (creatorOrName: string | ContentCreator | any) => {
    // If we receive a ContentCreator from on-chain data, map it directly
    if (creatorOrName && typeof creatorOrName === "object" && "id" in creatorOrName && "pseudo" in creatorOrName) {
      const creator = creatorOrName as ContentCreator;

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
        videos: [],
        pricePerMonth: Number(creator.price_per_month).toFixed(2) || "0",
      };

      setActiveCreator(mappedCreator);
      setCurrentView("creator");
      return;
    }

    // Fallback: legacy demo flow using mocked API by creator name
    const name = typeof creatorOrName === "string" ? creatorOrName : "Sophie Tech";

    setIsLoading(true);
    try {
      const creator = await api.getCreator(name);
      setActiveCreator(creator);
      setCurrentView("creator");
    } finally {
      setIsLoading(false);
    }
  };

  const goToDashboard = async () => {
    setIsLoading(true);
    const stats = await api.getCreatorDashboard();
    setDashboardStats(stats);
    setCurrentView("dashboard");
    setIsLoading(false);
  };

  const goToProfile = async () => {
    setIsLoading(true);
    const user = await api.getCurrentUser();
    setCurrentUser(user);
    setCurrentView("profile");
    setIsLoading(false);
  };

  const goToCreateCreator = () => {
    setCurrentView("createCreator");
  };

  const goToContent = (content: CreatorContent) => {
    setActiveContent(content);
    setCurrentView("content");
  };

  useEffect(() => {
    if (!activeCreator) {
      setIsSubscribed(false);
      return;
    }

    const subscribed = subscriptions.some((sub) => sub.creatorId === activeCreator.id);
    setIsSubscribed(subscribed);
  }, [activeCreator, subscriptions]);

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
        // Refresh video to get stream URL (simulated)
        const refreshedVideo = await api.getVideoById(activeVideo.id);
        if (refreshedVideo) setActiveVideo(refreshedVideo);
      } finally {
        setIsUnlocking(false);
      }
    }
  };

  const handleSubscribe = async () => {
    if (!activeCreator) return;

    setIsLoading(true);
    try {
      await subscribeToCreator({ creatorId: activeCreator.id });
      await refetchSubscriptions();
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async (payload: { title: string; description: string; blobId: string; creatorId: string; fileName: string | null }) => {
    setIsLoading(true);
    try {
      // Publish encrypted content metadata on-chain via Move call instead of using the REST API.
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
      setIsLoading(false);
    }
  };

  // --- Mock Data Helpers ---
  // Note: In a real app this would be dynamic. Here we define specific items for the demo.

  if (!isWalletConnected) {
    return <ConnectWalletView />;
  }

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
              <button onClick={goHome} className={`hover:text-white transition-colors ${currentView === "home" ? "text-white font-semibold" : ""}`}>
                Découvrir
              </button>
              <button onClick={goToCreator} className="transition-colors opacity-50 cursor-not-allowed hover:text-white" title="Demo only">
                Créateurs
              </button>
            </nav>
          </div>

          {/* Search Bar */}
          <div className="flex-1 hidden max-w-md mx-6 md:flex">
            <div className="relative w-full group">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400 group-focus-within:text-indigo-400 transition-colors" />
              <input
                type="text"
                placeholder="Rechercher une vidéo, un créateur..."
                className="w-full h-10 pl-10 pr-4 text-sm transition-all border rounded-full outline-none border-white/10 bg-white/5 text-slate-200 placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500/50 focus:bg-white/10 focus:border-indigo-500/30"
              />
            </div>
          </div>

          {/* User Actions */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="hidden sm:flex text-slate-300 hover:text-white hover:bg-white/10" onClick={goToDashboard}>
              <Upload className="w-4 h-4 mr-2" />
              Créer
            </Button>
            <Button variant="ghost" className="hidden sm:flex text-slate-300 hover:text-white hover:bg-white/10" onClick={goToCreateCreator}>
              <User className="w-4 h-4 mr-2" />
              Compte Créateur
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 text-slate-300 hover:text-white hover:bg-white/10">
              <Bell className="w-5 h-5" />
            </Button>
            {/* Wallet connect / disconnect (ConnectButton handles both states) */}
            <div className="hidden sm:block">
              <ConnectButton />
            </div>
            <div
              className="flex items-center justify-center transition-all border rounded-full cursor-pointer bg-white/10 border-white/10 h-9 w-9 hover:bg-indigo-600 hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-500/30"
              onClick={goToProfile}
            >
              <User className="w-5 h-5 text-slate-200" />
            </div>
          </div>
        </div>
      </header>

      {/* --- Main Content Area --- */}
      <main className="container px-4 py-8 mx-auto">
        {/* VIEW: HOME */}
        {currentView === "home" && <HomeView goToCreator={goToCreator} />}

        {/* VIEW: VIDEO PLAYER */}
        {currentView === "video" && activeVideo && (
          <VideoPlayerView
            activeVideo={activeVideo}
            currentUser={currentUser}
            isSubscribed={isSubscribed}
            isUnlocking={isUnlocking || isSubscribing}
            goHome={goHome}
            goToCreator={goToCreator}
            handleUnlock={handleUnlock}
            handleSubscribe={handleSubscribe}
          />
        )}

        {/* VIEW: CREATOR PAGE */}
        {currentView === "creator" && activeCreator && (
          <CreatorProfileView
            activeCreator={activeCreator}
            isSubscribed={isSubscribed}
            isSubscribing={isSubscribing}
            handleSubscribe={handleSubscribe}
            goToContent={goToContent}
          />
        )}

        {/* VIEW: CONTENT DETAIL */}
        {currentView === "content" && activeContent && activeCreator && (
          <ContentDetailView content={activeContent} creatorId={activeCreator.id} goBack={() => setCurrentView("creator")} />
        )}

        {/* VIEW: CREATOR DASHBOARD */}
        {currentView === "dashboard" && <CreatorDashboardView dashboardStats={dashboardStats} handleUpload={handleUpload} />}

        {/* VIEW: USER PROFILE */}
        {currentView === "profile" && <UserProfileView currentUser={currentUser} isSubscribed={isSubscribed} />}

        {/* VIEW: CREATE CREATOR ACCOUNT */}
        {currentView === "createCreator" && <CreateCreatorView />}
      </main>

      {/* --- Floating Notifications / Toasts --- */}
      {showUploadToast && (
        <div className="fixed z-50 flex items-center gap-3 px-6 py-3 text-white duration-300 rounded-lg shadow-xl bottom-8 right-8 bg-slate-900 animate-in slide-in-from-bottom-10">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <div>
            <p className="font-medium">Succès !</p>
            <p className="text-xs text-slate-300">Votre vidéo a été publiée.</p>
          </div>
        </div>
      )}

      {/* --- Footer --- */}
      {/* <footer className="py-12 mt-12 bg-white border-t border-slate-200">
        <div className="container px-4 mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4 opacity-50">
            <div className="flex items-center justify-center w-6 h-6 rounded bg-slate-900">
              <Play className="w-3 h-3 text-white fill-current" />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900">SuiFan</span>
          </div>
          <p className="text-sm text-slate-500">© 2024 Plateforme Décentralisée Prototype. Design Concept for demonstration.</p>
        </div>
      </footer> */}
    </div>
  );
}
