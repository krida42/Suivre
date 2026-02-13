import { useLocation, useNavigate } from "react-router-dom";
import { ContentDetailPage } from "@features/content/pages/ContentDetailPage";
import type { CreatorContent } from "@features/content/types";

type ContentRouteState = {
  content?: CreatorContent;
  creatorId?: string;
} | null;

export function ContentRouteWrapper() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as ContentRouteState;

  if (!state?.content) {
    return (
      <div className="p-8 text-center text-slate-400">
        Contenu inaccessible directement. Veuillez passer par la page du createur.
      </div>
    );
  }

  return (
    <ContentDetailPage
      content={state.content}
      creatorId={state.creatorId || ""}
      goBack={() => {
        navigate(-1);
      }}
    />
  );
}
