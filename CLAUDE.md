# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Frontend for an AI-powered audio/video content assistant. Next.js 16 application with TypeScript, shadcn/ui, and NextAuth. Communicates with a separate FastAPI backend via REST API and WebSocket.

**Key Principle**: Frontend handles UI, OAuth flows, file hashing, and S3 direct upload. Backend handles business logic, ASR/LLM calls, and database operations.

## Development Commands

```bash
npm run dev                                              # Dev server at localhost:3000
npm run build                                            # Production build
npm run lint                                             # ESLint
npm run test                                             # All Vitest tests
npm run test -- src/components/task/TaskCard.test.tsx   # Single file
npm run test -- --watch                                  # Watch mode
npm run test -- -t "should render"                       # Filter by name
npx tsc --noEmit                                         # Type check
```

Pre-commit hooks (husky + lint-staged) run ESLint automatically on staged files.

## Technology Stack

- **Framework**: Next.js 16 (App Router) + TypeScript 5
- **Auth**: NextAuth v5 (Auth.js) with Google/GitHub OAuth
- **UI**: shadcn/ui + Radix UI + Tailwind CSS v4
- **State**: React Server Components + Zustand (audio, notifications)
- **Theme**: next-themes for dark/light mode

## Project Structure

```
src/
├── app/
│   ├── (auth)/login/              # Public auth routes
│   ├── (main)/                    # Protected routes (tasks, settings, stats, admin)
│   ├── api/auth/[...nextauth]/    # NextAuth routes
│   └── globals.css                # Tailwind theme config
├── components/
│   ├── ui/                        # shadcn/ui (DO NOT MODIFY)
│   ├── common/                    # Shared components
│   ├── task/                      # Task-specific components
│   └── layout/                    # Header, Sidebar
├── lib/
│   ├── api-client.ts              # Centralized API client (use for all API calls)
│   └── auth*.ts                   # NextAuth configuration
├── store/                         # Zustand stores
├── types/                         # TypeScript definitions
└── middleware.ts                  # Auth middleware
```

Test files are co-located (e.g., `TaskCard.test.tsx` next to `TaskCard.tsx`).

## Architecture Patterns

### Route Groups
- `(auth)`: No authentication required
- `(main)`: Protected routes - middleware enforces login

### API Integration

All API calls use the unified response format:
```typescript
{ code: 0, message: string, data: T, traceId: string }
```

- `code === 0` = success, non-zero = error
- Backend returns internationalized messages - display directly
- Send `Accept-Language: zh|en` header for localized errors

**Always use the centralized API client**:
```typescript
import { apiClient } from '@/lib/api-client';

try {
  const tasks = await apiClient.getTasks({ page: 1, page_size: 10 });
} catch (error) {
  if (error instanceof ApiError) {
    toast.error(error.message);  // Already localized
    console.error(`[${error.traceId}] Error ${error.code}`);
  }
}
```

### File Upload Flow
1. Frontend calculates SHA256 hash
2. `POST /upload/presign` - returns presigned URL or existing task_id (instant upload)
3. Frontend uploads directly to S3 via presigned URL
4. `POST /tasks` to create task
5. Backend triggers Celery worker

### State Management
- **Server State**: React Server Components + fetch()
- **Client State**: useState/useReducer for UI interactions
- **Global State**: Zustand stores in `src/store/`
- **API Calls**: Always use `api-client.ts`

### Styling
- Tailwind CSS v4 with `@theme inline` in `globals.css`
- shadcn/ui components - use as-is
- Dark mode via CSS variables (`:root` and `.dark`)

## Important Constraints

**Frontend responsibilities**:
- OAuth login flow (NextAuth)
- File SHA256 hash calculation (client-side)
- S3 direct upload (presigned URLs)
- Display backend error messages
- WebSocket for real-time updates

**Frontend does NOT**:
- Verify JWTs (backend does)
- Generate presigned URLs
- Call ASR/LLM APIs directly
- Database operations
- Maintain error code mappings

### Error Code Ranges
- `40000-40099`: Parameter errors
- `40100-40199`: Auth errors → redirect to login
- `40400-40499`: Not found
- `40900-40999`: Business conflicts
- `50000-50099`: System errors
- `51000-51999`: Third-party service errors

## Key Types

`src/types/index.ts`:
- `TaskStatus`: "pending" | "queued" | "processing" | ... | "completed" | "failed"
- `Task`, `TranscriptSegment`, `Summary`

`src/types/api.ts`:
- Request/response types for all endpoints
- `ApiResponse<T>`, `ApiError`

## Documentation

Extensive docs in `docs/` folder:
- **docs/API.md** - Complete API contract (read before making API calls)
- **docs/ARCH.md** - System architecture (check before adding features)
- **docs/FE.md** - Frontend responsibilities

## Environment Variables

Copy `.env.example` to `.env.local`:

| Variable | Description |
|----------|-------------|
| `AUTH_SECRET` | Auth.js secret |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | GitHub OAuth |
| `NEXT_PUBLIC_APP_URL` | Frontend URL (default: `http://localhost:3000`) |
| `NEXT_PUBLIC_API_BASE_URL` | Backend API (default: `http://localhost:8088/api/v1`) |

## Notes

- **Path alias**: `@/*` → `./src/*`
- **Mock data**: `src/data/` for development without backend
- **i18n**: Frontend handles UI text, backend handles API error messages
