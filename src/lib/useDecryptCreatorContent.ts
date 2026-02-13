import { useState, useCallback, useEffect } from "react";
import { useCurrentAccount, useSignPersonalMessage, useSuiClient } from "@mysten/dapp-kit";
import type { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { fromHex, SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import { SealClient, SessionKey, NoAccessError, EncryptedObject } from "@mysten/seal";
import { ContentCreatorpackageId } from "./package_id";

// Cache SessionKey across component mounts to avoid multiple sign-personal-message prompts,
// especially under React.StrictMode where effects may run twice.
let cachedSessionKey: SessionKey | null = null;
let cachedSessionKeyAddress: string | null = null;
let cachedSessionKeyPackageId: string | null = null;
let sessionKeyInitPromise: Promise<SessionKey> | null = null;

type DecryptArgs = {
  blobId: string;
  creatorId: string;
};

type UseDecryptCreatorContentReturn = {
  videoUrl: string | null;
  isDecrypting: boolean;
  error: string | null;
  decryptContent: (args: DecryptArgs) => Promise<string | null>;
};

const TTL_MIN = 10;

/**
 * Hook to download and decrypt a single creator content blob from Walrus using Seal.
 *
 * Flow:
 * 1. Ensure a valid `SessionKey` for the current wallet and `ContentCreatorpackageId`.
 * 2. Find a `Subscription` for the given `creatorId` owned by the current wallet.
 * 3. Build a Move call to `${ContentCreatorpackageId}::content_creator::seal_approve`.
 * 4. Download the encrypted blob from Walrus, fetch decryption keys via Seal, then decrypt.
 * 5. Expose a `video/mp4` object URL to be used as the video source.
 */
export const useDecryptCreatorContent = (): UseDecryptCreatorContentReturn => {
  const suiClient = useSuiClient() as SuiClient;
  const currentAccount = useCurrentAccount();
  const { mutate: signPersonalMessage } = useSignPersonalMessage();

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clean up any existing object URL when it changes or when the hook unmounts
  useEffect(() => {
    return () => {
      if (videoUrl) {
        console.debug("[DecryptContent] Revoking previous video URL");
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  const decryptContent = useCallback(
    async ({ blobId, creatorId }: DecryptArgs): Promise<string | null> => {
      console.debug("[DecryptContent] Start", { blobId, creatorId });

      if (!currentAccount?.address) {
        const msg = "Wallet non connectée.";
        setError(msg);
        throw new Error(msg);
      }

      if (!blobId || !creatorId) {
        const msg = "Paramètres invalides pour le déchiffrement du contenu.";
        setError(msg);
        throw new Error(msg);
      }

      const suiAddress = currentAccount.address;

      setIsDecrypting(true);
      setError(null);
      setVideoUrl(null);
      console.debug("[DecryptContent] Using wallet address", suiAddress);

      const serverObjectIds = [
        "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
        "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8",
      ];

      const sealClient = new SealClient({
        suiClient,
        serverConfigs: serverObjectIds.map((id) => ({
          objectId: id,
          weight: 1,
        })),
        verifyKeyServers: false,
      });

      try {
        // 1) Ensure we have a valid SessionKey for this wallet + package
        console.debug("[DecryptContent] Ensuring SessionKey for package", ContentCreatorpackageId);
        let sessionKey = cachedSessionKey;

        const needsNewSessionKey =
          !sessionKey || sessionKey.isExpired() || cachedSessionKeyAddress !== suiAddress || cachedSessionKeyPackageId !== ContentCreatorpackageId;

        if (needsNewSessionKey) {
          console.debug("[DecryptContent] Creating or reusing SessionKey init promise");

          if (!sessionKeyInitPromise) {
            sessionKeyInitPromise = (async () => {
              console.debug("[DecryptContent] Creating new SessionKey");
              const key = await SessionKey.create({
                address: suiAddress,
                packageId: ContentCreatorpackageId,
                ttlMin: TTL_MIN,
                suiClient,
              });

              // Sign the personal message to authorize the session key
              await new Promise<void>((resolve, reject) => {
                signPersonalMessage(
                  {
                    message: key.getPersonalMessage(),
                  },
                  {
                    onSuccess: async (result) => {
                      console.debug("[DecryptContent] Personal message signed for SessionKey");
                      try {
                        await key.setPersonalMessageSignature(result.signature);
                        console.debug("[DecryptContent] SessionKey signature set");
                        resolve();
                      } catch (err) {
                        console.error("[DecryptContent] Failed to set SessionKey signature", err);
                        reject(err);
                      }
                    },
                    onError: (err) => {
                      console.error("[DecryptContent] Error while signing personal message", err);
                      reject(err as Error);
                    },
                  }
                );
              });

              cachedSessionKey = key;
              cachedSessionKeyAddress = suiAddress;
              cachedSessionKeyPackageId = ContentCreatorpackageId;

              return key;
            })().finally(() => {
              // Allow re-initialisation later if needed (e.g. after expiration)
              sessionKeyInitPromise = null;
            });
          }
          sessionKey = await sessionKeyInitPromise;
        }

        if (!sessionKey) {
          throw new Error("SessionKey non initialisée.");
        }

        // 2) Find a Subscription object for this creator owned by the current wallet
        console.debug("[DecryptContent] Fetching subscriptions for user", {
          owner: suiAddress,
          creatorId,
        });
        const subsResponse = await suiClient.getOwnedObjects({
          owner: suiAddress,
          options: {
            showContent: true,
            showType: true,
          },
          filter: {
            StructType: `${ContentCreatorpackageId}::content_creator::Subscription`,
          },
        });

        type SubscriptionInfo = {
          id: string;
          createdAt: bigint;
          creatorId: string;
        };

        const subs = subsResponse.data
          .map((obj) => {
            const fields = (obj.data?.content as { fields: any } | null)?.fields;
            if (!fields) return null;
            return {
              id: fields.id.id as string,
              createdAt: BigInt(fields.created_at as string),
              creatorId: fields.creator_id as string,
            } as SubscriptionInfo;
          })
          .filter((sub): sub is SubscriptionInfo => !!sub && sub.creatorId === creatorId);

        if (subs.length === 0) {
          console.warn("[DecryptContent] No subscription found for creator", creatorId);
          const msg = "Aucun abonnement valide trouvé pour ce créateur.";
          setError(msg);
          throw new Error(msg);
        }

        // Pick the most recent subscription (highest createdAt)
        const subscription = subs.reduce((latest, sub) => (sub.createdAt > latest.createdAt ? sub : latest));

        const subscriptionId = subscription.id;
        console.debug("[DecryptContent] Selected subscription", subscription);

        // 3) Construct the Move call for seal_approve
        const constructMoveCall = (tx: Transaction, id: string) => {
          console.debug("[DecryptContent] Constructing seal_approve Move call", {
            encryptedId: id,
            subscriptionId,
            creatorId,
          });
          tx.moveCall({
            target: `${ContentCreatorpackageId}::content_creator::seal_approve`,
            arguments: [tx.pure.vector("u8", fromHex(id)), tx.object(subscriptionId), tx.object(creatorId), tx.object(SUI_CLOCK_OBJECT_ID)],
          });
        };

        // 4) Download the encrypted blob from a Walrus aggregator
        const aggregators = ["aggregator1", "aggregator2", "aggregator3", "aggregator4", "aggregator5", "aggregator6"];

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const randomAggregator = aggregators[Math.floor(Math.random() * aggregators.length)];
        const aggregatorUrl = `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${blobId}`;

        console.debug("[DecryptContent] Downloading encrypted blob from Walrus", {
          aggregator: randomAggregator,
          url: aggregatorUrl,
        });

        const response = await fetch(aggregatorUrl, { signal: controller.signal });
        clearTimeout(timeout);

        if (!response.ok) {
          const msg = "Impossible de récupérer le fichier chiffré depuis Walrus. Veuillez réessayer.";
          console.error("[DecryptContent] Walrus download failed", {
            status: response.status,
            statusText: response.statusText,
          });
          setError(msg);
          throw new Error(msg);
        }

        const encryptedBuffer = await response.arrayBuffer();
        const encryptedBytes = new Uint8Array(encryptedBuffer);

        // Parse encrypted object to obtain its Walrus/Seal id
        const encryptedObject = EncryptedObject.parse(encryptedBytes);
        const encryptedId = encryptedObject.id;
        console.debug("[DecryptContent] Encrypted object parsed", { encryptedId });

        // 5) Fetch decryption keys via Seal (using seal_approve Move call)
        const tx = new Transaction();
        constructMoveCall(tx, encryptedId);
        const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });

        try {
          await sealClient.fetchKeys({
            ids: [encryptedId],
            txBytes,
            sessionKey,
            threshold: 2,
          });
          console.debug("[DecryptContent] Decryption keys fetched via Seal");
        } catch (err) {
          const msg = err instanceof NoAccessError ? "Aucun accès aux clés de déchiffrement." : "Impossible de récupérer les clés de déchiffrement.";
          console.error(msg, err);
          setError(msg);
          throw err;
        }

        // 6) Decrypt the file locally and expose as a video/mp4 URL
        try {
          console.debug("[DecryptContent] Decrypting file locally");
          const decrypted = await sealClient.decrypt({
            data: encryptedBytes,
            sessionKey,
            txBytes,
          });

          const blob = new Blob([decrypted.buffer as ArrayBuffer], { type: "video/mp4" });
          const url = URL.createObjectURL(blob);
          console.debug("[DecryptContent] Video decrypted, object URL created");
          setVideoUrl(url);
          return url;
        } catch (err) {
          const msg = err instanceof NoAccessError ? "Aucun accès aux clés de déchiffrement." : "Impossible de déchiffrer cette vidéo.";
          console.error(msg, err);
          setError(msg);
          throw err;
        }
      } finally {
        console.debug("[DecryptContent] Finished", { blobId, creatorId });
        setIsDecrypting(false);
      }
    },
    [currentAccount?.address, signPersonalMessage, suiClient]
  );

  return {
    videoUrl,
    isDecrypting,
    error,
    decryptContent,
  };
};
