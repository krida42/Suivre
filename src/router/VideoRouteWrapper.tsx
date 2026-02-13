import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useParams } from "react-router-dom";
import { VideoPlayerPage } from "@pages/VideoPlayerPage";
import { api } from "@services/mockApi";
import type { ContentCreator } from "@models/creators";
import type { User, Video } from "@models/domain";

interface VideoRouteWrapperProps {
  currentUser: User | null;
  setCurrentUser: Dispatch<SetStateAction<User | null>>;
  goHome: () => void;
  goToCreator: (arg: ContentCreator | string) => void;
}

export function VideoRouteWrapper({ currentUser, setCurrentUser, goHome, goToCreator }: VideoRouteWrapperProps) {
  const { id } = useParams();
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);

  useEffect(() => {
    if (id) {
      api.getVideoById(Number(id)).then((v) => setActiveVideo(v || null));
    }
  }, [id]);

  const handleUnlock = async () => {
    if (!activeVideo || !currentUser) return;

    setIsUnlocking(true);
    try {
      await api.unlockVideo(activeVideo.id);
      const updatedUser: User = {
        ...currentUser,
        unlockedVideoIds: [...currentUser.unlockedVideoIds, activeVideo.id],
      };
      setCurrentUser(updatedUser);
      const refreshedVideo = await api.getVideoById(activeVideo.id);
      if (refreshedVideo) setActiveVideo(refreshedVideo);
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleSubscribe = async () => {
    console.log("Subscribe from video player request");
  };

  if (!activeVideo) {
    return <div className="p-8 text-center text-slate-400">Chargement de la video...</div>;
  }

  return (
    <VideoPlayerPage
      activeVideo={activeVideo}
      currentUser={currentUser}
      isSubscribed={false}
      isUnlocking={isUnlocking}
      goHome={goHome}
      goToCreator={(creatorName) => goToCreator(creatorName)}
      handleUnlock={handleUnlock}
      handleSubscribe={handleSubscribe}
    />
  );
}
