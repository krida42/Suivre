import type { Video, Creator, User, DashboardStats } from "@models/domain";

const MOCK_VIDEOS: Video[] = [
  {
    id: 1,
    title: "Introduction a l'IA Generative",
    creator: "Sophie Tech",
    creatorAvatar: "https://placehold.co/100x100/1e40af/ffffff",
    thumbnailUrl:
      "https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/aaaeb91c-244d-455d-8a55-f672cc51a139.png",
    isFree: true,
    views: "12k",
    uploadedAt: "Il y a 2 jours",
    description: "Decouvrez les bases de l'intelligence artificielle generative dans ce cours introductif complet.",
    streamUrl:
      "https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/a4adbc5d-3797-426d-b4b8-f2eeb3b63af1.png",
    duration: "14:20",
  },
  {
    id: 2,
    title: "Masterclass: Design System Avance",
    creator: "DesignPro",
    creatorAvatar: "https://placehold.co/100x100/9f1239/ffffff",
    thumbnailUrl: "https://placehold.co/600x340/e11d48/ffffff",
    isFree: false,
    price: "5.00€",
    isLocked: true,
    views: "5.4k",
    uploadedAt: "Il y a 1 jour",
    description: "Une plongee en profondeur dans la creation de systemes de design evolutifs.",
    duration: "45:00",
  },
  {
    id: 3,
    title: "Vlog: Une journee a Tokyo",
    creator: "TravelBen",
    creatorAvatar: "https://placehold.co/100x100/065f46/ffffff",
    thumbnailUrl: "https://placehold.co/600x340/059669/ffffff",
    isFree: true,
    views: "45k",
    uploadedAt: "Il y a 1 semaine",
    description: "Suivez-moi dans les rues de Tokyo pour une journee inoubliable.",
    streamUrl:
      "https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/a4adbc5d-3797-426d-b4b8-f2eeb3b63af1.png",
    duration: "10:15",
  },
];

const MOCK_CREATOR: Creator = {
  id: "creator-1",
  name: "Sophie Tech",
  handle: "sophietech",
  bio: "Artiste numerique et cineaste independant.",
  subscribers: "12.5k",
  isVerified: true,
  avatarUrl:
    "https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/056bf547-5117-4821-afe5-c0c4df8e47eb.png",
  bannerUrl: "https://placehold.co/1200x400/312e81/ffffff",
  videos: [MOCK_VIDEOS[0], { ...MOCK_VIDEOS[1], id: 101 }, { ...MOCK_VIDEOS[2], id: 102 }],
};

const MOCK_USER: User = {
  id: "user-1",
  name: "Jean Dupont",
  email: "jean.dupont@exemple.fr",
  avatarUrl: "https://placehold.co/100x100/6366f1/ffffff",
  isVerified: true,
  unlockedVideoIds: [],
  subscribedCreatorIds: ["creator-99"],
};

const MOCK_DASHBOARD: DashboardStats = {
  revenue: "1,240€",
  subscribersCount: 458,
  recentUploads: [
    { ...MOCK_VIDEOS[0], title: "Analyse de Donnees #3" },
    { ...MOCK_VIDEOS[2], title: "Q&A Live Replay" },
  ],
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const api = {
  getVideos: async (filter: string = "all"): Promise<Video[]> => {
    await delay(500);
    if (filter === "free") return MOCK_VIDEOS.filter((v) => v.isFree);
    if (filter === "premium") return MOCK_VIDEOS.filter((v) => !v.isFree);
    return [...MOCK_VIDEOS];
  },

  getVideoById: async (id: number): Promise<Video | undefined> => {
    await delay(300);
    return MOCK_VIDEOS.find((v) => v.id === id);
  },

  unlockVideo: async (videoId: number): Promise<{ success: boolean }> => {
    await delay(800);
    console.log(`[API] Video ${videoId} unlocked for user.`);
    return { success: true };
  },

  subscribeToCreator: async (creatorId: string): Promise<{ success: boolean }> => {
    await delay(600);
    console.log(`[API] Subscribed to creator ${creatorId}.`);
    return { success: true };
  },

  getCreator: async (handle: string): Promise<Creator> => {
    await delay(400);
    return { ...MOCK_CREATOR, name: handle || MOCK_CREATOR.name };
  },

  getCreatorDashboard: async (): Promise<DashboardStats> => {
    await delay(500);
    return MOCK_DASHBOARD;
  },

  uploadVideo: async (): Promise<{ success: boolean; videoId: number }> => {
    await delay(1500);
    return { success: true, videoId: Math.floor(Math.random() * 1000) };
  },

  getCurrentUser: async (): Promise<User> => {
    await delay(300);
    return MOCK_USER;
  },
};
