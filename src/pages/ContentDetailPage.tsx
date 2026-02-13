import { useEffect } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useDecryptContent } from "@hooks/useDecryptContent";
import type { CreatorContent } from "@models/content";

interface ContentDetailPageProps {
  content: CreatorContent;
  creatorId: string;
  goBack: () => void;
}

export function ContentDetailPage({ content, creatorId, goBack }: ContentDetailPageProps) {
  const { videoUrl, isDecrypting, error, decryptContent } = useDecryptContent();

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        await decryptContent({ blobId: content.blobId, creatorId });
      } catch (e) {
        if (cancelled) return;
        console.error("Failed to decrypt content", e);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [content.blobId, creatorId, decryptContent]);

  return (
    <div className="max-w-4xl mx-auto duration-300 animate-in fade-in">
      <button
        onClick={goBack}
        className="flex items-center gap-2 mb-4 text-sm text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Retour au createur</span>
      </button>

      <h1 className="mb-2 text-2xl font-bold text-white">{content.contentName || "Contenu sans titre"}</h1>
      <p className="mb-6 text-sm text-slate-200">{content.contentDescription}</p>

      <div className="mb-6 overflow-hidden bg-black shadow-2xl shadow-indigo-500/10 aspect-video rounded-xl flex items-center justify-center border border-white/10">
        {isDecrypting && !videoUrl && (
          <div className="flex items-center justify-center text-slate-200">
            <Loader2 className="w-6 h-6 mr-2 animate-spin text-indigo-500" />
            <span>Preparation de la video...</span>
          </div>
        )}
        {!isDecrypting && error && <div className="px-4 text-sm text-center text-red-400">{error}</div>}
        {!isDecrypting && videoUrl && (
          <video controls className="object-contain w-full h-full bg-black" src={videoUrl}>
            Votre navigateur ne supporte pas la lecture video.
          </video>
        )}
      </div>

      <div className="p-4 text-xs glass-panel rounded-xl text-slate-300 border border-white/5">
        <div className="font-semibold text-slate-200">Informations techniques</div>
        <div className="mt-2 break-all">
          <span className="font-mono text-[11px] text-indigo-300">blobId: {content.blobId}</span>
        </div>
      </div>
    </div>
  );
}
