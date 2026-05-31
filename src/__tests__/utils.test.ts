import { describe, expect, it } from "vitest";
import { formatDuration } from "@/lib/utils";

describe("formatDuration", () => {
  it("formats sub-hour durations into m:ss", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(125)).toBe("2:05");
    expect(formatDuration(3599)).toBe("59:59");
  });

  it("formats one-hour-and-up durations into h:mm:ss", () => {
    expect(formatDuration(3600)).toBe("1:00:00");
    expect(formatDuration(4530)).toBe("1:15:30");
    expect(formatDuration(7325)).toBe("2:02:05");
  });
});
