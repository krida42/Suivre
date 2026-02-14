import { Transaction } from "@mysten/sui/transactions";

export const createHero = (packageId: string, name: string, imageUrl: string, power: string, destination: string) => {
  const tx = new Transaction();
  
  const powerValue = Math.round(parseFloat(power));

  const res = tx.moveCall({
    target: `${packageId}::hero::create_hero`,
    typeArguments: [],
    arguments: [
      tx.pure.string(name),
      tx.pure.string(imageUrl),
      tx.pure.u64(powerValue),
      tx.object.clock,
    ],
  });

  tx.transferObjects([res], tx.pure.address(destination));
  
  return tx;
};
