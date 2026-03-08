import { prisma } from "@/lib/db";

export type OwnerAuthState =
  | { status: "uninitialized" }
  | {
      status: "initialized";
      owner: {
        id: string;
        googleSub: string;
        email: string;
      };
    };

export type OwnerProfile = {
  sub: string;
  email: string;
  email_verified: boolean;
};

export type OwnerAuthDecision =
  | { ok: true; action: "enroll" | "login" }
  | {
      ok: false;
      code:
        | "OWNER_EMAIL_NOT_VERIFIED"
        | "OWNER_EMAIL_NOT_ALLOWED"
        | "OWNER_SUB_MISMATCH";
    };

export function normalizeOwnerEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAllowlistedOwnerEmail(email: string, allowlist: string[]): boolean {
  const normalized = normalizeOwnerEmail(email);
  return allowlist.includes(normalized);
}

export function authorizeOwnerProfile(
  state: OwnerAuthState,
  profile: OwnerProfile,
  allowlist: string[],
): OwnerAuthDecision {
  if (!profile.email_verified) {
    return { ok: false, code: "OWNER_EMAIL_NOT_VERIFIED" };
  }

  if (state.status === "uninitialized") {
    if (!isAllowlistedOwnerEmail(profile.email, allowlist)) {
      return { ok: false, code: "OWNER_EMAIL_NOT_ALLOWED" };
    }
    return { ok: true, action: "enroll" };
  }

  if (state.owner.googleSub !== profile.sub) {
    return { ok: false, code: "OWNER_SUB_MISMATCH" };
  }

  return { ok: true, action: "login" };
}

export async function getOwnerAuthState(): Promise<OwnerAuthState> {
  const owner = await prisma.ownerAccount.findUnique({
    where: { id: "owner" },
    select: {
      id: true,
      googleSub: true,
      email: true,
    },
  });

  if (!owner) {
    return { status: "uninitialized" };
  }

  return {
    status: "initialized",
    owner,
  };
}
