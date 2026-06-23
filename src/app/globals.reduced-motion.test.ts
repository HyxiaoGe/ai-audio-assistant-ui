import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * UX-32:尊重系统「减少动效」。断言 globals.css 含全局 prefers-reduced-motion 复位块,
 * 把 animation/transition 降到接近 0,防止回退。
 */
const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

describe("globals.css prefers-reduced-motion 守卫", () => {
  it("含 reduce 媒体块且对所有元素复位 animation/transition", () => {
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    const block = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(block).toMatch(/\*\s*,\s*\*::before\s*,\s*\*::after/);
    expect(block).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
    expect(block).toMatch(/animation-iteration-count:\s*1\s*!important/);
    expect(block).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
    expect(block).toMatch(/scroll-behavior:\s*auto\s*!important/);
  });
});
