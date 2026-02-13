import { Video, Creator, User, DashboardStats } from '../types';

// --- Mock Data ---

const MOCK_VIDEOS: Video[] = [
  {
    id: 1,
    title: "Introduction à l'IA Générative",
    creator: "Sophie Tech",
    creatorAvatar: "https://placehold.co/100x100/1e40af/ffffff",
    thumbnailUrl: "https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/aaaeb91c-244d-455d-8a55-f672cc51a139.png",
    isFree: true,
    views: "12k",
    uploadedAt: "Il y a 2 jours",
    description: "Découvrez les bases de l'intelligence artificielle générative dans ce cours introductif complet.",
    streamUrl: "https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/a4adbc5d-3797-426d-b4b8-f2eeb3b63af1.png", // Mock stream
    duration: "14:20"
  },
  {
    id: 2,
    title: "Masterclass: Design System Avancé",
    creator: "DesignPro",
    creatorAvatar: "https://placehold.co/100x100/9f1239/ffffff",
    thumbnailUrl: "https://placehold.co/600x340/e11d48/ffffff",
    isFree: false,
    price: "5.00€",
    isLocked: true,
    views: "5.4k",
    uploadedAt: "Il y a 1 jour",
    description: "Une plongée en profondeur dans la création de systèmes de design évolutifs pour les grandes entreprises.",
    duration: "45:00"
  },
  {
    id: 3,
    title: "Vlog: Une journée à Tokyo",
    creator: "TravelBen",
    creatorAvatar: "https://placehold.co/100x100/065f46/ffffff",
    thumbnailUrl: "https://placehold.co/600x340/059669/ffffff",
    isFree: true,
    views: "45k",
    uploadedAt: "Il y a 1 semaine",
    description: "Suivez-moi dans les rues de Tokyo pour une journée inoubliable.",
    streamUrl: "https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/a4adbc5d-3797-426d-b4b8-f2eeb3b63af1.png",
    duration: "10:15"
  },
  {
    id: 4,
    title: "Recette Secrète: Pâtes à la Truffe",
    creator: "Chef Luigi",
    creatorAvatar: "https://placehold.co/100x100/b45309/ffffff",
    thumbnailUrl: "https://placehold.co/600x340/d97706/ffffff",
    isFree: false,
    price: "2.99€",
    isLocked: true,
    views: "2k",
    uploadedAt: "Il y a 3 jours",
    description: "La recette authentique que je ne partage qu'avec mes abonnés les plus fidèles.",
    duration: "08:30"
  }
];

const MOCK_CREATOR: Creator = {
  id: "creator-1",
  name: "Sophie Tech",
  handle: "sophietech",
  bio: "Artiste numérique et cinéaste indépendant. Je partage mes techniques de création, mes vlogs et des tutoriels exclusifs.",
  subscribers: "12.5k",
  isVerified: true,
  avatarUrl: "https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/056bf547-5117-4821-afe5-c0c4df8e47eb.png",
  bannerUrl: "https://placehold.co/1200x400/312e81/ffffff",
  videos: [
    MOCK_VIDEOS[0],
    { ...MOCK_VIDEOS[1], id: 101, title: "Workshop Privé #42", isFree: false, price: "Abonnés", isLocked: true },
    { ...MOCK_VIDEOS[2], id: 102, title: "Mon setup caméra 2024", isFree: true }
  ]
};

const MOCK_USER: User = {
  id: "user-1",
  name: "Jean Dupont",
  email: "jean.dupont@exemple.fr",
  avatarUrl: "https://placehold.co/100x100/6366f1/ffffff",
  isVerified: true,
  unlockedVideoIds: [],
  subscribedCreatorIds: ["creator-99"] // Mock existing subscription
};

const MOCK_DASHBOARD: DashboardStats = {
  revenue: "1,240€",
  subscribersCount: 458,
  recentUploads: [
    { ...MOCK_VIDEOS[0], title: "Analyse de Données #3", views: "Abonnés", uploadedAt: "Hier" },
    { ...MOCK_VIDEOS[2], title: "Q&A Live Replay", views: "Public", uploadedAt: "Il y a 5 jours" }
  ]
};

// --- API Service ---

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const api = {
  // Videos
  getVideos: async (filter: string = 'all'): Promise<Video[]> => {
    console.log('getVideos called with filter:', filter);
    await delay(500);
    if (filter === 'free') return MOCK_VIDEOS.filter(v => v.isFree);
    if (filter === 'premium') return MOCK_VIDEOS.filter(v => !v.isFree);
    return [...MOCK_VIDEOS];
  },

  getVideoById: async (id: number): Promise<Video | undefined> => {
    console.log('getVideoById called with id:', id);
    await delay(300);
    return MOCK_VIDEOS.find(v => v.id === id);
  },

  // User Actions
  unlockVideo: async (videoId: number): Promise<{ success: boolean }> => {
    console.log('unlockVideo called with videoId:', videoId);
    await delay(800); // Simulate transaction processing
    console.log(`[API] Video ${videoId} unlocked for user.`);
    return { success: true };
  },

  subscribeToCreator: async (creatorId: string): Promise<{ success: boolean }> => {
    console.log('subscribeToCreator called with creatorId:', creatorId);
    await delay(600);
    console.log(`[API] Subscribed to creator ${creatorId}.`);
    return { success: true };
  },

  // Creator
  getCreator: async (handle: string): Promise<Creator> => {
    console.log('getCreator called with handle:', handle);
    await delay(400);
    return { ...MOCK_CREATOR, name: handle || MOCK_CREATOR.name }; // Return mock creator but with requested name for demo
  },

  getCreatorDashboard: async (): Promise<DashboardStats> => {
    console.log('getCreatorDashboard called');
    await delay(500);
    return MOCK_DASHBOARD;
  },

  uploadVideo: async (formData: FormData): Promise<{ success: boolean, videoId: number }> => {
    console.log('uploadVideo called');
    await delay(1500); // Simulate upload
    console.log('[API] Video uploaded:', formData.get('title'));
    return { success: true, videoId: Math.floor(Math.random() * 1000) };
  },

  // User Profile
  getCurrentUser: async (): Promise<User> => {
    console.log('getCurrentUser called');
    await delay(300);
    return MOCK_USER;
  }
};
