import React, { useEffect } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { CreatorContent } from "../lib/useGetCreatorContent";
import { useDecryptCreatorContent } from "../lib/useDecryptCreatorContent";

interface ContentDetailViewProps {
  content: CreatorContent;
  creatorId: string;
  goBack: () => void;
}

/**
 * Detail page for a single uploaded content.
 *
 * Uses Walrus + Seal to download and decrypt the encrypted blob on the client
 * and renders the resulting `video/mp4` in a player.
 */
export const ContentDetailView: React.FC<ContentDetailViewProps> = ({ content, creatorId, goBack }) => {
  const { videoUrl, isDecrypting, error, decryptContent } = useDecryptCreatorContent();

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      console.debug("[ContentDetailView] Trigger decryptContent", {
        blobId: content.blobId,
        creatorId,
      });
      try {
        await decryptContent({ blobId: content.blobId, creatorId });
      } catch (e) {
        if (cancelled) return;
        console.error("[ContentDetailView] Failed to decrypt content", e);
      }
    };
    run();
    return () => {
      console.debug("[ContentDetailView] Cleanup effect for content", {
        blobId: content.blobId,
        creatorId,
      });
      cancelled = true;
    };
  }, [content.blobId, creatorId, decryptContent]);

  return (
    <div className="max-w-4xl mx-auto duration-300 animate-in fade-in">
      {/* Back button */}
      <button
        onClick={goBack}
        className="flex items-center gap-2 mb-4 text-sm text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Retour au créateur</span>
      </button>

      {/* Title */}
      <h1 className="mb-2 text-2xl font-bold text-white">{content.contentName || "Contenu sans titre"}</h1>
      <p className="mb-6 text-sm text-slate-200">{content.contentDescription}</p>

      {/* Video area */}
      <div className="mb-6 overflow-hidden bg-black shadow-2xl shadow-indigo-500/10 aspect-video rounded-xl flex items-center justify-center border border-white/10">
        {isDecrypting && !videoUrl && (
          <div className="flex items-center justify-center text-slate-200">
            <Loader2 className="w-6 h-6 mr-2 animate-spin text-indigo-500" />
            <span>Préparation de la vidéo...</span>
          </div>
        )}
        {!isDecrypting && error && (
          <div className="px-4 text-sm text-center text-red-400">{error}</div>
        )}
        {!isDecrypting && videoUrl && (
          <video
            controls
            className="object-contain w-full h-full bg-black"
            src={videoUrl}
          >
            Votre navigateur ne supporte pas la lecture vidéo.
          </video>
        )}
      </div>

      {/* Technical info */}
      <div className="p-4 text-xs glass-panel rounded-xl text-slate-300 border border-white/5">
        <div className="font-semibold text-slate-200">Informations techniques</div>
        <div className="mt-2 break-all">
          <span className="font-mono text-[11px] text-indigo-300">blobId: {content.blobId}</span>
        </div>
      </div>
    </div>
  );
};


