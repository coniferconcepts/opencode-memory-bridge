# Expo Native Stack

A modern React Native mobile stack built with Legend State for reactive state management, Tamagui for universal UI, Valibot for validation, and tRPC for type-safe APIs.

## Technology Philosophy

This stack prioritizes:
- **Fine-grained reactivity** via Legend State's observable patterns (no unnecessary re-renders)
- **Type safety end-to-end** with tRPC and Valibot schemas
- **Universal UI components** with Tamagui's design tokens
- **Lightning-fast storage** using MMKV (0.3ms read/write vs 3ms+ for AsyncStorage)
- **Secure credential storage** via Expo SecureStore (keychain-backed)
- **Native-first authentication** with Better Auth's deep linking support

## Stack Overview

| Category | Technology | Purpose |
|----------|------------|---------|
| **Framework** | React Native + Expo | Cross-platform mobile development |
| **Router** | Expo Router (file-based) | Type-safe routing with deep links |
| **State** | Legend State v3 | Observable state with fine-grained reactivity |
| **Validation** | Valibot | Schema validation (~300 bytes vs 15KB+ alternatives) |
| **API** | tRPC client | End-to-end type-safe APIs |
| **UI** | Tamagui | Universal design system with token-based theming |
| **Auth** | Better Auth | Native auth with social providers |
| **Storage** | MMKV + SecureStore | Fast general storage + secure credential storage |
| **Runtime** | Bun | Fast package manager and runtime |
| **Linting** | Biome | Fast unified linter and formatter |
| **Testing** | Vitest | Unit testing with native compatibility |
| **Language** | TypeScript (strict) | Type safety throughout |

## Project Structure

```
my-expo-app/
├── apps/
│   └── native/              # Expo mobile app
│       ├── app/             # Expo Router routes
│       │   ├── _layout.tsx  # Root layout with providers
│       │   ├── (tabs)/      # Tab navigator group
│       │   │   ├── _layout.tsx
│       │   │   ├── index.tsx
│       │   │   └── profile.tsx
│       │   ├── (auth)/      # Auth group (login/signup)
│       │   ├── [slug].tsx   # Dynamic routes
│       │   └── +not-found.tsx
│       ├── components/      # App-specific components
│       ├── hooks/           # Custom React hooks
│       ├── lib/             # Utilities and config
│       └── package.json
├── packages/
│   ├── ui/                  # Tamagui component library
│   │   ├── src/
│   │   │   ├── components/  # Buttons, inputs, cards
│   │   │   ├── themes/      # Theme configurations
│   │   │   └── tokens/      # Design tokens
│   │   └── tamagui.config.ts
│   ├── state/               # Legend State stores
│   │   ├── src/
│   │   │   ├── auth/        # Auth state (synced with SecureStore)
│   │   │   ├── app/         # App state (synced with MMKV)
│   │   │   └── sync/        # Sync configurations
│   ├── api-client/          # tRPC client setup
│   │   ├── src/
│   │   │   ├── client.ts    # tRPC client initialization
│   │   │   ├── context.ts   # React context providers
│   │   │   └── hooks.ts     # Query/mutation hooks
│   ├── form/                # Form handling + Valibot
│   │   ├── src/
│   │   │   ├── schemas/     # Validation schemas
│   │   │   └── components/  # Form field wrappers
│   └── shared/              # Shared utilities
├── turbo.json               # Turborepo config
├── opencode.json            # OpenCode agent config
└── AGENTS.md                # Agent guidelines
```

## Essential Commands

### Development (use bun, never npm/pnpm)

```bash
# Start development servers
bun run dev                 # Start Expo dev server
bun run dev:native          # Start native dev server
bun run start:go            # Expo Go (faster iteration, limited native features)
bun run start:dev           # Development build (full native capabilities)

# Platform-specific
bun run android             # Run on Android emulator/device
bun run ios                 # Run on iOS simulator/device

# Pre-flight validation
bun run pre-dev             # Validate environment and dependencies
bun run dev:safe            # Smart start with auto-fix capabilities
```

### Code Quality (Biome)

