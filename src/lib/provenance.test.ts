import { describe, expect, it } from "vitest";
import { formatAsrProvenance } from "@/lib/provenance";

describe("formatAsrProvenance", () => {
  it("returns null when provider is missing (旧任务未捕获→不显示徽章)", () => {
    expect(formatAsrProvenance({ provider: null })).toBeNull();
    expect(formatAsrProvenance({ provider: "" })).toBeNull();
    expect(formatAsrProvenance({ provider: "   " })).toBeNull();
    expect(formatAsrProvenance({})).toBeNull();
  });

  it("uses the resolved display name as the visible label", () => {
    const result = formatAsrProvenance(
      { provider: "tencent" },
      (p) => (p === "tencent" ? "腾讯云" : undefined)
    );
    expect(result?.label).toBe("腾讯云");
  });

  it("falls back to the raw provider when no display name resolves", () => {
    const result = formatAsrProvenance({ provider: "tencent" });
    expect(result?.label).toBe("tencent");
  });

  it("joins label · engine · variant into the detail, skipping empty parts", () => {
    const result = formatAsrProvenance(
      { provider: "tencent", engine: "16k_zh", variant: "file" },
      () => "腾讯云"
    );
    expect(result?.detail).toBe("腾讯云 · 16k_zh · file");
  });

  it("detail is just the label when engine/variant absent", () => {
    const result = formatAsrProvenance({ provider: "tencent", engine: null, variant: "  " }, () => "腾讯云");
    expect(result?.detail).toBe("腾讯云");
  });
});
