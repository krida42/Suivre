import dotenv from 'dotenv';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { toBase64 } from '@mysten/sui/utils';

dotenv.config({ path: 'backend/.env' });
dotenv.config();

const network = (process.env.SUI_NETWORK || process.env.VITE_SUI_NETWORK || 'testnet').toLowerCase();
const packageId = process.env.PACKAGE_ID || process.env.VITE_PACKAGE_ID;
const allCreatorObjectId =
  process.env.VITE_ALL_CREATOR_OBJECT_ID ||
  '0xd6f5d9c3808fdd06b4ebf53746e8b20c50a539120862d90507d525993a2b4eb8';

if (!packageId) {
  throw new Error('Missing PACKAGE_ID / VITE_PACKAGE_ID');
}

const client = new SuiClient({
  url: getFullnodeUrl(network === 'mainnet' ? 'mainnet' : network === 'devnet' ? 'devnet' : 'testnet'),
});

const tx = new Transaction();
tx.moveCall({
  target: `${packageId}::content_creator::new`,
  arguments: [
    tx.object(allCreatorObjectId),
    tx.pure.string('sponsor-smoke-test'),
    tx.pure.u64(1n),
    tx.pure.string('desc'),
    tx.pure.string('img-url'),
  ],
});

const bytes = await tx.build({ client, onlyTransactionKind: true });
console.log(toBase64(bytes));