```bash
bun run check               # Lint + format (auto-fix issues)
bun run check:fast          # Fast check (lint only, no format)
bun run lint                # Biome lint only
bun run format              # Biome format only
```

### Type Checking & Testing

```bash
bun run check-types         # TypeScript type checking
bun run test                # Run Vitest tests
bun run test:watch          # Watch mode for tests
bun run test:coverage       # Test coverage report
```

### Build & Deploy (EAS)

```bash
bun run build:preview       # EAS preview build
bun run build:prod          # EAS production build
bun run submit              # Submit to app stores
bun run update              # OTA update via EAS
```

## Stack-Specific Agents

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| `@legend-state-expert` | Legend State v3 patterns, MMKV persistence, synced queries | State management, offline sync, persistence setup |
| `@valibot-expert` | Schema validation, form validation patterns | Form schemas, input validation, API validation |
| `@tamagui-expert` | Tamagui mobile UI, tokens, themes | UI components, layouts, theming issues |
| `@mobile-expert` | React Native platform differences, native modules | iOS/Android differences, performance, native features |
| `@context7-super-expert` | Deep knowledge retrieval via Context7 | Complex integration questions, edge cases |

## Configuration

### app.json

```json
{
  "expo": {
    "name": "My App",
    "slug": "my-app",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "scheme": "myapp",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#1a1a1a"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.mycompany.myapp",
      "infoPlist": {
        "NSFaceIDUsageDescription": "Use Face ID for secure authentication"
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#1a1a1a"
      },
      "package": "com.mycompany.myapp"
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      [
        "expo-build-properties",
        {
          "ios": {
            "newArchEnabled": true
          },
          "android": {
            "newArchEnabled": true
          }
        }
      ]
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

### opencode.json

```json
{
  "$schema": "https://opencode.ai/config.json",
  "extends": "~/.config/opencode/opencode.json",
  "agent": {
    "mobile-expert": {
      "model": "opencode/glm-4.7",
      "prompt": "React Native and Expo mobile development expert. Specializes in platform differences, performance optimization, and native module integration.",
      "mode": "subagent"
    },
    "legend-state-expert": {
      "model": "opencode/glm-4.7",
      "prompt": "Legend State v3 expert. Deep knowledge of observable patterns, synced queries, MMKV persistence, and fine-grained reactivity.",
      "mode": "subagent"
    }
  }
}
```

## Guardrails (Stack-Specific)

### Legend State (CRITICAL)

1. **NEVER use TanStack Query for data fetching** - Legend State `synced` provides caching, deduplication, and persistence in one API
2. **ALWAYS persist with MMKV** - Configure `synced` with MMKV for instant reads (<1ms) vs AsyncStorage (3-10ms)
3. **NEVER store sensitive data in observables** - Auth tokens go to SecureStore only
4. **ALWAYS use `.get()` for reads in non-reactive contexts** - Use `use$()` hook for reactive component subscriptions
5. **NEVER mutate observables directly** - Always use `.set()`, `.push()`, `.assign()` methods
6. **ALWAYS handle sync errors** - Implement `retry` and `onError` in synced configurations

### Tamagui (CRITICAL)

1. **NEVER use NativeWind or raw StyleSheet** - Tamagui tokens ensure consistency across web/native
2. **ALWAYS use theme tokens** - `$purple9`, `$space4`, `$size5` (NO hardcoded hex codes or px values)
3. **NEVER assume platform parity** - Test on both iOS and Android; platform-specific files use `.ios.tsx`/`.android.tsx`
4. **ALWAYS handle SafeArea** - Use `useSafeAreaInsets` for notches, home indicators, status bars
5. **NEVER mix inline styles with Tamagui props** - Use `styled()` or sx prop for dynamic styles
6. **ALWAYS use Tamagui's Image component** - Better cross-platform handling than React Native's

### Mobile-Specific (CRITICAL)

1. **NEVER use Node.js APIs** - Use `fetch` (not axios), Web APIs only, no `fs` or `path`
2. **ALWAYS test on physical devices** - Simulators miss: push notifications, camera behavior, performance, memory pressure
3. **NEVER bundle large assets (>2MB)** - Use remote URLs with `expo-image` for caching
4. **ALWAYS handle app state changes** - Background/foreground transitions, low memory, network changes
5. **NEVER block the JS thread** - Offload heavy work to native modules or use `InteractionManager`
6. **ALWAYS implement error boundaries** - Mobile crashes are fatal; use `react-error-boundary`

### Storage & Security (CRITICAL)

1. **ALWAYS use SecureStore for sensitive data** - Auth tokens, API keys, biometric data (keychain/Keystore backed)
2. **NEVER store tokens in Legend State** - Even with MMKV persistence, tokens bypass observables
3. **ALWAYS use MMKV for app data** - User preferences, cache, offline data (synchronous, encrypted option available)
4. **NEVER log sensitive data** - Sanitize auth tokens, PII before Sentry/console logging
5. **ALWAYS encrypt sensitive MMKV data** - Use MMKV's encryption for health data, financial data
6. **NEVER hardcode API keys** - Use `expo-constants` + environment variables

### Forms & Validation (CRITICAL)

1. **ALWAYS use Valibot schemas** - Lightweight (~300 bytes) validation with TypeScript inference
2. **NEVER validate on every keystroke** - Debounce validation or validate on blur/submit
3. **ALWAYS handle async validation** - Email uniqueness checks with loading states
4. **NEVER trust client-side validation** - Always validate on server via tRPC

## Best Practices

### Legend State with MMKV Persistence

```typescript
// packages/state/src/sync/mmkv-config.ts
import { configureSynced } from '@legendapp/state/sync'
import { MMKV } from 'react-native-mmkv'

