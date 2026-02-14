import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { ImageIcon, LayoutGrid, Upload, Video } from "lucide-react";
import { Button, Card, CardContent } from "@ui";
import { useEncryptAndUploadWalrus } from "@hooks/useEncryptAndUploadWalrus";
import { useGetAllCreators } from "@hooks/useGetAllCreators";
import type { DashboardStats } from "@models/domain";
import type { ContentCreator } from "@models/creators";

type MediaKind = "image" | "video";

type UploadedMedia = {
  fileName: string;
  blobId: string;
  mimeType: string;
};

interface PublishContentPageProps {
  dashboardStats: DashboardStats | null;
  handleUpload: (payload: {
    title: string;
    text: string;
    imageBlobId: string | null;
    imageMimeType: string | null;
    videoBlobId: string | null;
    videoMimeType: string | null;
    creatorId: string;
  }) => Promise<{ digest: string }>;
}

function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function resolveBlobId(storageInfo: {
  info?: {
    blobId?: string;
    blobObject?: { blobId?: string };
    newlyCreated?: { blobObject?: { blobId?: string } };
  };
}): string | null {
  const maybeBlobId =
    storageInfo?.info?.newlyCreated?.blobObject?.blobId ?? storageInfo?.info?.blobObject?.blobId ?? storageInfo?.info?.blobId;
  return typeof maybeBlobId === "string" && maybeBlobId.trim().length > 0 ? maybeBlobId : null;
}

