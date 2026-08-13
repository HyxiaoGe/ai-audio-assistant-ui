# Repository Guidelines

## Project Structure & Module Organization
- `src/app/` contains Next.js App Router routes, layouts, and route groups like `(auth)` and `(main)`.
- `src/components/` holds reusable UI building blocks; `src/lib/` contains shared utilities (API client, auth, upload helpers).
- `src/app/globals.css` defines global styles; `public/` stores static assets.
- Reviewable engineering and design-system rules live in this tracked file; project overview is in `README.md`, and the tracked testing guide is `docs/TESTING.md`.

## Build, Test, and Development Commands
- `npm run dev`: start the local Next.js dev server at `http://localhost:3000`.
- `npm run build`: create a production build for deployment.
- `npm run start`: run the production server from the build output.
- `npm run lint`: run ESLint against `src/` using `eslint.config.mjs`.

## Coding Style & Naming Conventions
- TypeScript/TSX is the default; keep code in `src/` and follow existing patterns.
- Indentation uses 2 spaces, double quotes, and semicolons (match current files).
- Components use PascalCase (e.g., `TaskCard`), hooks use `useX` naming (e.g., `useUpload`).
- Prefer named exports unless a Next.js file requires default (e.g., `layout.tsx`).

## Testing Guidelines
- Vitest + Testing Library is wired: `npm run test` (single file: `npm run test -- <path>`).
  See `docs/TESTING.md` for scope and conventions. Tests are co-located (`*.test.ts(x)`
  next to the unit) or under `src/__tests__/`.
- Add a regression test on bug fixes and a minimal render/interaction test for new shared components.

## Commit & Pull Request Guidelines
- Recent commits use Conventional Commits (e.g., `feat: ...`). Follow that style for
  new commits.
- PRs should include a short description, link to relevant tasks/issues, and UI
  screenshots or screen recordings for visual changes.

## Security & Configuration Tips
- Use `.env.local` for secrets; keep `.env.example` updated with required keys.
- Do not commit real credentials or tokens.

## Architecture References
- Engineering conventions, design-system contract, structure: this tracked `AGENTS.md`
- Project overview and structure: `README.md`
- Testing strategy: `docs/TESTING.md`
- (The old `docs/FE.md` / `docs/ARCH.md` were stale 2024-era copies and were removed; treat this `AGENTS.md` + `README.md` as authoritative.)

## Design System Review Rules

- Use the semantic `--app-*` tokens in `src/app/globals.css` as the color, background, and border source; use the existing Tailwind spacing scale for layout, and do not introduce hard-coded colors or a parallel palette.
- Express tokens with Tailwind arbitrary-value `className` utilities rather than inline `style`; runtime-calculated values are the only exception and require the existing ESLint justification comment.
- Prefer the shared `Button` primitive for interactions. A justified raw `<button>` must preserve themed states and focus-visible behavior and include the existing ESLint justification comment.
- Treat `src/components/ui/` as shared shadcn primitives: do not modify it for feature styling; confirm any new primitive variant first.

## Code Review Rules

### 阻塞边界

- 只提交 P0/P1 finding：问题必须由当前 PR 引入、存在当前可达的触发路径，并会造成明确的正确性、安全、权限、数据、兼容性或发布后果；评论必须说明触发条件、实际影响和最小安全路径，证据不足则不报告。
- P2/P3、纯防御性加固、需要未来维护者同时修改规则与测试才成立的假设、测试还可增加更多 fixture、lint/格式/措辞/命名或无当前影响的重构默认不报告，也不得仅因建议有价值就阻塞合并。

### 项目重点

- 重点检查认证、上传、WebSocket 重连与 HTTP 轮询降级，并保护前端职责边界：不校验 JWT、不生成预签名、不直连数据库或 ASR/LLM，敏感值不得进入客户端环境变量；设计 token 或组件形式只有造成当前可达的功能、主题或可访问性故障时才报告。

### Few-shot

正例：WebSocket 断开后没有启动 HTTP 轮询，后台任务仍在运行但页面永久停留在旧进度；这是当前可达的用户路径故障，应提交 P1。

反例：还可以把一个表现正确的原生按钮换成共享组件，或增加另一种断点 fixture，但当前功能、主题和可访问性没有故障；这属于 P2/P3 加固，不提交 finding。
