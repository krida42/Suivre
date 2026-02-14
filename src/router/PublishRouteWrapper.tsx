import { useState } from "react";
import { CheckCircle } from "lucide-react";
import { usePublishContentTx } from "@hooks/usePublishContentTx";
import { PublishContentPage } from "@pages/PublishContentPage";

export function PublishRouteWrapper() {
  const [showUploadToast, setShowUploadToast] = useState(false);
  const { publishContent } = usePublishContentTx();

  const handleUpload = async (payload: {
    title: string;
    text: string;
    imageBlobId: string | null;
    imageMimeType: string | null;
    videoBlobId: string | null;
    videoMimeType: string | null;
    creatorId: string;
  }) => {
    const result = await publishContent({
      title: payload.title,
      text: payload.text,
      imageBlobId: payload.imageBlobId,
      imageMimeType: payload.imageMimeType,
      videoBlobId: payload.videoBlobId,
      videoMimeType: payload.videoMimeType,
      creatorId: payload.creatorId,
    });

    setShowUploadToast(true);
    setTimeout(() => setShowUploadToast(false), 3000);

    return result;
  };

  return (
    <>
      <PublishContentPage dashboardStats={null} handleUpload={handleUpload} />
      {showUploadToast && (
        <div className="fixed z-50 flex items-center gap-3 px-6 py-3 text-slate-900 duration-300 border rounded-xl shadow-xl bottom-8 right-8 border-[rgba(15,23,42,0.12)] bg-[rgba(255,255,255,0.95)] animate-in slide-in-from-bottom-10">
          <CheckCircle className="w-5 h-5 text-emerald-600" />
          <div>
            <p className="font-medium">Succes !</p>
            <p className="text-xs text-slate-600">Votre post a ete publie.</p>
          </div>
        </div>
      )}
    </>
  );
}
