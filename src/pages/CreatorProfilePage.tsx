import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { GoutteFeed } from "@ui";
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
  goToContent,
}: CreatorProfilePageProps) {
  const {
    data: contents = [],
    isLoading: isLoadingContents,
    error: contentsError,
  } = useGetCreatorContent(activeCreator?.id);
  const { decryptContent, isDecrypting: isPreloadingMedia, error: decryptError } = useDecryptContent();
  const [prefetchedMediaByContentId, setPrefetchedMediaByContentId] = useState<Record<string, PrefetchedMedia>>({});

  useEffect(() => {
    if (!contents.length) return;

    let cancelled = false;
    const tasks: Array<() => Promise<void>> = [];

    for (const content of contents) {
      const prefetchedEntry = prefetchedMediaByContentId[content.id];

      if (content.imageBlobId && !prefetchedEntry?.imageUrl) {
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

      if (content.videoBlobId && !prefetchedEntry?.videoUrl) {
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
  }, [activeCreator.id, contents, decryptContent, prefetchedMediaByContentId]);

  const contentsById = useMemo(() => new Map(contents.map((content) => [content.id, content])), [contents]);

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
      <div className="min-h-[160px]">
        <div className="flex items-end justify-between px-1 mb-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-[#f8f5ef]">Posts</h2>
            <p className="text-sm text-[#d4cfc1]">
              {contents.length > 0 ? `${contents.length} contenus publies` : "Collection en chargement"}
            </p>
          </div>
        </div>

        {isPreloadingMedia && (
          <div className="mb-4 text-xs font-semibold tracking-wide uppercase text-[#d2c8ae]">Prechargement des medias...</div>
        )}
        {decryptError && <div className="mb-4 text-xs text-amber-200">{decryptError}</div>}
        {isLoadingContents ? (
          <div className="flex items-center justify-center py-10 text-slate-400">
            <Loader2 className="w-5 h-5 mr-2 text-amber-300 animate-spin" />
            <span>Chargement des contenus...</span>
          </div>
        ) : contentsError ? (
          <p className="py-6 text-sm text-center text-red-300">Impossible de charger les contenus de ce createur.</p>
        ) : contents.length === 0 ? (
          <p className="py-6 text-sm text-center text-slate-300">Aucun contenu publie pour le moment.</p>
        ) : (
          <GoutteFeed
            posts={contentPosts}
            maxWidth={1400}
            onPostClick={(post) => {
              const contentId = String(post.contentId ?? post.id);
              const content = contentsById.get(contentId);
              if (content) {
                goToContent(content);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
