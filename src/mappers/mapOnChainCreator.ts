import type { ContentCreator } from "@models/creators";
import { extractObjectId, getObjectFields } from "@utils/sui/objectParsing";

type MaybeObjectResponse = {
  data?: {
    objectId?: string | null;
    content?: unknown;
  } | null;
};

export function mapOnChainCreatorObjectToContentCreator(object: MaybeObjectResponse): ContentCreator | null {
  const fields = getObjectFields(object.data?.content);
  if (!fields) return null;

  const pseudo = String(fields.pseudo ?? "");
  const first = pseudo.charAt(0);
  const second = pseudo.charAt(1);
  const fallbackImage = `https://avatar.iran.liara.run/username?username=${first}+${second}`;

  const creatorId = extractObjectId(fields.id) ?? object.data?.objectId ?? "";
  if (!creatorId) return null;

  return {
    id: String(creatorId),
    pseudo,
    description: String(fields.description ?? ""),
    owner: String(fields.wallet ?? ""),
    image_url: String(fields.image_url ?? fallbackImage),
    price_per_month: String(fields.price_per_month ?? "0"),
  };
}
