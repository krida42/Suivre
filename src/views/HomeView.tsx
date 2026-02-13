import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "../components/Button";
import { Card, CardContent } from "../components/Card";
import { useGetCreators, ContentCreator } from "../lib/useGetCreators";
import { useGetAllCreators } from "../lib/useGetAllCreators";

interface HomeViewProps {
  goToCreator: (creator: ContentCreator) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ goToCreator }) => {
  const getCreators = useGetAllCreators();
  const [creators, setCreators] = useState<ContentCreator[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchCreators() {
      try {
        setIsLoading(true);
        const data = await getCreators();
        if (!isMounted) return;
        setCreators(data);
      } catch (error) {
        console.error("Erreur lors du chargement des créateurs pour la home", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchCreators();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <section className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Créateurs</h1>
          <p className="mt-1 text-slate-300">Découvrez les créateurs dont le compte est déployé sur Sui.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" className="rounded-full">
            Tous
          </Button>
          <Button variant="outline" className="rounded-full">
            Tech
          </Button>
          <Button variant="outline" className="rounded-full">
            Créateurs vidéo
          </Button>
        </div>
      </section>

      {/* Creators Grid / States */}
      {isLoading && creators.length === 0 ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        </div>
      ) : creators.length === 0 ? (
        <div className="py-12 text-center text-slate-400">Aucun créateur trouvé pour ce wallet.</div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {creators.map((creator) => (
            <Card key={creator.id} className="transition-all duration-300 cursor-pointer hover:scale-[1.02] hover:shadow-xl hover:shadow-indigo-500/10 border-white/5 hover:border-indigo-500/30 group">
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-12 h-12 overflow-hidden rounded-full bg-slate-800 ring-2 ring-white/10 group-hover:ring-indigo-500/50 transition-all">
                    <img
                      src={creator.image_url || "https://avatar.iran.liara.run/public"}
                      alt={creator.pseudo}
                      className="object-cover w-full h-full"
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold truncate text-white group-hover:text-indigo-300 transition-colors">{creator.pseudo}</h3>
                    <p className="text-xs truncate text-slate-400">{creator.owner}</p>
                  </div>
                </div>
                <p className="text-sm leading-snug text-slate-300 line-clamp-3">{creator.description}</p>
                <Button variant="outline" className="w-full mt-2 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-500 transition-all" onClick={() => goToCreator(creator)}>
                  Voir le profil
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
