import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { CreatorProfilePage } from "@pages/CreatorProfilePage";
import { useUserSubscriptions } from "@hooks/useUserSubscriptions";
import { useSubscribeToCreator } from "@hooks/useSubscribeToCreator";
import { mapCreatorToProfile } from "@mappers/mapCreatorToProfile";
import type { Creator } from "@models/domain";
import type { ContentCreator } from "@models/creators";
import type { CreatorContent } from "@models/content";

type CreatorRouteState = {
  creator?: ContentCreator;
  premappedCreator?: Creator;
} | null;

export function CreatorRouteWrapper() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { subscriptions, refetch: refetchSubscriptions } = useUserSubscriptions();
  const { subscribeToCreator, isSubscribing, error: subscribeHookError } = useSubscribeToCreator();
  const [subscribeActionError, setSubscribeActionError] = useState<string | null>(null);
  const state = location.state as CreatorRouteState;

  const activeCreator: Creator | null = (() => {
    if (state?.premappedCreator) return state.premappedCreator;
    if (state?.creator) return mapCreatorToProfile(state.creator);
    if (id) return null;
    return null;
  })();

  const isSubscribed = activeCreator
    ? subscriptions.some((sub) => sub.creatorId.toLowerCase() === activeCreator.id.toLowerCase())
    : false;

  const handleSubscribe = async () => {
    if (!activeCreator) return;
    setSubscribeActionError(null);
    try {
      await subscribeToCreator({ creatorId: activeCreator.id });
      await refetchSubscriptions();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Echec de l'abonnement";
      setSubscribeActionError(message);
    }
  };

  const goToContent = (content: CreatorContent) => {
    navigate(`/app/content/${content.id}`, {
      state: { content, creatorId: activeCreator?.id },
    });
  };

  if (!activeCreator) {
    return <div className="p-8 text-center text-slate-400">Chargement du createur... ou donnees manquantes.</div>;
  }

  return (
    <CreatorProfilePage
      activeCreator={activeCreator}
      isSubscribed={isSubscribed}
      isSubscribing={isSubscribing}
      handleSubscribe={handleSubscribe}
      subscribeError={subscribeActionError ?? subscribeHookError}
      goToContent={goToContent}
    />
  );
}
