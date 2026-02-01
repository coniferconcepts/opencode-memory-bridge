# TanStack Start Stack

A full-stack TypeScript stack optimized for web applications using TanStack Start with observable state management, type-safe APIs, and universal UI components.

## Technology Overview

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Framework** | TanStack Start (Vinxi + Nitro) | Full-stack React framework with file-based routing |
| **Frontend** | React + TanStack Router | Component library with type-safe routing |
| **Backend** | Hono | Lightweight, fast web framework for Cloudflare Workers |
| **API** | tRPC | End-to-end type-safe RPC layer |
| **State Management** | Legend State v3 | Observable state with sync, persistence, and reactivity |
| **Validation** | Valibot | Lightweight, tree-shakeable schema validation |
| **Database** | Drizzle ORM + Cloudflare D1 | Type-safe SQL with edge database |
| **UI Components** | Tamagui | Universal UI system (web + native capable) |
| **Authentication** | Better Auth | Framework-agnostic auth with multiple providers |
| **Runtime** | Bun | Fast package manager, test runner, and runtime |
| **Linting** | Biome | Fast linter and formatter (ESLint/Prettier replacement) |
| **Testing** | Vitest | Fast unit testing with Vite integration |
| **Language** | TypeScript | Strict mode enabled |

## Project Structure

```
my-app/
├── apps/
│   ├── web/                 # TanStack Start web application
│   │   ├── app/
│   │   │   ├── routes/      # File-based routing
│   │   │   ├── components/  # Route components and features
│   │   │   ├── hooks/       # Custom React hooks
│   │   │   └── styles/      # Global styles and Tamagui config
│   │   └── package.json
│   └── server/              # Hono + tRPC API server
│       ├── src/
│       │   ├── routers/     # tRPC router definitions
│       │   ├── procedures/  # tRPC procedure builders (auth, etc.)
│       │   ├── db/          # Drizzle schema and migrations
│       │   └── auth/        # Better Auth configuration
│       └── package.json
├── packages/
│   ├── ui/                  # Tamagui design system
│   │   ├── src/
│   │   │   ├── components/  # Universal UI components
│   │   │   └── tokens/      # Theme tokens and configuration
│   ├── state/               # Legend State stores and sync logic
│   ├── db/                  # Shared Drizzle schema definitions
│   ├── api-client/          # tRPC client configuration
│   ├── form/                # Form components + Valibot integration
│   └── shared/              # Shared utilities and types
├── turbo.json               # Turborepo configuration
├── opencode.json            # OpenCode agent configuration
└── AGENTS.md                # Detailed agent guidelines
```

## Development Commands

### Development Server

```bash
# Start development (uses Bun exclusively)
bun run dev                 # Start all apps (web + server)
bun run dev:web             # Web app only
bun run dev:server          # API server only

# Pre-flight checks
bun run pre-dev             # Validate environment before starting
bun run dev:safe            # Smart start with auto-fix attempts
```

### Build & Deploy

```bash
# Production builds
bun run build               # Build all applications
bun run build:web           # Build web only
bun run build:server        # Build server only

# Deployment
bun run deploy              # Deploy to Cloudflare
```

### Code Quality (Biome)

```bash
# Lint and format
bun run check               # Full lint + format with auto-fix
bun run check:fast          # Quick check (lint + type check only)
bun run lint                # Biome lint only
bun run format              # Biome format only
```

### Type Checking

```bash
bun run check-types         # Full TypeScript check
bun run check-types:incremental  # Faster incremental check
```

### Testing (Vitest)

```bash
bun run test                # Run all tests
bun run test:watch          # Watch mode for development
bun run test:coverage       # Generate coverage report
bun run test:ui             # Vitest UI mode
```

### Database (Drizzle + D1)

```bash
bun run db:push             # Push schema to D1 (development)
bun run db:generate         # Generate migration files
bun run db:migrate          # Run pending migrations
bun run db:studio           # Open Drizzle Studio GUI
bun run db:seed             # Seed database with test data
```

### Validation

```bash
bun run validate:fields     # Validate field mappings (CRITICAL)
bun run validate:all        # Run complete validation suite
```

## Stack-Specific Agents

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| `@legend-state-expert` | Legend State v3 patterns, observables, synced queries, persistence | State management, data fetching, caching |
| `@valibot-expert` | Schema validation, type inference, transformations | API contracts, form validation, data parsing |
| `@tamagui-expert` | Tamagui components, tokens, theming, styling | UI development, design system, responsive layouts |
| `@cloudflare-expert` | Workers, D1 database, deployment, edge patterns | Backend infrastructure, database design |
| `@context7-super-expert` | Deep knowledge retrieval from documentation | Complex integration questions, best practices |

