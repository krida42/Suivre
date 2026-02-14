import { useMemo, useState } from "react";
import { useSuiClient } from "@mysten/dapp-kit";
import { SealClient } from "@mysten/seal";
import { fromHex, toHex } from "@mysten/sui/utils";
import { CONTENT_CREATOR_PACKAGE_ID } from "@config/chain";
import {
  buildWalrusPublisherPutBlobUrl,
  SEAL_KEY_THRESHOLD,
  SEAL_SERVER_OBJECT_IDS,
  SEAL_VERIFY_KEY_SERVERS,
} from "@config/storage";

type WalrusUploadResponse = {
  info?: {
    blobId?: string;
    blobObject?: { blobId?: string };
    newlyCreated?: { blobObject?: { blobId?: string } };
  };
};

export function useEncryptAndUploadWalrus() {
  const [isUploading, setIsUploading] = useState(false);
  const suiClient = useSuiClient();

  const client = useMemo(
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

  const encryptAndUpload = async (file: File, policyObject: string): Promise<WalrusUploadResponse> => {
    setIsUploading(true);

    try {
      if (!file) {
        throw new Error("No file selected");
      }

      const result = await file.arrayBuffer();
      const nonce = crypto.getRandomValues(new Uint8Array(5));
      const policyObjectBytes = fromHex(policyObject);
      const id = toHex(new Uint8Array([...policyObjectBytes, ...nonce]));

      const { encryptedObject: encryptedBytes } = await client.encrypt({
        threshold: SEAL_KEY_THRESHOLD,
        packageId: CONTENT_CREATOR_PACKAGE_ID,
        id,
        data: new Uint8Array(result),
      });

      return await storeBlob(encryptedBytes);
    } finally {
      setIsUploading(false);
    }
  };

  return {
    isUploading,
    encryptAndUpload,
  };
}

async function storeBlob(encryptedData: Uint8Array): Promise<WalrusUploadResponse> {
  const response = await fetch(buildWalrusPublisherPutBlobUrl(1), {
    method: "PUT",
    body: encryptedData as unknown as BodyInit,
  });

  if (response.status !== 200) {
    throw new Error("Something went wrong when storing the blob on Walrus");
  }

  const info = (await response.json()) as WalrusUploadResponse["info"];
  return { info };
}
