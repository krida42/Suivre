import { useState } from "react";
import type { FormEvent } from "react";
import { User, Loader2, CheckCircle2 } from "lucide-react";
import { useSignAndExecuteTransaction, useSignTransaction, useSuiClient, ConnectButton } from "@mysten/dapp-kit";
import type { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { Button } from "@ui";
import { ALL_CREATOR_OBJECT_ID, CONTENT_CREATOR_PACKAGE_ID } from "@config/chain";
import { useEnokiAuth } from "@context/EnokiAuthContext";
import { useActiveAddress } from "@hooks/useActiveAddress";
import { executeTransactionWithOptionalSponsor } from "@utils/sui/sponsoredTransactions";
import { parseSuiToMist } from "@utils/sui/amount";

export function CreateCreatorPage() {
  const { address: activeAddress, isZkLoginConnected } = useActiveAddress();
  const { signSponsoredTransaction } = useEnokiAuth();
  const suiClient = useSuiClient() as SuiClient;
  const { mutate: signTransaction } = useSignTransaction();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [subscribePrice, setSubscribePrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [submitStep, setSubmitStep] = useState<"idle" | "transaction">("idle");
  const [txDigest, setTxDigest] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isSubmitting = submitStep !== "idle";

  const createCreatorOnBlockchain = async ({
    nextName,
    nextDescription,
    nextSubscribePrice,
    blobId,
  }: {
    nextName: string;
    nextDescription: string;
    nextSubscribePrice: string;
    blobId: string;
  }): Promise<string> => {
    if (!activeAddress) {
      throw new Error("Compte non connecte.");
    }

    const amountInMist = parseSuiToMist(nextSubscribePrice);
    if (amountInMist === null) {
      throw new Error("Le prix doit etre un nombre valide (jusqu'a 9 decimales).");
    }

    const tx = new Transaction();

    tx.moveCall({
      target: `${CONTENT_CREATOR_PACKAGE_ID}::content_creator::new`,
      arguments: [
        tx.object(ALL_CREATOR_OBJECT_ID),
        tx.pure.string(nextName.trim()),
        tx.pure.u64(amountInMist),
        tx.pure.string(nextDescription.trim()),
        tx.pure.string(blobId.trim()),
      ],
    });

    const result = await executeTransactionWithOptionalSponsor({
      operation: "CREATE_CREATOR_PROFILE",
      transaction: tx,
      client: suiClient,
      sender: activeAddress,
      signSponsoredTransaction: isZkLoginConnected ? signSponsoredTransaction : undefined,
      signTransactionMutate: signTransaction,
      signAndExecuteTransactionMutate: signAndExecuteTransaction as unknown as (
        variables: { transaction: Transaction },
        callbacks: {
          onSuccess: (result: { digest: string }) => void;
          onError: (error: unknown) => void;
        }
      ) => void,
      allowedMoveCallTargets: [`${CONTENT_CREATOR_PACKAGE_ID}::content_creator::new`],
    });

    if (!result.digest) {
      throw new Error("Digest de transaction manquant.");
    }

    return result.digest;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    setSubmitError(null);

    if (!imageUrl.trim()) {
      setSubmitError("Veuillez saisir une URL d'image.");
      return;
    }

    try {
      setSubmitStep("transaction");
      const digest = await createCreatorOnBlockchain({
        nextName: name,
        nextDescription: description,
        nextSubscribePrice: subscribePrice,
        blobId: imageUrl,
      });
      setTxDigest(digest);
    } catch (err) {
      console.error("Error while creating creator profile", err);
      setSubmitError(err instanceof Error ? err.message : "Erreur lors de la creation sur la blockchain.");
    } finally {
      setSubmitStep("idle");
    }
  };

  return (
    <div className="max-w-xl mx-auto duration-300 animate-in fade-in">
      <div className="rounded-3xl border border-[#2a3344] bg-[rgba(7,11,18,0.86)] p-8 shadow-[0_22px_50px_rgba(0,0,0,0.45)] backdrop-blur-lg">
          <div className="mb-8 text-center">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 text-white bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-full shadow-lg shadow-emerald-600/30">
              <User className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-[#f8f5ef]">Devenir Createur</h1>
            <p className="mt-2 text-[#d8d2c4]">Configurez votre profil de createur pour commencer a publier.</p>
          </div>

          {txDigest ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center">
              <div className="flex items-center justify-center w-16 h-16 mb-2 text-emerald-300 bg-emerald-500/20 rounded-full">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-semibold text-[#f8f5ef]">Compte createur cree avec succes</h2>
              <p className="text-sm text-[#c8c1b2]">Votre transaction a ete confirmee sur la blockchain Sui.</p>
              <div className="w-full max-w-md p-3 mt-2 font-mono text-xs break-all border rounded-xl bg-[#0a1220] border-[#2a3547] text-[#e2ddcf]">
                <span className="font-semibold text-[#f8f5ef]">Digest:</span> {txDigest}
              </div>
              <a
                href={`https://testnet.suivision.xyz/txblock/${txDigest}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 text-sm font-medium text-emerald-300 hover:text-emerald-200 hover:underline"
              >
                Voir la transaction dans Suivision
              </a>
              {imageUrl && (
                <a
                  href={imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-emerald-300 hover:text-emerald-200 hover:underline"
                >
                  Voir l'image
                </a>
              )}
            </div>
          ) : !activeAddress ? (
            <div className="flex flex-col items-center justify-center p-6 space-y-4 text-center border-2 border-dashed rounded-xl bg-[#0a1220] border-[#2a3547]">
              <p className="text-[#ddd6c8]">Veuillez connecter un wallet Sui ou zkLogin pour continuer</p>
              <ConnectButton />
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label className="block mb-2 text-sm font-medium text-[#efe9dc]">URL de l'image / Avatar</label>
                <div className="flex items-center gap-4">
                  <div className="relative flex items-center justify-center w-20 h-20 overflow-hidden border-2 border-dashed rounded-full bg-[#0a1220] border-[#334155]">
                    {imageUrl ? (
                      <img src={imageUrl} alt="Avatar" className="object-cover w-full h-full" />
                    ) : (
                      <span className="px-2 text-xs text-center text-[#9aa7ba]">Apercu</span>
                    )}
                  </div>
                  <input
                    type="url"
                    className="flex-1 w-full p-2 border rounded-xl outline-none bg-[#0a1220] border-[#334155] text-[#f8f5ef] placeholder:text-[#7f8ca1] focus:ring-2 focus:ring-emerald-500/60 focus:border-transparent transition-all"
                    placeholder="https://exemple.com/mon-image.jpg"
                    required
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium text-[#efe9dc]">Nom du Createur</label>
                <input
                  type="text"
                  className="w-full p-2 border rounded-xl outline-none bg-[#0a1220] border-[#334155] text-[#f8f5ef] placeholder:text-[#7f8ca1] focus:ring-2 focus:ring-emerald-500/60 focus:border-transparent transition-all"
                  placeholder="Votre nom de scene"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium text-[#efe9dc]">Description</label>
                <textarea
                  className="w-full h-32 p-2 border rounded-xl outline-none resize-none bg-[#0a1220] border-[#334155] text-[#f8f5ef] placeholder:text-[#7f8ca1] focus:ring-2 focus:ring-emerald-500/60 focus:border-transparent transition-all"
                  placeholder="Parlez-nous de votre contenu..."
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                ></textarea>
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium text-[#efe9dc]">Prix de l'abonnement (SUI/mois)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full p-2 pl-10 border rounded-xl outline-none bg-[#0a1220] border-[#334155] text-[#f8f5ef] placeholder:text-[#7f8ca1] focus:ring-2 focus:ring-emerald-500/60 focus:border-transparent transition-all"
                    placeholder="9.99"
                    required
                    value={subscribePrice}
                    onChange={(e) => setSubscribePrice(e.target.value)}
                  />
                  <span className="absolute left-3 top-2 text-[#9aa7ba]">SUI</span>
                </div>
                <p className="mt-1 text-xs text-[#9aa7ba]">Conversion automatique en MIST pour l'ecriture on-chain.</p>
              </div>

              {submitError && <p className="text-sm text-red-400">{submitError}</p>}

              <div className="pt-4">
                <Button
                  variant="primary"
                  className="w-full py-6 text-lg border-emerald-300/30 shadow-xl shadow-emerald-700/25"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {submitStep === "transaction" ? "Transaction en cours..." : "Creation en cours..."}
                    </span>
                  ) : (
                    "Creer mon compte Createur"
                  )}
                </Button>
              </div>
            </form>
          )}
      </div>
    </div>
  );
}