## Configuration

### opencode.json

```json
{
  "$schema": "https://opencode.ai/config.json",
  "extends": "~/.config/opencode/opencode.json",
  "agent": {
    "legend-state-expert": {
      "model": "opencode/glm-4.7",
      "prompt": "Legend State v3 observable state management expert. Focus on syncedCrud, fieldId mappings, and reactive patterns.",
      "mode": "subagent"
    },
    "valibot-expert": {
      "model": "opencode/glm-4.7",
      "prompt": "Valibot schema validation expert. Focus on type inference, pipes, and tree-shakable schemas.",
      "mode": "subagent"
    },
    "tamagui-expert": {
      "model": "opencode/glm-4.7",
      "prompt": "Tamagui universal UI expert. Focus on tokens, theming, and web/native compatibility.",
      "mode": "subagent"
    }
  }
}
```

## Guardrails

### Legend State (CRITICAL)

1. **NEVER use TanStack Query for data fetching** — Use Legend State observables with `syncedCrud` or `syncedQuery`
2. **ALWAYS define `fieldId` mappings** — Must match the API response field name exactly (e.g., `workoutId`, not `id`)
3. **NEVER mutate observables directly** — Use `.set()`, `.assign()`, or defined actions only
4. **ALWAYS use `use$()` hook** — Required for React components to track observable changes
5. **NEVER mix sync strategies** — Use `syncedCrud` consistently for entity collections
6. **ALWAYS handle loading states** — Check `observable.isLoaded` before rendering

### Valibot (CRITICAL)

1. **NEVER use Zod or Yup** — Valibot is the only validation library
2. **ALWAYS use `InferOutput` for types** — `type User = v.InferOutput<typeof userSchema>`
3. **NEVER skip validation** — Validate all API inputs, form data, and external data
4. **ALWAYS use `v.pipe()` for transforms** — Chain validations: `v.pipe(v.string(), v.email(), v.minLength(5))`
5. **NEVER use `any` types** — Ensure type safety from validation through to consumption
6. **ALWAYS export schemas** — Reuse schemas across client and server

### Tamagui (CRITICAL)

1. **NEVER use Tailwind, CSS modules, or inline styles** — Tamagui ONLY for all styling
2. **ALWAYS use theme tokens** — `$purple9`, `$space4`, `$size5` (never hex codes or px values)
3. **NEVER hardcode values** — Define tokens in theme configuration
4. **ALWAYS prefer universal components** — Design for web and native compatibility
5. **NEVER use media queries directly** — Use Tamagui's `useMedia()` hook
6. **ALWAYS use the `$` prefix** — Reference tokens with `$` (e.g., `$color`, `$space`)

### tRPC + Hono (CRITICAL)

1. **NEVER use REST or GraphQL** — tRPC ONLY for type-safe API communication
2. **ALWAYS use procedure builders** — Create `publicProcedure`, `protectedProcedure`, `adminProcedure`
3. **NEVER skip input validation** — Use Valibot schemas in all mutations and queries that accept input
4. **ALWAYS handle errors consistently** — Use `TRPCError` with appropriate codes
5. **NEVER expose internal errors** — Sanitize error messages in production
6. **ALWAYS type the context** — Ensure `ctx` is fully typed (session, db, etc.)

### Drizzle + D1 (CRITICAL)

1. **NEVER use raw SQL without types** — Use Drizzle's type-safe query builder
2. **ALWAYS use singular table names** — `user`, `workout`, `exercise` (not `users`, `workouts`)
3. **NEVER forget migrations** — Generate and run migrations for schema changes
4. **ALWAYS validate field mappings** — Run `bun run validate:fields` before committing
5. **NEVER store secrets in schema** — Exclude sensitive fields from default queries
6. **ALWAYS use transactions** — Wrap multi-table operations in transactions

### Better Auth (CRITICAL)

1. **NEVER roll your own auth** — Use Better Auth for all authentication
2. **ALWAYS protect routes** — Use `beforeLoad` guards in TanStack Router
3. **NEVER store passwords** — Better Auth handles hashing and storage
4. **ALWAYS validate sessions** — Check session validity on protected procedures
5. **NEVER expose session tokens** — Keep tokens in httpOnly cookies
6. **ALWAYS use CSRF protection** — Enabled by default in Better Auth

## Best Practices & Examples

### Legend State Patterns

