import { describe, expect, it } from "vitest";
import { formatDuration } from "@/lib/utils";

describe("formatDuration", () => {
  it("formats seconds into mm:ss", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(125)).toBe("2:05");
  });
});