const storage = new MMKV({
  id: 'app-storage',
  // Optional: encrypt sensitive data
  // encryptionKey: 'your-encryption-key'
})

export const mmkvPlugin = {
  get: (key: string) => {
    const value = storage.getString(key)
    return value ? JSON.parse(value) : undefined
  },
  set: (key: string, value: unknown) => {
    storage.set(key, JSON.stringify(value))
  },
  delete: (key: string) => {
    storage.delete(key)
  }
}

configureSynced({
  persist: {
    plugin: mmkvPlugin,
    retrySync: true // Auto-retry failed syncs
  }
})
```

```typescript
// packages/state/src/app/settings.ts
import { observable, synced } from '@legendapp/state'
import { mmkvPlugin } from './mmkv-config'

interface Settings {
  darkMode: boolean
  notifications: boolean
  language: string
}

const initialSettings: Settings = {
  darkMode: false,
  notifications: true,
  language: 'en'
}

export const settings$ = observable(synced<Settings>({
  initial: initialSettings,
  persist: {
    name: 'settings',
    plugin: mmkvPlugin
  }
}))

// Computed observable example
export const isDarkMode$ = observable(() => settings$.darkMode.get())
```

```typescript
// Usage in component
import { use$ } from '@legendapp/state/react'
import { settings$ } from '@myapp/state'
import { YStack, Switch, Text } from '@myapp/ui'

export function SettingsScreen() {
  // Fine-grained reactivity - only re-renders when darkMode changes
  const darkMode = use$(settings$.darkMode)
  
  return (
    <YStack padding="$4" gap="$4">
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontSize="$5">Dark Mode</Text>
        <Switch 
          checked={darkMode} 
          onCheckedChange={(v) => settings$.darkMode.set(v)}
        />
      </XStack>
    </YStack>
  )
}
```

### Legend State with tRPC Synced

```typescript
// packages/state/src/user/profile.ts
import { observable, synced } from '@legendapp/state'
import { trpcClient } from '@myapp/api-client'

interface UserProfile {
  id: string
  name: string
  email: string
  avatar?: string
}

export const userProfile$ = observable(synced<UserProfile | null>({
  initial: null,
  get: async () => {
    const profile = await trpcClient.user.getProfile.query()
    return profile
  },
  set: async ({ value }) => {
    if (!value) return
    await trpcClient.user.updateProfile.mutate(value)
  },
  persist: {
    name: 'user-profile',
    plugin: mmkvPlugin
  },
  // Retry failed requests
  retry: {
    times: 3,
    delay: 1000,
    backoff: 'exponential'
  }
}))
```

### Secure Token Storage with Better Auth

```typescript
// packages/state/src/auth/secure-storage.ts
import * as SecureStore from 'expo-secure-store'