```typescript
// ✅ CORRECT: Observable state with syncedCrud
import { observable, syncedCrud } from '@legendapp/state'
import { use$ } from '@legendapp/state/react'

// Define the observable with proper field mappings
const workouts$ = observable(syncedCrud({
  initial: [],
  list: () => api.workouts.list(),
  create: (workout) => api.workouts.create(workout),
  update: (workout) => api.workouts.update(workout.workoutId, workout),
  delete: (workout) => api.workouts.delete(workout.workoutId),
  fieldId: 'workoutId',        // CRITICAL: Must match API field name
  fieldUpdatedAt: 'updatedAt', // For optimistic updates
}))

// Use in component with reactive hook
function WorkoutList() {
  const workouts = use$(workouts$)
  const isLoaded = use$(workouts$.isLoaded)
  
  if (!isLoaded) return <LoadingSpinner />
  
  return (
    <YStack>
      {workouts.map(workout => (
        <WorkoutCard 
          key={workout.workoutId} 
          workout={workout} 
        />
      ))}
    </YStack>
  )
}
```

### Valibot Schema Validation

```typescript
// ✅ CORRECT: Valibot schema with type inference
import * as v from 'valibot'

// Base schema with validation pipes
const userSchema = v.object({
  userId: v.string(),
  email: v.pipe(
    v.string(), 
    v.email('Invalid email format'),
    v.minLength(5, 'Email too short')
  ),
  name: v.optional(v.pipe(v.string(), v.minLength(2))),
  role: v.picklist(['user', 'admin', 'trainer']),
  createdAt: v.optional(v.date()),
})

// Infer TypeScript type from schema
type User = v.InferOutput<typeof userSchema>
type UserInput = v.InferInput<typeof userSchema>

// Use in tRPC procedure with full type safety
import { router, protectedProcedure } from '../trpc'

export const userRouter = router({
  create: protectedProcedure
    .input(userSchema)
    .mutation(async ({ input, ctx }) => {
      // Input is fully typed and validated
      const user = await ctx.db.insert(users).values(input).returning()
      return user[0]
    }),
    
  update: protectedProcedure
    .input(v.object({
      userId: v.string(),
      data: v.partial(userSchema),
    }))
    .mutation(async ({ input, ctx }) => {
      return ctx.db
        .update(users)
        .set(input.data)
        .where(eq(users.userId, input.userId))
        .returning()
    }),
})
```

### Tamagui UI Components

```typescript
// ✅ CORRECT: Tamagui with theme tokens
import { YStack, XStack, Text, Button, Card, useMedia } from '@myapp/ui'

export function WorkoutCard({ workout, onStart, onEdit }) {
  // Responsive breakpoint hook
  const media = useMedia()
  
  return (
    <Card
      padding="$4"              // Use token spacing
      backgroundColor="$purple3" // Use theme color
      borderRadius="$4"
      bordered
      elevation="$2"
    >
      <XStack 
        justifyContent="space-between"
        alignItems="center"
        flexDirection={media.sm ? 'column' : 'row'}  // Responsive layout
        gap="$3"
      >
        <YStack flex={1}>
          <Text 
            color="$purple12"      // High contrast text color
            fontSize="$6"          // Token-based font size
            fontWeight="bold"
          >
            {workout.title}
          </Text>
          <Text color="$gray11" fontSize="$3">
            {workout.duration} minutes • {workout.exerciseCount} exercises
          </Text>
        </YStack>
        
        <XStack gap="$2">
          <Button 
            onPress={onEdit}
            variant="outlined"
            size="$3"
          >
            Edit
          </Button>
          <Button 
            onPress={onStart}
            theme="active"
            size="$3"
          >
            Start
          </Button>
        </XStack>
      </XStack>
    </Card>
  )
}
```

### tRPC with Hono

