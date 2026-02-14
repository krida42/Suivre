import { Transaction } from "@mysten/sui/transactions";

export const buyHero = (packageId: string, paymentCoinObject: string, listHeroId: string, priceInSui: string, destination: string) => {
  const tx = new Transaction();
  
  const normalizedPrice = priceInSui.replace(/,/g, '.');
  const priceInMist = Number(normalizedPrice) * 1_000_000_000;
  
  const [paymentCoin] = tx.splitCoins(tx.object(paymentCoinObject), [priceInMist]);

  const res = tx.moveCall({
    target: `${packageId}::hero::buy_hero`,
    typeArguments: [],
     arguments: [
      tx.object(listHeroId),
      paymentCoin,
      tx.object.clock,
    ],
  });

  tx.transferObjects([res], tx.pure.address(destination));

  return tx;
};
