import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// 设计系统契约(见 CLAUDE.md「样式与组件契约」)的机器强制规则。
// 存量违规已 baseline 进 eslint-suppressions.json,故全量 lint 仍绿、CI/build
// 不被旧账阻塞;新增/改动代码才报错。新增一类 no-restricted-syntax 选择器后,
// 用 `npx eslint src --suppress-rule no-restricted-syntax` 重新生成 baseline;
// 清理存量后用 `npx eslint src --prune-suppressions` 收缩。

// 规则一:禁止用内联 style 承载 --app-* 设计 token,改用 Tailwind 任意值类。
const noInlineAppTokenStyle = {
  selector:
    "JSXAttribute[name.name='style'] > JSXExpressionContainer ObjectExpression",
  message:
    "禁止用内联 style={{}} 承载 --app-* 设计 token;改用 Tailwind 任意值类,如 className=\"text-[var(--app-text)]\"(--app-* 是唯一样式源)。仅当值是运行时动态计算(进度宽度/计算位移等)才允许内联,并加 // eslint-disable-next-line no-restricted-syntax -- 动态值 注明原因。存量已 baseline,清理后用 `npx eslint src --prune-suppressions` 收缩。",
};

// 规则二:禁止手搓原生 <button>,改用 <Button> 原语。仅约束业务源码,
// 测试夹具(*.test/*.spec)里的 <button> 不受限。
const noRawButton = {
  selector: "JSXOpeningElement[name.name='button']",
  message:
    "禁止手搓原生 <button>;改用 <Button>(@/components/ui/button)原语,它已 --app-* 主题化并内建 focus-visible:ring(见 CLAUDE.md「样式与组件契约」)。确需裸 <button>(图标位/整卡可点/特殊交互)时,自己补 --app-* 类 + 焦点态,并加 // eslint-disable-next-line no-restricted-syntax -- 原因 注明。存量已 baseline,清理后用 `npx eslint src --prune-suppressions` 收缩。",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // 业务源码(非测试):内联 style + 裸 <button> 双禁。
  {
    files: ["src/**/*.{jsx,tsx}"],
    ignores: ["src/**/*.{test,spec}.{jsx,tsx}"],
    rules: {
      "no-restricted-syntax": ["error", noInlineAppTokenStyle, noRawButton],
    },
  },
  // 测试文件:仅禁内联 style;允许裸 <button> 作为测试夹具。
  {
    files: ["src/**/*.{test,spec}.{jsx,tsx}"],
    rules: {
      "no-restricted-syntax": ["error", noInlineAppTokenStyle],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
