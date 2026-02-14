import type { CSSProperties } from "react";
import type { GoutteFeedPost } from "./types";

export type MasonrySlot = {
  post: GoutteFeedPost & { uniqueId?: string };
  style: CSSProperties;
  index: number;
  uniqueId?: string;
};

export function useMasonry(
  posts?: GoutteFeedPost[],
  config?: { containerWidth?: number }
): { slots: MasonrySlot[]; sceneHeight: number };
