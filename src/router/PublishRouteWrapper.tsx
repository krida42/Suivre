import { useEffect, useState } from "react";
import { CheckCircle } from "lucide-react";
import { api } from "@services/mockApi";
import { usePublishContentTx } from "@hooks/usePublishContentTx";
import { PublishContentPage } from "@pages/PublishContentPage";
import type { DashboardStats } from "@models/domain";

export function PublishRouteWrapper() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [showUploadToast, setShowUploadToast] = useState(false);
  const { publishContent } = usePublishContentTx();

  useEffect(() => {
    api
      .getCreatorDashboard()
      .then(setStats)
      .catch((error) => {
        console.error("Failed to load creator dashboard mock data", error);
      });
  }, []);

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
    });

    setShowUploadToast(true);
    setTimeout(() => setShowUploadToast(false), 3000);

    return result;
  };

  return (
    <>
      <PublishContentPage dashboardStats={stats} handleUpload={handleUpload} />
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
