import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useDecryptContent } from "@hooks/useDecryptContent";
import type { CreatorContent } from "@models/content";

interface ContentDetailPageProps {
  content: CreatorContent;
  creatorId: string;
  goBack: () => void;
}

export function ContentDetailPage({ content, creatorId, goBack }: ContentDetailPageProps) {
  const { isDecrypting, error, decryptContent } = useDecryptContent();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [imageUrl, videoUrl]);

  useEffect(() => {
    let cancelled = false;

    const revokePreviousMedia = () => {
      setImageUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return null;
      });
      setVideoUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return null;
      });
    };

    const run = async () => {
      revokePreviousMedia();

      if (content.imageBlobId) {
        try {
          const nextImageUrl = await decryptContent({
            blobId: content.imageBlobId,
            creatorId,
            mimeType: content.imageMimeType,
          });
          if (cancelled) {
            URL.revokeObjectURL(nextImageUrl);
          } else {
            setImageUrl(nextImageUrl);
          }
        } catch (e) {
          if (cancelled) return;
          console.error("Failed to decrypt image", e);
        }
      }

      if (content.videoBlobId) {
        try {
          const nextVideoUrl = await decryptContent({
            blobId: content.videoBlobId,
            creatorId,
            mimeType: content.videoMimeType,
          });
          if (cancelled) {
            URL.revokeObjectURL(nextVideoUrl);
          } else {
            setVideoUrl(nextVideoUrl);
          }
        } catch (e) {
          if (cancelled) return;
          console.error("Failed to decrypt video", e);
        }
      }
    };

    if (content.imageBlobId || content.videoBlobId) {
      void run();
    } else {
      revokePreviousMedia();
    }

    return () => {
      cancelled = true;
    };
  }, [
    content.imageBlobId,
    content.imageMimeType,
    content.videoBlobId,
    content.videoMimeType,
    creatorId,
    decryptContent,
  ]);

  return (
    <div className="max-w-4xl mx-auto duration-300 animate-in fade-in">
      <button
        onClick={goBack}
        className="flex items-center gap-2 mb-4 text-sm text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Retour au createur</span>
      </button>

      <h1 className="mb-2 text-2xl font-bold text-white">{content.contentName || "Post sans titre"}</h1>
      {content.contentDescription && <p className="mb-6 text-sm leading-relaxed text-slate-200 whitespace-pre-wrap">{content.contentDescription}</p>}

      {!content.contentDescription && !content.imageBlobId && !content.videoBlobId && (
        <p className="mb-6 text-sm text-slate-400">Ce post ne contient pas de donnees affichables.</p>
      )}

      {content.imageBlobId && (
        <div className="mb-6 overflow-hidden border rounded-xl border-white/10 bg-black/30 min-h-[240px] flex items-center justify-center">
          {imageUrl ? (
            <img src={imageUrl} alt={content.contentName || "Image du post"} className="object-contain w-full max-h-[640px]" />
          ) : isDecrypting ? (
            <div className="flex items-center justify-center py-8 text-slate-200">
              <Loader2 className="w-6 h-6 mr-2 animate-spin text-indigo-500" />
              <span>Preparation de l'image...</span>
            </div>
          ) : (
            <div className="px-4 py-8 text-sm text-center text-slate-400">Image non disponible.</div>
          )}
        </div>
      )}

      {content.videoBlobId && (
        <div className="mb-6 overflow-hidden bg-black shadow-2xl shadow-indigo-500/10 aspect-video rounded-xl flex items-center justify-center border border-white/10">
          {videoUrl ? (
            <video controls className="object-contain w-full h-full bg-black" src={videoUrl}>
              Votre navigateur ne supporte pas la lecture video.
            </video>
          ) : isDecrypting ? (
            <div className="flex items-center justify-center text-slate-200">
              <Loader2 className="w-6 h-6 mr-2 animate-spin text-indigo-500" />
              <span>Preparation de la video...</span>
            </div>
          ) : (
            <div className="px-4 py-8 text-sm text-center text-slate-400">Video non disponible.</div>
          )}
        </div>
      )}

      {error && <p className="mb-6 text-sm text-red-400">{error}</p>}

      <div className="p-4 text-xs glass-panel rounded-xl text-slate-300 border border-white/5 space-y-1">
        <div className="font-semibold text-slate-200">Informations techniques</div>
        {content.imageBlobId && (
          <div className="break-all">
            <span className="font-mono text-[11px] text-indigo-300">imageBlobId: {content.imageBlobId}</span>
          </div>
        )}
        {content.videoBlobId && (
          <div className="break-all">
            <span className="font-mono text-[11px] text-indigo-300">videoBlobId: {content.videoBlobId}</span>
          </div>
        )}
        {!content.imageBlobId && !content.videoBlobId && <div className="text-slate-400">Aucun media chiffre.</div>}
      </div>
    </div>
  );
}
