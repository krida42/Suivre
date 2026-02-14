import { User as UserIcon, ShieldCheck, Loader2 } from "lucide-react";
import { Badge, Card } from "@ui";
import type { User } from "@models/domain";
import { useGetMyCreators } from "@hooks/useGetMyCreators";
import { useNavigate } from "react-router-dom";

interface AccountPageProps {
  currentUser: User | null;
  isSubscribed: boolean;
}

export function AccountPage({ currentUser }: AccountPageProps) {
  const navigate = useNavigate();
  const { data: creators = [], isLoading } = useGetMyCreators();

  const initials = currentUser?.name
    ? currentUser.name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "JD";

  return (
    <div className="max-w-3xl mx-auto animate-in fade-in">
      <div className="flex items-center gap-6 mb-8">
        <div className="flex items-center justify-center w-20 h-20 text-3xl font-bold text-white bg-gradient-to-br from-indigo-500 to-violet-600 border-4 border-white/10 rounded-full shadow-lg shadow-indigo-500/30">
          {initials}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">{currentUser?.name || "Jean Dupont"}</h1>
          <p className="text-slate-400">{currentUser?.email || "jean.dupont@exemple.fr"}</p>
          <div className="flex gap-2 mt-2">
            <Badge variant="default" className="text-indigo-300 bg-indigo-500/20 border border-indigo-500/30">
              Utilisateur Verifie
            </Badge>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="flex items-center gap-2 mb-4 text-lg font-bold text-white">
            <UserIcon className="w-5 h-5 text-indigo-400" /> Abonnements
          </h2>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
            </div>
          ) : creators.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {creators.map((creator) => (
                <Card
                  key={creator.id}
                  className="flex items-center gap-4 p-4 transition-all cursor-pointer hover:border-indigo-500/50 hover:bg-white/10 glass-panel border-white/10"
                  onClick={() => navigate(`/app/creator/${creator.id}`)}
                >
                  <div className="w-12 h-12 overflow-hidden rounded-full bg-slate-800">
                    <img
                      src={creator.image_url || "https://avatar.iran.liara.run/public"}
                      alt={creator.pseudo}
                      className="object-cover w-full h-full"
                    />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">{creator.pseudo}</h4>
                    <p className="flex items-center gap-1 text-xs font-medium text-green-400">
                      <ShieldCheck className="w-3 h-3" /> Abonné
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center border rounded-lg border-white/10 bg-white/5 text-slate-400">
              Aucun abonnement actif.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
