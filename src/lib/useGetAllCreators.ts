import { useSuiClient } from "@mysten/dapp-kit";
import { allCreatorObjectId } from "./package_id";

export type ContentCreator = {
  id: string;
  pseudo: string;
  description: string;
  owner: string;
  image_url: string;
  // Raw on-chain price per month (u64 in MIST, usually serialized as a string)
  price_per_month: string;
};

/**
 * Fetch **all** `ContentCreator` objects registered in the on-chain
 * `sui_fan::content_creator::AllCreators` table, regardless of who owns them.
 *
 * Flow:
 * 1. Load the `AllCreators` object by its known ID (`allCreatorObjectId`).
 * 2. Read the internal `creators: table::Table<address, ID>` field and get its table object ID.
 * 3. Use `getDynamicFields` on that table to list all entries (address → ID).
 * 4. For each stored `ID`, load the corresponding `ContentCreator` object.
 */
export const useGetAllCreators = () => {
  const suiClient = useSuiClient();

  return async function getAllCreators(): Promise<ContentCreator[]> {
    // 1) Load the shared AllCreators object
    const allCreatorsObject = await suiClient.getObject({
      id: allCreatorObjectId,
      options: {
        showContent: true,
      },
    });

    const allCreatorsFields = (allCreatorsObject.data?.content as { fields: any } | null)?.fields;
    if (!allCreatorsFields) {
      console.warn("AllCreators object not found or has no fields", allCreatorsObject);
      return [];
    }

    // 2) Extract the internal table object ID from `creators: Table<address, ID>`
    const tableId = allCreatorsFields.creators?.fields?.id?.id ?? allCreatorsFields.creators?.fields?.id ?? undefined;

    if (!tableId || typeof tableId !== "string") {
      console.warn("Unable to resolve table ID from AllCreators.creators", allCreatorsFields);
      return [];
    }

    // 3) Walk the dynamic fields of the table to collect all stored creator IDs
    const creatorIds: string[] = [];
    let cursor: string | null = null;

    // Paginate over dynamic fields in case there are many creators.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const page = await suiClient.getDynamicFields({
        parentId: tableId,
        cursor: cursor ?? undefined,
        limit: 50,
      });

      if (!page.data.length) break;

      for (const field of page.data) {
        try {
          // Each dynamic field is a `0x2::table::Entry<address, 0x2::object::ID>`.
          const entryObject = await suiClient.getObject({
            id: field.objectId,
            options: { showContent: true },
          });

          const entryFields = (entryObject.data?.content as { fields: any } | null)?.fields;
          if (!entryFields) continue;
          const value = entryFields.value;
          // The stored value is an `ID` struct; extract the underlying object ID.
          const creatorId = value?.fields?.id ?? value?.id ?? value ?? null;

          if (typeof creatorId === "string") {
            creatorIds.push(creatorId);
          }
        } catch (e) {
          console.warn("Failed to load AllCreators table entry", field, e);
        }
      }

      if (!page.hasNextPage || !page.nextCursor) break;
      cursor = page.nextCursor;
    }

    if (!creatorIds.length) {
      return [];
    }

    // 4) Load all ContentCreator objects for the collected IDs
    const creatorObjects = await suiClient.multiGetObjects({
      ids: creatorIds,
      options: {
        showContent: true,
        showType: true,
      },
    });

    const contentCreators = creatorObjects
      .map((obj) => {
        const fields = (obj.data?.content as { fields: any } | null)?.fields;
        if (!fields) return null;

        const pseudoFirstChar = fields.pseudo.charAt(0);
        const pseudoSecondChar = fields.pseudo.charAt(1);
        const imageUrl = `https://avatar.iran.liara.run/username?username=${pseudoFirstChar}+${pseudoSecondChar}`;

        return {
          id: fields.id?.id as string,
          pseudo: fields.pseudo as string,
          description: fields.description as string,
          // The Move struct exposes `wallet: address`; we surface it as `owner` in the UI.
          owner: fields.wallet as string,
          image_url: fields?.image_url || (imageUrl as string),
          price_per_month: String((fields as any).price_per_month ?? "0"),
        } as ContentCreator;
      })
      .filter((item) => item !== null) as ContentCreator[];

    console.log("🚀 ~ getAllCreators ~ contentCreators:", contentCreators);
    return contentCreators;
  };
};
