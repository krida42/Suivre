import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import type { Request, Response } from "express";
import { EnokiClient } from "@mysten/enoki";
import { logError, logRequest, logServer, logZkOperation, maskAddress } from "./helpers/logger.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 3001);
const network = process.env.SUI_NETWORK === "mainnet" ? "mainnet" : "testnet";
const corsOrigin = process.env.CORS_ORIGIN ?? "*";
const enokiPrivateKey = process.env.ENOKI_PRIVATE_KEY;

if (!enokiPrivateKey) {
  throw new Error("Missing ENOKI_PRIVATE_KEY in backend environment.");
}

const enokiClient = new EnokiClient({
  apiKey: enokiPrivateKey,
});

type ApiErrorResponse = {
  error: string;
};

type SponsorRequestBody = {
  sender?: unknown;
  transactionKindBytes?: unknown;
  allowedMoveCallTargets?: unknown;
  allowedAddresses?: unknown;
  operation?: unknown;
};

type ExecuteRequestBody = {
  digest?: unknown;
  signature?: unknown;
  operation?: unknown;
};

function parseStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const parsed = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : undefined;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function getOperation(value: unknown, fallback: string): string {
  if (!isNonEmptyString(value)) {
    return fallback;
  }

  return value.trim();
}

function getExecutionStatus(result: unknown): string | undefined {
  if (typeof result !== "object" || result === null) {
    return undefined;
  }

  const effects = (result as { effects?: { status?: { status?: unknown } } }).effects;
  const status = effects?.status?.status;

  return typeof status === "string" ? status : undefined;
}

app.use(
  cors({
    origin: corsOrigin === "*" ? true : corsOrigin,
  })
);

app.use(express.json({ limit: "2mb" }));

app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    logRequest(req.method, req.path, {
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
      userAgent: req.headers["user-agent"],
    });
  });

  next();
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "suivre-backend",
    network,
  });
});

app.post(
  "/api/sponsor",
  async (req: Request<unknown, unknown, SponsorRequestBody>, res: Response<{ bytes: string; digest: string } | ApiErrorResponse>) => {
    try {
      const { sender, transactionKindBytes } = req.body;

      if (!isNonEmptyString(sender)) {
        return res.status(400).json({ error: "Invalid sender. Expected a non-empty string." });
      }

      if (!isNonEmptyString(transactionKindBytes)) {
        return res
          .status(400)
          .json({ error: "Invalid transactionKindBytes. Expected base64-encoded transaction kind bytes." });
      }

      const allowedMoveCallTargets = parseStringArray(req.body.allowedMoveCallTargets);
      const allowedAddresses = parseStringArray(req.body.allowedAddresses);
      const operation = getOperation(req.body.operation, "SPONSORED_TRANSACTION");

      logZkOperation(operation, "INITIATED", {
        sender: maskAddress(sender),
        allowedMoveCallTargetCount: allowedMoveCallTargets?.length ?? 0,
        allowedAddressCount: allowedAddresses?.length ?? 0,
      });

      const sponsored = await enokiClient.createSponsoredTransaction({
        network,
        sender,
        transactionKindBytes,
        ...(allowedMoveCallTargets ? { allowedMoveCallTargets } : {}),
        ...(allowedAddresses ? { allowedAddresses } : {}),
      });

      logZkOperation(operation, "SUCCESS", {
        sender: maskAddress(sender),
        digest: sponsored.digest,
      });

      return res.json({
        bytes: sponsored.bytes,
        digest: sponsored.digest,
      });
    } catch (error) {
      logError("Sponsor transaction failed", error, {
        sender: req.body.sender,
      });

      logZkOperation(getOperation(req.body.operation, "SPONSORED_TRANSACTION"), "ERROR", {
        sender: isNonEmptyString(req.body.sender) ? maskAddress(req.body.sender) : "unknown",
      });

      return res.status(500).json({ error: "Failed to sponsor transaction" });
    }
  }
);

app.post(
  "/api/execute-transaction",
  async (
    req: Request<unknown, unknown, ExecuteRequestBody>,
    res: Response<{ result: unknown } | ApiErrorResponse>
  ) => {
    try {
      const { digest, signature } = req.body;

      if (!isNonEmptyString(digest)) {
        return res.status(400).json({ error: "Invalid digest. Expected a non-empty string." });
      }

      if (!isNonEmptyString(signature)) {
        return res.status(400).json({ error: "Invalid signature. Expected a non-empty string." });
      }

      const operation = getOperation(req.body.operation, "EXECUTE_SPONSORED_TRANSACTION");

      logZkOperation(operation, "INITIATED", {
        digest,
      });

      const result = await enokiClient.executeSponsoredTransaction({
        digest,
        signature,
      });

      logZkOperation(operation, "SUCCESS", {
        digest,
        executionStatus: getExecutionStatus(result),
      });

      return res.json({ result });
    } catch (error) {
      logError("Execute sponsored transaction failed", error, {
        digest: req.body.digest,
      });

      logZkOperation(getOperation(req.body.operation, "EXECUTE_SPONSORED_TRANSACTION"), "ERROR", {
        digest: req.body.digest,
      });

      return res.status(500).json({ error: "Failed to execute sponsored transaction" });
    }
  }
);

app.listen(port, () => {
  logServer("Suivre backend started", {
    port,
    network,
    nodeEnv: process.env.NODE_ENV ?? "development",
  });
});
