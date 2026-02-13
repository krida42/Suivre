import type { Creator } from "@models/domain";
import type { ContentCreator } from "@models/creators";

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
    pricePerMonth: Number(creator.price_per_month).toFixed(2) || "0",
  };
}
