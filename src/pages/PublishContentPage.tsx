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
  const { data: allCreators = [] } = useGetAllCreators();

  const creators: ContentCreator[] = currentAccount?.address
    ? allCreators.filter((creator) => sameAddress(creator.owner, currentAccount.address))
    : [];

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

  const selectedCreator = creators[0] ?? null;
  const selectedCreatorId = selectedCreator?.id ?? "";

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
    <div className="max-w-5xl mx-auto animate-in fade-in">
      <div className="mb-4 rounded-[20px] border border-white/30 bg-[rgba(255,255,255,0.9)] px-4 py-3 shadow-[0_10px_24px_rgba(2,6,23,0.18)] backdrop-blur-sm md:px-5">
        <h1 className="flex items-center gap-2 text-xl font-black tracking-tight text-[#0f172a]">
          <LayoutGrid className="w-6 h-6 text-cyan-700" />
          Publier un post
        </h1>
        <p className="mt-1 text-xs text-slate-700">Compose, chiffre et publie.</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
            Createur actif: {selectedCreator?.pseudo || "Aucun profil createur"}
          </span>
          <span
            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
              isUploadInProgress
                ? "border-cyan-300 bg-cyan-50 text-cyan-700"
                : "border-emerald-300 bg-emerald-50 text-emerald-700"
            }`}
          >
            {isUploadInProgress ? "Chiffrement en cours" : "Pret a publier"}
          </span>
        </div>
        {creators.length === 0 && (
          <p className="mt-2 text-xs text-amber-700">Creez d'abord votre profil createur avec ce wallet pour publier du contenu.</p>
        )}
      </div>

      {dashboardStats && (
        <div className="grid grid-cols-1 gap-3 mb-6 sm:grid-cols-2">
          <Card className="p-3 border-[rgba(15,23,42,0.12)] shadow-lg">
            <p className="text-xs text-slate-500">Revenue (mock)</p>
            <p className="text-lg font-semibold text-slate-900">{dashboardStats.revenue}</p>
          </Card>
          <Card className="p-3 border-[rgba(15,23,42,0.12)] shadow-lg">
            <p className="text-xs text-slate-500">Abonnes (mock)</p>
            <p className="text-lg font-semibold text-slate-900">{dashboardStats.subscribersCount}</p>
          </Card>
        </div>
      )}

      <div className="flex justify-center">
        <Card className="w-full max-w-4xl pt-3 border-[rgba(15,23,42,0.14)] shadow-[0_14px_32px_rgba(2,6,23,0.22)]">
          <CardContent className="p-4 space-y-4 md:p-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <label className="block mb-1 text-sm font-semibold text-slate-800">Titre (optionnel)</label>
                  <input
                    type="text"
                    className="w-full p-2.5 transition-all border rounded-xl outline-none bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:border-cyan-400/60 border-slate-200 focus:ring-cyan-500/30"
                    placeholder="Ex: Nouvel update..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block mb-1 text-sm font-semibold text-slate-800">Texte du post (optionnel)</label>
                  <textarea
                    className="w-full h-20 p-2.5 transition-all border rounded-xl outline-none resize-none bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:border-cyan-400/60 border-slate-200 focus:ring-cyan-500/30"
                    placeholder="Ecrivez le contenu de votre post..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  ></textarea>
                </div>

                <div className="flex items-center gap-2 px-3 py-2 text-xs rounded-xl bg-cyan-50 text-cyan-800 border border-cyan-200">
                  <Upload className="w-4 h-4 text-cyan-700" />
                  <span>Les medias sont chiffres avant publication.</span>
                </div>

                <Button
                  variant="accent"
                  className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500 shadow-lg shadow-cyan-500/25"
                  onClick={handleSubmitClick}
                  disabled={isUploadInProgress || creators.length === 0}
                >
                  Publier le post
                </Button>
              </div>

              <div className="space-y-3">
                <label
                  className={`flex min-h-[150px] flex-col items-center justify-center gap-2 p-4 transition-all border-2 border-dashed rounded-xl group ${
                    !selectedCreatorId || isUploadInProgress
                      ? "cursor-not-allowed border-slate-200 bg-slate-100/80 opacity-70"
                      : "cursor-pointer border-slate-300 bg-slate-50 hover:bg-white hover:border-cyan-400/60"
                  }`}
                >
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleMediaChange("image")}
                    disabled={!selectedCreatorId || isUploadInProgress}
                  />
                  <div className="text-center">
                    <div className="inline-block p-2 mb-1 transition-colors rounded-full bg-white border border-slate-200 group-hover:border-cyan-300">
                      <ImageIcon className="w-5 h-5 text-slate-600 group-hover:text-cyan-700 transition-colors" />
                    </div>
                    <p className="text-sm font-semibold text-slate-800">
                      {uploadingMedia === "image" ? "Chiffrement image..." : "Ajouter une image"}
                    </p>
                    {imageUpload && (
                      <p className="mt-1 text-xs text-slate-700">
                        <span className="font-semibold text-cyan-700">{imageUpload.fileName}</span>
                      </p>
                    )}
                  </div>
                </label>

                <label
                  className={`flex min-h-[150px] flex-col items-center justify-center gap-2 p-4 transition-all border-2 border-dashed rounded-xl group ${
                    !selectedCreatorId || isUploadInProgress
                      ? "cursor-not-allowed border-slate-200 bg-slate-100/80 opacity-70"
                      : "cursor-pointer border-slate-300 bg-slate-50 hover:bg-white hover:border-cyan-400/60"
                  }`}
                >
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={handleMediaChange("video")}
                    disabled={!selectedCreatorId || isUploadInProgress}
                  />
                  <div className="text-center">
                    <div className="inline-block p-2 mb-1 transition-colors rounded-full bg-white border border-slate-200 group-hover:border-cyan-300">
                      <Video className="w-5 h-5 text-slate-600 group-hover:text-cyan-700 transition-colors" />
                    </div>
                    <p className="text-sm font-semibold text-slate-800">
                      {uploadingMedia === "video" ? "Chiffrement video..." : "Ajouter une video"}
                    </p>
                    {videoUpload && (
                      <p className="mt-1 text-xs text-slate-700">
                        <span className="font-semibold text-cyan-700">{videoUpload.fileName}</span>
                      </p>
                    )}
                  </div>
                </label>
              </div>
            </div>

            <div>
              {hasTriedSubmit && !hasPostPayload && (
                <p className="mt-1 text-xs text-red-600">Ajoutez du texte, une image ou une video avant de publier.</p>
              )}
              {formError && <p className="mt-1 text-xs text-red-600">{formError}</p>}
              {walrusError && <p className="mt-1 text-xs text-red-600">{walrusError}</p>}

              {(suiDigest || imageUpload || videoUpload) && (
                <div className="mt-3 space-y-1.5 text-xs text-slate-700">
                  {suiDigest && (
                    <>
                      <div className="font-mono break-all">
                        <span className="font-semibold text-slate-900">Sui digest:</span> {suiDigest}
                      </div>
                      <a
                        href={`https://testnet.suivision.xyz/txblock/${suiDigest}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-700 hover:text-cyan-800 hover:underline"
                      >
                        Voir la transaction Sui dans Suivision
                      </a>
                    </>
                  )}

                  {imageUpload && (
                    <div className="font-mono break-all">
                      <span className="font-semibold text-slate-900">Image blobId:</span> {imageUpload.blobId}
                    </div>
                  )}

                  {videoUpload && (
                    <div className="font-mono break-all">
                      <span className="font-semibold text-slate-900">Video blobId:</span> {videoUpload.blobId}
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
