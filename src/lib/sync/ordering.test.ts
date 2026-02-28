import { OrderMode } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { insertionPositionForMode, sortForInsertion } from "@/lib/sync/ordering";

describe("sortForInsertion", () => {
  const samples = [
    { id: "a", publishedAt: new Date("2024-01-02T00:00:00Z") },
    { id: "b", publishedAt: new Date("2024-01-01T00:00:00Z") },
  ];

  it("sorts ascending for oldest mode", () => {
    const ids = sortForInsertion(samples, OrderMode.OLDEST).map((video) => video.id);
    expect(ids).toEqual(["b", "a"]);
  });

  it("sorts ascending for newest mode because insertion happens at position 0", () => {
    const ids = sortForInsertion(samples, OrderMode.NEWEST).map((video) => video.id);
    expect(ids).toEqual(["b", "a"]);
  });

  it("returns insertion position for newest", () => {
    expect(insertionPositionForMode(OrderMode.NEWEST)).toBe(0);
    expect(insertionPositionForMode(OrderMode.OLDEST)).toBeUndefined();
  });
});
