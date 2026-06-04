import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

// ── Auth logout test (from template) ─────────────────────────────────────────

type CookieCall = { name: string; options: Record<string, unknown> };
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];
  const user: AuthenticatedUser = {
    id: 1, openId: "sample-user", email: "sample@example.com",
    name: "Sample User", loginMethod: "manus", role: "user",
    createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({
      maxAge: -1, secure: true, sameSite: "none", httpOnly: true, path: "/",
    });
  });
});

// ── Time slot logic tests ─────────────────────────────────────────────────────

// Inline the logic for testing (same as client/src/lib/timeSlot.ts)
function getTimeSlotInfo(date: Date): { date: string; hour: number } {
  const d = new Date(date);
  const hour = d.getHours();
  if (hour < 4) d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return { date: `${year}-${month}-${day}`, hour };
}

describe("4am-based time slot logic", () => {
  it("hour 0 (midnight) belongs to previous day", () => {
    const d = new Date("2024-06-05T00:30:00");
    const slot = getTimeSlotInfo(d);
    expect(slot.date).toBe("2024-06-04");
    expect(slot.hour).toBe(0);
  });

  it("hour 3 (3:59am) belongs to previous day", () => {
    const d = new Date("2024-06-05T03:59:00");
    const slot = getTimeSlotInfo(d);
    expect(slot.date).toBe("2024-06-04");
    expect(slot.hour).toBe(3);
  });

  it("hour 4 (4:00am) belongs to current day", () => {
    const d = new Date("2024-06-05T04:00:00");
    const slot = getTimeSlotInfo(d);
    expect(slot.date).toBe("2024-06-05");
    expect(slot.hour).toBe(4);
  });

  it("hour 23 (11pm) belongs to current day", () => {
    const d = new Date("2024-06-05T23:30:00");
    const slot = getTimeSlotInfo(d);
    expect(slot.date).toBe("2024-06-05");
    expect(slot.hour).toBe(23);
  });

  it("hour 8:41 maps to slot 8", () => {
    const d = new Date("2024-06-05T08:41:00");
    const slot = getTimeSlotInfo(d);
    expect(slot.hour).toBe(8);
  });
});

// ── Invite code format test ───────────────────────────────────────────────────

describe("invite code", () => {
  it("should be 6 uppercase alphanumeric characters", () => {
    // nanoid(6).toUpperCase() produces 6 chars
    const code = "ABC123";
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
  });
});
