import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { GoutteFeed } from "@ui";
import { useGetMyCreators } from "@hooks/useGetMyCreators";
import type { ContentCreator } from "@models/creators";
import type { GoutteFeedPost } from "@ui/GoutteFeed/types";

interface MyCreatorsPageProps {
  goToCreator: (creator: ContentCreator) => void;
}

export function MyCreatorsPage({ goToCreator }: MyCreatorsPageProps) {
  const { data: creators = [], isLoading, error } = useGetMyCreators();
  const creatorsById = useMemo(() => new Map(creators.map((creator) => [creator.id, creator])), [creators]);
  const creatorPosts = useMemo<GoutteFeedPost[]>(
    () =>
      creators.map((creator, index) => ({
        id: creator.id,
        author: creator.pseudo || "Createur",
        handle: `@${creator.owner.slice(0, 6)}...${creator.owner.slice(-4)}`,
        avatar: creator.image_url || "https://avatar.iran.liara.run/public",
        description: creator.description || "Ce createur n'a pas encore ajoute de description.",
        media: {
          type: "image",
          src: creator.image_url || "/images/image_placeholder.jpg",
          alt: `Profil de ${creator.pseudo || "createur"}`,
        },
        accent: index % 2 === 0 ? "#22d3ee" : "#f59e0b",
        creatorId: creator.id,
      })),
    [creators]
  );

  return (
    <div className="space-y-8">
      <section className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Mes Abonnements</h1>
          <p className="mt-1 text-slate-300">Retrouvez ici les créateurs que vous soutenez.</p>
        </div>
      </section>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        </div>
      ) : error ? (
        <div className="py-12 text-center text-red-400">Impossible de charger vos abonnements pour le moment.</div>
      ) : creators.length === 0 ? (
        <div className="py-12 text-center text-slate-400">Vous n'êtes abonné à aucun créateur pour le moment.</div>
      ) : (
        <GoutteFeed
          posts={creatorPosts}
          maxWidth={1400}
          enableFocus={false}
          showHint={false}
          onPostClick={(post) => {
            const creatorId = String(post.creatorId ?? post.id);
            const creator = creatorsById.get(creatorId);
            if (creator) goToCreator(creator);
          }}
        />
      )}
    </div>
  );
}
