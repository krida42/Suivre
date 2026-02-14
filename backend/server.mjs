import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { EnokiClient } from "@mysten/enoki";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { isValidSuiAddress } from "@mysten/sui/utils";

dotenv.config({ path: "backend/.env" });
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3001);
const NETWORK = (process.env.SUI_NETWORK || "testnet").toLowerCase();
const PACKAGE_ID = process.env.PACKAGE_ID || process.env.VITE_PACKAGE_ID || "";
const SUINS_DOMAIN = process.env.ENOKI_SUBNAME_DOMAIN || process.env.SUINS_DOMAIN || "";
const SUINS_NETWORK = NETWORK === "mainnet" ? "mainnet" : "testnet";
const FRONTEND_ORIGINS = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!process.env.ENOKI_PRIVATE_KEY) {
  throw new Error("Missing ENOKI_PRIVATE_KEY in backend environment.");
}

if (!PACKAGE_ID) {
  throw new Error("Missing PACKAGE_ID (or VITE_PACKAGE_ID) in backend environment.");
}

const allowedMoveCallTargets = new Set([
  `${PACKAGE_ID}::content_creator::new`,
  `${PACKAGE_ID}::content_creator::upload_content`,
  `${PACKAGE_ID}::content_creator::subscribe`,
]);

const suiClient = new SuiClient({
  url: getFullnodeUrl(NETWORK === "mainnet" ? "mainnet" : NETWORK === "devnet" ? "devnet" : "testnet"),
});

const enokiClient = new EnokiClient({
  apiKey: process.env.ENOKI_PRIVATE_KEY,
});

app.use(
  cors({
    origin: FRONTEND_ORIGINS,
  }),
);
app.use(express.json({ limit: "1mb" }));

function sanitizeAllowedAddresses(rawValue) {
  if (!Array.isArray(rawValue)) return undefined;
  const list = rawValue
    .filter((value) => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (!list.length) return undefined;

  for (const address of list) {
    if (!isValidSuiAddress(address)) {
      throw new Error(`Invalid allowed address: ${address}`);
    }
  }

  return list;
}

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    network: NETWORK,
    packageId: PACKAGE_ID,
    suinsDomain: SUINS_DOMAIN || null,
    suinsNetwork: SUINS_DOMAIN ? SUINS_NETWORK : null,
    allowedMoveCallTargets: Array.from(allowedMoveCallTargets),
  });
});

// Generic sponsor route. We do not trust targets from the client unless they are allowlisted.
app.post("/api/sponsor", async (req, res) => {
  try {
    const { sender, transactionKindBytes, moveCallTarget, allowedAddresses } = req.body;

    if (typeof sender !== "string" || !isValidSuiAddress(sender)) {
      return res.status(400).json({ error: "Invalid sender. Expected a valid Sui address." });
    }

    if (typeof transactionKindBytes !== "string" || !transactionKindBytes.trim()) {
      return res.status(400).json({ error: "Invalid transactionKindBytes. Expected a base64 string." });
    }

    if (typeof moveCallTarget !== "string" || !moveCallTarget.trim()) {
      return res.status(400).json({ error: "Invalid moveCallTarget. Expected a non-empty string." });
    }

    if (!allowedMoveCallTargets.has(moveCallTarget)) {
      return res.status(403).json({
        error: `moveCallTarget not allowed. Allowed targets: ${Array.from(allowedMoveCallTargets).join(", ")}`,
      });
    }

    const sanitizedAllowedAddresses = sanitizeAllowedAddresses(allowedAddresses);

    const sponsored = await enokiClient.createSponsoredTransaction({
      network: NETWORK === "mainnet" ? "mainnet" : NETWORK === "devnet" ? "devnet" : "testnet",
      sender,
      transactionKindBytes,
      allowedMoveCallTargets: [moveCallTarget],
      ...(sanitizedAllowedAddresses ? { allowedAddresses: sanitizedAllowedAddresses } : {}),
    });

    return res.json({
      bytes: sponsored.bytes,
      digest: sponsored.digest,
    });
  } catch (error) {
    console.error("Sponsor transaction failed", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to sponsor transaction",
    });
  }
});

app.post("/api/execute-transaction", async (req, res) => {
  try {
    const { digest, signature } = req.body;

    if (typeof digest !== "string" || !digest.trim()) {
      return res.status(400).json({ error: "Invalid digest." });
    }

    if (typeof signature !== "string" || !signature.trim()) {
      return res.status(400).json({ error: "Invalid signature." });
    }

    const result = await enokiClient.executeSponsoredTransaction({
      digest,
      signature,
    });

    return res.json({ result });
  } catch (error) {
    console.error("Execute transaction failed", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to execute transaction",
    });
  }
});

