import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button, Card, CardContent } from "@ui";
import { useGetAllCreators } from "@hooks/useGetAllCreators";
import type { ContentCreator } from "@models/creators";

interface HomePageProps {
  goToCreator: (creator: ContentCreator) => void;
}

export function HomePage({ goToCreator }: HomePageProps) {
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
        console.error("Erreur lors du chargement des createurs pour la home", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void fetchCreators();

    return () => {
      isMounted = false;
    };
  }, [getCreators]);

  return (
    <div className="space-y-8">
      <section className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Createurs</h1>
          <p className="mt-1 text-slate-300">Decouvrez les createurs dont le compte est deploye sur Sui.</p>
        </div>
      </section>

      {isLoading && creators.length === 0 ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        </div>
      ) : creators.length === 0 ? (
        <div className="py-12 text-center text-slate-400">Aucun createur trouve pour ce wallet.</div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {creators.map((creator) => (
            <Card
              key={creator.id}
              className="transition-all duration-300 cursor-pointer hover:scale-[1.02] hover:shadow-xl hover:shadow-indigo-500/10 border-white/5 hover:border-indigo-500/30 group"
            >
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
                    <h3 className="text-sm font-semibold truncate text-white group-hover:text-indigo-300 transition-colors">
                      {creator.pseudo}
                    </h3>
                    <p className="text-xs truncate text-slate-400">{creator.owner}</p>
                  </div>
                </div>
                <p className="text-sm leading-snug text-slate-300 line-clamp-3">{creator.description}</p>
                <Button
                  variant="outline"
                  className="w-full mt-2 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-500 transition-all"
                  onClick={() => goToCreator(creator)}
                >
                  Voir le profil
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
