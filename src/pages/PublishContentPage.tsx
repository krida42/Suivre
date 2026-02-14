import { useState } from "react";
import type { ChangeEvent } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { LayoutGrid, Upload } from "lucide-react";
import { Button, Card, CardContent } from "@ui";
import { useEncryptAndUploadWalrus } from "@hooks/useEncryptAndUploadWalrus";
import { useGetAllCreators } from "@hooks/useGetAllCreators";
import type { DashboardStats } from "@models/domain";
import type { ContentCreator } from "@models/creators";

interface PublishContentPageProps {
  dashboardStats: DashboardStats | null;
  handleUpload: (payload: {
    title: string;
    description: string;
    blobId: string;
    creatorId: string;
    fileName: string | null;
  }) => Promise<{ digest: string }>;
}

function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

export function PublishContentPage({ dashboardStats, handleUpload }: PublishContentPageProps) {
  const currentAccount = useCurrentAccount();
  const { data: allCreators = [], isLoading: isLoadingCreators, error: creatorsError } = useGetAllCreators();

  const creators: ContentCreator[] = currentAccount?.address
    ? allCreators.filter((creator) => sameAddress(creator.owner, currentAccount.address))
    : [];

  const [manuallySelectedCreatorId, setManuallySelectedCreatorId] = useState("");
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [blobId, setBlobId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [walrusError, setWalrusError] = useState<string | null>(null);
  const [hasTriedSubmit, setHasTriedSubmit] = useState(false);
  const [suiDigest, setSuiDigest] = useState<string | null>(null);
  const { encryptAndUpload, isUploading } = useEncryptAndUploadWalrus();

  const selectedCreatorId =
    manuallySelectedCreatorId && creators.some((creator) => creator.id === manuallySelectedCreatorId)
      ? manuallySelectedCreatorId
      : creators[0]?.id ?? "";

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!selectedCreatorId) {
      setFormError("Aucun createur selectionne pour generer la policy Walrus.");
      return;
    }

    setSelectedFileName(file.name);
    setBlobId(null);
    setWalrusError(null);
    setFormError(null);

    encryptAndUpload(file, selectedCreatorId)
      .then((storageInfo) => {
        const maybeBlobId =
          storageInfo?.info?.newlyCreated?.blobObject?.blobId ??
          storageInfo?.info?.blobObject?.blobId ??
          storageInfo?.info?.blobId;

        if (!maybeBlobId) {
          console.error("Impossible de recuperer blobId depuis Walrus storageInfo", storageInfo);
          setWalrusError("Erreur: impossible de recuperer l'identifiant du fichier chiffre.");
          return;
        }

        setBlobId(maybeBlobId);
      })
      .catch((error) => {
        console.error("Erreur lors de l'encrypt + push Walrus", error);
        setWalrusError("Erreur lors du chiffrement et de l'envoi sur Walrus. Veuillez reessayer.");
      });
  };

  const handleSubmitClick = async () => {
    setHasTriedSubmit(true);
    setFormError(null);

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    if (!trimmedTitle || !trimmedDescription || !blobId) {
      const missing: string[] = [];
      if (!trimmedTitle) missing.push("titre");
      if (!trimmedDescription) missing.push("description");
      if (!blobId) missing.push("fichier chiffre");

      setFormError(`Merci de renseigner: ${missing.join(", ")}.`);
      return;
    }

    if (!selectedCreatorId) {
      setFormError("Veuillez selectionner un createur.");
      return;
    }

    if (isUploading) {
      setFormError("Le fichier est encore en cours de chiffrement. Merci de patienter.");
      return;
    }

    try {
      const result = await handleUpload({
        title: trimmedTitle,
        description: trimmedDescription,
        blobId,
        creatorId: selectedCreatorId,
        fileName: selectedFileName,
      });
      setSuiDigest(result.digest);
    } catch (error) {
      console.error("Erreur lors de la publication de la video", error);
      setFormError("Erreur lors de la publication de la video. Veuillez reessayer.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in">
      <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <LayoutGrid className="w-6 h-6 text-indigo-400" />
            Uploader du contenu
          </h1>
        </div>
        <div className="w-full">
          <label className="block mb-1 text-sm font-medium text-slate-200">Selectionnez votre createur</label>
          <select
            className="w-full p-2 text-sm border rounded-xl outline-none border-white/10 bg-white/5 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/30 disabled:text-slate-500"
            value={selectedCreatorId}
            onChange={(event) => setManuallySelectedCreatorId(event.target.value)}
            disabled={isLoadingCreators || creators.length === 0}
          >
            {isLoadingCreators && <option className="bg-slate-900">Chargement...</option>}
            {!isLoadingCreators && creators.length === 0 && <option className="bg-slate-900">Aucun createur trouve</option>}
            {!isLoadingCreators &&
              creators.map((creator) => (
                <option key={creator.id} value={creator.id} className="bg-slate-900">
                  {creator.pseudo}
                </option>
              ))}
          </select>
          {creatorsError && <p className="mt-1 text-xs text-red-400">Impossible de charger les createurs.</p>}
          {!isLoadingCreators && creators.length === 0 && (
            <p className="mt-1 text-xs text-slate-400">
              Creez d'abord votre profil createur avec ce wallet pour publier du contenu.
            </p>
          )}
        </div>
      </div>

      {dashboardStats && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card className="p-3 border-white/10">
            <p className="text-xs text-slate-400">Revenue (mock)</p>
            <p className="text-lg font-semibold text-white">{dashboardStats.revenue}</p>
          </Card>
          <Card className="p-3 border-white/10">
            <p className="text-xs text-slate-400">Abonnes (mock)</p>
            <p className="text-lg font-semibold text-white">{dashboardStats.subscribersCount}</p>
          </Card>
        </div>
      )}

      <div className="flex justify-center">
        <Card className="w-full max-w-2xl pt-6 border-white/10 shadow-xl glass-panel">
          <CardContent className="p-6 space-y-5">
            <div>
              <label className="block mb-1 text-sm font-medium text-slate-200">Titre de la video</label>
              <input
                type="text"
                className={`w-full p-2 border rounded-xl outline-none bg-white/5 text-white placeholder:text-slate-300 focus:ring-2 focus:border-transparent transition-all ${
                  hasTriedSubmit && !title.trim()
                    ? "border-red-500/50 focus:ring-red-500/50"
                    : "border-white/10 focus:ring-indigo-500/50"
                }`}
                placeholder="Ex: Tutoriel Exclusif..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              {hasTriedSubmit && !title.trim() && <p className="mt-1 text-xs text-red-400">Le titre est requis.</p>}
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium text-slate-200">Description</label>
              <textarea
                className={`w-full h-24 p-2 border rounded-xl outline-none resize-none bg-white/5 text-white placeholder:text-slate-300 focus:ring-2 focus:border-transparent transition-all ${
                  hasTriedSubmit && !description.trim()
                    ? "border-red-500/50 focus:ring-red-500/50"
                    : "border-white/10 focus:ring-indigo-500/50"
                }`}
                placeholder="De quoi parle votre video ?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              ></textarea>
              {hasTriedSubmit && !description.trim() && <p className="mt-1 text-xs text-red-400">La description est requise.</p>}
            </div>

            <label className="flex flex-col items-center justify-center gap-4 p-8 transition-all border-2 border-dashed rounded-xl cursor-pointer border-white/10 bg-white/5 hover:bg-white/10 hover:border-indigo-500/30 group">
              <input
                type="file"
                accept="video/mp4,video/quicktime"
                className="hidden"
                onChange={handleFileChange}
                disabled={!selectedCreatorId || isUploading}
              />
              <div className="text-center">
                <div className="p-3 mb-2 rounded-full bg-white/5 group-hover:bg-indigo-500/20 transition-colors inline-block">
                  <Upload className="w-8 h-8 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                </div>
                <p className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
                  {isUploading ? "Chiffrement en cours..." : "Glisser le fichier video ici"}
                </p>
                <p className="text-xs text-slate-400">MP4, MOV jusqu'a 2Go</p>
                {selectedFileName && (
                  <p className="mt-3 text-xs text-slate-300">
                    Fichier selectionne: <span className="font-semibold text-indigo-300">{selectedFileName}</span>
                  </p>
                )}
                {hasTriedSubmit && !blobId && (
                  <p className="mt-1 text-xs text-red-400">
                    Un fichier doit etre selectionne et chiffre avant la mise en ligne.
                  </p>
                )}
                {walrusError && <p className="mt-1 text-xs text-red-400">{walrusError}</p>}
              </div>
            </label>

            <div className="pt-2">
              <Button variant="accent" className="w-full" onClick={handleSubmitClick} disabled={isUploading || creators.length === 0}>
                Mettre en ligne
              </Button>
              {formError && <p className="mt-2 text-xs text-red-400">{formError}</p>}
              {(suiDigest || blobId) && (
                <div className="mt-4 space-y-2 text-xs text-slate-300">
                  {suiDigest && (
                    <>
                      <div className="font-mono break-all">
                        <span className="font-semibold text-slate-200">Sui digest:</span> {suiDigest}
                      </div>
                      <a
                        href={`https://testnet.suivision.xyz/txblock/${suiDigest}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-400 hover:text-indigo-300 hover:underline"
                      >
                        Voir la transaction Sui dans Suivision
                      </a>
                    </>
                  )}
                  {blobId && (
                    <>
                      <div className="font-mono break-all">
                        <span className="font-semibold text-slate-200">Walrus blobId:</span> {blobId}
                      </div>
                      <a
                        href={`https://walruscan.com/testnet/blob/${blobId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-400 hover:text-indigo-300 hover:underline"
                      >
                        Voir le blob sur Walrus (testnet)
                      </a>
                    </>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