```typescript
// ✅ CORRECT: tRPC router with Hono on Cloudflare Workers
import { Hono } from 'hono'
import { trpcServer } from '@trpc/server/adapters/fetch'
import { initTRPC, TRPCError } from '@trpc/server'
import { db } from './db'
import { validateSession } from './auth'

// Initialize tRPC
const t = initTRPC.context<{ db: typeof db; session: Session | null }>().create()

export const router = t.router
export const procedure = t.procedure

// Procedure builders for different access levels
const publicProcedure = procedure

const protectedProcedure = procedure
  .use(async ({ ctx, next }) => {
    if (!ctx.session) {
      throw new TRPCError({ 
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      })
    }
    return next({ ctx: { ...ctx, session: ctx.session } })
  })

const adminProcedure = protectedProcedure
  .use(async ({ ctx, next }) => {
    if (ctx.session.user.role !== 'admin') {
      throw new TRPCError({ 
        code: 'FORBIDDEN',
        message: 'Admin access required'
      })
    }
    return next({ ctx })
  })

// Router definitions
export const workoutRouter = router({
  list: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.db.query.workouts.findMany({
        where: eq(workouts.userId, ctx.session.userId),
        orderBy: desc(workouts.createdAt),
      })
    }),
    
  create: protectedProcedure
    .input(workoutSchema)
    .mutation(async ({ input, ctx }) => {
      const workout = await ctx.db
        .insert(workouts)
        .values({ ...input, userId: ctx.session.userId })
        .returning()
      return workout[0]
    }),
    
  delete: protectedProcedure
    .input(v.object({ workoutId: v.string() }))
    .mutation(async ({ input, ctx }) => {
      // Verify ownership before deletion
      const workout = await ctx.db.query.workouts.findFirst({
        where: eq(workouts.workoutId, input.workoutId),
      })
      
      if (!workout || workout.userId !== ctx.session.userId) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }
      
      await ctx.db
        .delete(workouts)
        .where(eq(workouts.workoutId, input.workoutId))
      
      return { success: true }
    }),
})

// Hono app with tRPC middleware
const app = new Hono<{ Bindings: Env }>()

app.use('/api/trpc/*', async (c) => {
  const session = await validateSession(c.req.raw)
  
  return trpcServer({
    router: appRouter,
    createContext: () => ({
      db: createDb(c.env.D1_DATABASE),
      session,
    }),
  })(c.req.raw)
})

export default app
```

### Drizzle ORM Schema

```typescript
// ✅ CORRECT: Drizzle schema with relations
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'

// Singular table names
export const user = sqliteTable('user', {
  userId: text('user_id').primaryKey().$defaultFn(createId),
  email: text('email').notNull().unique(),
  name: text('name'),
  role: text('role', { enum: ['user', 'admin', 'trainer'] }).notNull().default('user'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

export const workout = sqliteTable('workout', {
  workoutId: text('workout_id').primaryKey().$defaultFn(createId),
  userId: text('user_id').notNull().references(() => user.userId, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  duration: integer('duration'), // minutes
  description: text('description'),
  isPublic: integer('is_public', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

// Define relations for query building
export const userRelations = relations(user, ({ many }) => ({
  workouts: many(workout),
}))

export const workoutRelations = relations(workout, ({ one, many }) => ({
  user: one(user, {
    fields: [workout.userId],
    references: [user.userId],
  }),
  exercises: many(exercise),
}))

export const exercise = sqliteTable('exercise', {
  exerciseId: text('exercise_id').primaryKey().$defaultFn(createId),
  workoutId: text('workout_id').notNull().references(() => workout.workoutId, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sets: integer('sets'),
  reps: integer('reps'),
  weight: real('weight'), // kg
  duration: integer('duration'), // seconds
  order: integer('order').notNull().default(0),
})

export const exerciseRelations = relations(exercise, ({ one }) => ({
  workout: one(workout, {
    fields: [exercise.workoutId],
    references: [workout.workoutId],
  }),
}))
```

### Better Auth Integration

```typescript
// ✅ CORRECT: Better Auth with tRPC integration
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from './db'
import { user, session, account, verification } from './db/schema'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: { user, session, account, verification },
  }),
  
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
})

// Session validation helper for tRPC context
export async function validateSession(request: Request): Promise<Session | null> {
  const cookie = request.headers.get('cookie')
  if (!cookie) return null
  
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    return session
  } catch {
    return null
  }
}

// Protected route loader in TanStack Start
export const Route = createFileRoute('/_app/dashboard')({
  beforeLoad: async ({ context }) => {
    if (!context.session) {
      throw redirect({ to: '/login' })
    }
    return { session: context.session }
  },
  component: DashboardPage,
})
```

### Testing with Vitest

