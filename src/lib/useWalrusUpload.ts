import { useState } from "react";
import { WriteFilesFlow } from "@mysten/walrus";
import type { SuiClient } from "@mysten/sui/client";
// import type { SignAndExecuteTransactionOptions } from "@mysten/dapp-kit";
import { WalrusService } from "./walrusServiceSDK";

interface UploadedItem {
  blobId: string;
  id: string; // Metadata ID for explorer links
  url: string;
  size: number;
  type: string;
  timestamp: number;
  filename?: string;
}

interface UseWalrusFileUploadOptions {
  walrus: WalrusService | null;
  currentAccount: { address: string } | null;
  signAndExecute: (
    options: any,
    callbacks?: {
      onSuccess?: (result: { digest: string }) => void | Promise<void>;
      onError?: (error: Error) => void;
    }
  ) => void;
  suiClient: SuiClient;
  onSuccess?: (item: UploadedItem) => void;
}

interface UseWalrusFileUploadReturn {
  uploadFile: (file: File) => Promise<UploadedItem | null>;
  uploading: boolean;
  error: string | null;
  success: string | null;
  setError: (error: string | null) => void;
  setSuccess: (success: string | null) => void;
}

/**
 * Custom hook for uploading files to Walrus storage
 * Handles the complete upload flow: encode, register, upload, certify
 */
export function useWalrusFileUpload({
  walrus,
  currentAccount,
  signAndExecute,
  suiClient,
  onSuccess,
}: UseWalrusFileUploadOptions): UseWalrusFileUploadReturn {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const uploadFile = async (file: File): Promise<UploadedItem | null> => {
    console.log(`Starting upload for file: ${file.name}, size: ${file.size} bytes`);

    if (!currentAccount) {
      console.warn("Upload failed: No current account connected.");
      setError("Please connect your wallet first");
      return null;
    }

    if (!walrus) {
      console.warn("Upload failed: Walrus service not available.");
      setError("Walrus service not available. Please refresh the page.");
      return null;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      // Read file as array buffer
      const contents = await file.arrayBuffer();
      console.log("File read into array buffer.");

      // Use writeFilesFlow for browser environments (avoids popup blocking)
      console.log("Initializing upload flow...");
      const flow: WriteFilesFlow = walrus.uploadWithFlow(
        [
          {
            contents: new Uint8Array(contents),
            identifier: file.name,
            tags: { "content-type": file.type || "application/octet-stream" },
          },
        ],
        { epochs: 1, deletable: true }
      );

      // Step 1: Encode files
      console.log("Step 1: Encoding files...");
      await flow.encode();
      console.log("Files encoded successfully.");

      // Step 2: Register the blob (returns transaction)
      console.log("Step 2: Registering blob...");
      const registerTx = flow.register({
        owner: currentAccount.address,
        epochs: 10,
        deletable: true,
      });

      // Step 3: Sign and execute register transaction and get the created blob object ID
      console.log("Step 3: Signing and executing register transaction...");
      let registerDigest: string;
      let blobObjectId: string | null = null;
      await new Promise<void>((resolve, reject) => {
        signAndExecute(
          { transaction: registerTx },
          {
            onSuccess: async ({ digest }) => {
              console.log(`Register transaction signed. Digest: ${digest}`);
              try {
                registerDigest = digest;
                console.log("Waiting for register transaction to be included in a block...");
                const result = await suiClient.waitForTransaction({
                  digest,
                  options: {
                    showEffects: true,
                    showEvents: true,
                  },
                });
                console.log("Register transaction confirmed.");

                // Get the blob object ID from BlobRegistered event
                if (result.events) {
                  console.log("Parsing events for BlobRegistered...", result.events);
                  const blobRegisteredEvent = result.events.find((event) => event.type.includes("BlobRegistered"));

                  if (blobRegisteredEvent?.parsedJson) {
                    // Extract object_id from the event (can be snake_case or camelCase)
                    const eventData = blobRegisteredEvent.parsedJson as {
                      object_id?: string;
                      objectId?: string;
                    };
                    blobObjectId = eventData.object_id || eventData.objectId || null;
                    console.log(`Blob Object ID found: ${blobObjectId}`);
                  } else {
                    console.warn("BlobRegistered event not found or missing parsedJson.");
                  }
                }
                resolve();
              } catch (err) {
                console.error("Error waiting for register transaction:", err);
                reject(err);
              }
            },
            onError: (err) => {
              console.error("Error signing register transaction:", err);
              reject(err);
            },
          }
        );
      });

      // Step 4: Upload the blob data to storage nodes
      console.log("Step 4: Uploading blob data to storage nodes...");
      await flow.upload({ digest: registerDigest! });
      console.log("Blob data uploaded.");

      // Step 5: Certify the blob (returns transaction)
      console.log("Step 5: Certifying blob...");
      const certifyTx = flow.certify();

      // Step 6: Sign and execute certify transaction
      console.log("Step 6: Signing and executing certify transaction...");
      await new Promise<void>((resolve, reject) => {
        signAndExecute(
          { transaction: certifyTx },
          {
            onSuccess: async ({ digest }) => {
              console.log(`Certify transaction signed. Digest: ${digest}`);
              try {
                console.log("Waiting for certify transaction to be included in a block...");
                await suiClient.waitForTransaction({ digest });
                console.log("Certify transaction confirmed.");
                resolve();
              } catch (err) {
                console.error("Error waiting for certify transaction:", err);
                reject(err);
              }
            },
            onError: (err) => {
              console.error("Error signing certify transaction:", err);
              reject(err);
            },
          }
        );
      });

      // Step 7: Get the blobId from listFiles
      console.log("Step 7: Retrieving blob ID from flow...");
      const files = await flow.listFiles();
      console.log("Files retrieved from flow:", files);
      const blobId = files[0]?.blobId;

      if (!blobId) {
        throw new Error("Failed to get blobId after upload");
      }
      console.log(`Blob ID retrieved: ${blobId}`);

      // Use the blob object ID from transaction effects, or fallback to blobId if not found
      const metadataId = blobObjectId || blobId;
      console.log(`Final Metadata ID: ${metadataId}`);

      const uploadedItem: UploadedItem = {
        blobId,
        id: metadataId,
        url: `https://aggregator.walrus-testnet.walrus.space/v1/${blobId}`,
        size: file.size,
        type: file.type || "application/octet-stream",
        timestamp: Date.now(),
        filename: file.name,
      };

      console.log("Upload successful. Item:", uploadedItem);
      setSuccess(`File "${file.name}" uploaded successfully!`);

      if (onSuccess) {
        onSuccess(uploadedItem);
      }

      return uploadedItem;
    } catch (err) {
      const errorMessage = `Upload failed: ${err instanceof Error ? err.message : "Unknown error"}`;
      setError(errorMessage);
      console.error("Upload error:", err);
      return null;
    } finally {
      setUploading(false);
    }
  };

  return {
    uploadFile,
    uploading,
    error,
    success,
    setError,
    setSuccess,
  };
}
