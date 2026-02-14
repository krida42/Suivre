import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle, Loader2 } from "lucide-react";
import { Button, GoutteFeed } from "@ui";
import { useDecryptContent } from "@hooks/useDecryptContent";
import { useGetCreatorContent } from "@hooks/useGetCreatorContent";
import type { Creator } from "@models/domain";
import type { CreatorContent } from "@models/content";
import type { GoutteFeedPost } from "@ui/GoutteFeed/types";

interface CreatorProfilePageProps {
  activeCreator: Creator;
  isSubscribed: boolean;
  isSubscribing: boolean;
  handleSubscribe: () => void;
  subscribeError?: string | null;
  goToContent: (content: CreatorContent) => void;
}

const MOCK_VIDEO_SRC = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
const MOCK_VIDEO_POSTER = "/images/video_placeholder.png";
const MOCK_IMAGE_THUMB = "/images/image_placeholder.jpg";
const PREFETCH_CONCURRENCY = 3;

type PrefetchedMedia = {
  imageUrl?: string;
  videoUrl?: string;
};

export function CreatorProfilePage({
  activeCreator,
  isSubscribed,
  isSubscribing,
  handleSubscribe,
  subscribeError,
  goToContent: _goToContent,
}: CreatorProfilePageProps) {
  const {
    data: contents = [],
    isLoading: isLoadingContents,
    error: contentsError,
  } = useGetCreatorContent(activeCreator?.id);
  const { decryptContent, isDecrypting: isPreloadingMedia } = useDecryptContent();
  const [prefetchedMediaByContentId, setPrefetchedMediaByContentId] = useState<Record<string, PrefetchedMedia>>({});
  const scheduledPrefetchKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!contents.length) return;

    let cancelled = false;
    const tasks: Array<() => Promise<void>> = [];

    for (const content of contents) {
      if (content.imageBlobId) {
        const imageTaskKey = `${activeCreator.id}::image::${content.imageBlobId}`;
        if (!scheduledPrefetchKeysRef.current.has(imageTaskKey)) {
          scheduledPrefetchKeysRef.current.add(imageTaskKey);
          tasks.push(async () => {
            try {
              const imageUrl = await decryptContent({
                blobId: content.imageBlobId ?? "",
                creatorId: activeCreator.id,
                mimeType: content.imageMimeType,
              });

              if (cancelled) return;

              setPrefetchedMediaByContentId((prev) => {
                const previousEntry = prev[content.id];
                if (previousEntry?.imageUrl === imageUrl) {
                  return prev;
                }
                return {
                  ...prev,
                  [content.id]: {
                    ...previousEntry,
                    imageUrl,
                  },
                };
              });
            } catch (error) {
              console.error("Prefetch image failed", error);
            }
          });
        }
      }

      if (content.videoBlobId) {
        const videoTaskKey = `${activeCreator.id}::video::${content.videoBlobId}`;
        if (!scheduledPrefetchKeysRef.current.has(videoTaskKey)) {
          scheduledPrefetchKeysRef.current.add(videoTaskKey);
          tasks.push(async () => {
            try {
              const videoUrl = await decryptContent({
                blobId: content.videoBlobId ?? "",
                creatorId: activeCreator.id,
                mimeType: content.videoMimeType,
              });

              if (cancelled) return;

              setPrefetchedMediaByContentId((prev) => {
                const previousEntry = prev[content.id];
                if (previousEntry?.videoUrl === videoUrl) {
                  return prev;
                }
                return {
                  ...prev,
                  [content.id]: {
                    ...previousEntry,
                    videoUrl,
                  },
                };
              });
            } catch (error) {
              console.error("Prefetch video failed", error);
            }
          });
        }
      }
    }

    if (!tasks.length) {
      return;
    }

    const run = async () => {
      const workers = Array.from({ length: Math.min(PREFETCH_CONCURRENCY, tasks.length) }, async () => {
        while (tasks.length > 0) {
          const task = tasks.shift();
          if (!task) break;
          await task();
        }
      });
      await Promise.all(workers);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [activeCreator.id, contents, decryptContent]);

  const contentPosts = useMemo<GoutteFeedPost[]>(
    () =>
      contents.map((content, index) => {
        const contentName = content.contentName ?? "";
        const contentDescription = content.contentDescription ?? "";
        const hasVideo = Boolean(content.videoBlobId);
        const hasImage = Boolean(content.imageBlobId);
        const hasText = contentName.trim().length > 0 || contentDescription.trim().length > 0;
        const formatLabel = [
          hasText ? "Texte" : null,
          hasImage ? "Image" : null,
          hasVideo ? "Video" : null,
        ]
          .filter(Boolean)
          .join(" • ");
        const prefetchedMedia = prefetchedMediaByContentId[content.id];
        const media = hasVideo
          ? {
              type: "video" as const,
              src: prefetchedMedia?.videoUrl ?? MOCK_VIDEO_SRC,
              poster: prefetchedMedia?.imageUrl ?? MOCK_VIDEO_POSTER,
              alt: "Mock video thumbnail",
            }
          : hasImage
            ? {
                type: "image" as const,
                src: prefetchedMedia?.imageUrl ?? MOCK_IMAGE_THUMB,
                alt: "Mock image thumbnail",
              }
            : undefined;

        return {
          id: content.id,
          author: activeCreator.name,
          handle: "@content",
          avatar: activeCreator.avatarUrl || "https://avatar.iran.liara.run/public",
          description:
            contentDescription ||
            contentName ||
            "Contenu on-chain publie par ce createur. Ouvrez la fiche pour decrypter les medias.",
          media,
          accent: index % 2 === 0 ? "#22d3ee" : "#f59e0b",
          contentId: content.id,
          formatLabel,
        };
      }),
    [activeCreator.avatarUrl, activeCreator.name, contents, prefetchedMediaByContentId]
  );

  return (
    <div className="duration-500 animate-in slide-in-from-bottom-4">
      <div className=" px-6 mb-8 border-t-0 shadow-xl glass-panel md:px-10 rounded-b-2xl">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <div className="z-20 flex items-end gap-6 mt-12">
            <div className=" w-32 h-32 overflow-hidden border-4 rounded-full shadow-2xl bg-slate-800 border-slate-900">
              <img
                src={activeCreator.avatarUrl || "https://avatar.iran.liara.run/public"}
                alt="Creator avatar"
                className="object-cover w-full h-full"
              />
            </div>
            <div className="mb-2">
              <h1 className="flex items-center gap-2 text-3xl font-bold text-white">
                {activeCreator.name}
                {activeCreator.isVerified && <CheckCircle className="w-5 h-5 text-blue-400 fill-current" />}
              </h1>
              <p className="font-medium text-slate-300">{activeCreator.subscribers} membres</p>
            </div>
          </div>
          <div className="flex w-full gap-3 mb-2 md:w-auto">
            <Button
              variant={isSubscribed ? "outline" : "accent"}
              className="flex-1 md:flex-none"
              onClick={handleSubscribe}
              disabled={isSubscribed || isSubscribing}
            >
              {isSubscribed
                ? "Abonne"
                : `S'abonner - ${activeCreator.pricePerMonth ? `${activeCreator.pricePerMonth} SUI/mois` : "Prix inconnu"}`}
            </Button>
          </div>
        </div>
        {subscribeError && <p className="mt-3 text-sm text-red-400">{subscribeError}</p>}
        <div className="max-w-3xl mt-6">
          <h3 className="mb-2 font-semibold text-white">A propos</h3>
          <p className="leading-relaxed text-slate-300">{activeCreator.bio}</p>
        </div>
      </div>

      <div className="flex items-center gap-8 px-2 mb-6 border-b border-white/10">
        <button className="pb-3 text-sm font-medium text-indigo-400 border-b-2 border-indigo-400">Posts</button>
        <button className="pb-3 text-sm font-medium transition-colors border-b-2 border-transparent text-slate-400 hover:text-white">
          Communaute
        </button>
        <button className="pb-3 text-sm font-medium transition-colors border-b-2 border-transparent text-slate-400 hover:text-white">
          A propos
        </button>
      </div>

      <div className="min-h-[160px]">
        {isPreloadingMedia && (
          <div className="mb-4 text-xs font-medium text-slate-300">Prechargement des medias dechiffres en cours...</div>
        )}
        {isLoadingContents ? (
          <div className="flex items-center justify-center py-10 text-slate-400">
            <Loader2 className="w-5 h-5 mr-2 text-indigo-400 animate-spin" />
            <span>Chargement des contenus...</span>
          </div>
        ) : contentsError ? (
          <p className="py-6 text-sm text-center text-red-400">Impossible de charger les contenus de ce createur.</p>
        ) : contents.length === 0 ? (
          <p className="py-6 text-sm text-center text-slate-400">Aucun contenu publie pour le moment.</p>
        ) : (
          <GoutteFeed posts={contentPosts} maxWidth={1400} />
        )}
      </div>
    </div>
  );
}
