export interface Video {
  id: number;
  title: string;
  description?: string;
  thumbnailUrl: string;
  streamUrl?: string; // Only present if unlocked/free
  previewUrl?: string; // For locked videos
  creator: string; // Creator name or ID
  creatorAvatar?: string;
  views: string;
  uploadedAt: string;
  isFree: boolean;
  price?: string; // e.g. "5.00€"
  isLocked?: boolean; // Computed for the current user
  duration?: string;
}

export interface Creator {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string;
  bannerUrl: string;
  bio: string;
  subscribers: string;
  isVerified: boolean;
  videos?: Video[];
  // Human-readable monthly price in SUI (e.g. "0.01"), derived from on-chain data.
  pricePerMonth?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  isVerified: boolean;
  unlockedVideoIds: number[];
  subscribedCreatorIds: string[];
}

export interface DashboardStats {
  revenue: string;
  subscribersCount: number;
  recentUploads: Video[];
}
