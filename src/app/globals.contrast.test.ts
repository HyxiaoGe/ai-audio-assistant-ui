import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * audit a11y F117：浅色模式下 --app-text-subtle / --app-text-faint 对常见浅色背景
 * 对比度不达 WCAG AA。此测试解析 globals.css 的 :root（浅色）块，按 WCAG 相对亮度
 * 公式计算对比度，对正文 / 提示文字所在的主要浅色背景设下达标门槛，防止回退。
 *
 * 取舍：subtle 作为正常正文要求 ≥4.5:1；faint 仅用于最弱的提示 / 时间戳等，按大字号
 * 阈值要求 ≥3.0:1，从而 faint 仍可保持为三档中最浅的一档（视觉层级不被压平）。
 */

const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

// 仅取浅色（:root）块：从 ':root {' 到下一个顶层 '}'（.dark 之前）。
function lightRootBlock(source: string): string {
  const start = source.indexOf(":root {");
  if (start === -1) throw new Error(":root block not found");
  const darkAt = source.indexOf(".dark", start);
  return source.slice(start, darkAt === -1 ? undefined : darkAt);
}

function readToken(block: string, name: string): string {
  const m = block.match(new RegExp(`${name}\\s*:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token ${name} not found in :root block`);
  return m[1].toLowerCase();
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const linear = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

const root = lightRootBlock(css);
// 正文 / 提示文字实际渲染的主要浅色背景。
const surface = readToken(root, "--app-surface"); // #ffffff
const surfaceMuted = readToken(root, "--app-surface-muted"); // #f8fafc
const textSubtle = readToken(root, "--app-text-subtle");
const textFaint = readToken(root, "--app-text-faint");

// 取暗色（.dark）块：从 '.dark {' 到其后第一个行首 '}'。
function darkBlock(source: string): string {
  const start = source.indexOf(".dark {");
  if (start === -1) throw new Error(".dark block not found");
  const end = source.indexOf("\n}", start);
  return source.slice(start, end === -1 ? undefined : end);
}

describe("globals.css light-mode muted text contrast (WCAG AA)", () => {
  it("--app-text-subtle meets AA normal text (>=4.5:1) on primary light surfaces", () => {
    expect(contrastRatio(textSubtle, surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(textSubtle, surfaceMuted)).toBeGreaterThanOrEqual(4.5);
  });

  it("--app-text-faint meets at least the large-text threshold (>=3.0:1) on primary light surfaces", () => {
    expect(contrastRatio(textFaint, surface)).toBeGreaterThanOrEqual(3.0);
    expect(contrastRatio(textFaint, surfaceMuted)).toBeGreaterThanOrEqual(3.0);
  });

  it("keeps faint lighter than subtle so the muted hierarchy is preserved", () => {
    expect(relativeLuminance(textFaint)).toBeGreaterThan(relativeLuminance(textSubtle));
  });
});

describe("globals.css dark-mode muted text contrast (WCAG AA)", () => {
  const dark = darkBlock(css);
  const surface = readToken(dark, "--app-surface");        // #1e293b
  const surfaceMuted = readToken(dark, "--app-surface-muted"); // #111827
  const textMuted = readToken(dark, "--app-text-muted");
  const textSubtle = readToken(dark, "--app-text-subtle");
  const textFaint = readToken(dark, "--app-text-faint");

  it("--app-text-subtle 暗色达 AA 正文 (>=4.5:1)", () => {
    expect(contrastRatio(textSubtle, surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(textSubtle, surfaceMuted)).toBeGreaterThanOrEqual(4.5);
  });

  it("--app-text-faint 暗色达大字阈值 (>=3.0:1)", () => {
    expect(contrastRatio(textFaint, surface)).toBeGreaterThanOrEqual(3.0);
    expect(contrastRatio(textFaint, surfaceMuted)).toBeGreaterThanOrEqual(3.0);
  });

  it("暗色三档层级:faint 比 subtle 暗、subtle 比 muted 暗(方向与浅色相反)", () => {
    expect(relativeLuminance(textFaint)).toBeLessThan(relativeLuminance(textSubtle));
    expect(relativeLuminance(textSubtle)).toBeLessThan(relativeLuminance(textMuted));
  });
});
