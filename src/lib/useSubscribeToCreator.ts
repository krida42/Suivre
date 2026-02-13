import { useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import { ContentCreatorpackageId } from "./package_id";

type SubscribeArgs = {
  creatorId: string;
};

type UseSubscribeToCreatorReturn = {
  subscribeToCreator: (args: SubscribeArgs) => Promise<void>;
  isSubscribing: boolean;
  error: string | null;
};

/**
 * Hook to subscribe to a creator on-chain using the `subscribe` Move function.
 *
 * It:
 * - Fetches the on-chain `ContentCreator` object to read `price_per_month`
 * - Splits the gas coin to create a `Coin<SUI>` of exactly `price_per_month`
 * - Calls `${ContentCreatorpackageId}::content_creator::subscribe`
 */
export const useSubscribeToCreator = (): UseSubscribeToCreatorReturn => {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const [isSubscribing, setIsSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subscribeToCreator = async ({ creatorId }: SubscribeArgs): Promise<void> => {
    if (!currentAccount?.address) {
      throw new Error("Wallet not connected");
    }

    setIsSubscribing(true);
    setError(null);

    try {
      // 1. Fetch the ContentCreator object to read the on-chain price_per_month
      const creatorObject = await suiClient.getObject({
        id: creatorId,
        options: {
          showContent: true,
        },
      });

      const moveObject = creatorObject.data?.content;
      const fields = (moveObject as any)?.fields;
      const priceField = fields?.price_per_month;

      if (!priceField) {
        throw new Error("Unable to read creator price_per_month from on-chain object");
      }

      const pricePerMonth = BigInt(priceField);

      // 2. Build transaction: split gas coin to exact fee and call subscribe
      const tx = new Transaction();

      const [feeCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(pricePerMonth)]);

      tx.moveCall({
        target: `${ContentCreatorpackageId}::content_creator::subscribe`,
        arguments: [
          feeCoin, // Coin<SUI>
          tx.object(creatorId), // &ContentCreator
          tx.object(SUI_CLOCK_OBJECT_ID), // &Clock
        ],
      });

      await new Promise<void>((resolve, reject) => {
        signAndExecuteTransaction(
          { transaction: tx },
          {
            onSuccess: () => resolve(),
            onError: (err: Error) => reject(err),
          }
        );
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error while subscribing to creator";
      setError(message);
      throw e;
    } finally {
      setIsSubscribing(false);
    }
  };

  return {
    subscribeToCreator,
    isSubscribing,
    error,
  };
};
