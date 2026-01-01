# Testing Strategy

## Goals
- Provide minimal, high-value coverage that is stable and easy to maintain.
- Focus on behavior and integration boundaries, not visual details.

## Scope & Priorities
1. **Pure utilities**: deterministic functions in `src/lib/` (formatters, parsers).
2. **Reusable UI components**: low-dependency components in `src/components/common/` and `src/components/task/`.
3. **Key interactions**: user actions that trigger callbacks, navigation, or state updates.
4. **Hook/context-dependent components**: only when the component is critical and has risk.

## What We Do Not Test
- Third-party UI primitives (shadcn/ui) beyond our usage.
- Static text/visual-only variations.
- Full end-to-end flows (unless explicitly requested later).

## Current Setup
- Test runner: Vitest
- DOM environment: jsdom
- Utilities: Testing Library + jest-dom matchers
- Config: `vitest.config.ts`, setup in `src/setupTests.ts`

## Conventions
- Test files: `*.test.tsx` or `*.test.ts` next to component or in `src/__tests__/`.
- Naming: `<Component>.test.tsx` for components, `<util>.test.ts` for utilities.
- Keep tests small: prefer 2–5 assertions per test.

## Mocks & Helpers
- Router: mock `next/navigation` `useRouter()` when testing navigation behavior.
- i18n: mock `useI18n()` to return deterministic strings.
- Auth: mock `useSession()` only when the component depends on auth state.

## Baseline Examples
- `src/components/common/EmptyState.test.tsx`
- `src/components/task/TabSwitch.test.tsx`
- `src/components/notifications/NotificationItem.test.tsx`
- `src/__tests__/utils.test.ts`

## When to Add Tests
- Bug fixes: add a regression test.
- New shared component: add a minimal render + interaction test.
- High-risk refactor: add tests around behavior that could regress.

## How to Run
```bash
npm run test
```

## CI Notes
- GitHub Actions runs on `master` branch push and pull requests.
- Workflow file: `.github/workflows/ci.yml`.
