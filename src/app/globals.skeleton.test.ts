import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

describe("--app-skeleton 语义 token", () => {
  it("在 :root 与 .dark 均定义(至少两处)", () => {
    const matches = css.match(/--app-skeleton:\s*[^;]+;/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});