const TOKEN_KEY = 'auth_token'
const REFRESH_TOKEN_KEY = 'refresh_token'

export async function saveAuthToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
  })
}

export async function getAuthToken(): Promise<string | null> {
  return await SecureStore.getItemAsync(TOKEN_KEY)
}

export async function deleteAuthToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY)
}

export async function saveRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
  })
}

export async function getRefreshToken(): Promise<string | null> {
  return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY)
}
```

```typescript
// packages/api-client/src/client.ts
import { createTRPCReact, httpBatchLink } from '@trpc/react-query'
import type { AppRouter } from '@myapp/api'
import { getAuthToken } from '@myapp/state'

export const trpc = createTRPCReact<AppRouter>()

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/trpc',
      async headers() {
        const token = await getAuthToken()
        return {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      },
    }),
  ],
})
```

```typescript
// apps/native/app/(auth)/login.tsx
import { useState } from 'react'
import { authClient } from '@myapp/api-client'
import { saveAuthToken, saveRefreshToken } from '@myapp/state'
import { YStack, Input, Button, Text } from '@myapp/ui'
import { useRouter } from 'expo-router'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async () => {
    setIsLoading(true)
    setError('')
    
    try {
      const result = await authClient.signIn.email({
        email,
        password
      }, {
        onSuccess: async (ctx) => {
          // Store tokens securely (NOT in Legend State)
          await saveAuthToken(ctx.data.token)
          await saveRefreshToken(ctx.data.refreshToken)
          
          // Navigate to main app
          router.replace('/(tabs)')
        },
        onError: (ctx) => {
          setError(ctx.error.message)
        }
      })
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <YStack padding="$4" gap="$4">
      <Text fontSize="$8" fontWeight="bold">Welcome Back</Text>
      
      <Input
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      
      <Input
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      
      {error ? (
        <Text color="$red9">{error}</Text>
      ) : null}
      
      <Button 
        theme="active" 
        onPress={handleLogin}
        disabled={isLoading}
      >
        {isLoading ? 'Signing in...' : 'Sign In'}
      </Button>
    </YStack>
  )
}
```

### Valibot Form Validation

```typescript
// packages/form/src/schemas/auth.ts
import * as v from 'valibot'

export const LoginSchema = v.object({
  email: v.pipe(
    v.string(),
    v.nonEmpty('Please enter your email'),
    v.email('Please enter a valid email address')
  ),
  password: v.pipe(
    v.string(),
    v.nonEmpty('Please enter your password'),
    v.minLength(8, 'Password must be at least 8 characters')
  )
})

export const SignupSchema = v.object({
  name: v.pipe(
    v.string(),
    v.nonEmpty('Please enter your name'),
    v.minLength(2, 'Name must be at least 2 characters')
  ),
  email: v.pipe(
    v.string(),
    v.nonEmpty('Please enter your email'),
    v.email('Please enter a valid email address')
  ),
  password: v.pipe(
    v.string(),
    v.nonEmpty('Please enter your password'),
    v.minLength(8, 'Password must be at least 8 characters'),
    v.regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain uppercase, lowercase, and number'
    )
  ),
  confirmPassword: v.string()
}, [
  // Custom validation for password match
  v.forward(
    v.check(
      (input) => input.password === input.confirmPassword,
      'Passwords do not match'
    ),
    ['confirmPassword']
  )
])

export type LoginInput = v.InferInput<typeof LoginSchema>
export type SignupInput = v.InferInput<typeof SignupSchema>
```

```typescript
// packages/form/src/hooks/useForm.ts
import { useState, useCallback } from 'react'
import * as v from 'valibot'

interface UseFormOptions<T> {
  schema: v.BaseSchema<T>
  initialValues: T
  onSubmit: (values: T) => Promise<void>
}

interface FormState<T> {
  values: T
  errors: Partial<Record<keyof T, string>>
  touched: Partial<Record<keyof T, boolean>>
  isSubmitting: boolean
}

