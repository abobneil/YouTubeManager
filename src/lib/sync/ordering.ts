import { OrderMode } from "@prisma/client";

export type OrderedVideo = {
  id: string;
  publishedAt: Date;
};

export function sortForInsertion(videos: OrderedVideo[], orderMode: OrderMode): OrderedVideo[] {
  const sorted = [...videos].sort(
    (left, right) => left.publishedAt.getTime() - right.publishedAt.getTime(),
  );
  if (orderMode === OrderMode.OLDEST) {
    return sorted;
  }
  // NEWEST mode inserts each item at position 0, so we still process oldest to newest.
  return sorted;
}

export function insertionPositionForMode(orderMode: OrderMode): number | undefined {
  if (orderMode === OrderMode.NEWEST) {
    return 0;
  }
  return undefined;
}
