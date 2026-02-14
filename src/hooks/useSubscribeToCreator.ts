import { useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import type { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import { CONTENT_CREATOR_PACKAGE_ID } from "@config/chain";
import { mutateAsync } from "@utils/sui/mutateAsync";
import { getObjectFields } from "@utils/sui/objectParsing";

type SubscribeArgs = {
  creatorId: string;
};

type UseSubscribeToCreatorReturn = {
  subscribeToCreator: (args: SubscribeArgs) => Promise<void>;
  isSubscribing: boolean;
  error: string | null;
};

type ExecuteTransactionResult = {
  digest: string;
};

export function useSubscribeToCreator(): UseSubscribeToCreatorReturn {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient() as SuiClient;
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

      const fields = getObjectFields(creatorObject.data?.content);
      const priceField = fields?.price_per_month;

      if (priceField == null) {
        throw new Error("Unable to read creator price_per_month from on-chain object");
      }

      // On-chain price is stored in MIST (u64), so we use it directly as split amount.
      const pricePerMonth = BigInt(String(priceField));
      const tx = new Transaction();

      const [feeCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(pricePerMonth)]);

      tx.moveCall({
        target: `${CONTENT_CREATOR_PACKAGE_ID}::content_creator::subscribe`,
        arguments: [feeCoin, tx.object(creatorId), tx.object(SUI_CLOCK_OBJECT_ID)],
      });

      const result = await mutateAsync<{ transaction: Transaction }, ExecuteTransactionResult>(
        signAndExecuteTransaction as unknown as (
          variables: { transaction: Transaction },
          callbacks: {
            onSuccess: (result: ExecuteTransactionResult) => void;
            onError: (error: unknown) => void;
          }
        ) => void,
        { transaction: tx }
      );

      if (!result.digest) {
        throw new Error("Subscription transaction digest not found");
      }

      // We wait for final effects to surface on-chain failures that can happen after signature.
      const txResult = await suiClient.waitForTransaction({
        digest: result.digest,
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
