import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { EnokiClient } from '@mysten/enoki';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { toBase64 } from '@mysten/sui/utils';
import { createHero } from './utility/create_hero';
import { listHero } from './utility/list_hero';
import { buyHero } from './utility/buy_hero';
import { transferHero } from './utility/transfer_hero';
import { logTransaction, logRequest, logServer, logError } from './helpers/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize clients
const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });
const enokiClient = new EnokiClient({
  apiKey: process.env.ENOKI_PRIVATE_KEY!
});
const walrusSubscriptionType = process.env.WALRUS_SUBSCRIPTION_TYPE;

app.use(cors());
app.use(express.json());

const parseStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;

  const sanitizedValues = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return sanitizedValues.length > 0 ? sanitizedValues : undefined;
};

const getWalrusObjectIds = () => {
  return (process.env.WALRUS_OBJECT_IDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
};

const hasWalrusSubscription = async (address: string, subscriptionType: string) => {
  const response = await suiClient.getOwnedObjects({
    owner: address,
    filter: {
      StructType: subscriptionType,
    },
    limit: 1,
  });

  return response.data.length > 0;
};

// Request logging middleware
app.use((req, res, next) => {
  logRequest(req.method, req.path, req.headers['user-agent']);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Hero Marketplace Backend' });
});

// Generic sponsor endpoint for frontend-built transaction blocks
app.post('/api/sponsor', async (req, res) => {
  try {
    const { sender, transactionKindBytes, allowedMoveCallTargets, allowedAddresses } = req.body;

    if (typeof sender !== 'string' || !sender.trim()) {
      return res.status(400).json({ error: 'Invalid sender. Expected a non-empty string.' });
    }

    if (typeof transactionKindBytes !== 'string' || !transactionKindBytes.trim()) {
      return res.status(400).json({ error: 'Invalid transactionKindBytes. Expected base64-encoded transaction kind bytes.' });
    }

    const moveCallTargets = parseStringArray(allowedMoveCallTargets);
    const allowedAddressList = parseStringArray(allowedAddresses);

    logServer('Sponsoring transaction request', {
      sender: `${sender.slice(0, 6)}...${sender.slice(-4)}`,
      moveCallTargetCount: moveCallTargets?.length ?? 0,
      allowedAddressCount: allowedAddressList?.length ?? 0,
    });

    const sponsored = await enokiClient.createSponsoredTransaction({
      network: 'testnet',
      sender,
      transactionKindBytes,
      ...(moveCallTargets ? { allowedMoveCallTargets: moveCallTargets } : {}),
      ...(allowedAddressList ? { allowedAddresses: allowedAddressList } : {}),
    });

    return res.json({
      bytes: sponsored.bytes,
      digest: sponsored.digest,
    });
  } catch (error) {
    logError('Sponsor transaction failed', error, {
      sender: req.body?.sender,
    });

    return res.status(500).json({ error: 'Failed to sponsor transaction' });
  }
});

// Token-gating preparation route for Walrus object access
app.post('/api/walrus/access', async (req, res) => {
  try {
    const { address } = req.body;

    if (typeof address !== 'string' || !address.trim()) {
      return res.status(400).json({ error: 'Invalid address. Expected a non-empty Sui address.' });
    }

    if (!walrusSubscriptionType) {
      return res.status(503).json({
        error: 'Walrus token-gating is not configured. Set WALRUS_SUBSCRIPTION_TYPE on the backend.',
      });
    }

    const subscribed = await hasWalrusSubscription(address, walrusSubscriptionType);
    if (!subscribed) {
      return res.status(403).json({
        error: 'Subscription required. This address does not hold the required Walrus subscription token.',
      });
    }

    const walrusObjectIds = getWalrusObjectIds();
    logServer('Walrus access granted', {
      address: `${address.slice(0, 6)}...${address.slice(-4)}`,
      walrusObjectCount: walrusObjectIds.length,
      subscriptionType: walrusSubscriptionType,
    });

    return res.json({ walrusObjectIds });
  } catch (error) {
    logError('Walrus access verification failed', error, {
      address: req.body?.address,
    });

    return res.status(500).json({ error: 'Failed to verify Walrus access' });
  }
});

// Create Hero - Sponsored Transaction
app.post('/api/create-hero', async (req, res) => {
  try {
    const { sender, packageId, name, imageUrl, power } = req.body;

    logTransaction('CREATE_HERO', sender, {
      name,
      power,
      imageUrl: imageUrl?.slice(0, 50) + '...'
    });

    const tx = createHero(packageId, name, imageUrl, power, sender);

    const txBytes = await tx.build({
      client: suiClient,
      onlyTransactionKind: true,
    });

    const sponsored = await enokiClient.createSponsoredTransaction({
      network: 'testnet',
      transactionKindBytes: toBase64(txBytes),
      sender,
      allowedMoveCallTargets: [`${packageId}::hero::create_hero`],
    });

    logTransaction('CREATE_HERO', sender, {
      name,
      power,
      digest: sponsored.digest
    }, 'SUCCESS');

    res.json({ 
      bytes: sponsored.bytes, 
      digest: sponsored.digest 
    });
  } catch (error) {
    logError('Create hero transaction failed', error, {
      sender: req.body.sender,
      name: req.body.name
    });
    
    logTransaction('CREATE_HERO', req.body.sender || 'unknown', {
      name: req.body.name,
      error: error instanceof Error ? error.message : String(error)
    }, 'ERROR');

    res.status(500).json({ error: 'Failed to create sponsored transaction' });
  }
});

// List Hero - Sponsored Transaction  
app.post('/api/list-hero', async (req, res) => {
  try {
    const { sender, packageId, heroId, price } = req.body;

    logTransaction('LIST_HERO', sender, {
      heroId: `${heroId.slice(0, 8)}...${heroId.slice(-4)}`,
      price: `${price} SUI`
    });

    const tx = listHero(packageId, heroId, price);

    const txBytes = await tx.build({
      client: suiClient,
      onlyTransactionKind: true,
    });

    const sponsored = await enokiClient.createSponsoredTransaction({
      network: 'testnet',
      transactionKindBytes: toBase64(txBytes),
      sender,
      allowedMoveCallTargets: [`${packageId}::hero::list_hero`],
    });

    logTransaction('LIST_HERO', sender, {
      heroId: `${heroId.slice(0, 8)}...${heroId.slice(-4)}`,
      price: `${price} SUI`,
      digest: sponsored.digest
    }, 'SUCCESS');

    res.json({ 
      bytes: sponsored.bytes, 
      digest: sponsored.digest 
    });
  } catch (error) {
    logError('List hero transaction failed', error, {
      sender: req.body.sender,
      heroId: req.body.heroId
    });
    
    logTransaction('LIST_HERO', req.body.sender || 'unknown', {
      heroId: req.body.heroId,
      price: req.body.price,
      error: error instanceof Error ? error.message : String(error)
    }, 'ERROR');

    res.status(500).json({ error: 'Failed to create sponsored transaction' });
  }
});

// Buy Hero - Sponsored Transaction
app.post('/api/buy-hero', async (req, res) => {
  try {
    const { sender, packageId, paymentCoinObject, listHeroId, price } = req.body;

    logTransaction('BUY_HERO', sender, {
      listHeroId: `${listHeroId.slice(0, 8)}...${listHeroId.slice(-4)}`,
      price: `${price} SUI`,
      paymentCoin: `${paymentCoinObject.slice(0, 8)}...${paymentCoinObject.slice(-4)}`
    });

    const tx = buyHero(packageId, paymentCoinObject, listHeroId, price, sender);

    const txBytes = await tx.build({
      client: suiClient,
      onlyTransactionKind: true,
    });

    const sponsored = await enokiClient.createSponsoredTransaction({
      network: 'testnet',
      transactionKindBytes: toBase64(txBytes),
      sender,
      allowedMoveCallTargets: [`${packageId}::hero::buy_hero`],
    });

    logTransaction('BUY_HERO', sender, {
      listHeroId: `${listHeroId.slice(0, 8)}...${listHeroId.slice(-4)}`,
      price: `${price} SUI`,
      digest: sponsored.digest
    }, 'SUCCESS');

    res.json({ 
      bytes: sponsored.bytes, 
      digest: sponsored.digest 
    });
  } catch (error) {
    logError('Buy hero transaction failed', error, {
      sender: req.body.sender,
      listHeroId: req.body.listHeroId,
      price: req.body.price
    });
    
    logTransaction('BUY_HERO', req.body.sender || 'unknown', {
      listHeroId: req.body.listHeroId,
      price: req.body.price,
      error: error instanceof Error ? error.message : String(error)
    }, 'ERROR');

    res.status(500).json({ error: 'Failed to create sponsored transaction' });
  }
});

// Transfer Hero - Sponsored Transaction
app.post('/api/transfer-hero', async (req, res) => {
  try {
    const { sender, packageId, heroId, recipient } = req.body;

    logTransaction('TRANSFER_HERO', sender, {
      heroId: `${heroId.slice(0, 8)}...${heroId.slice(-4)}`,
      recipient: `${recipient.slice(0, 6)}...${recipient.slice(-4)}`
    });

    const tx = transferHero(heroId, recipient);

    const txBytes = await tx.build({
      client: suiClient,
      onlyTransactionKind: true,
    });

    const sponsored = await enokiClient.createSponsoredTransaction({
      network: 'testnet',
      transactionKindBytes: toBase64(txBytes),
      sender,
      allowedMoveCallTargets: [`${packageId}::hero::transfer_hero`],
      allowedAddresses: [recipient],
    });

    logTransaction('TRANSFER_HERO', sender, {
      heroId: `${heroId.slice(0, 8)}...${heroId.slice(-4)}`,
      recipient: `${recipient.slice(0, 6)}...${recipient.slice(-4)}`,
      digest: sponsored.digest
    }, 'SUCCESS');

    res.json({ 
      bytes: sponsored.bytes, 
      digest: sponsored.digest 
    });
  } catch (error) {
    logError('Transfer hero transaction failed', error, {
      sender: req.body.sender,
      heroId: req.body.heroId,
      recipient: req.body.recipient
    });
    
    logTransaction('TRANSFER_HERO', req.body.sender || 'unknown', {
      heroId: req.body.heroId,
      recipient: req.body.recipient,
      error: error instanceof Error ? error.message : String(error)
    }, 'ERROR');

    res.status(500).json({ error: 'Failed to create sponsored transaction' });
  }
});

// Execute Sponsored Transaction
app.post('/api/execute-transaction', async (req, res) => {
  try {
    const { digest, signature } = req.body;

    logServer('Executing sponsored transaction', {
      digest: `${digest.slice(0, 8)}...${digest.slice(-4)}`
    });

    const result = await enokiClient.executeSponsoredTransaction({
      digest,
      signature,
    });

    logServer('Transaction executed successfully', {
      digest: `${digest.slice(0, 8)}...${digest.slice(-4)}`,
      status: (result as any).effects?.status?.status
    });

    res.json({ result });
  } catch (error) {
    logError('Execute transaction failed', error, {
      digest: req.body.digest
    });

    res.status(500).json({ error: 'Failed to execute transaction' });
  }
});

app.listen(PORT, () => {
  logServer('Hero Marketplace Backend started', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    network: 'testnet'
  });
});
