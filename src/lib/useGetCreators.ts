import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { ContentCreatorpackageId } from "./package_id";
import { useEnokiAuth } from "../context/EnokiAuthContext";

export type ContentCreator = {
  id: string;
  pseudo: string;
  description: string;
  owner: string;
  image_url: string;
  // Raw on-chain price per month (u64 in MIST, usually serialized as a string)
  price_per_month: string;
};

export const useGetCreators = () => {
  const suiClient = useSuiClient();
  const { accountAddress } = useEnokiAuth();
  const walletAccount = useCurrentAccount();

  return async function getCreators(): Promise<ContentCreator[]> {
    const activeAddress = accountAddress || walletAccount?.address;
    if (!activeAddress) {
      console.warn("getCreators called without a connected account; returning empty list.");
      return [];
    }

    const res = await suiClient.getOwnedObjects({
      owner: activeAddress,
      options: {
        showContent: true,
        showType: true,
      },
      filter: {
        StructType: `${ContentCreatorpackageId}::content_creator::ContentCreator`,
      },
    });

    const contentCreators = res.data
      .map((obj) => {
        const fields = (obj!.data!.content as { fields: Record<string, any> }).fields;
        const pseudoFirstChar = fields.pseudo.charAt(0);
        const pseudoSecondChar = fields.pseudo.charAt(1);
        const imageUrl = `https://avatar.iran.liara.run/username?username=${pseudoFirstChar}+${pseudoSecondChar}`;
        return {
          id: fields?.id.id,
          pseudo: fields?.pseudo,
          description: fields?.description,
          owner: fields?.wallet,
          image_url: fields?.image_url || (imageUrl as string),
          price_per_month: String(fields?.price_per_month ?? "0"),
        };
      })
      .filter((item) => item !== null) as ContentCreator[];

    return contentCreators;
  };
};
