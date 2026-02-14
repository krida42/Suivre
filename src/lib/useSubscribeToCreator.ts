import { useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import { ContentCreatorpackageId } from "./package_id";
import { useEnokiAuth } from "../context/EnokiAuthContext";
import { sponsorAndExecuteTransaction } from "./sponsoredTransactions";

type SubscribeArgs = {
  creatorId: string;
};

type UseSubscribeToCreatorReturn = {
  subscribeToCreator: (args: SubscribeArgs) => Promise<void>;
  isSubscribing: boolean;
  error: string | null;
};

/**
 * Hook to subscribe to a creator on-chain using sponsored zkLogin transaction flow.
 */
export const useSubscribeToCreator = (): UseSubscribeToCreatorReturn => {
  const { accountAddress, signSponsoredTransaction } = useEnokiAuth();
  const walletAccount = useCurrentAccount();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const suiClient = useSuiClient();

  const [isSubscribing, setIsSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subscribeToCreator = async ({ creatorId }: SubscribeArgs): Promise<void> => {
    const activeAddress = accountAddress || walletAccount?.address;
    if (!activeAddress) {
      throw new Error("Aucun compte connecté (zkLogin ou wallet)");
    }

    setIsSubscribing(true);
    setError(null);

    try {
      // 1. Fetch the ContentCreator object to read the on-chain price_per_month.
      const creatorObject = await suiClient.getObject({
        id: creatorId,
        options: {
          showContent: true,
        },
      });

      const moveObject = creatorObject.data?.content;
      const fields = (moveObject as { fields?: { price_per_month?: string } } | null)?.fields;
      const priceField = fields?.price_per_month;

      if (!priceField) {
        throw new Error("Unable to read creator price_per_month from on-chain object");
      }

      const pricePerMonth = BigInt(priceField);
      const tx = new Transaction();
      const isZkLoginMode = Boolean(accountAddress);

      if (isZkLoginMode) {
        // In sponsored mode, gas coin belongs to sponsor.
        // We must split the subscription payment from a SUI coin owned by the user.
        const userSuiCoins = await suiClient.getCoins({
          owner: activeAddress,
          coinType: "0x2::sui::SUI",
        });

        const paymentSourceCoin = userSuiCoins.data.find((coin) => BigInt(coin.balance) >= pricePerMonth);
        if (!paymentSourceCoin) {
          throw new Error("Solde SUI insuffisant pour payer cet abonnement.");
        }
        const [feeCoin] = tx.splitCoins(tx.object(paymentSourceCoin.coinObjectId), [tx.pure.u64(pricePerMonth)]);
        tx.moveCall({
          target: `${ContentCreatorpackageId}::content_creator::subscribe`,
          arguments: [feeCoin, tx.object(creatorId), tx.object(SUI_CLOCK_OBJECT_ID)],
        });
      } else {
        // Wallet mode: split from user's gas coin directly.
        const [feeCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(pricePerMonth)]);
        tx.moveCall({
          target: `${ContentCreatorpackageId}::content_creator::subscribe`,
          arguments: [feeCoin, tx.object(creatorId), tx.object(SUI_CLOCK_OBJECT_ID)],
        });
      }

      if (isZkLoginMode) {
        await sponsorAndExecuteTransaction({
          transaction: tx,
          client: suiClient,
          sender: activeAddress,
          signSponsoredTransaction,
          moveCallTarget: `${ContentCreatorpackageId}::content_creator::subscribe`,
        });
      } else {
        await new Promise<void>((resolve, reject) => {
          signAndExecuteTransaction(
            { transaction: tx },
            {
              onSuccess: () => resolve(),
              onError: (err: Error) => reject(err),
            },
          );
        });
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
};