```typescript
// ✅ CORRECT: Vitest test examples
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WorkoutCard } from './WorkoutCard'
import { createMockWorkout } from '@/test/factories'

// Unit test for component
describe('WorkoutCard', () => {
  const mockWorkout = createMockWorkout({
    title: 'Morning Routine',
    duration: 30,
  })
  
  it('renders workout details correctly', () => {
    render(
      <WorkoutCard 
        workout={mockWorkout} 
        onStart={vi.fn()} 
        onEdit={vi.fn()} 
      />
    )
    
    expect(screen.getByText('Morning Routine')).toBeInTheDocument()
    expect(screen.getByText(/30 minutes/)).toBeInTheDocument()
  })
  
  it('calls onStart when start button clicked', () => {
    const onStart = vi.fn()
    render(
      <WorkoutCard 
        workout={mockWorkout} 
        onStart={onStart} 
        onEdit={vi.fn()} 
      />
    )
    
    fireEvent.click(screen.getByText('Start'))
    expect(onStart).toHaveBeenCalledTimes(1)
  })
})

// Integration test for tRPC router
import { caller } from '@/test/trpc-caller'

describe('workoutRouter', () => {
  it('creates workout for authenticated user', async () => {
    const result = await caller.workout.create({
      title: 'New Workout',
      duration: 45,
    })
    
    expect(result).toMatchObject({
      title: 'New Workout',
      duration: 45,
    })
    expect(result.workoutId).toBeDefined()
  })
  
  it('rejects unauthenticated requests', async () => {
    await expect(
      unauthenticatedCaller.workout.list()
    ).rejects.toThrow('UNAUTHORIZED')
  })
})
```

### Biome Configuration

```json
{
  "$schema": "https://biomejs.dev/schemas/1.5.3/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedImports": "error",
        "noUnusedVariables": "error"
      },
      "suspicious": {
        "noConsoleLog": "warn"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingComma": "es5"
    }
  }
}
```

### Rendering Strategies (TanStack Start)

```typescript
// ✅ CORRECT: Mixed rendering strategies

// 1. Static marketing page (CDN-cached, $0 compute cost)
export const Route = createFileRoute('/about')({
  ssr: true,
  prerender: true,
  component: AboutPage,
})

// 2. SPA dashboard (client-only, authenticated)
export const Route = createFileRoute('/_app/dashboard')({
  ssr: false,
  beforeLoad: requireAuth,
  component: DashboardPage,
})

// 3. SSR dynamic page (server-rendered per request)
export const Route = createFileRoute('/workout/$workoutId')({
  ssr: true,
  prerender: false,
  loader: async ({ params }) => {
    const workout = await api.workouts.get(params.workoutId)
    return { workout }
  },
  component: WorkoutDetailPage,
})

// 4. ISR-style (revalidate periodically)
export const Route = createFileRoute('/blog/$slug')({
  ssr: true,
  prerender: false,
  staleTime: 60_000, // 1 minute stale-while-revalidate
  loader: async ({ params }) => {
    const post = await api.blog.get(params.slug)
    return { post }
  },
  component: BlogPostPage,
})
```

## Agent Usage Examples

```bash
# Legend State - state management patterns
@legend-state-expert help me set up syncedCrud for user profiles with optimistic updates

# Valibot - schema validation
@valibot-expert create a schema for workout creation with nested exercise validation

# Tamagui - UI components and theming
@tamagui-expert create a responsive workout grid that adapts from 1 to 3 columns

# Cloudflare/D1 - backend and database
@cloudflare-expert help design a schema for workout history with proper indexing

# tRPC - API patterns
@trpc-expert set up file upload procedures with progress tracking

# Deep knowledge lookup
@context7-super-expert explain Legend State v3 persistOptions configurations
```

## Pre-Commit Checklist

Before every commit, run these validations:

```bash
# 1. Field mapping validation (CRITICAL - prevents data loss)
bun run validate:fields

# 2. Full code quality check
bun run check

# 3. Type checking
bun run check-types

# 4. Run tests
bun run test

# Or run all validations at once
bun run validate:all
```

## Common Issues & Solutions

### Legend State fieldId mismatch
**Problem:** UI shows stale data or updates don't reflect
**Solution:** Ensure `fieldId` in `syncedCrud` matches the API response exactly

### Tamagui styles not applying
**Problem:** Components appear unstyled
**Solution:** Verify Tamagui provider is at the root and tokens are properly configured

### tRPC type errors
**Problem:** Types not syncing between client and server
**Solution:** Run `bun run check-types` and restart the dev server

### D1 migration failures
**Problem:** Schema changes not applying
**Solution:** Use `bun run db:generate` then `bun run db:migrate` (not `db:push` in production)

## Resources

- [Legend State v3 Docs](https://legendapp.com/open-source/state/v3/)
- [Valibot Docs](https://valibot.dev/)
- [Tamagui Docs](https://tamagui.dev/)
- [tRPC Docs](https://trpc.io/)
- [Hono Docs](https://hono.dev/)
- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [Better Auth Docs](https://www.better-auth.com/)
- [TanStack Start Docs](https://tanstack.com/start/latest)
- [Bun Docs](https://bun.sh/docs)
- [Biome Docs](https://biomejs.dev/)
- [Vitest Docs](https://vitest.dev/)
