import React from "react";
import { ConnectButton } from "@mysten/dapp-kit";
import { Play } from "lucide-react";

export const ConnectWalletView: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-12 relative overflow-hidden">
      {/* Background Blobs */}
      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>
      <div className="blob blob-3"></div>

      <div className="flex flex-col items-center w-full max-w-md gap-6 p-8 text-center glass-panel border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl shadow-lg shadow-indigo-500/30">
          <Play className="w-8 h-8 text-white fill-current" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white">Connectez votre wallet Sui</h1>
          <p className="text-slate-300">Pour accéder à la plateforme et publier du contenu, veuillez connecter votre wallet Sui sécurisé.</p>
        </div>
        <div className="w-full flex justify-center py-2">
          <ConnectButton />
        </div>
        <p className="text-xs text-slate-400">Aucun wallet ? Installez-en un compatible avec Sui (ex: Ethos, Sui Wallet) puis revenez ici.</p>
      </div>
    </div>
  );
};
