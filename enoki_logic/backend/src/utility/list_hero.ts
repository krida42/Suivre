import { Transaction } from "@mysten/sui/transactions";

export const listHero = (packageId: string, heroId: string, priceInSui: string) => {
  const tx = new Transaction();
  
  const normalizedPrice = priceInSui.replace(/,/g, '.');
  const priceInMist = Number(normalizedPrice) * 1_000_000_000;
  
  tx.moveCall({
    target: `${packageId}::hero::list_hero`,
    typeArguments: [],
    arguments: [
      tx.object(heroId),
      tx.pure.u64(priceInMist),
      tx.object.clock,
    ],
  });
  
  return tx;
};
