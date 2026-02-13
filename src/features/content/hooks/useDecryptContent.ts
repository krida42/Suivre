import { useState, useCallback, useEffect } from "react";
import { useCurrentAccount, useSignPersonalMessage, useSuiClient } from "@mysten/dapp-kit";
import type { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { fromHex, SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import { SealClient, SessionKey, NoAccessError, EncryptedObject } from "@mysten/seal";
import { CONTENT_CREATOR_PACKAGE_ID } from "@shared/config/chain";

let cachedSessionKey: SessionKey | null = null;
let cachedSessionKeyAddress: string | null = null;
let cachedSessionKeyPackageId: string | null = null;
let sessionKeyInitPromise: Promise<SessionKey> | null = null;

type DecryptArgs = {
  blobId: string;
  creatorId: string;
};

type UseDecryptContentReturn = {
  videoUrl: string | null;
  isDecrypting: boolean;
  error: string | null;
  decryptContent: (args: DecryptArgs) => Promise<string | null>;
};

const TTL_MIN = 10;

function getFields(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return ((value as { fields?: Record<string, unknown> }).fields ?? null) as Record<string, unknown> | null;
}

function extractObjectId(value: unknown, depth = 0): string | null {
  if (depth > 6 || value == null) return null;

  if (typeof value === "string") {
    return value.startsWith("0x") ? value : null;
  }

  if (typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.id === "string" && record.id.startsWith("0x")) {
    return record.id;
  }

  const fields = getFields(value);
  if (fields) {
    const nestedCandidates: unknown[] = [fields.id, fields.value];
    for (const candidate of nestedCandidates) {
      const extracted = extractObjectId(candidate, depth + 1);
      if (extracted) return extracted;
    }
  }

  const fallbackCandidates: unknown[] = [record.id, record.fields, record.value];
  for (const candidate of fallbackCandidates) {
    const extracted = extractObjectId(candidate, depth + 1);
    if (extracted) return extracted;
  }

  return null;
}

export function useDecryptContent(): UseDecryptContentReturn {
  const suiClient = useSuiClient() as SuiClient;
  const currentAccount = useCurrentAccount();
  const { mutate: signPersonalMessage } = useSignPersonalMessage();

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  const decryptContent = useCallback(
    async ({ blobId, creatorId }: DecryptArgs): Promise<string | null> => {
      if (!currentAccount?.address) {
        const msg = "Wallet non connectee.";
        setError(msg);
        throw new Error(msg);
      }

      if (!blobId || !creatorId) {
        const msg = "Parametres invalides pour le dechiffrement du contenu.";
        setError(msg);
        throw new Error(msg);
      }

      const suiAddress = currentAccount.address;

      setIsDecrypting(true);
      setError(null);
      setVideoUrl(null);

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
        let sessionKey = cachedSessionKey;

        const needsNewSessionKey =
          !sessionKey ||
          sessionKey.isExpired() ||
          cachedSessionKeyAddress !== suiAddress ||
          cachedSessionKeyPackageId !== CONTENT_CREATOR_PACKAGE_ID;

        if (needsNewSessionKey) {
          if (!sessionKeyInitPromise) {
            sessionKeyInitPromise = (async () => {
              const key = await SessionKey.create({
                address: suiAddress,
                packageId: CONTENT_CREATOR_PACKAGE_ID,
                ttlMin: TTL_MIN,
                suiClient,
              });

              await new Promise<void>((resolve, reject) => {
                signPersonalMessage(
                  {
                    message: key.getPersonalMessage(),
                  },
                  {
                    onSuccess: async (result) => {
                      try {
                        await key.setPersonalMessageSignature(result.signature);
                        resolve();
                      } catch (err) {
                        reject(err);
                      }
                    },
                    onError: (err) => reject(err as Error),
                  }
                );
              });

              cachedSessionKey = key;
              cachedSessionKeyAddress = suiAddress;
              cachedSessionKeyPackageId = CONTENT_CREATOR_PACKAGE_ID;

              return key;
            })().finally(() => {
              sessionKeyInitPromise = null;
            });
          }

          sessionKey = await sessionKeyInitPromise;
        }

        if (!sessionKey) {
          throw new Error("SessionKey non initialisee.");
        }

        const subsResponse = await suiClient.getOwnedObjects({
          owner: suiAddress,
          options: {
            showContent: true,
            showType: true,
          },
          filter: {
            StructType: `${CONTENT_CREATOR_PACKAGE_ID}::content_creator::Subscription`,
          },
        });

        type SubscriptionInfo = {
          id: string;
          createdAt: bigint;
          creatorId: string;
        };

        const subs = subsResponse.data
          .map((obj) => {
            const fields = getFields(obj.data?.content);
            if (!fields) return null;

            const subId = extractObjectId(fields.id);
            const subCreatorId = extractObjectId(fields.creator_id);

            return {
              id: String(subId ?? ""),
              createdAt: BigInt(String(fields.created_at ?? "0")),
              creatorId: String(subCreatorId ?? ""),
            } as SubscriptionInfo;
          })
          .filter((sub): sub is SubscriptionInfo => !!sub && sub.creatorId.toLowerCase() === creatorId.toLowerCase());

        if (subs.length === 0) {
          const msg = "Aucun abonnement valide trouve pour ce createur.";
          setError(msg);
          throw new Error(msg);
        }

        const subscription = subs.reduce((latest, sub) => (sub.createdAt > latest.createdAt ? sub : latest));
        const subscriptionId = subscription.id;

        const constructMoveCall = (tx: Transaction, id: string) => {
          tx.moveCall({
            target: `${CONTENT_CREATOR_PACKAGE_ID}::content_creator::seal_approve`,
            arguments: [
              tx.pure.vector("u8", fromHex(id)),
              tx.object(subscriptionId),
              tx.object(creatorId),
              tx.object(SUI_CLOCK_OBJECT_ID),
            ],
          });
        };

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const aggregatorUrl = `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${blobId}`;

        const response = await fetch(aggregatorUrl, { signal: controller.signal });
        clearTimeout(timeout);

        if (!response.ok) {
          const msg = "Impossible de recuperer le fichier chiffre depuis Walrus. Veuillez reessayer.";
          setError(msg);
          throw new Error(msg);
        }

        const encryptedBuffer = await response.arrayBuffer();
        const encryptedBytes = new Uint8Array(encryptedBuffer);

        const encryptedObject = EncryptedObject.parse(encryptedBytes);
        const encryptedId = encryptedObject.id;

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
        } catch (err) {
          const msg =
            err instanceof NoAccessError
              ? "Aucun acces aux cles de dechiffrement."
              : "Impossible de recuperer les cles de dechiffrement.";
          setError(msg);
          throw err;
        }

        try {
          const decrypted = await sealClient.decrypt({
            data: encryptedBytes,
            sessionKey,
            txBytes,
          });

          const blob = new Blob([decrypted.buffer as ArrayBuffer], { type: "video/mp4" });
          const url = URL.createObjectURL(blob);
          setVideoUrl(url);
          return url;
        } catch (err) {
          const msg =
            err instanceof NoAccessError
              ? "Aucun acces aux cles de dechiffrement."
              : "Impossible de dechiffrer cette video.";
          setError(msg);
          throw err;
        }
      } finally {
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
}
