import { useMemo, useState } from "react";
import { AtSign } from "lucide-react";
import { Button } from "./Button";
import { registerSuiNsAPI } from "../lib/backendApi";

type SuiNsOnboardingModalProps = {
  open: boolean;
  address: string | null;
  onClose: () => void;
  onCompleted: (primaryName: string | null) => void;
};

const HANDLE_PATTERN = /^[a-z0-9]{2,20}@[0-9]{3}$/;

export const SuiNsOnboardingModal = ({ open, address, onClose, onCompleted }: SuiNsOnboardingModalProps) => {
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedHandle = useMemo(() => handle.trim().toLowerCase(), [handle]);
  const isValidHandle = HANDLE_PATTERN.test(normalizedHandle);

  if (!open || !address) {
    return null;
  }

  const submit = async () => {
    setError(null);

    if (!isValidHandle) {
      setError("Format invalide. Utilise: nom@123");
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await registerSuiNsAPI(address, normalizedHandle);
      onCompleted(result.primaryName);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de créer le SuiNS");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md p-6 border rounded-2xl bg-slate-900 border-white/10 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/20">
            <AtSign className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Choisis ton SuiNS</h2>
            <p className="mt-1 text-sm text-slate-300">Première connexion détectée. Choisis un nom au format `nom@123`.</p>
          </div>
        </div>

        <div className="mt-5">
          <label className="block mb-2 text-xs font-medium text-slate-300">Nom SuiNS</label>
          <input
            type="text"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="alex@123"
            className="w-full px-3 py-2 text-sm border rounded-xl bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            autoFocus
          />
          <p className="mt-1 text-xs text-slate-400">2-20 caractères alphanumériques, puis `@` et 3 chiffres.</p>
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 mt-6">
          <Button variant="outline" className="h-9 px-4" onClick={onClose} disabled={isSubmitting}>
            Plus tard
          </Button>
          <Button variant="primary" className="h-9 px-4" onClick={submit} disabled={!isValidHandle || isSubmitting}>
            {isSubmitting ? "Création..." : "Créer mon SuiNS"}
          </Button>
        </div>
      </div>
    </div>
  );
};
