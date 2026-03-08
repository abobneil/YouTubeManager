import { describe, expect, it } from "vitest";
import { isAllowedMutationRequest } from "@/lib/security";

describe("mutation origin checks", () => {
  const allowedOrigins = ["https://app.example.com"];

  it("accepts matching origin", () => {
    const request = new Request("https://app.example.com/api/rules", {
      method: "POST",
      headers: {
        origin: "https://app.example.com",
      },
    });

    expect(isAllowedMutationRequest(request, allowedOrigins)).toBe(true);
  });

  it("rejects mismatched origin", () => {
    const request = new Request("https://app.example.com/api/rules", {
      method: "POST",
      headers: {
        origin: "https://evil.example.com",
      },
    });

    expect(isAllowedMutationRequest(request, allowedOrigins)).toBe(false);
  });

  it("accepts missing origin when referer matches", () => {
    const request = new Request("https://app.example.com/api/rules", {
      method: "POST",
      headers: {
        referer: "https://app.example.com/dashboard",
      },
    });

    expect(isAllowedMutationRequest(request, allowedOrigins)).toBe(true);
  });

  it("rejects requests without origin or referer", () => {
    const request = new Request("https://app.example.com/api/rules", {
      method: "POST",
    });

    expect(isAllowedMutationRequest(request, allowedOrigins)).toBe(false);
  });
});
