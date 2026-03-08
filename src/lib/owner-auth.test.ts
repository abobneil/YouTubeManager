import { describe, expect, it } from "vitest";
import {
  authorizeOwnerProfile,
  isAllowlistedOwnerEmail,
  normalizeOwnerEmail,
  type OwnerAuthState,
} from "@/lib/owner-auth";

describe("owner auth policy", () => {
  it("normalizes and matches allowlisted emails exactly", () => {
    expect(normalizeOwnerEmail(" Owner@Example.com ")).toBe("owner@example.com");
    expect(isAllowlistedOwnerEmail("Owner@Example.com", ["owner@example.com"])).toBe(true);
    expect(isAllowlistedOwnerEmail("other@example.com", ["owner@example.com"])).toBe(false);
  });

  it("allows first-time enrollment for an allowlisted verified email", () => {
    const decision = authorizeOwnerProfile(
      { status: "uninitialized" },
      {
        sub: "sub-1",
        email: "owner@example.com",
        email_verified: true,
      },
      ["owner@example.com"],
    );

    expect(decision).toEqual({ ok: true, action: "enroll" });
  });

  it("rejects first-time enrollment for a disallowed email", () => {
    const decision = authorizeOwnerProfile(
      { status: "uninitialized" },
      {
        sub: "sub-1",
        email: "other@example.com",
        email_verified: true,
      },
      ["owner@example.com"],
    );

    expect(decision).toEqual({ ok: false, code: "OWNER_EMAIL_NOT_ALLOWED" });
  });

  it("rejects unverified emails", () => {
    const decision = authorizeOwnerProfile(
      { status: "uninitialized" },
      {
        sub: "sub-1",
        email: "owner@example.com",
        email_verified: false,
      },
      ["owner@example.com"],
    );

    expect(decision).toEqual({ ok: false, code: "OWNER_EMAIL_NOT_VERIFIED" });
  });

  it("allows login only for the bound Google subject", () => {
    const initializedState: OwnerAuthState = {
      status: "initialized",
      owner: {
        id: "owner",
        googleSub: "sub-1",
        email: "owner@example.com",
      },
    };

    expect(
      authorizeOwnerProfile(
        initializedState,
        {
          sub: "sub-1",
          email: "owner@example.com",
          email_verified: true,
        },
        ["owner@example.com"],
      ),
    ).toEqual({ ok: true, action: "login" });

    expect(
      authorizeOwnerProfile(
        initializedState,
        {
          sub: "sub-2",
          email: "owner@example.com",
          email_verified: true,
        },
        ["owner@example.com"],
      ),
    ).toEqual({ ok: false, code: "OWNER_SUB_MISMATCH" });
  });
});
