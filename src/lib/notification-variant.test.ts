import { describe, it, expect } from "vitest";
import { getNotificationVariant } from "@/lib/notification-variant";

describe("getNotificationVariant", () => {
  it("maps each known notification type to its semantic variant", () => {
    expect(getNotificationVariant("task_completed")).toBe("success");
    expect(getNotificationVariant("task_failed")).toBe("error");
    // N1 regression guard: a visual failure must read as error (red), not success,
    // on BOTH the toast and the bell row (they share this mapping).
    expect(getNotificationVariant("visual_failed")).toBe("error");
    expect(getNotificationVariant("quota_alert")).toBe("warning");
    expect(getNotificationVariant("youtube_reauth_required")).toBe("warning");
  });

  it("falls back to info for unknown types", () => {
    expect(getNotificationVariant("mystery_type")).toBe("info");
  });
});
