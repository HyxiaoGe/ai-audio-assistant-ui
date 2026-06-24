import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // 设计系统契约(见 CLAUDE.md「样式与组件契约」):
  // 禁止用内联 style 承载 --app-* 设计 token,改用 Tailwind 任意值类
  // className="text-[var(--app-text)]"。存量违规已 baseline 进
  // eslint-suppressions.json,故全量 lint 仍绿;新增/改动代码才报错。
  {
    files: ["src/**/*.{jsx,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "JSXAttribute[name.name='style'] > JSXExpressionContainer ObjectExpression",
          message:
            "禁止用内联 style={{}} 承载 --app-* 设计 token;改用 Tailwind 任意值类,如 className=\"text-[var(--app-text)]\"(--app-* 是唯一样式源)。仅当值是运行时动态计算(进度宽度/计算位移等)才允许内联,并加 // eslint-disable-next-line no-restricted-syntax -- 动态值 注明原因。存量已 baseline,清理后用 `npx eslint src --prune-suppressions` 收缩。",
        },
      ],
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
