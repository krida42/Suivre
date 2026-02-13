import { useState } from "react";
import { useSuiClient } from "@mysten/dapp-kit";
import { SealClient } from "@mysten/seal";
import { fromHex, toHex } from "@mysten/sui/utils";
import { CONTENT_CREATOR_PACKAGE_ID } from "@config/chain";

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

  const serverObjectIds = [
    "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
    "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8",
  ];

  const client = new SealClient({
    suiClient,
    serverConfigs: serverObjectIds.map((id) => ({
      objectId: id,
      weight: 1,
    })),
    verifyKeyServers: false,
  });

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
        threshold: 2,
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
  const response = await fetch("https://publisher.walrus-testnet.walrus.space/v1/blobs?epochs=1", {
    method: "PUT",
    body: encryptedData as unknown as BodyInit,
  });

  if (response.status !== 200) {
    throw new Error("Something went wrong when storing the blob on Walrus");
  }

  const info = (await response.json()) as WalrusUploadResponse["info"];
  return { info };
}
