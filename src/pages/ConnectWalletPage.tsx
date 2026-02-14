import { ConnectButton } from "@mysten/dapp-kit";
import { Play } from "lucide-react";
import { useState } from "react";
import { useEnokiAuth } from "@context/EnokiAuthContext";
import { Button } from "@ui";

export function ConnectWalletPage() {
  const { isConfigured, isAuthLoading, isAuthenticated, accountAddress, loginWithGoogle, logout } = useEnokiAuth();
  const [zkLoginError, setZkLoginError] = useState<string | null>(null);

  const handleZkLogin = async () => {
    setZkLoginError(null);

    try {
      await loginWithGoogle();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Echec de connexion zkLogin.";
      setZkLoginError(message);
    }
  };

  const shortAddress =
    accountAddress && accountAddress.length > 12 ? `${accountAddress.slice(0, 6)}...${accountAddress.slice(-4)}` : accountAddress;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-12 relative overflow-hidden">
      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>
      <div className="blob blob-3"></div>

      <div className="flex flex-col items-center w-full max-w-md gap-6 p-8 text-center glass-panel border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl shadow-lg shadow-indigo-500/30">
          <Play className="w-8 h-8 text-white fill-current" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white">Connectez votre wallet Sui</h1>
          <p className="text-slate-300">
            Pour acceder a la plateforme et publier du contenu, veuillez connecter votre wallet Sui securise.
          </p>
        </div>
        <div className="w-full flex justify-center py-2">
          <ConnectButton />
        </div>
        {isConfigured && (
          <div className="w-full space-y-3">
            {isAuthenticated ? (
              <div className="flex flex-col items-center gap-2">
                <p className="text-xs text-emerald-300">Connecte avec zkLogin ({shortAddress})</p>
                <Button variant="secondary" className="w-full" onClick={() => void logout()}>
                  Se deconnecter de zkLogin
                </Button>
              </div>
            ) : (
              <Button variant="accent" className="w-full" onClick={() => void handleZkLogin()} isLoading={isAuthLoading}>
                Se connecter avec Google zkLogin
              </Button>
            )}
            {zkLoginError && <p className="text-xs text-red-400 text-center">{zkLoginError}</p>}
          </div>
        )}
        <p className="text-xs text-slate-400">
          Aucun wallet ? Utilisez zkLogin ou installez un wallet compatible Sui (ex: Ethos, Sui Wallet).
        </p>
      </div>
    </div>
  );
}
