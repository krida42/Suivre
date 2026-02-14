import { Transaction } from "@mysten/sui/transactions";

const MIST_PER_SUI = 1_000_000_000;

function toMistFromSuiAmount(amountInSui: string): bigint {
  const normalizedPrice = amountInSui.replace(/,/g, ".");
  const parsedAmount = Number(normalizedPrice);

  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    throw new Error("Price must be a positive number.");
  }

  return BigInt(Math.floor(parsedAmount * MIST_PER_SUI));
}

export function buildCreateHeroTransaction(
  packageId: string,
  name: string,
  imageUrl: string,
  power: string,
  destination: string,
) {
  const tx = new Transaction();
  const powerValue = Math.round(parseFloat(power));

  const createdHero = tx.moveCall({
    target: `${packageId}::hero::create_hero`,
    typeArguments: [],
    arguments: [
      tx.pure.string(name),
      tx.pure.string(imageUrl),
      tx.pure.u64(powerValue),
      tx.object.clock,
    ],
  });

  tx.transferObjects([createdHero], tx.pure.address(destination));
  return tx;
}

export function buildListHeroTransaction(packageId: string, heroId: string, priceInSui: string) {
  const tx = new Transaction();
  const priceInMist = toMistFromSuiAmount(priceInSui);

  tx.moveCall({
    target: `${packageId}::hero::list_hero`,
    typeArguments: [],
    arguments: [tx.object(heroId), tx.pure.u64(priceInMist), tx.object.clock],
  });

  return tx;
}

export function buildBuyHeroTransaction(
  packageId: string,
  paymentCoinObject: string,
  listHeroId: string,
  priceInSui: string,
  destination: string,
) {
  const tx = new Transaction();
  const priceInMist = toMistFromSuiAmount(priceInSui);

  const [paymentCoin] = tx.splitCoins(tx.object(paymentCoinObject), [priceInMist]);

  const purchasedHero = tx.moveCall({
    target: `${packageId}::hero::buy_hero`,
    typeArguments: [],
    arguments: [tx.object(listHeroId), paymentCoin, tx.object.clock],
  });

  tx.transferObjects([purchasedHero], tx.pure.address(destination));
  return tx;
}

export function buildTransferHeroTransaction(heroId: string, recipient: string) {
  const tx = new Transaction();
  tx.transferObjects([tx.object(heroId)], tx.pure.address(recipient));
  return tx;
}
