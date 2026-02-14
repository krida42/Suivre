import { useCallback, useEffect, useMemo, useState } from "react";
import { useCurrentAccount, useSignPersonalMessage, useSuiClient } from "@mysten/dapp-kit";
import type { SuiClient } from "@mysten/sui/client";
import { SealClient, SessionKey, NoAccessError, EncryptedObject } from "@mysten/seal";
import { Transaction } from "@mysten/sui/transactions";
import { fromHex, SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import { CONTENT_CREATOR_PACKAGE_ID } from "@config/chain";
import { buildWalrusAggregatorBlobUrls, SEAL_KEY_THRESHOLD, SEAL_SERVER_OBJECT_IDS, SEAL_VERIFY_KEY_SERVERS } from "@config/storage";
import { mutateAsync } from "@utils/sui/mutateAsync";
import { extractObjectId, getObjectFields } from "@utils/sui/objectParsing";
import { normalizeWalrusBlobId } from "@utils/walrus";

// Session key cache at module scope to avoid wallet signature prompts on every playback.
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

type SubscriptionInfo = {
  id: string;
  createdAt: bigint;
  creatorId: string;
};

const TTL_MIN = 10;
const WALRUS_FETCH_TIMEOUT_MS = 10_000;

type SignPersonalMessageInput = {
  message: Uint8Array;
};

type SignPersonalMessageResult = {
  signature: string;
};

function setAndThrow(setError: (value: string | null) => void, message: string): never {
  setError(message);
  throw new Error(message);
}

async function fetchEncryptedBlob(blobId: string): Promise<Uint8Array> {
  const urls = buildWalrusAggregatorBlobUrls(blobId);
  let lastError: Error | null = null;

  // Try each aggregator endpoint because env/base URL can vary between deployments.
  for (const url of urls) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WALRUS_FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
      });

      if (!response.ok) {
        lastError = new Error(`walrus_fetch_failed_status_${response.status}`);
        continue;
      }

      const encryptedBuffer = await response.arrayBuffer();
      return new Uint8Array(encryptedBuffer);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("walrus_fetch_failed_unknown");
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError ?? new Error("walrus_fetch_failed");
}

async function getLatestSubscriptionForCreator(
  suiClient: SuiClient,
  owner: string,
  creatorId: string
): Promise<SubscriptionInfo | null> {
  const subsResponse = await suiClient.getOwnedObjects({
    owner,
    options: {
      showContent: true,
      showType: true,
    },
    filter: {
      StructType: `${CONTENT_CREATOR_PACKAGE_ID}::content_creator::Subscription`,
    },
  });

  const subscriptions = subsResponse.data
    .map((obj) => {
      const fields = getObjectFields(obj.data?.content);
      if (!fields) return null;

      const subId = extractObjectId(fields.id);
      const subCreatorId = extractObjectId(fields.creator_id);

      return {
        id: String(subId ?? ""),
        createdAt: BigInt(String(fields.created_at ?? "0")),
        creatorId: String(subCreatorId ?? ""),
      };
    })
    .filter((sub): sub is SubscriptionInfo => !!sub && sub.creatorId.toLowerCase() === creatorId.toLowerCase());

  if (!subscriptions.length) return null;
  return subscriptions.reduce((latest, sub) => (sub.createdAt > latest.createdAt ? sub : latest));
}