export function useForm<T extends Record<string, unknown>>({
  schema,
  initialValues,
  onSubmit
}: UseFormOptions<T>) {
  const [state, setState] = useState<FormState<T>>({
    values: initialValues,
    errors: {},
    touched: {},
    isSubmitting: false
  })

  const setFieldValue = useCallback((field: keyof T, value: unknown) => {
    setState(prev => ({
      ...prev,
      values: { ...prev.values, [field]: value },
      touched: { ...prev.touched, [field]: true }
    }))
  }, [])

  const validateField = useCallback((field: keyof T, value: unknown) => {
    const result = v.safeParse(schema, { ...state.values, [field]: value })
    if (!result.success) {
      const issue = result.issues.find(i => 
        i.path?.some(p => p.key === field)
      )
      return issue?.message
    }
    return undefined
  }, [schema, state.values])

  const handleSubmit = useCallback(async () => {
    setState(prev => ({ ...prev, isSubmitting: true }))
    
    const result = v.safeParse(schema, state.values)
    
    if (!result.success) {
      const errors: Partial<Record<keyof T, string>> = {}
      for (const issue of result.issues) {
        const field = issue.path?.[0]?.key as keyof T
        if (field && !errors[field]) {
          errors[field] = issue.message
        }
      }
      setState(prev => ({ ...prev, errors, isSubmitting: false }))
      return
    }

    try {
      await onSubmit(state.values)
      setState(prev => ({ ...prev, errors: {}, isSubmitting: false }))
    } catch (error) {
      setState(prev => ({ ...prev, isSubmitting: false }))
      throw error
    }
  }, [schema, state.values, onSubmit])

  return {
    values: state.values,
    errors: state.errors,
    touched: state.touched,
    isSubmitting: state.isSubmitting,
    setFieldValue,
    validateField,
    handleSubmit
  }
}
```

### Tamagui Mobile Components

```typescript
// packages/ui/src/components/Screen.tsx
import { YStack, styled } from 'tamagui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export const Screen = styled(YStack, {
  flex: 1,
  backgroundColor: '$background',
  
  variants: {
    withInsets: {
      true: {
        // Will be overridden by component
      }
    }
  }
})

// Wrapper component for safe area handling
import { ReactNode } from 'react'

interface SafeScreenProps {
  children: ReactNode
  withTopInset?: boolean
  withBottomInset?: boolean
  backgroundColor?: string
}

export function SafeScreen({ 
  children, 
  withTopInset = true,
  withBottomInset = true,
  backgroundColor 
}: SafeScreenProps) {
  const insets = useSafeAreaInsets()
  
  return (
    <YStack 
      flex={1}
      backgroundColor={backgroundColor ?? '$background'}
      paddingTop={withTopInset ? insets.top : 0}
      paddingBottom={withBottomInset ? insets.bottom : 0}
    >
      {children}
    </YStack>
  )
}
```

```typescript
// apps/native/components/workout/WorkoutCard.tsx
import { YStack, XStack, Text, Button, Card } from '@myapp/ui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface WorkoutCardProps {
  title: string
  duration: number
  exercises: number
  onStart: () => void
  onViewDetails: () => void
}

export function WorkoutCard({
  title,
  duration,
  exercises,
  onStart,
  onViewDetails
}: WorkoutCardProps) {
  return (
    <Card 
      elevate
      bordered
      padding="$4"
      margin="$4"
      borderRadius="$6"
      backgroundColor="$purple2"
    >
      <YStack gap="$3">
        <Text 
          fontSize="$7" 
          fontWeight="bold"
          color="$purple11"
        >
          {title}
        </Text>
        
        <XStack gap="$4">
          <Text fontSize="$4" color="$gray11">
            {duration} min
          </Text>
          <Text fontSize="$4" color="$gray11">
            {exercises} exercises
          </Text>
        </XStack>
        
        <XStack gap="$3" marginTop="$2">
          <Button 
            theme="active"
            flex={1}
            onPress={onStart}
          >
            Start
          </Button>
          <Button 
            variant="outlined"
            onPress={onViewDetails}
          >
            Details
          </Button>
        </XStack>
      </YStack>
    </Card>
  )
}
```

### Platform-Safe Code Patterns

```typescript
// apps/native/lib/platform.ts
import { Platform } from 'react-native'

