import { useState } from "react";
import { useSignAndExecuteTransaction, useSignTransaction, useSuiClient } from "@mysten/dapp-kit";
import type { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import { CONTENT_CREATOR_PACKAGE_ID } from "@config/chain";
import { useEnokiAuth } from "@context/EnokiAuthContext";
import { useActiveAddress } from "@hooks/useActiveAddress";
import { executeTransactionWithOptionalSponsor } from "@utils/sui/sponsoredTransactions";
import { getObjectFields } from "@utils/sui/objectParsing";

type SubscribeArgs = {
  creatorId: string;
};

type UseSubscribeToCreatorReturn = {
  subscribeToCreator: (args: SubscribeArgs) => Promise<void>;
  isSubscribing: boolean;
  error: string | null;
};

export function useSubscribeToCreator(): UseSubscribeToCreatorReturn {
  const { address: activeAddress, isZkLoginConnected } = useActiveAddress();
  const { signSponsoredTransaction } = useEnokiAuth();
  const suiClient = useSuiClient() as SuiClient;
  const { mutate: signTransaction } = useSignTransaction();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const [isSubscribing, setIsSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subscribeToCreator = async ({ creatorId }: SubscribeArgs): Promise<void> => {
    if (!activeAddress) {
      throw new Error("No connected account");
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

      const result = await executeTransactionWithOptionalSponsor({
        operation: "SUBSCRIBE_CREATOR",
        transaction: tx,
        client: suiClient,
        sender: activeAddress,
        signSponsoredTransaction: isZkLoginConnected ? signSponsoredTransaction : undefined,
        signTransactionMutate: signTransaction,
        signAndExecuteTransactionMutate: signAndExecuteTransaction as unknown as (
          variables: { transaction: Transaction },
          callbacks: {
            onSuccess: (result: { digest: string }) => void;
            onError: (error: unknown) => void;
          }
        ) => void,
        allowedMoveCallTargets: [`${CONTENT_CREATOR_PACKAGE_ID}::content_creator::subscribe`],
      });

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
