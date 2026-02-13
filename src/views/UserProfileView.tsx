import React from "react";
import { User as UserIcon, ShieldCheck, Unlock, Play } from "lucide-react";
import { User } from "../types";
import { Badge } from "../components/Badge";
import { Card } from "../components/Card";

interface UserProfileViewProps {
  currentUser: User | null;
  isSubscribed: boolean;
}

export const UserProfileView: React.FC<UserProfileViewProps> = () => {
  return (
    <div className="max-w-3xl mx-auto animate-in fade-in">
      <div className="flex items-center gap-6 mb-8">
        <div className="flex items-center justify-center w-20 h-20 text-3xl font-bold text-white bg-gradient-to-br from-indigo-500 to-violet-600 border-4 border-white/10 rounded-full shadow-lg shadow-indigo-500/30">
          JD
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Jean Dupont</h1>
          <p className="text-slate-400">jean.dupont@exemple.fr</p>
          <div className="flex gap-2 mt-2">
            <Badge variant="default" className="text-indigo-300 bg-indigo-500/20 border border-indigo-500/30">
              Utilisateur Vérifié
            </Badge>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {/* Section: Subscriptions */}
        <section>
          <h2 className="flex items-center gap-2 mb-4 text-lg font-bold text-white">
            <UserIcon className="w-5 h-5 text-indigo-400" /> Abonnements
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Sub 1 */}
            <Card className="flex items-center gap-4 p-4 transition-all cursor-pointer hover:border-indigo-500/50 hover:bg-white/10 glass-panel border-white/10">
              <div className="w-12 h-12 overflow-hidden rounded-full bg-slate-800">
                <img src="https://placehold.co/100x100/6366f1/ffffff" alt="Creator avatar" className="object-cover w-full h-full" />
              </div>
              <div>
                <h4 className="font-semibold text-white">Fake</h4>
                <p className="flex items-center gap-1 text-xs font-medium text-green-400">
                  <ShieldCheck className="w-3 h-3" /> Abonnement Actif
                </p>
              </div>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
};