function parseHandleToSubname(handleRaw) {
  if (typeof handleRaw !== "string") return null;
  const normalized = handleRaw.trim().toLowerCase();
  const match = normalized.match(/^([a-z0-9]{2,20})@([0-9]{3})$/);
  if (!match) return null;

  const [, label, discriminator] = match;
  return {
    handle: `${label}@${discriminator}`,
    subname: `${label}-${discriminator}`,
  };
}

app.post("/api/suins/status", async (req, res) => {
  try {
    const { address } = req.body;
    if (typeof address !== "string" || !isValidSuiAddress(address)) {
      return res.status(400).json({ error: "Invalid address." });
    }
    if (!SUINS_DOMAIN) {
      return res.status(503).json({
        error: "SuiNS not configured on backend. Missing ENOKI_SUBNAME_DOMAIN.",
      });
    }

    const result = await enokiClient.getSubnames({
      address,
      domain: SUINS_DOMAIN,
      network: SUINS_NETWORK,
    });

    const sorted = [...(result.subnames || [])].sort((a, b) => {
      const aWeight = a.status === "ACTIVE" ? 0 : 1;
      const bWeight = b.status === "ACTIVE" ? 0 : 1;
      return aWeight - bWeight;
    });
    const primaryName = sorted[0]?.name || null;

    return res.json({
      domain: SUINS_DOMAIN,
      network: SUINS_NETWORK,
      hasSubname: sorted.length > 0,
      primaryName,
      subnames: sorted,
    });
  } catch (error) {
    console.error("SuiNS status check failed", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get SuiNS status",
    });
  }
});

app.post("/api/suins/register", async (req, res) => {
  try {
    const { address, handle } = req.body;
    if (typeof address !== "string" || !isValidSuiAddress(address)) {
      return res.status(400).json({ error: "Invalid address." });
    }
    if (!SUINS_DOMAIN) {
      return res.status(503).json({
        error: "SuiNS not configured on backend. Missing ENOKI_SUBNAME_DOMAIN.",
      });
    }

    const parsed = parseHandleToSubname(handle);
    if (!parsed) {
      return res.status(400).json({
        error: "Invalid handle format. Use format nom@123 (2-20 chars + @ + 3 digits).",
      });
    }

    const existing = await enokiClient.getSubnames({
      address,
      domain: SUINS_DOMAIN,
      network: SUINS_NETWORK,
    });
    if ((existing.subnames || []).length > 0) {
      const currentName = existing.subnames[0]?.name || null;
      return res.json({
        created: false,
        primaryName: currentName,
        handle: parsed.handle,
        subname: parsed.subname,
      });
    }

    const created = await enokiClient.createSubname({
      domain: SUINS_DOMAIN,
      network: SUINS_NETWORK,
      subname: parsed.subname,
      targetAddress: address,
    });

    return res.status(201).json({
      created: true,
      primaryName: created.name || null,
      status: created.status || "PENDING",
      handle: parsed.handle,
      subname: parsed.subname,
    });
  } catch (error) {
    console.error("SuiNS register failed", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to register SuiNS handle",
    });
  }
});

// Token-gating helper for Walrus access checks (creator subscription based).
app.post("/api/walrus/access", async (req, res) => {
  try {
    const { address, creatorId, blobId } = req.body;

    if (typeof address !== "string" || !isValidSuiAddress(address)) {
      return res.status(400).json({ error: "Invalid address." });
    }

    if (typeof creatorId !== "string" || !creatorId.trim()) {
      return res.status(400).json({ error: "Invalid creatorId." });
    }

    const ownedSubscriptions = await suiClient.getOwnedObjects({
      owner: address,
      filter: {
        StructType: `${PACKAGE_ID}::content_creator::Subscription`,
      },
      options: {
        showContent: true,
      },
    });

    const hasSubscriptionForCreator = ownedSubscriptions.data.some((obj) => {
      const fields = obj.data?.content && "fields" in obj.data.content ? obj.data.content.fields : null;
      return fields?.creator_id === creatorId;
    });

    if (!hasSubscriptionForCreator) {
      return res.status(403).json({ error: "Subscription required for this creator." });
    }

    return res.json({
      allowed: true,
      blobId,
    });
  } catch (error) {
    console.error("Walrus access verification failed", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to verify Walrus access",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
  console.log(`Network: ${NETWORK}`);
  console.log(`Package: ${PACKAGE_ID}`);
});
