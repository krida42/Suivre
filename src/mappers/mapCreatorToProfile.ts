import type { Creator } from "@models/domain";
import type { ContentCreator } from "@models/creators";
import { formatMistToSui } from "@utils/sui/amount";

export function mapCreatorToProfile(creator: ContentCreator): Creator {
  const first = creator.pseudo.charAt(0);
  const second = creator.pseudo.charAt(1);
  const fallbackImage = `https://avatar.iran.liara.run/username?username=${first}+${second}`;

  return {
    id: creator.id,
    name: creator.pseudo || "Createur",
    handle: creator.pseudo?.toLowerCase().replace(/\s+/g, "") || creator.owner,
    avatarUrl: creator.image_url || fallbackImage,
    bannerUrl: creator.image_url || fallbackImage,
    bio: creator.description || "",
    subscribers: "0",
    isVerified: false,
    videos: [],
    pricePerMonth: formatMistToSui(creator.price_per_month, 9),
  };
}
