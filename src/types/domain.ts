export interface Video {
  id: number;
  title: string;
  description?: string;
  thumbnailUrl: string;
  streamUrl?: string;
  previewUrl?: string;
  creator: string;
  creatorAvatar?: string;
  views: string;
  uploadedAt: string;
  isFree: boolean;
  price?: string;
  isLocked?: boolean;
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
