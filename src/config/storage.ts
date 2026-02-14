const DEFAULT_SEAL_SERVER_OBJECT_IDS = [
  "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
  "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8",
];

const envSealServerIds = import.meta.env.VITE_SEAL_SERVER_OBJECT_IDS
  ? String(import.meta.env.VITE_SEAL_SERVER_OBJECT_IDS)
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  : [];

export const SEAL_SERVER_OBJECT_IDS = envSealServerIds.length ? envSealServerIds : DEFAULT_SEAL_SERVER_OBJECT_IDS;

export const SEAL_KEY_THRESHOLD = Number(import.meta.env.VITE_SEAL_KEY_THRESHOLD ?? 2);

export const SEAL_VERIFY_KEY_SERVERS = String(import.meta.env.VITE_SEAL_VERIFY_KEY_SERVERS ?? "false") === "true";

export const WALRUS_PUBLISHER_BASE_URL =
  import.meta.env.VITE_WALRUS_PUBLISHER_BASE_URL ?? "https://publisher.walrus-testnet.walrus.space";

export const WALRUS_AGGREGATOR_BASE_URL =
  import.meta.env.VITE_WALRUS_AGGREGATOR_BASE_URL ?? "https://aggregator.walrus-testnet.walrus.space";

const DEFAULT_WALRUS_TESTNET_AGGREGATOR_BASE_URL = "https://aggregator.walrus-testnet.walrus.space";

function removeTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalizeWalrusBaseUrl(baseUrl: string): string {
  const clean = removeTrailingSlash(baseUrl.trim());
  return clean.endsWith("/v1") ? clean.slice(0, -3) : clean;
}

export function buildWalrusPublisherPutBlobUrl(epochs = 1): string {
  const base = normalizeWalrusBaseUrl(WALRUS_PUBLISHER_BASE_URL);
  return `${base}/v1/blobs?epochs=${epochs}`;
}

export function buildWalrusAggregatorBlobUrls(blobId: string): string[] {
  const bases = [
    normalizeWalrusBaseUrl(WALRUS_AGGREGATOR_BASE_URL),
    normalizeWalrusBaseUrl(DEFAULT_WALRUS_TESTNET_AGGREGATOR_BASE_URL),
  ].filter(Boolean);

  const uniqueBases = [...new Set(bases)];
  return uniqueBases.map((base) => `${base}/v1/blobs/${encodeURIComponent(blobId)}`);
}