export const isIOS = Platform.OS === 'ios'
export const isAndroid = Platform.OS === 'android'

// Haptic feedback (iOS only)
import * as Haptics from 'expo-haptics'

export function triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'error') {
  if (!isIOS) return // Android haptics need different handling
  
  switch (type) {
    case 'light':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      break
    case 'medium':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      break
    case 'heavy':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
      break
    case 'success':
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      break
    case 'error':
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      break
  }
}
```

```typescript
// apps/native/hooks/useAppState.ts
import { useEffect, useState, useCallback } from 'react'
import { AppState, AppStateStatus } from 'react-native'

export function useAppState() {
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState)

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState)
    return () => subscription.remove()
  }, [])

  const isActive = appState === 'active'
  const isBackground = appState === 'background'
  const isInactive = appState === 'inactive'

  return { appState, isActive, isBackground, isInactive }
}

// Usage: Pause expensive operations when backgrounded
export function useBackgroundPause(callback: () => void) {
  const { isActive } = useAppState()
  
  useEffect(() => {
    if (!isActive) {
      callback()
    }
  }, [isActive, callback])
}
```

### Keyboard Handling

```typescript
// apps/native/components/KeyboardAvoidingContainer.tsx
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { isIOS } from '../lib/platform'

interface KeyboardAvoidingContainerProps {
  children: React.ReactNode
  withScrollView?: boolean
}

export function KeyboardAvoidingContainer({ 
  children, 
  withScrollView = true 
}: KeyboardAvoidingContainerProps) {
  const content = withScrollView ? (
    <ScrollView 
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ flexGrow: 1 }}
    >
      {children}
    </ScrollView>
  ) : children

  if (!isIOS) return <>{content}</> // Android handles this natively

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.select({ ios: 64, android: 0 })}
    >
      {content}
    </KeyboardAvoidingView>
  )
}
```

### Deep Linking with Expo Router

```typescript
// apps/native/app/_layout.tsx
import { Stack } from 'expo-router'
import { useEffect } from 'react'
import { Linking } from 'react-native'
import { useRouter } from 'expo-router'

export default function RootLayout() {
  const router = useRouter()

  useEffect(() => {
    // Handle deep links when app is already running
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (url.includes('reset-password')) {
        const token = new URL(url).searchParams.get('token')
        router.push({
          pathname: '/(auth)/reset-password',
          params: { token }
        })
      }
    })

    // Handle deep link that opened the app
    Linking.getInitialURL().then((url) => {
      if (url?.includes('reset-password')) {
        const token = new URL(url).searchParams.get('token')
        router.push({
          pathname: '/(auth)/reset-password',
          params: { token }
        })
      }
    })

    return () => subscription?.remove()
  }, [router])

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="+not-found" />
    </Stack>
  )
}
```

### Error Boundaries

```typescript
// packages/ui/src/components/ErrorBoundary.tsx
import { Component, ErrorInfo, ReactNode } from 'react'
import { YStack, Text, Button } from 'tamagui'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error?: Error
}

export class MobileErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to error reporting service
    console.error('MobileErrorBoundary caught an error:', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <YStack flex={1} justifyContent="center" alignItems="center" padding="$4" gap="$4">
          <Text fontSize="$6" fontWeight="bold" color="$red9">
            Something went wrong
          </Text>
          <Text fontSize="$4" color="$gray11" textAlign="center">
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          <Button theme="active" onPress={this.handleReset}>
            Try Again
          </Button>
        </YStack>
      )
    }

    return this.props.children
  }
}
```

### Testing Patterns

```typescript
// packages/state/src/__tests__/settings.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { settings$ } from '../app/settings'

