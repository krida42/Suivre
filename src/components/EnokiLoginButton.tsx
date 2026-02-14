import { LogOut, ShieldCheck } from "lucide-react";
import { Button } from "./Button";
import { useEnokiAuth } from "../context/EnokiAuthContext";

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export const EnokiLoginButton = () => {
  const { accountAddress, isAuthLoading, loginWithGoogle, logout } = useEnokiAuth();

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error("Google zkLogin failed:", error);
      alert("Connexion Google échouée: " + (error as Error).message);
    }
  };

  const handleDisconnect = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Disconnect failed:", error);
    }
  };

  if (accountAddress) {
    return (
      <div className="flex items-center gap-2">
        <div className="hidden md:flex items-center gap-1 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-1">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>zkLogin {shortenAddress(accountAddress)}</span>
        </div>
        <Button variant="outline" className="h-9 px-3" onClick={handleDisconnect}>
          <LogOut className="w-4 h-4 mr-1" />
          Déconnexion
        </Button>
      </div>
    );
  }

  return (
    <Button variant="primary" className="h-9 px-4" onClick={handleGoogleLogin} disabled={isAuthLoading}>
      {isAuthLoading ? "Connexion..." : "Google zkLogin"}
    </Button>
  );
};
