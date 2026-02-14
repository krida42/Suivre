import { useState } from "react";
import { CheckCircle } from "lucide-react";
import { usePublishContentTx } from "@hooks/usePublishContentTx";
import { PublishContentPage } from "@pages/PublishContentPage";

export function PublishRouteWrapper() {
  const [showUploadToast, setShowUploadToast] = useState(false);
  const { publishContent } = usePublishContentTx();

  const handleUpload = async (payload: {
    title: string;
    description: string;
    blobId: string;
    creatorId: string;
    fileName: string | null;
  }) => {
    const result = await publishContent({
      title: payload.title,
      description: payload.description,
      blobId: payload.blobId,
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
        <div className="fixed z-50 flex items-center gap-3 px-6 py-3 text-white duration-300 rounded-lg shadow-xl bottom-8 right-8 bg-slate-900 animate-in slide-in-from-bottom-10">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <div>
            <p className="font-medium">Succes !</p>
            <p className="text-xs text-slate-300">Votre video a ete publiee.</p>
          </div>
        </div>
      )}
    </>
  );
}