describe('settings$', () => {
  beforeEach(() => {
    // Reset to initial state
    settings$.set({ darkMode: false, notifications: true, language: 'en' })
  })

  it('should update dark mode', () => {
    settings$.darkMode.set(true)
    expect(settings$.darkMode.get()).toBe(true)
  })

  it('should persist changes to MMKV', async () => {
    settings$.language.set('es')
    // In real tests, verify MMKV storage
    expect(settings$.language.get()).toBe('es')
  })
})
```

```typescript
// packages/form/src/__tests__/validation.test.ts
import { describe, it, expect } from 'vitest'
import * as v from 'valibot'
import { LoginSchema } from '../schemas/auth'

describe('LoginSchema', () => {
  it('should validate correct email and password', () => {
    const result = v.safeParse(LoginSchema, {
      email: 'user@example.com',
      password: 'password123'
    })
    expect(result.success).toBe(true)
  })

  it('should reject invalid email', () => {
    const result = v.safeParse(LoginSchema, {
      email: 'not-an-email',
      password: 'password123'
    })
    expect(result.success).toBe(false)
  })

  it('should reject short password', () => {
    const result = v.safeParse(LoginSchema, {
      email: 'user@example.com',
      password: '123'
    })
    expect(result.success).toBe(false)
  })
})
```

## Example Agent Usage

```bash
# Legend State patterns
@legend-state-expert help me set up offline-first data sync with retry logic
@legend-state-expert how do I persist form state across app restarts

# Valibot validation
@valibot-expert create a validation schema for user registration
@valibot-expert how do I validate nested objects and arrays

# Tamagui mobile UI
@tamagui-expert review my screen layout for tablet support
@tamagui-expert create a responsive grid that works on all screen sizes

# Mobile-specific issues
@mobile-expert handle iOS/Android differences for push notifications
@mobile-expert optimize list performance with 1000+ items

# Deep knowledge retrieval
@context7-super-expert look up Expo best practices for background tasks
@context7-super-expert find Legend State patterns for real-time collaboration
```

## Migration Guides

### From TanStack Query to Legend State

```typescript
// Before: TanStack Query
const { data, isLoading } = useQuery({
  queryKey: ['user'],
  queryFn: fetchUser
})

// After: Legend State synced
const user$ = observable(synced({
  get: fetchUser,
  persist: { name: 'user', plugin: mmkvPlugin }
}))

// In component: fine-grained reactivity
const user = use$(user$)
```

### From Zod to Valibot

```typescript
// Before: Zod (~15KB)
import { z } from 'zod'
const schema = z.object({ name: z.string().min(2) })

// After: Valibot (~300 bytes)
import * as v from 'valibot'
const schema = v.object({
  name: v.pipe(v.string(), v.minLength(2))
})
```

## Resources

### Official Documentation

- [Legend State v3](https://legendapp.com/open-source/state/v3/intro/introduction/) - Observable state with sync and persist
- [Valibot](https://valibot.dev/) - Lightweight schema validation
- [Tamagui](https://tamagui.dev/) - Universal UI kit
- [Expo](https://docs.expo.dev/) - React Native framework
- [Expo Router](https://docs.expo.dev/router/introduction/) - File-based routing
- [Better Auth](https://www.better-auth.com/docs/integrations/expo) - Authentication for Expo
- [tRPC](https://trpc.io/) - End-to-end typesafe APIs
- [MMKV](https://github.com/mrousavy/react-native-mmkv) - Fast key-value storage
- [EAS](https://docs.expo.dev/build/introduction/) - Expo Application Services

### Community & Examples

- [Legend State React Native Guide](https://legendapp.com/open-source/state/v3/react-native/)
- [Tamagui Best Practices](https://tamagui.dev/docs/intro/best-practices)
- [Expo Router Migration](https://docs.expo.dev/router/migrate/from-react-navigation/)
- [React Native Performance](https://reactnative.dev/docs/performance)

### Troubleshooting

| Issue | Solution |
|-------|----------|
| MMKV build errors on iOS | Run `cd ios && pod install` after adding MMKV |
| Tamagui styles not applying | Ensure `tamagui.config.ts` is imported in app entry |
| Legend State not persisting | Verify `configureSynced` is called before creating observables |
| SecureStore hangs on Android | Use `expo-secure-store` v12+ with proper keychain config |
| tRPC types not generating | Run `bun run generate` in api package before client |