export function PublishContentPage({ dashboardStats, handleUpload }: PublishContentPageProps) {
  const currentAccount = useCurrentAccount();
  const { data: allCreators = [], isLoading: isLoadingCreators, error: creatorsError } = useGetAllCreators();

  const creators: ContentCreator[] = currentAccount?.address
    ? allCreators.filter((creator) => sameAddress(creator.owner, currentAccount.address))
    : [];

  const [manuallySelectedCreatorId, setManuallySelectedCreatorId] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [imageUpload, setImageUpload] = useState<UploadedMedia | null>(null);
  const [videoUpload, setVideoUpload] = useState<UploadedMedia | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState<MediaKind | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [walrusError, setWalrusError] = useState<string | null>(null);
  const [hasTriedSubmit, setHasTriedSubmit] = useState(false);
  const [suiDigest, setSuiDigest] = useState<string | null>(null);

  const { encryptAndUpload, isUploading } = useEncryptAndUploadWalrus();

  const selectedCreatorId =
    manuallySelectedCreatorId && creators.some((creator) => creator.id === manuallySelectedCreatorId)
      ? manuallySelectedCreatorId
      : creators[0]?.id ?? "";

  useEffect(() => {
    setImageUpload(null);
    setVideoUpload(null);
    setWalrusError(null);
  }, [selectedCreatorId]);

  const isUploadInProgress = isUploading || uploadingMedia !== null;
  const hasText = title.trim().length > 0 || text.trim().length > 0;
  const hasImage = Boolean(imageUpload?.blobId);
  const hasVideo = Boolean(videoUpload?.blobId);
  const hasPostPayload = hasText || hasImage || hasVideo;

  const handleMediaChange = (kind: MediaKind) => async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!selectedCreatorId) {
      setFormError("Aucun createur selectionne pour generer la policy Walrus.");
      return;
    }

    if (kind === "image" && !file.type.startsWith("image/")) {
      setWalrusError("Le fichier selectionne n'est pas une image valide.");
      return;
    }

    if (kind === "video" && !file.type.startsWith("video/")) {
      setWalrusError("Le fichier selectionne n'est pas une video valide.");
      return;
    }

    setFormError(null);
    setWalrusError(null);
    setSuiDigest(null);
    setUploadingMedia(kind);
    if (kind === "image") setImageUpload(null);
    if (kind === "video") setVideoUpload(null);

    try {
      const storageInfo = await encryptAndUpload(file, selectedCreatorId);
      const nextBlobId = resolveBlobId(storageInfo);

      if (!nextBlobId) {
        console.error("Impossible de recuperer blobId depuis Walrus storageInfo", storageInfo);
        setWalrusError("Erreur: impossible de recuperer l'identifiant du fichier chiffre.");
        return;
      }

      const nextUpload: UploadedMedia = {
        fileName: file.name,
        blobId: nextBlobId,
        mimeType: file.type || (kind === "image" ? "application/octet-stream" : "video/mp4"),
      };

      if (kind === "image") {
        setImageUpload(nextUpload);
      } else {
        setVideoUpload(nextUpload);
      }
    } catch (error) {
      console.error("Erreur lors de l'encrypt + push Walrus", error);
      setWalrusError("Erreur lors du chiffrement et de l'envoi sur Walrus. Veuillez reessayer.");
    } finally {
      setUploadingMedia(null);
    }
  };

  const handleSubmitClick = async () => {
    setHasTriedSubmit(true);
    setFormError(null);

    if (!selectedCreatorId) {
      setFormError("Veuillez selectionner un createur.");
      return;
    }

    if (!hasPostPayload) {
      setFormError("Un post doit contenir du texte, une image ou une video.");
      return;
    }

    if (isUploadInProgress) {
      setFormError("Un media est encore en cours de chiffrement. Merci de patienter.");
      return;
    }

    try {
      const result = await handleUpload({
        title: title.trim(),
        text: text.trim(),
        imageBlobId: imageUpload?.blobId ?? null,
        imageMimeType: imageUpload?.mimeType ?? null,
        videoBlobId: videoUpload?.blobId ?? null,
        videoMimeType: videoUpload?.mimeType ?? null,
        creatorId: selectedCreatorId,
      });
      setSuiDigest(result.digest);
    } catch (error) {
      console.error("Erreur lors de la publication du post", error);
      setFormError("Erreur lors de la publication du post. Veuillez reessayer.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in">
      <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <LayoutGrid className="w-6 h-6 text-indigo-400" />
            Publier un post
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
        <Card className="w-full max-w-3xl pt-6 border-white/10 shadow-xl glass-panel">
          <CardContent className="p-6 space-y-5">
            <div>
              <label className="block mb-1 text-sm font-medium text-slate-200">Titre (optionnel)</label>
              <input
                type="text"
                className="w-full p-2 transition-all border rounded-xl outline-none bg-white/5 text-white placeholder:text-slate-300 focus:ring-2 focus:border-transparent border-white/10 focus:ring-indigo-500/50"
                placeholder="Ex: Nouvel update..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="block mb-1 text-sm font-medium text-slate-200">Texte du post (optionnel)</label>
              <textarea
                className="w-full h-28 p-2 transition-all border rounded-xl outline-none resize-none bg-white/5 text-white placeholder:text-slate-300 focus:ring-2 focus:border-transparent border-white/10 focus:ring-indigo-500/50"
                placeholder="Ecrivez le contenu de votre post..."
                value={text}
                onChange={(e) => setText(e.target.value)}
              ></textarea>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="flex flex-col items-center justify-center gap-3 p-6 transition-all border-2 border-dashed rounded-xl cursor-pointer border-white/10 bg-white/5 hover:bg-white/10 hover:border-indigo-500/30 group">
                <input type="file" accept="image/*" className="hidden" onChange={handleMediaChange("image")} disabled={!selectedCreatorId || isUploadInProgress} />
                <div className="text-center">
                  <div className="inline-block p-3 mb-2 transition-colors rounded-full bg-white/5 group-hover:bg-indigo-500/20">
                    <ImageIcon className="w-7 h-7 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                  </div>
                  <p className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
                    {uploadingMedia === "image" ? "Chiffrement image..." : "Ajouter une image"}
                  </p>
                  <p className="text-xs text-slate-400">PNG, JPG, WEBP...</p>
                  {imageUpload && (
                    <p className="mt-2 text-xs text-slate-300">
                      <span className="font-semibold text-indigo-300">{imageUpload.fileName}</span>
                    </p>
                  )}
                </div>
              </label>

              <label className="flex flex-col items-center justify-center gap-3 p-6 transition-all border-2 border-dashed rounded-xl cursor-pointer border-white/10 bg-white/5 hover:bg-white/10 hover:border-indigo-500/30 group">
                <input type="file" accept="video/*" className="hidden" onChange={handleMediaChange("video")} disabled={!selectedCreatorId || isUploadInProgress} />
                <div className="text-center">
                  <div className="inline-block p-3 mb-2 transition-colors rounded-full bg-white/5 group-hover:bg-indigo-500/20">
                    <Video className="w-7 h-7 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                  </div>
                  <p className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
                    {uploadingMedia === "video" ? "Chiffrement video..." : "Ajouter une video"}
                  </p>
                  <p className="text-xs text-slate-400">MP4, MOV, WEBM...</p>
                  {videoUpload && (
                    <p className="mt-2 text-xs text-slate-300">
                      <span className="font-semibold text-indigo-300">{videoUpload.fileName}</span>
                    </p>
                  )}
                </div>
              </label>
            </div>

            <div className="flex items-center gap-2 px-3 py-2 text-xs rounded-xl bg-white/5 text-slate-300 border border-white/10">
              <Upload className="w-4 h-4 text-indigo-300" />
              <span>Les medias (image/video) sont chiffres avant publication via Seal + Walrus.</span>
            </div>

            <div className="pt-2">
              <Button variant="accent" className="w-full" onClick={handleSubmitClick} disabled={isUploadInProgress || creators.length === 0}>
                Publier le post
              </Button>

              {hasTriedSubmit && !hasPostPayload && <p className="mt-2 text-xs text-red-400">Ajoutez du texte, une image ou une video avant de publier.</p>}
              {formError && <p className="mt-2 text-xs text-red-400">{formError}</p>}
              {walrusError && <p className="mt-2 text-xs text-red-400">{walrusError}</p>}

              {(suiDigest || imageUpload || videoUpload) && (
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

                  {imageUpload && (
                    <div className="font-mono break-all">
                      <span className="font-semibold text-slate-200">Image blobId:</span> {imageUpload.blobId}
                    </div>
                  )}

                  {videoUpload && (
                    <div className="font-mono break-all">
                      <span className="font-semibold text-slate-200">Video blobId:</span> {videoUpload.blobId}
                    </div>
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
