"use client";
import { useState } from "react";
import { useMemo } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { createWalrusService } from "./walrusServiceSDK";
import { WriteFilesFlow } from "@mysten/walrus";
import { Loader2 } from "lucide-react";

type UploadTab = "file" | "text" | "json";

interface UploadedItem {
  blobId: string;
  id: string; // Metadata ID for explorer links
  url: string;
  size: number;
  type: string;
  timestamp: number;
  filename?: string;
}

export function WalrusUpload() {
  // Get wallet hooks for signing
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const suiClient = useSuiClient();

  // Create walrus service directly (only on client-side)
  const walrus = useMemo(() => {
    if (typeof window === "undefined") {
      // Return a dummy service on server-side
      return null as any;
    }
    return createWalrusService({ network: "testnet", epochs: 10 });
  }, []);

  const [activeTab, setActiveTab] = useState<UploadTab>("file");
  const [uploading, setUploading] = useState(false);
  const [uploadHistory, setUploadHistory] = useState<UploadedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Text/JSON upload state
  const [textContent, setTextContent] = useState("");
  const [jsonContent, setJsonContent] = useState("");

  /**
   * Handle file upload using WalrusFile API with writeFilesFlow
   * From official docs: https://sdk.mystenlabs.com/walrus
   */
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!currentAccount) {
      setError("Please connect your wallet first");
      return;
    }

    if (!walrus) {
      setError("Walrus service not available. Please refresh the page.");
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      // Read file as array buffer
      const contents = await file.arrayBuffer();

      // Use writeFilesFlow for browser environments (avoids popup blocking)
      const flow: WriteFilesFlow = walrus.uploadWithFlow(
        [
          {
            contents: new Uint8Array(contents),
            identifier: file.name,
            tags: { "content-type": file.type || "application/octet-stream" },
          },
        ],
        { epochs: 10, deletable: true }
      );

      // Step 1: Encode files
      await flow.encode();

      // Step 2: Register the blob (returns transaction)
      const registerTx = flow.register({
        owner: currentAccount.address,
        epochs: 10,
        deletable: true,
      });

      // Step 3: Sign and execute register transaction and get the created blob object ID
      let registerDigest: string;
      let blobObjectId: string | null = null;
      await new Promise<void>((resolve, reject) => {
        signAndExecute(
          { transaction: registerTx },
          {
            onSuccess: async ({ digest }) => {
              try {
                registerDigest = digest;
                const result = await suiClient.waitForTransaction({
                  digest,
                  options: {
                    showEffects: true,
                    showEvents: true,
                  },
                });

                // Get the blob object ID from BlobRegistered event
                if (result.events) {
                  const blobRegisteredEvent = result.events.find((event) => event.type.includes("BlobRegistered"));

                  if (blobRegisteredEvent?.parsedJson) {
                    // Extract object_id from the event (can be snake_case or camelCase)
                    const eventData = blobRegisteredEvent.parsedJson as {
                      object_id?: string;
                      objectId?: string;
                    };
                    blobObjectId = eventData.object_id || eventData.objectId || null;
                  }
                }
                resolve();
              } catch (err) {
                reject(err);
              }
            },
            onError: reject,
          }
        );
      });

      // Step 4: Upload the blob data to storage nodes
      await flow.upload({ digest: registerDigest! });

      // Step 5: Certify the blob (returns transaction)
      const certifyTx = flow.certify();

      // Step 6: Sign and execute certify transaction
      await new Promise<void>((resolve, reject) => {
        signAndExecute(
          { transaction: certifyTx },
          {
            onSuccess: async ({ digest }) => {
              try {
                await suiClient.waitForTransaction({ digest });
                resolve();
              } catch (err) {
                reject(err);
              }
            },
            onError: reject,
          }
        );
      });

      // Step 7: Get the blobId from listFiles
      const files = await flow.listFiles();
      const blobId = files[0]?.blobId;

      if (!blobId) {
        throw new Error("Failed to get blobId after upload");
      }

      // Use the blob object ID from transaction effects, or fallback to blobId if not found
      const metadataId = blobObjectId || blobId;

      const uploadedItem: UploadedItem = {
        blobId,
        id: metadataId,
        url: `https://aggregator.walrus-testnet.walrus.space/v1/${blobId}`,
        size: file.size,
        type: file.type || "application/octet-stream",
        timestamp: Date.now(),
        filename: file.name,
      };
      setUploadHistory([uploadedItem, ...uploadHistory]);
      setSuccess(`File "${file.name}" uploaded successfully!`);

      // Reset input
      event.target.value = "";
    } catch (err) {
      setError(`Upload failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
    }
  };

  /**
   * Handle text upload using WalrusFile API with writeFilesFlow
   */
  const handleTextUpload = async () => {
    if (!textContent.trim()) {
      setError("Please enter some text to upload");
      return;
    }

    if (!currentAccount) {
      setError("Please connect your wallet first");
      return;
    }

    if (!walrus) {
      setError("Walrus service not available. Please refresh the page.");
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      // Use writeFilesFlow for browser environments
      const flow = walrus.uploadWithFlow(
        [
          {
            contents: textContent,
            identifier: "text.txt",
            tags: { "content-type": "text/plain" },
          },
        ],
        { epochs: 10, deletable: true }
      );

      // Step 1: Encode
      await flow.encode();

      // Step 2: Register
      const registerTx = flow.register({
        owner: currentAccount.address,
        epochs: 10,
        deletable: true,
      });

      let registerDigest: string;
      let blobObjectId: string | null = null;
      await new Promise<void>((resolve, reject) => {
        signAndExecute(
          { transaction: registerTx },
          {
            onSuccess: async ({ digest }) => {
              try {
                registerDigest = digest;
                const result = await suiClient.waitForTransaction({
                  digest,
                  options: {
                    showEffects: true,
                    showEvents: true,
                  },
                });

                // Get the blob object ID from BlobRegistered event
                if (result.events) {
                  const blobRegisteredEvent = result.events.find((event) => event.type.includes("BlobRegistered"));

                  if (blobRegisteredEvent?.parsedJson) {
                    // Extract object_id from the event (can be snake_case or camelCase)
                    const eventData = blobRegisteredEvent.parsedJson as {
                      object_id?: string;
                      objectId?: string;
                    };
                    blobObjectId = eventData.object_id || eventData.objectId || null;
                  }
                }
                resolve();
              } catch (err) {
                reject(err);
              }
            },
            onError: reject,
          }
        );
      });

      // Step 3: Upload
      await flow.upload({ digest: registerDigest! });

      // Step 4: Certify
      const certifyTx = flow.certify();
      await new Promise<void>((resolve, reject) => {
        signAndExecute(
          { transaction: certifyTx },
          {
            onSuccess: async ({ digest }) => {
              try {
                await suiClient.waitForTransaction({ digest });
                resolve();
              } catch (err) {
                reject(err);
              }
            },
            onError: reject,
          }
        );
      });

      // Step 5: Get blobId
      const files = await flow.listFiles();
      const blobId = files[0]?.blobId;

      if (!blobId) {
        throw new Error("Failed to get blobId after upload");
      }

      // Use the blob object ID from transaction effects, or fallback to blobId if not found
      const metadataId = blobObjectId || blobId;

      const uploadedItem: UploadedItem = {
        blobId,
        id: metadataId,
        url: `https://aggregator.walrus-testnet.walrus.space/v1/${blobId}`,
        size: textContent.length,
        type: "text/plain",
        timestamp: Date.now(),
      };
      setUploadHistory([uploadedItem, ...uploadHistory]);
      setSuccess("Text uploaded successfully!");
      setTextContent("");
    } catch (err) {
      setError(`Upload failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
    }
  };

  /**
   * Handle JSON upload using WalrusFile API with writeFilesFlow
   */
  const handleJsonUpload = async () => {
    if (!jsonContent.trim()) {
      setError("Please enter JSON data to upload");
      return;
    }

    // Validate JSON
    try {
      JSON.parse(jsonContent);
    } catch {
      setError("Invalid JSON format. Please check your syntax.");
      return;
    }

    if (!currentAccount) {
      setError("Please connect your wallet first");
      return;
    }

    if (!walrus) {
      setError("Walrus service not available. Please refresh the page.");
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      // Use writeFilesFlow for browser environments
      const flow = walrus.uploadWithFlow(
        [
          {
            contents: jsonContent,
            identifier: "data.json",
            tags: { "content-type": "application/json" },
          },
        ],
        { epochs: 10, deletable: true }
      );

      // Step 1: Encode
      await flow.encode();

      // Step 2: Register
      const registerTx = flow.register({
        owner: currentAccount.address,
        epochs: 10,
        deletable: true,
      });

      let registerDigest: string;
      let blobObjectId: string | null = null;
      await new Promise<void>((resolve, reject) => {
        signAndExecute(
          { transaction: registerTx },
          {
            onSuccess: async ({ digest }) => {
              try {
                registerDigest = digest;
                const result = await suiClient.waitForTransaction({
                  digest,
                  options: {
                    showEffects: true,
                    showEvents: true,
                  },
                });

                // Get the blob object ID from BlobRegistered event
                if (result.events) {
                  const blobRegisteredEvent = result.events.find((event) => event.type.includes("BlobRegistered"));

                  if (blobRegisteredEvent?.parsedJson) {
                    // Extract object_id from the event (can be snake_case or camelCase)
                    const eventData = blobRegisteredEvent.parsedJson as {
                      object_id?: string;
                      objectId?: string;
                    };
                    blobObjectId = eventData.object_id || eventData.objectId || null;
                  }
                }
                resolve();
              } catch (err) {
                reject(err);
              }
            },
            onError: reject,
          }
        );
      });

      // Step 3: Upload
      await flow.upload({ digest: registerDigest! });

      // Step 4: Certify
      const certifyTx = flow.certify();
      await new Promise<void>((resolve, reject) => {
        signAndExecute(
          { transaction: certifyTx },
          {
            onSuccess: async ({ digest }) => {
              try {
                await suiClient.waitForTransaction({ digest });
                resolve();
              } catch (err) {
                reject(err);
              }
            },
            onError: reject,
          }
        );
      });

      // Step 5: Get blobId
      const files = await flow.listFiles();
      const blobId = files[0]?.blobId;

      if (!blobId) {
        throw new Error("Failed to get blobId after upload");
      }

      // Use the blob object ID from transaction effects, or fallback to blobId if not found
      const metadataId = blobObjectId || blobId;

      const uploadedItem: UploadedItem = {
        blobId,
        id: metadataId,
        url: `https://aggregator.walrus-testnet.walrus.space/v1/${blobId}`,
        size: jsonContent.length,
        type: "application/json",
        timestamp: Date.now(),
      };
      setUploadHistory([uploadedItem, ...uploadHistory]);
      setSuccess("JSON uploaded successfully!");
      setJsonContent("");
    } catch (err) {
      setError(`Upload failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
    }
  };

  /**
   * Copy blob ID or URL to clipboard
   */
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setSuccess(`${label} copied to clipboard!`);
    setTimeout(() => setSuccess(null), 2000);
  };

  /**
   * Format file size
   */
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className="space-y-4">
      <div className="p-8 text-center transition-colors border-2 border-gray-300 border-dashed rounded-lg hover:border-blue-500">
        <input type="file" onChange={handleFileUpload} disabled={uploading} className="hidden" id="file-upload" accept="*/*" />
        <label htmlFor="file-upload" className="flex flex-col items-center cursor-pointer">
          <div className="mb-4 text-5xl">📤</div>
          <div className="mb-2 text-lg font-semibold text-black">{uploading ? "Uploading..." : "Choose a file or drag it here"}</div>
          <div className="text-sm text-black">Any file type supported • Max size depends on Walrus limits</div>
        </label>
      </div>
      {uploading && (
        <div className="flex items-center justify-center">
          <Loader2 size={30} color="#2563eb" />
          <span className="ml-3 text-black">Uploading to Walrus...</span>
        </div>
      )}
    </div>
  );
}