export function useDecryptContent(): UseDecryptContentReturn {
  const suiClient = useSuiClient() as SuiClient;
  const currentAccount = useCurrentAccount();
  const { mutate: signPersonalMessage } = useSignPersonalMessage();

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sealClient = useMemo(
    () =>
      new SealClient({
        suiClient,
        serverConfigs: SEAL_SERVER_OBJECT_IDS.map((id) => ({
          objectId: id,
          weight: 1,
        })),
        verifyKeyServers: SEAL_VERIFY_KEY_SERVERS,
      }),
    [suiClient]
  );

  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  const ensureSessionKey = useCallback(
    async (suiAddress: string): Promise<SessionKey> => {
      const existingSessionKey = cachedSessionKey;
      const needsNewSessionKey =
        !existingSessionKey ||
        existingSessionKey.isExpired() ||
        cachedSessionKeyAddress !== suiAddress ||
        cachedSessionKeyPackageId !== CONTENT_CREATOR_PACKAGE_ID;

      if (!needsNewSessionKey) {
        return existingSessionKey;
      }

      if (!sessionKeyInitPromise) {
        sessionKeyInitPromise = (async () => {
          const key = await SessionKey.create({
            address: suiAddress,
            packageId: CONTENT_CREATOR_PACKAGE_ID,
            ttlMin: TTL_MIN,
            suiClient,
          });

          const signatureResult = await mutateAsync<SignPersonalMessageInput, SignPersonalMessageResult>(
            signPersonalMessage as unknown as (
              variables: SignPersonalMessageInput,
              callbacks: {
                onSuccess: (result: SignPersonalMessageResult) => void;
                onError: (error: unknown) => void;
              }
            ) => void,
            {
              message: key.getPersonalMessage(),
            }
          );

          await key.setPersonalMessageSignature(signatureResult.signature);

          cachedSessionKey = key;
          cachedSessionKeyAddress = suiAddress;
          cachedSessionKeyPackageId = CONTENT_CREATOR_PACKAGE_ID;

          return key;
        })().finally(() => {
          sessionKeyInitPromise = null;
        });
      }

      return sessionKeyInitPromise;
    },
    [signPersonalMessage, suiClient]
  );

  const decryptContent = useCallback(
    async ({ blobId, creatorId }: DecryptArgs): Promise<string | null> => {
      if (!currentAccount?.address) {
        setAndThrow(setError, "Wallet non connectee.");
      }

      if (!blobId || !creatorId) {
        setAndThrow(setError, "Parametres invalides pour le dechiffrement du contenu.");
      }

      setIsDecrypting(true);
      setError(null);
      setVideoUrl(null);

      try {
        const suiAddress = currentAccount.address;
        const normalizedBlobId = normalizeWalrusBlobId(blobId);
        if (!normalizedBlobId) {
          setAndThrow(setError, "BlobId invalide pour Walrus.");
        }

        const sessionKey = await ensureSessionKey(suiAddress);

        const subscription = await getLatestSubscriptionForCreator(suiClient, suiAddress, creatorId);

        if (!subscription) {
          setAndThrow(setError, "Aucun abonnement valide trouve pour ce createur.");
        }

        let encryptedBytes: Uint8Array;
        try {
          encryptedBytes = await fetchEncryptedBlob(normalizedBlobId);
        } catch (fetchError) {
          const details = fetchError instanceof Error ? ` (${fetchError.message})` : "";
          setAndThrow(setError, `Impossible de recuperer le fichier chiffre depuis Walrus. Veuillez reessayer.${details}`);
        }

        const encryptedObject = EncryptedObject.parse(encryptedBytes);
        const encryptedId = encryptedObject.id;

        // Build only the transaction kind bytes used by Seal policy verification.
        const tx = new Transaction();
        tx.moveCall({
          target: `${CONTENT_CREATOR_PACKAGE_ID}::content_creator::seal_approve`,
          arguments: [
            tx.pure.vector("u8", fromHex(encryptedId)),
            tx.object(subscription.id),
            tx.object(creatorId),
            tx.object(SUI_CLOCK_OBJECT_ID),
          ],
        });
        const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });

        try {
          await sealClient.fetchKeys({
            ids: [encryptedId],
            txBytes,
            sessionKey,
            threshold: SEAL_KEY_THRESHOLD,
          });
        } catch (err) {
          if (err instanceof NoAccessError) {
            setAndThrow(setError, "Aucun acces aux cles de dechiffrement.");
          }
          setAndThrow(setError, "Impossible de recuperer les cles de dechiffrement.");
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
          if (err instanceof NoAccessError) {
            setAndThrow(setError, "Aucun acces aux cles de dechiffrement.");
          }
          setAndThrow(setError, "Impossible de dechiffrer cette video.");
        }
      } finally {
        setIsDecrypting(false);
      }
    },
    [currentAccount, ensureSessionKey, sealClient, suiClient]
  );

  return {
    videoUrl,
    isDecrypting,
    error,
    decryptContent,
  };
}
