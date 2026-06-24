import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * 光标手型守卫:Tailwind v4 Preflight 移除了 v3 的 button{cursor:pointer},
 * 交互元素默认变箭头。globals.css 在 base 层补回 button/role=button/原生表单的手型,
 * 并用「不入任何 @layer」的规则给 radix 菜单项/下拉选项恢复手型(必须 unlayered
 * 才能压过 ui/ 里 cursor-default 工具类所在的 utilities 层)。本测试锁死这两点防回退。
 */
const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

/** 返回 `@layer <name> {` 块的 [起, 止) 区间(止=匹配的闭合花括号下标+1);找不到返回 null。 */
function layerBlockRange(name: string): [number, number] | null {
  const head = new RegExp(`@layer\\s+${name}\\s*\\{`);
  const m = head.exec(css);
  if (!m) return null;
  let depth = 0;
  for (let i = m.index + m[0].length - 1; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return [m.index, i + 1];
    }
  }
  return null;
}

describe("globals.css 光标手型守卫", () => {
  it("base 层补回 button / role=button / 原生表单控件的手型", () => {
    const range = layerBlockRange("base");
    expect(range).not.toBeNull();
    const base = css.slice(range![0], range![1]);
    expect(base).toMatch(/button:not\(:disabled\)/);
    expect(base).toMatch(/\[role="button"\]:not\(\[aria-disabled="true"\]\)/);
    expect(base).toMatch(/select:not\(:disabled\)/);
    expect(base).toMatch(/summary/);
    expect(base).toMatch(/label\[for\]/);
    // 这些选择器同属一条以 cursor: pointer 收尾的规则
    expect(base).toMatch(/label\[for\]\s*\{\s*cursor:\s*pointer;/);
  });

  it("radix 菜单项/下拉选项恢复手型,且覆盖四种交互角色", () => {
    expect(css).toMatch(/\[role="menuitem"\]:not\(\[data-disabled\]\)/);
    expect(css).toMatch(/\[role="menuitemcheckbox"\]:not\(\[data-disabled\]\)/);
    expect(css).toMatch(/\[role="menuitemradio"\]:not\(\[data-disabled\]\)/);
    expect(css).toMatch(/\[role="option"\]:not\(\[aria-disabled="true"\]\)/);
  });

  it("radix 角色规则必须是 unlayered(不在 @layer base 内),否则压不过 ui/ 的 cursor-default", () => {
    const idx = css.indexOf('[role="menuitem"]:not([data-disabled])');
    expect(idx).toBeGreaterThan(-1);
    const range = layerBlockRange("base");
    expect(range).not.toBeNull();
    // 规则必须落在 @layer base 块之外(此处即块结束之后)
    expect(idx).toBeGreaterThanOrEqual(range![1]);
  });
});
