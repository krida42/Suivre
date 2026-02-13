import { useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import { CONTENT_CREATOR_PACKAGE_ID } from "@config/chain";

type SubscribeArgs = {
  creatorId: string;
};

type UseSubscribeToCreatorReturn = {
  subscribeToCreator: (args: SubscribeArgs) => Promise<void>;
  isSubscribing: boolean;
  error: string | null;
};

export function useSubscribeToCreator(): UseSubscribeToCreatorReturn {
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
      const creatorObject = await suiClient.getObject({
        id: creatorId,
        options: {
          showContent: true,
        },
      });

      const fields = (creatorObject.data?.content as { fields?: Record<string, unknown> } | null)?.fields;
      const priceField = fields?.price_per_month;

      if (!priceField) {
        throw new Error("Unable to read creator price_per_month from on-chain object");
      }

      const pricePerMonth = BigInt(String(priceField));
      const tx = new Transaction();

      const [feeCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(pricePerMonth)]);

      tx.moveCall({
        target: `${CONTENT_CREATOR_PACKAGE_ID}::content_creator::subscribe`,
        arguments: [feeCoin, tx.object(creatorId), tx.object(SUI_CLOCK_OBJECT_ID)],
      });

      let txDigest: string | null = null;

      await new Promise<void>((resolve, reject) => {
        signAndExecuteTransaction(
          { transaction: tx },
          {
            onSuccess: (result: { digest: string }) => {
              txDigest = result.digest;
              resolve();
            },
            onError: (err: Error) => reject(err),
          }
        );
      });

      if (!txDigest) {
        throw new Error("Subscription transaction digest not found");
      }

      const txResult = await suiClient.waitForTransaction({
        digest: txDigest,
        options: {
          showEffects: true,
        },
      });

      const status = txResult.effects?.status;
      if (status?.status === "failure") {
        throw new Error(status.error || "Subscription transaction failed on-chain");
      }
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
}
