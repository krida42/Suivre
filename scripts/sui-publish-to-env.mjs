#!/usr/bin/env node

import fs from 'node:fs';
import process from 'node:process';

const PACKAGE_KEY = 'VITE_CONTENT_CREATOR_PACKAGE_ID';
const SHARED_KEY = 'VITE_ALL_CREATOR_OBJECT_ID';

function parseArgs(argv) {
  let sourcePath = null;
  let envPath = '.env';

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--env') {
      envPath = argv[i + 1];
      i += 1;
      continue;
    }
    sourcePath = arg;
  }

  if (!envPath) {
    throw new Error('Missing value after --env');
  }

  return { sourcePath, envPath };
}

async function readInput(sourcePath) {
  if (sourcePath && sourcePath !== '-') {
    return fs.readFileSync(sourcePath, 'utf8');
  }

  if (process.stdin.isTTY) {
    throw new Error('No input provided. Pass a file path or pipe JSON via stdin.');
  }

  return new Promise((resolve, reject) => {
    let raw = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      raw += chunk;
    });
    process.stdin.on('end', () => resolve(raw));
    process.stdin.on('error', reject);
  });
}

function parseJson(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Input is empty.');
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('Invalid JSON input.');
    }
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

function extractFromChangedObjects(data) {
  const changedObjects = data?.changed_objects ?? data?.changedObjects;
  if (!Array.isArray(changedObjects)) {
    return { packageId: null, sharedId: null };
  }

  let packageId = null;
  let preferredSharedId = null;
  let fallbackSharedId = null;

  for (const item of changedObjects) {
    if (!item || typeof item !== 'object') continue;
    const objectId = item.objectId;
    if (!objectId) continue;

    if (!packageId && item.objectType === 'package') {
      packageId = objectId;
    }

    if (item.outputOwner?.kind === 'SHARED') {
      if (typeof item.objectType === 'string' && item.objectType.endsWith('::AllCreators')) {
        preferredSharedId = objectId;
      } else if (!fallbackSharedId) {
        fallbackSharedId = objectId;
      }
    }
  }

  return {
    packageId,
    sharedId: preferredSharedId ?? fallbackSharedId,
  };
}

function extractFromEffects(data) {
  const changedObjects = data?.effects?.V2?.changed_objects;
  if (!Array.isArray(changedObjects)) {
    return { packageId: null, sharedId: null };
  }

  let packageId = null;
  let sharedId = null;

  for (const item of changedObjects) {
    if (!Array.isArray(item) || item.length < 2) continue;
    const objectId = item[0];
    const meta = item[1];
    const outputState = meta?.output_state;
    if (!objectId || !outputState || typeof outputState !== 'object') continue;

    if (!packageId && Array.isArray(outputState.PackageWrite)) {
      packageId = objectId;
    }

    if (
      !sharedId &&
      Array.isArray(outputState.ObjectWrite) &&
      outputState.ObjectWrite[1] &&
      typeof outputState.ObjectWrite[1] === 'object' &&
      outputState.ObjectWrite[1].Shared
    ) {
      sharedId = objectId;
    }
  }

  return { packageId, sharedId };
}

function upsertEnv(content, key, value) {
  const lines = content ? content.split(/\r?\n/) : [];
  let found = false;

  const updated = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });

  if (!found) {
    updated.push(`${key}=${value}`);
  }

  return `${updated.filter((line, index, arr) => !(line === '' && index === arr.length - 1)).join('\n')}\n`;
}

async function main() {
  const { sourcePath, envPath } = parseArgs(process.argv.slice(2));
  const rawInput = await readInput(sourcePath);
  const json = parseJson(rawInput);

  const primary = extractFromChangedObjects(json);
  const fallback = extractFromEffects(json);

  const packageId = primary.packageId ?? fallback.packageId;
  const sharedId = primary.sharedId ?? fallback.sharedId;

  if (!packageId || !sharedId) {
    throw new Error(
      `Unable to extract required IDs. packageId=${packageId ?? 'missing'}, sharedId=${sharedId ?? 'missing'}`
    );
  }

  const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  let nextContent = envContent;
  nextContent = upsertEnv(nextContent, PACKAGE_KEY, packageId);
  nextContent = upsertEnv(nextContent, SHARED_KEY, sharedId);
  fs.writeFileSync(envPath, nextContent);

  process.stdout.write(`${PACKAGE_KEY}=${packageId}\n`);
  process.stdout.write(`${SHARED_KEY}=${sharedId}\n`);
  process.stdout.write(`Updated ${envPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
