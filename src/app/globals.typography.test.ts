import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

// 提取某个 @utility 块的体内文本（@utility 块内无嵌套花括号，[^}]* 即可）。
function utilityBlock(source: string, name: string): string {
  const m = source.match(new RegExp(`@utility\\s+${name}\\s*\\{([^}]*)\\}`));
  if (!m) throw new Error(`@utility ${name} 未找到`);
  return m[1];
}

function fontSizeRem(block: string): number {
  const m = block.match(/font-size:\s*([\d.]+)rem/);
  if (!m) throw new Error("未找到 font-size(rem)");
  return parseFloat(m[1]);
}

describe("标题工具类 text-h1/h2/h3 已定义且层级单调", () => {
  for (const name of ["text-h1", "text-h2", "text-h3"]) {
    it(`${name} 定义了 font-size / font-weight / line-height`, () => {
      const block = utilityBlock(css, name);
      expect(block).toMatch(/font-size:\s*[\d.]+rem/);
      expect(block).toMatch(/font-weight:\s*\d{3}/);
      expect(block).toMatch(/line-height:\s*[\d.]+/);
    });
  }

  it("字号 h1 > h2 > h3（层级不被压平）", () => {
    const h1 = fontSizeRem(utilityBlock(css, "text-h1"));
    const h2 = fontSizeRem(utilityBlock(css, "text-h2"));
    const h3 = fontSizeRem(utilityBlock(css, "text-h3"));
    expect(h1).toBeGreaterThan(h2);
    expect(h2).toBeGreaterThan(h3);
  });
});

describe("全局 :focus-visible 焦点环基线", () => {
  it("存在 :focus-visible 规则且 outline 引用 --app-primary", () => {
    const m = css.match(/:focus-visible\s*\{([^}]*)\}/);
    expect(m, ":focus-visible 规则未找到").not.toBeNull();
    const block = m![1];
    expect(block).toMatch(/outline:[^;]*var\(--app-primary\)/);
    expect(block).toMatch(/outline-offset:/);
  });
});
