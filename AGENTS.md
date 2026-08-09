# Repository Guidelines

## Project Structure & Module Organization
- `src/app/` contains Next.js App Router routes, layouts, and route groups like `(auth)` and `(main)`.
- `src/components/` holds reusable UI building blocks; `src/lib/` contains shared utilities (API client, auth, upload helpers).
- `src/styles/` and `src/app/globals.css` define global styles; `public/` stores static assets.
- Reviewable engineering and design-system rules live in this tracked file; project overview is in `README.md`. `docs/` holds `TESTING.md` and the per-feature spec/plan archive (`docs/superpowers/`).

## Build, Test, and Development Commands
- `npm run dev`: start the local Next.js dev server at `http://localhost:3000`.
- `npm run build`: create a production build for deployment.
- `npm run start`: run the production server from the build output.
- `npm run lint`: run ESLint against `src/` using `eslint.config.mjs`.

## Coding Style & Naming Conventions
- TypeScript/TSX is the default; keep code in `src/` and follow existing patterns.
- Indentation uses 2 spaces, double quotes, and no semicolons (match current files).
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

- Use the semantic `--app-*` tokens in `src/app/globals.css` as the only color, background, border, and spacing source; do not introduce hard-coded colors or a parallel palette.
- Express tokens with Tailwind arbitrary-value `className` utilities rather than inline `style`; runtime-calculated values are the only exception and require the existing ESLint justification comment.
- Prefer the shared `Button` primitive for interactions. A justified raw `<button>` must preserve themed states and focus-visible behavior and include the existing ESLint justification comment.
- Treat `src/components/ui/` as shared shadcn primitives: do not modify it for feature styling; confirm any new primitive variant first.

## Code Review Rules

- 只报告本 PR 引入且有具体触发路径和实际影响的问题，尤其关注正确性、性能、安全、兼容、可维护性与发布风险；核对失败/回滚路径与测试能否拒绝错误实现，忽略风格、既有问题和无影响猜测。
- 认证、上传和 WebSocket 进度变更必须覆盖重连与 HTTP 轮询降级，避免只验证正常在线路径。
- 保持前端职责边界：不校验 JWT、不生成预签名、不直连数据库或 ASR/LLM，敏感值不得进入客户端环境变量。
