# Frontend Architecture Strategy Template
## Stop FRA Platform - Frontend Development Guide

**Version:** 1.0
**Last Updated:** December 20, 2025
**Target Audience:** Frontend Architect Agents, Mobile Developers, UI/UX Engineers

---

## Table of Contents

1. [Architecture Philosophy](#architecture-philosophy)
2. [Technology Stack Rationale](#technology-stack-rationale)
3. [Project Structure & Organization](#project-structure-organization)
4. [Component Architecture](#component-architecture)
5. [State Management Strategy](#state-management-strategy)
6. [Navigation & Routing](#navigation-routing)
7. [Design System & UI Guidelines](#design-system-ui-guidelines)
8. [Form Handling & Validation](#form-handling-validation)
9. [Data Fetching & API Integration](#data-fetching-api-integration)
10. [Performance Optimization](#performance-optimization)
11. [Offline-First Strategy](#offline-first-strategy)
12. [Accessibility Standards](#accessibility-standards)
13. [Testing Strategy](#testing-strategy)
14. [Security Best Practices](#security-best-practices)
15. [Cross-Platform Compatibility](#cross-platform-compatibility)
16. [Deployment & Updates](#deployment-updates)
17. [Decision Framework](#decision-framework)

---

## Architecture Philosophy

### Core Principles

**1. Mobile-First, Cross-Platform Design**
- Build once, deploy everywhere (iOS, Android, Web)
- Native performance and feel
- Platform-specific optimizations when needed
- Responsive design for all screen sizes

**2. User Experience Excellence**
- Intuitive, accessible interfaces
- Clear visual hierarchy and navigation
- Immediate feedback for all user actions
- Graceful error handling and recovery
- Progress indicators for long-running operations

**3. Performance & Efficiency**
- Fast initial load (<3 seconds)
- Smooth animations (60 FPS)
- Optimized bundle size
- Lazy loading for heavy components
- Efficient re-rendering strategies

**4. Maintainability & Scalability**
- Component reusability (DRY principle)
- Clear separation of concerns
- Type safety throughout
- Comprehensive documentation
- Consistent coding standards

**5. Offline-First Capability**
- Core functionality works offline
- Automatic sync when online
- Clear offline/online status indicators
- Conflict resolution strategies

**6. Compliance & Security**
- WCAG 2.1 AA accessibility compliance
- Secure data storage on device
- No sensitive data in logs
- Secure communication with backend
- GDPR-compliant data handling

---

## Technology Stack Rationale

### React Native + Expo

**Why React Native?**
- ✅ True cross-platform development (iOS, Android, Web)
- ✅ Native performance and components
- ✅ Large ecosystem and community
- ✅ Hot reload for rapid development
- ✅ Shared codebase reduces maintenance
- ✅ JavaScript/TypeScript familiarity

**Why Expo?**
- ✅ Simplified development workflow
- ✅ OTA (Over-The-Air) updates
- ✅ Built-in native modules
- ✅ Easy deployment process
- ✅ Excellent developer experience
- ✅ EAS (Expo Application Services) integration

**Alternatives Considered:**
- **Flutter:** ❌ Dart language learning curve, smaller ecosystem
- **Native (Swift/Kotlin):** ❌ Duplicate codebases, higher maintenance
- **Ionic:** ❌ WebView performance limitations

### TypeScript

**Benefits:**
- Type safety reduces runtime errors
- Better IDE support and autocomplete
- Self-documenting code
- Easier refactoring
- Catches errors at compile time

```typescript
// Example: Type-safe assessment data
interface Assessment {
  assessment_id: string;
  organisation_id: string;
  status: 'draft' | 'submitted' | 'paid' | 'signed';
  overall_risk_level?: 'low' | 'medium' | 'high';
  created_at: string;
}

// Compile-time error prevention
const assessment: Assessment = {
  assessment_id: '123',
  organisation_id: '456',
  status: 'invalid', // ❌ Type error: not assignable
  created_at: new Date().toISOString()
};
```

### Expo Router (File-Based Routing)

**Benefits:**
- Automatic route generation from file structure
- Deep linking support out of the box
- Type-safe navigation
- Shared routes between web and mobile
- Nested layouts and groups

```
app/
├── _layout.tsx              → Root layout
├── index.tsx                → Home screen (/)
├── auth/
│   ├── login.tsx           → Login screen (/auth/login)
│   └── signup.tsx          → Signup screen (/auth/signup)
└── (assessment)/           → Route group
    ├── _layout.tsx         → Assessment layout
    ├── risk-appetite.tsx   → (/risk-appetite)
    └── fraud-triangle.tsx  → (/fraud-triangle)
```

### State Management

**Zustand (Global State)**
```typescript
// Why Zustand?
✅ Minimal boilerplate
✅ Hook-based API
✅ TypeScript support
✅ Middleware support
✅ Small bundle size (~1kb)
✅ No context provider hell
```

**React Query (Server State)**
```typescript
// Why React Query?
✅ Automatic caching
✅ Background refetching
✅ Optimistic updates
✅ Request deduplication
✅ Offline support
✅ Pagination/infinite scroll support
```

**React Context (UI State)**
```typescript
// For assessment flow and auth
✅ Built-in to React
✅ Good for theme, i18n
✅ Scoped state management
```

---

## Project Structure & Organization

### Recommended Folder Structure

```
fraud-risk-app-main/
├── app/                           # Expo Router screens
│   ├── _layout.tsx               # Root layout with providers
│   ├── index.tsx                 # Landing page
│   ├── +not-found.tsx            # 404 page
│   │
│   ├── (auth)/                   # Auth route group
│   │   ├── _layout.tsx          # Auth layout
│   │   ├── login.tsx
│   │   ├── signup.tsx
│   │   └── keypass.tsx
│   │
│   ├── (assessment)/             # Assessment route group
│   │   ├── _layout.tsx          # Assessment progress tracker
│   │   ├── risk-appetite.tsx
│   │   ├── fraud-triangle.tsx
│   │   └── [13 more modules]
│   │
│   └── (dashboard)/              # Dashboard route group
│       ├── _layout.tsx
│       └── index.tsx
│
├── components/                    # Reusable components
│   ├── ui/                       # Base UI components
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   └── Spinner.tsx
│   │
│   ├── assessment/               # Assessment-specific
│   │   ├── QuestionCard.tsx
│   │   ├── RiskScoreDisplay.tsx
│   │   ├── ProgressBar.tsx
│   │   └── SectionHeader.tsx
│   │
│   ├── dashboard/                # Dashboard widgets
│   │   ├── MetricCard.tsx
│   │   ├── RiskChart.tsx
│   │   └── ActivityFeed.tsx
│   │
│   └── layout/                   # Layout components
│       ├── Header.tsx
│       ├── Footer.tsx
│       └── Container.tsx
│
├── contexts/                      # React Context providers
│   ├── AuthContext.tsx
│   ├── AssessmentContext.tsx
│   └── ThemeContext.tsx
│
├── hooks/                         # Custom React hooks
│   ├── useAuth.ts
│   ├── useAssessment.ts
│   ├── useKeyPress.ts
│   └── useOfflineSync.ts
│
├── stores/                        # Zustand stores
│   ├── authStore.ts
│   ├── assessmentStore.ts
│   └── uiStore.ts
│
├── services/                      # API and external services
│   ├── api/
│   │   ├── client.ts            # Axios instance
│   │   ├── auth.ts              # Auth endpoints
│   │   ├── assessments.ts       # Assessment endpoints
│   │   └── payments.ts          # Payment endpoints
│   │
│   ├── storage/
│   │   ├── secureStorage.ts     # Encrypted storage
│   │   └── asyncStorage.ts      # Regular storage
│   │
│   └── analytics/
│       └── tracker.ts            # Analytics service
│
├── utils/                         # Utility functions
│   ├── validation.ts             # Form validation
│   ├── formatting.ts             # Data formatting
│   ├── calculations.ts           # Risk scoring
│   └── constants.ts              # App constants
│
├── types/                         # TypeScript types
│   ├── assessment.ts
│   ├── user.ts
│   ├── api.ts
│   └── index.ts
│
├── theme/                         # Design system
│   ├── colors.ts
│   ├── typography.ts
│   ├── spacing.ts
│   └── index.ts
│
├── assets/                        # Static assets
│   ├── images/
│   ├── fonts/
│   └── icons/
│
└── __tests__/                     # Test files
    ├── components/
    ├── hooks/
    └── utils/
```

### File Naming Conventions

```typescript
// Components: PascalCase
Button.tsx
QuestionCard.tsx
RiskScoreDisplay.tsx

// Hooks: camelCase with 'use' prefix
useAuth.ts
useAssessment.ts
useOfflineSync.ts

// Utils/Services: camelCase
validation.ts
apiClient.ts
formatting.ts

// Types: PascalCase
Assessment.ts
User.ts
RiskRegisterItem.ts

// Constants: UPPER_SNAKE_CASE
API_ENDPOINTS.ts
ERROR_MESSAGES.ts
```

---

## Component Architecture

### Component Design Principles

**1. Single Responsibility**
Each component should do one thing well.

```typescript
// ✅ Good: Focused components
<Button onPress={handleSubmit}>Submit</Button>
<LoadingSpinner visible={isLoading} />
<ErrorMessage error={error} />

// ❌ Bad: Component doing too much
<FormWithValidationAndSubmissionAndErrorHandling />
```

**2. Composition Over Inheritance**
Build complex UIs from simple components.

```typescript
// ✅ Good: Composition
<Card>
  <CardHeader title="Risk Assessment" />
  <CardBody>
    <RiskScore value={85} level="high" />
  </CardBody>
  <CardFooter>
    <Button>View Details</Button>
  </CardFooter>
</Card>

// ❌ Bad: Inheritance
class RiskAssessmentCard extends Card {
  // Complex inheritance hierarchy
}
```

**3. Props Interface Design**
Clear, type-safe props with sensible defaults.

```typescript
interface ButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  testID?: string;
}

const Button: React.FC<ButtonProps> = ({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
  testID
}) => {
  // Implementation
};
```

### Component Patterns

#### 1. Container/Presenter Pattern

```typescript
// Presenter: Pure UI component
interface RiskScoreDisplayProps {
  score: number;
  level: 'low' | 'medium' | 'high';
  label: string;
}

const RiskScoreDisplay: React.FC<RiskScoreDisplayProps> = ({
  score,
  level,
  label
}) => {
  const color = level === 'high' ? 'red' : level === 'medium' ? 'orange' : 'green';

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.score, { color }]}>{score}</Text>
    </View>
  );
};

// Container: Data fetching and logic
const RiskScoreContainer: React.FC<{ assessmentId: string }> = ({
  assessmentId
}) => {
  const { data: assessment, isLoading } = useQuery(
    ['assessment', assessmentId],
    () => fetchAssessment(assessmentId)
  );

  if (isLoading) return <LoadingSpinner />;

  const { overall_score, risk_level } = calculateRiskScore(assessment);

  return (
    <RiskScoreDisplay
      score={overall_score}
      level={risk_level}
      label="Overall Risk"
    />
  );
};
```

#### 2. Compound Components Pattern

```typescript
// Card compound component
interface CardProps {
  children: React.ReactNode;
  elevated?: boolean;
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

interface CardBodyProps {
  children: React.ReactNode;
  padding?: number;
}

const Card: React.FC<CardProps> & {
  Header: React.FC<CardHeaderProps>;
  Body: React.FC<CardBodyProps>;
  Footer: React.FC<{ children: React.ReactNode }>;
} = ({ children, elevated = false }) => {
  return (
    <View style={[styles.card, elevated && styles.elevated]}>
      {children}
    </View>
  );
};

Card.Header = ({ title, subtitle, action }) => (
  <View style={styles.header}>
    <View>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
    {action}
  </View>
);

Card.Body = ({ children, padding = 16 }) => (
  <View style={[styles.body, { padding }]}>
    {children}
  </View>
);

Card.Footer = ({ children }) => (
  <View style={styles.footer}>
    {children}
  </View>
);

// Usage
<Card elevated>
  <Card.Header
    title="Risk Assessment"
    subtitle="Package 3"
    action={<Button variant="outline">Edit</Button>}
  />
  <Card.Body>
    <RiskScoreDisplay score={85} level="high" label="Overall" />
  </Card.Body>
  <Card.Footer>
    <Button fullWidth>View Details</Button>
  </Card.Footer>
</Card>
```

#### 3. Render Props Pattern

```typescript
interface DataFetcherProps<T> {
  url: string;
  children: (data: {
    data: T | null;
    isLoading: boolean;
    error: Error | null;
    refetch: () => void;
  }) => React.ReactNode;
}

function DataFetcher<T>({ url, children }: DataFetcherProps<T>) {
  const { data, isLoading, error, refetch } = useQuery<T>(
    [url],
    () => apiClient.get(url).then(res => res.data)
  );

  return <>{children({ data, isLoading, error, refetch })}</>;
}

// Usage
<DataFetcher<Assessment> url="/api/assessments/123">
  {({ data, isLoading, error, refetch }) => {
    if (isLoading) return <LoadingSpinner />;
    if (error) return <ErrorMessage error={error} onRetry={refetch} />;
    if (!data) return null;

    return <AssessmentDetails assessment={data} />;
  }}
</DataFetcher>
```

### Component Best Practices

```typescript
// ✅ Good Practices

// 1. Memoization for expensive computations
const ExpensiveComponent: React.FC<{ data: any[] }> = ({ data }) => {
  const processedData = useMemo(
    () => data.map(item => expensiveCalculation(item)),
    [data]
  );

  return <DataVisualization data={processedData} />;
};

// 2. Callback memoization
const ParentComponent = () => {
  const handleSubmit = useCallback((values) => {
    submitForm(values);
  }, []); // Empty deps - stable reference

  return <ChildComponent onSubmit={handleSubmit} />;
};

// 3. Early returns for cleaner code
const UserProfile: React.FC<{ userId: string }> = ({ userId }) => {
  const { data: user, isLoading, error } = useUser(userId);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  if (!user) return <NotFound />;

  return (
    <View>
      <Avatar source={{ uri: user.avatar }} />
      <Text>{user.name}</Text>
      <Text>{user.email}</Text>
    </View>
  );
};

// 4. Prop spreading with care
const Button: React.FC<ButtonProps> = ({
  children,
  onPress,
  ...restProps // Spread remaining props
}) => {
  return (
    <Pressable onPress={onPress} {...restProps}>
      <Text>{children}</Text>
    </Pressable>
  );
};

// 5. Fragment shorthand
const Component = () => (
  <>
    <Header />
    <Content />
    <Footer />
  </>
);
```

---

## State Management Strategy

### State Classification

```typescript
// 1. SERVER STATE (React Query)
// - Data from API
// - Cached automatically
// - Background refetching

const { data: assessments } = useQuery(
  ['assessments', orgId],
  () => fetchAssessments(orgId),
  {
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  }
);

// 2. GLOBAL CLIENT STATE (Zustand)
// - User preferences
// - UI state across screens
// - App configuration

interface AuthStore {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  login: async (email, password) => {
    const { user, token } = await authApi.login(email, password);
    set({ user, token });
  },
  logout: () => set({ user: null, token: null })
}));

// 3. LOCAL COMPONENT STATE (useState)
// - Form inputs
// - UI toggles
// - Temporary data

const [isOpen, setIsOpen] = useState(false);
const [searchQuery, setSearchQuery] = useState('');

// 4. SHARED FLOW STATE (Context)
// - Multi-step form data
// - Assessment progress
// - Wizard state

const AssessmentContext = createContext<AssessmentContextType>(null);
```

### Zustand Store Pattern

```typescript
// stores/assessmentStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AssessmentStore {
  // State
  currentAssessmentId: string | null;
  draftAnswers: Record<string, any>;
  completedSections: string[];

  // Actions
  setCurrentAssessment: (id: string) => void;
  saveDraftAnswer: (section: string, key: string, value: any) => void;
  markSectionComplete: (section: string) => void;
  clearDraft: () => void;

  // Computed
  getProgress: () => number;
}

export const useAssessmentStore = create<AssessmentStore>()(
  persist(
    (set, get) => ({
      // State
      currentAssessmentId: null,
      draftAnswers: {},
      completedSections: [],

      // Actions
      setCurrentAssessment: (id) => set({ currentAssessmentId: id }),

      saveDraftAnswer: (section, key, value) => set((state) => ({
        draftAnswers: {
          ...state.draftAnswers,
          [`${section}.${key}`]: value
        }
      })),

      markSectionComplete: (section) => set((state) => ({
        completedSections: [...state.completedSections, section]
      })),

      clearDraft: () => set({
        currentAssessmentId: null,
        draftAnswers: {},
        completedSections: []
      }),

      // Computed
      getProgress: () => {
        const { completedSections } = get();
        const totalSections = 13;
        return (completedSections.length / totalSections) * 100;
      }
    }),
    {
      name: 'assessment-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        draftAnswers: state.draftAnswers,
        completedSections: state.completedSections
      })
    }
  )
);

// Usage in components
const RiskAppetiteScreen = () => {
  const saveDraftAnswer = useAssessmentStore((state) => state.saveDraftAnswer);
  const markSectionComplete = useAssessmentStore((state) => state.markSectionComplete);
  const [riskAppetite, setRiskAppetite] = useState('');

  const handleContinue = () => {
    saveDraftAnswer('risk-appetite', 'appetite', riskAppetite);
    markSectionComplete('risk-appetite');
    router.push('/fraud-triangle');
  };

  return (
    <View>
      <Picker
        selectedValue={riskAppetite}
        onValueChange={setRiskAppetite}
      >
        <Picker.Item label="Low" value="low" />
        <Picker.Item label="Medium" value="medium" />
        <Picker.Item label="High" value="high" />
      </Picker>
      <Button onPress={handleContinue}>Continue</Button>
    </View>
  );
};
```

### React Query Patterns

```typescript
// services/api/assessments.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

// Fetch assessment
export const useAssessment = (assessmentId: string) => {
  return useQuery({
    queryKey: ['assessment', assessmentId],
    queryFn: () => apiClient.get(`/assessments/${assessmentId}`),
    staleTime: 5 * 60 * 1000,
    enabled: !!assessmentId
  });
};

// Create assessment
export const useCreateAssessment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateAssessmentInput) =>
      apiClient.post('/assessments', data),
    onSuccess: (newAssessment) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['assessments'] });

      // Or optimistically update
      queryClient.setQueryData(
        ['assessment', newAssessment.id],
        newAssessment
      );
    }
  });
};

// Update assessment (with optimistic update)
export const useUpdateAssessment = (assessmentId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: Partial<Assessment>) =>
      apiClient.patch(`/assessments/${assessmentId}`, updates),

    // Optimistic update
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ['assessment', assessmentId] });

      const previousAssessment = queryClient.getQueryData(['assessment', assessmentId]);

      queryClient.setQueryData(['assessment', assessmentId], (old: Assessment) => ({
        ...old,
        ...updates
      }));

      return { previousAssessment };
    },

    // Rollback on error
    onError: (err, updates, context) => {
      queryClient.setQueryData(
        ['assessment', assessmentId],
        context?.previousAssessment
      );
    },

    // Refetch on success
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['assessment', assessmentId] });
    }
  });
};

// Usage in component
const AssessmentScreen = ({ assessmentId }: { assessmentId: string }) => {
  const { data: assessment, isLoading, error } = useAssessment(assessmentId);
  const updateMutation = useUpdateAssessment(assessmentId);

  const handleUpdate = (updates: Partial<Assessment>) => {
    updateMutation.mutate(updates, {
      onSuccess: () => {
        Alert.alert('Success', 'Assessment updated');
      },
      onError: (error) => {
        Alert.alert('Error', error.message);
      }
    });
  };

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return <AssessmentForm assessment={assessment} onUpdate={handleUpdate} />;
};
```

---

## Navigation & Routing

### Expo Router Configuration

```typescript
// app/_layout.tsx - Root layout
import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/services/api/queryClient';
import { AuthProvider } from '@/contexts/AuthContext';

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right'
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(assessment)" />
          <Stack.Screen name="(dashboard)" />
        </Stack>
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

### Navigation Patterns

```typescript
// Type-safe navigation
import { router } from 'expo-router';

// 1. Push new screen
router.push('/risk-appetite');
router.push({
  pathname: '/assessment/[id]',
  params: { id: '123' }
});

// 2. Replace current screen (no back)
router.replace('/dashboard');

// 3. Go back
router.back();

// 4. Navigate to specific screen in stack
router.navigate('/confirmation');

// 5. Deep linking
router.push('/assessment/123?section=fraud-triangle');
```

### Protected Routes

```typescript
// app/(assessment)/_layout.tsx
import { Redirect, Slot } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function AssessmentLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />;

  if (!user) {
    return <Redirect href="/auth/login" />;
  }

  return (
    <View style={{ flex: 1 }}>
      <AssessmentProgressBar />
      <Slot />
    </View>
  );
}
```

### Navigation Guards

```typescript
// hooks/useNavigationGuard.ts
import { useEffect } from 'react';
import { router } from 'expo-router';
import { Alert } from 'react-native';

export const useNavigationGuard = (
  condition: boolean,
  message: string
) => {
  useEffect(() => {
    const handleBeforeRemove = (e: any) => {
      if (!condition) return;

      e.preventDefault();

      Alert.alert(
        'Unsaved Changes',
        message,
        [
          { text: 'Stay', style: 'cancel' },
          {
            text: 'Leave',
            style: 'destructive',
            onPress: () => router.back()
          }
        ]
      );
    };

    return () => {
      // Cleanup
    };
  }, [condition, message]);
};

// Usage
const AssessmentForm = () => {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useNavigationGuard(
    hasUnsavedChanges,
    'You have unsaved changes. Are you sure you want to leave?'
  );

  return <Form />;
};
```

---

## Design System & UI Guidelines

### Color System

```typescript
// theme/colors.ts
export const colors = {
  // Primary palette
  primary: {
    50: '#E3F2FD',
    100: '#BBDEFB',
    500: '#2196F3',
    600: '#1E88E5',
    700: '#1976D2',
    900: '#0D47A1'
  },

  // Secondary palette
  secondary: {
    50: '#F3E5F5',
    500: '#9C27B0',
    900: '#4A148C'
  },

  // Semantic colors
  success: {
    light: '#81C784',
    main: '#4CAF50',
    dark: '#388E3C'
  },

  warning: {
    light: '#FFB74D',
    main: '#FF9800',
    dark: '#F57C00'
  },

  error: {
    light: '#E57373',
    main: '#F44336',
    dark: '#D32F2F'
  },

  // Risk levels
  risk: {
    low: '#4CAF50',
    medium: '#FF9800',
    high: '#F44336'
  },

  // Neutral colors
  grey: {
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#EEEEEE',
    300: '#E0E0E0',
    400: '#BDBDBD',
    500: '#9E9E9E',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121'
  },

  // Background
  background: {
    default: '#FFFFFF',
    paper: '#F5F5F5',
    elevated: '#FFFFFF'
  },

  // Text
  text: {
    primary: '#212121',
    secondary: '#757575',
    disabled: '#BDBDBD',
    inverse: '#FFFFFF'
  }
};
```

### Typography System

```typescript
// theme/typography.ts
import { Platform } from 'react-native';

export const typography = {
  fontFamily: {
    regular: Platform.select({
      ios: 'System',
      android: 'Roboto',
      web: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto'
    }),
    medium: Platform.select({
      ios: 'System',
      android: 'Roboto-Medium',
      web: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto'
    }),
    bold: Platform.select({
      ios: 'System',
      android: 'Roboto-Bold',
      web: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto'
    })
  },

  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36
  },

  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75
  },

  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const
  }
};

// Text styles
export const textStyles = {
  h1: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize['3xl'],
    lineHeight: typography.fontSize['3xl'] * typography.lineHeight.tight,
    fontWeight: typography.fontWeight.bold
  },

  h2: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize['2xl'],
    lineHeight: typography.fontSize['2xl'] * typography.lineHeight.tight,
    fontWeight: typography.fontWeight.bold
  },

  h3: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xl,
    lineHeight: typography.fontSize.xl * typography.lineHeight.tight,
    fontWeight: typography.fontWeight.semibold
  },

  body1: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.base,
    lineHeight: typography.fontSize.base * typography.lineHeight.normal
  },

  body2: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.fontSize.sm * typography.lineHeight.normal
  },

  button: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    textTransform: 'uppercase' as const
  },

  caption: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    lineHeight: typography.fontSize.xs * typography.lineHeight.normal
  }
};
```

### Spacing System

```typescript
// theme/spacing.ts
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64
};

// Usage
<View style={{ padding: spacing.md, marginTop: spacing.lg }} />
```

### Component Design Tokens

```typescript
// theme/tokens.ts
export const tokens = {
  // Border radius
  borderRadius: {
    none: 0,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999
  },

  // Shadows
  shadow: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 5
    }
  },

  // Animation durations
  duration: {
    fast: 150,
    normal: 300,
    slow: 500
  },

  // Z-index layers
  zIndex: {
    dropdown: 1000,
    modal: 1100,
    popover: 1200,
    tooltip: 1300
  }
};
```

### Reusable UI Components

```typescript
// components/ui/Button.tsx
import { Pressable, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, spacing, tokens, textStyles } from '@/theme';

interface ButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: colors.primary[500],
          borderWidth: 0
        };
      case 'secondary':
        return {
          backgroundColor: colors.secondary[500],
          borderWidth: 0
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.primary[500]
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          borderWidth: 0
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.md
        };
      case 'md':
        return {
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.lg
        };
      case 'lg':
        return {
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.xl
        };
    }
  };

  const getTextColor = () => {
    if (disabled) return colors.text.disabled;
    if (variant === 'outline' || variant === 'ghost') {
      return colors.primary[500];
    }
    return colors.text.inverse;
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        getVariantStyles(),
        getSizeStyles(),
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed
      ]}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} />
      ) : (
        <>
          {icon && <View style={styles.icon}>{icon}</View>}
          <Text style={[textStyles.button, { color: getTextColor() }]}>
            {children}
          </Text>
        </>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.borderRadius.md,
    ...tokens.shadow.sm
  },
  fullWidth: {
    width: '100%'
  },
  disabled: {
    opacity: 0.5
  },
  pressed: {
    opacity: 0.8
  },
  icon: {
    marginRight: spacing.xs
  }
});
```

---

## Form Handling & Validation

### Form Library: React Hook Form

```typescript
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Schema definition
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters')
});

type LoginFormData = z.infer<typeof loginSchema>;

// Login form component
const LoginForm: React.FC = () => {
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await authApi.login(data.email, data.password);
      router.push('/dashboard');
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <View style={styles.form}>
      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="Email"
            placeholder="you@example.com"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.email?.message}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        )}
      />

      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="Password"
            placeholder="••••••••"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.password?.message}
            secureTextEntry
          />
        )}
      />

      <Button
        onPress={handleSubmit(onSubmit)}
        loading={isSubmitting}
        fullWidth
      >
        Login
      </Button>
    </View>
  );
};
```

### Complex Form Validation

```typescript
// Assessment form schema
const riskAppetiteSchema = z.object({
  appetite: z.enum(['low', 'medium', 'high'], {
    required_error: 'Please select a risk appetite'
  }),

  justification: z.string()
    .min(50, 'Please provide at least 50 characters')
    .max(500, 'Maximum 500 characters allowed'),

  board_approval: z.boolean()
    .refine((val) => val === true, {
      message: 'Board approval is required'
    }),

  review_frequency: z.enum(['quarterly', 'semi-annual', 'annual']),

  risk_threshold: z.number()
    .min(0, 'Must be 0 or greater')
    .max(100, 'Must be 100 or less')
});

// Multi-step form with conditional fields
const procurementSchema = z.object({
  has_procurement: z.boolean(),

  annual_spend: z.number().optional(),

  supplier_count: z.number().optional(),

  controls: z.object({
    dual_authorization: z.boolean(),
    segregation_of_duties: z.boolean(),
    regular_audits: z.boolean()
  }).optional()
}).superRefine((data, ctx) => {
  // Conditional validation
  if (data.has_procurement) {
    if (!data.annual_spend) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Annual spend is required when procurement exists',
        path: ['annual_spend']
      });
    }

    if (!data.supplier_count) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Supplier count is required',
        path: ['supplier_count']
      });
    }
  }
});
```

### Custom Form Components

```typescript
// components/ui/Input.tsx
interface InputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  error?: string;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  multiline?: boolean;
  numberOfLines?: number;
}

export const Input: React.FC<InputProps> = ({
  label,
  value,
  onChangeText,
  onBlur,
  error,
  placeholder,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  multiline = false,
  numberOfLines = 1
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        numberOfLines={numberOfLines}
        style={[
          styles.input,
          error && styles.inputError,
          multiline && styles.inputMultiline
        ]}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md
  },
  label: {
    ...textStyles.body2,
    color: colors.text.secondary,
    marginBottom: spacing.xs
  },
  input: {
    ...textStyles.body1,
    borderWidth: 1,
    borderColor: colors.grey[300],
    borderRadius: tokens.borderRadius.md,
    padding: spacing.md,
    backgroundColor: colors.background.default
  },
  inputError: {
    borderColor: colors.error.main
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top'
  },
  error: {
    ...textStyles.caption,
    color: colors.error.main,
    marginTop: spacing.xs
  }
});
```

---

## Data Fetching & API Integration

### API Client Setup

```typescript
// services/api/client.ts
import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';
import { router } from 'expo-router';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add request ID for tracing
    config.headers['X-Request-ID'] = generateRequestId();

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh token
        const newToken = await refreshAuthToken();
        useAuthStore.getState().setToken(newToken);

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed, logout user
        useAuthStore.getState().logout();
        router.replace('/auth/login');
        return Promise.reject(refreshError);
      }
    }

    // Handle network errors
    if (!error.response) {
      return Promise.reject({
        message: 'Network error. Please check your connection.',
        code: 'NETWORK_ERROR'
      });
    }

    // Handle API errors
    const apiError = error.response.data?.error || {
      message: 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR'
    };

    return Promise.reject(apiError);
  }
);

function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function refreshAuthToken(): Promise<string> {
  const refreshToken = useAuthStore.getState().refreshToken;
  const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
    refreshToken
  });
  return response.data.accessToken;
}
```

### Query Client Configuration

```typescript
// services/api/queryClient.ts
import { QueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry failed requests
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors
        if (error.response?.status >= 400 && error.response?.status < 500) {
          return false;
        }
        return failureCount < 3;
      },

      // Stale time
      staleTime: 5 * 60 * 1000, // 5 minutes

      // Cache time
      cacheTime: 10 * 60 * 1000, // 10 minutes

      // Refetch on window focus
      refetchOnWindowFocus: false,

      // Refetch on reconnect
      refetchOnReconnect: true,

      // Network mode
      networkMode: 'online'
    },
    mutations: {
      retry: 1,
      networkMode: 'online'
    }
  }
});

// Setup network status listener
NetInfo.addEventListener((state) => {
  if (state.isConnected) {
    queryClient.resumePausedMutations();
    queryClient.invalidateQueries();
  }
});
```

### API Service Modules

```typescript
// services/api/assessments.ts
import { apiClient } from './client';
import type { Assessment, CreateAssessmentInput, UpdateAssessmentInput } from '@/types';

export const assessmentsApi = {
  // List assessments
  list: (orgId: string) =>
    apiClient.get<{ data: Assessment[] }>(`/assessments?organisation_id=${orgId}`),

  // Get single assessment
  get: (id: string) =>
    apiClient.get<{ data: Assessment }>(`/assessments/${id}`),

  // Create assessment
  create: (input: CreateAssessmentInput) =>
    apiClient.post<{ data: Assessment }>('/assessments', input),

  // Update assessment
  update: (id: string, input: UpdateAssessmentInput) =>
    apiClient.patch<{ data: Assessment }>(`/assessments/${id}`, input),

  // Submit assessment
  submit: (id: string) =>
    apiClient.post<{ data: Assessment }>(`/assessments/${id}/submit`),

  // Delete assessment
  delete: (id: string) =>
    apiClient.delete(`/assessments/${id}`)
};

// Custom hooks
export const useAssessments = (orgId: string) => {
  return useQuery({
    queryKey: ['assessments', orgId],
    queryFn: () => assessmentsApi.list(orgId),
    enabled: !!orgId
  });
};

export const useAssessment = (id: string) => {
  return useQuery({
    queryKey: ['assessment', id],
    queryFn: () => assessmentsApi.get(id),
    enabled: !!id
  });
};

export const useCreateAssessment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: assessmentsApi.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      return data;
    }
  });
};
```

---

## Performance Optimization

### React Native Performance Best Practices

```typescript
// 1. List optimization with FlashList
import { FlashList } from '@shopify/flash-list';

const AssessmentList = ({ assessments }: { assessments: Assessment[] }) => {
  const renderItem = useCallback(({ item }: { item: Assessment }) => (
    <AssessmentCard assessment={item} />
  ), []);

  const keyExtractor = useCallback((item: Assessment) => item.assessment_id, []);

  return (
    <FlashList
      data={assessments}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      estimatedItemSize={100}
      // Performance props
      removeClippedSubviews
      maxToRenderPerBatch={10}
      windowSize={5}
    />
  );
};

// 2. Image optimization
import { Image } from 'expo-image';

const OptimizedImage = ({ uri }: { uri: string }) => (
  <Image
    source={{ uri }}
    style={{ width: 300, height: 300 }}
    contentFit="cover"
    transition={200}
    cachePolicy="memory-disk"
  />
);

// 3. Heavy computation optimization
const ExpensiveComponent = ({ data }: { data: any[] }) => {
  const processedData = useMemo(
    () => data.map(item => expensiveCalculation(item)),
    [data]
  );

  return <Chart data={processedData} />;
};

// 4. Debounced search
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

const SearchScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebouncedValue(searchQuery, 500);

  const { data: results } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => searchApi.search(debouncedQuery),
    enabled: debouncedQuery.length > 2
  });

  return (
    <Input
      value={searchQuery}
      onChangeText={setSearchQuery}
      placeholder="Search..."
    />
  );
};

// 5. Code splitting with lazy loading
import { lazy, Suspense } from 'react';

const DashboardCharts = lazy(() => import('@/components/dashboard/Charts'));

const DashboardScreen = () => (
  <View>
    <Suspense fallback={<LoadingSpinner />}>
      <DashboardCharts />
    </Suspense>
  </View>
);
```

### Bundle Size Optimization

```typescript
// 1. Dynamic imports
const handleExport = async () => {
  const { exportToPDF } = await import('@/utils/pdfExport');
  await exportToPDF(data);
};

// 2. Tree shaking - import only what you need
// ❌ Bad
import * as _ from 'lodash';

// ✅ Good
import debounce from 'lodash/debounce';
import groupBy from 'lodash/groupBy';

// 3. Remove console.logs in production
if (__DEV__) {
  console.log('Debug info');
}
```

### Monitoring Performance

```typescript
// Performance monitoring hook
import { useEffect } from 'react';
import { InteractionManager } from 'react-native';

export const useScreenPerformance = (screenName: string) => {
  useEffect(() => {
    const startTime = Date.now();

    const task = InteractionManager.runAfterInteractions(() => {
      const loadTime = Date.now() - startTime;

      // Log to analytics
      analytics.track('screen_load', {
        screen: screenName,
        load_time: loadTime
      });

      if (loadTime > 3000) {
        console.warn(`Slow screen load: ${screenName} (${loadTime}ms)`);
      }
    });

    return () => task.cancel();
  }, [screenName]);
};

// Usage
const DashboardScreen = () => {
  useScreenPerformance('Dashboard');

  return <View>{/* Dashboard content */}</View>;
};
```

---

## Offline-First Strategy

### Offline Storage

```typescript
// services/storage/offlineStorage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { persistQueryClient } from '@tanstack/react-query-persist-client';

// Setup offline persistence
const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage
});

persistQueryClient({
  queryClient,
  persister: asyncStoragePersister,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => {
      // Only persist certain queries
      return query.state.status === 'success';
    }
  }
});

// Offline queue for mutations
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

export const offlineQueue = {
  mutations: [] as any[],

  add: async (mutation: any) => {
    const queue = await AsyncStorage.getItem('mutation-queue');
    const mutations = queue ? JSON.parse(queue) : [];
    mutations.push(mutation);
    await AsyncStorage.setItem('mutation-queue', JSON.stringify(mutations));
  },

  process: async () => {
    const queue = await AsyncStorage.getItem('mutation-queue');
    if (!queue) return;

    const mutations = JSON.parse(queue);

    for (const mutation of mutations) {
      try {
        await apiClient.request(mutation);
      } catch (error) {
        console.error('Failed to sync mutation:', error);
      }
    }

    await AsyncStorage.removeItem('mutation-queue');
  }
};
```

### Network Status Management

```typescript
// hooks/useNetworkStatus.ts
import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [networkType, setNetworkType] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? false);
      setNetworkType(state.type);

      // Sync when coming online
      if (state.isConnected) {
        offlineQueue.process();
      }
    });

    return () => unsubscribe();
  }, []);

  return { isOnline, networkType };
};

// Network status indicator component
const NetworkStatusBar = () => {
  const { isOnline } = useNetworkStatus();

  if (isOnline) return null;

  return (
    <View style={styles.offlineBanner}>
      <Text style={styles.offlineText}>
        You're offline. Changes will sync when you reconnect.
      </Text>
    </View>
  );
};
```

---

## Accessibility Standards

### WCAG 2.1 AA Compliance

```typescript
// 1. Accessible touchable areas (minimum 44x44 points)
const AccessibleButton = ({ children, onPress }: ButtonProps) => (
  <Pressable
    onPress={onPress}
    style={{ minWidth: 44, minHeight: 44 }}
    accessibilityRole="button"
    accessibilityLabel="Submit assessment"
    accessibilityHint="Double tap to submit your assessment"
  >
    {children}
  </Pressable>
);

// 2. Screen reader support
const RiskScoreDisplay = ({ score, level }: RiskScoreProps) => (
  <View
    accessible
    accessibilityLabel={`Risk score: ${score} out of 25. Risk level: ${level}`}
    accessibilityRole="text"
  >
    <Text>{score}</Text>
    <Text>{level}</Text>
  </View>
);

// 3. Color contrast (minimum 4.5:1 for text)
const validateContrast = (foreground: string, background: string) => {
  const ratio = calculateContrastRatio(foreground, background);
  return ratio >= 4.5;
};

// 4. Focus management
const Modal = ({ visible, children, onClose }: ModalProps) => {
  const firstElementRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      // Focus first element when modal opens
      setTimeout(() => {
        firstElementRef.current?.focus();
      }, 100);
    }
  }, [visible]);

  return (
    <RNModal visible={visible}>
      <TextInput ref={firstElementRef} />
      {children}
    </RNModal>
  );
};

// 5. Semantic headings
const AssessmentSection = ({ title, children }: SectionProps) => (
  <View>
    <Text
      accessibilityRole="header"
      accessibilityLevel={2}
      style={textStyles.h2}
    >
      {title}
    </Text>
    {children}
  </View>
);
```

---

## Testing Strategy

### Unit Tests (Jest + React Native Testing Library)

```typescript
// __tests__/components/Button.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '@/components/ui/Button';

describe('Button', () => {
  it('renders correctly', () => {
    const { getByText } = render(
      <Button onPress={() => {}}>Click Me</Button>
    );

    expect(getByText('Click Me')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPressMock = jest.fn();
    const { getByText } = render(
      <Button onPress={onPressMock}>Click Me</Button>
    );

    fireEvent.press(getByText('Click Me'));
    expect(onPressMock).toHaveBeenCalledTimes(1);
  });

  it('shows loading spinner when loading', () => {
    const { getByTestId } = render(
      <Button onPress={() => {}} loading>
        Click Me
      </Button>
    );

    expect(getByTestId('loading-spinner')).toBeTruthy();
  });

  it('disables button when disabled prop is true', () => {
    const onPressMock = jest.fn();
    const { getByText } = render(
      <Button onPress={onPressMock} disabled>
        Click Me
      </Button>
    );

    fireEvent.press(getByText('Click Me'));
    expect(onPressMock).not.toHaveBeenCalled();
  });
});
```

### Integration Tests

```typescript
// __tests__/screens/LoginScreen.test.tsx
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginScreen } from '@/app/auth/login';
import * as authApi from '@/services/api/auth';

jest.mock('@/services/api/auth');

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('submits form with valid credentials', async () => {
    const mockLogin = authApi.login as jest.Mock;
    mockLogin.mockResolvedValue({
      user: { id: '123', email: 'test@example.com' },
      token: 'fake-token'
    });

    const { getByPlaceholderText, getByText } = render(
      <LoginScreen />,
      { wrapper }
    );

    fireEvent.changeText(
      getByPlaceholderText('Email'),
      'test@example.com'
    );
    fireEvent.changeText(
      getByPlaceholderText('Password'),
      'password123'
    );
    fireEvent.press(getByText('Login'));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith(
        'test@example.com',
        'password123'
      );
    });
  });

  it('shows error message on invalid credentials', async () => {
    const mockLogin = authApi.login as jest.Mock;
    mockLogin.mockRejectedValue(new Error('Invalid credentials'));

    const { getByPlaceholderText, getByText, findByText } = render(
      <LoginScreen />,
      { wrapper }
    );

    fireEvent.changeText(
      getByPlaceholderText('Email'),
      'wrong@example.com'
    );
    fireEvent.changeText(
      getByPlaceholderText('Password'),
      'wrongpass'
    );
    fireEvent.press(getByText('Login'));

    const errorMessage = await findByText('Invalid credentials');
    expect(errorMessage).toBeTruthy();
  });
});
```

### E2E Tests (Detox)

```typescript
// e2e/assessmentFlow.test.ts
describe('Assessment Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should complete full assessment flow', async () => {
    // Login
    await element(by.id('email-input')).typeText('test@example.com');
    await element(by.id('password-input')).typeText('password123');
    await element(by.id('login-button')).tap();

    // Wait for dashboard
    await waitFor(element(by.id('dashboard-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Start new assessment
    await element(by.id('new-assessment-button')).tap();

    // Fill risk appetite
    await element(by.id('risk-appetite-picker')).tap();
    await element(by.text('Medium')).tap();
    await element(by.id('continue-button')).tap();

    // Fill fraud triangle
    await element(by.id('pressure-input')).typeText('Financial pressure');
    await element(by.id('continue-button')).tap();

    // ... Continue through all modules

    // Submit assessment
    await element(by.id('submit-button')).tap();

    // Verify completion
    await expect(element(by.text('Assessment Complete'))).toBeVisible();
  });
});
```

---

## Security Best Practices

### Secure Storage

```typescript
// services/storage/secureStorage.ts
import * as SecureStore from 'expo-secure-store';

export const secureStorage = {
  setItem: async (key: string, value: string): Promise<void> => {
    await SecureStore.setItemAsync(key, value);
  },

  getItem: async (key: string): Promise<string | null> => {
    return await SecureStore.getItemAsync(key);
  },

  removeItem: async (key: string): Promise<void> => {
    await SecureStore.deleteItemAsync(key);
  }
};

// Store sensitive data
await secureStorage.setItem('auth_token', token);
await secureStorage.setItem('refresh_token', refreshToken);

// Never store in AsyncStorage:
// ❌ await AsyncStorage.setItem('auth_token', token);
```

### Input Sanitization

```typescript
// utils/sanitization.ts
import DOMPurify from 'isomorphic-dompurify';

export const sanitizeHtml = (dirty: string): string => {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
    ALLOWED_ATTR: []
  });
};

export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets
    .substring(0, 1000); // Limit length
};
```

### Certificate Pinning

```typescript
// app.json or app.config.js
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSAppTransportSecurity": {
          "NSExceptionDomains": {
            "api.stopfra.com": {
              "NSIncludesSubdomains": true,
              "NSExceptionRequiresForwardSecrecy": true,
              "NSExceptionMinimumTLSVersion": "TLSv1.2",
              "NSPinnedDomains": {
                "api.stopfra.com": {
                  "NSIncludesSubdomains": true,
                  "NSPinnedLeafIdentities": [
                    {
                      "SPKI-SHA256-BASE64": "your-cert-hash-here"
                    }
                  ]
                }
              }
            }
          }
        }
      }
    }
  }
}
```

---

## Decision Framework

### Frontend Architecture Decision Record Template

```markdown
# ADR-F001: Use Zustand for Global State Management

## Status
Accepted

## Context
We need a lightweight, performant state management solution for global UI state and user preferences.

## Decision
We will use Zustand as our primary global state management library.

## Consequences

### Positive
- Minimal boilerplate compared to Redux
- Excellent TypeScript support
- Small bundle size (~1kb gzipped)
- Hook-based API familiar to React developers
- Built-in persistence middleware

### Negative
- Smaller ecosystem than Redux
- Less middleware available
- Team may need to learn new patterns

## Alternatives Considered
- **Redux Toolkit**: More mature but heavier, more boilerplate
- **MobX**: Too much magic, harder to debug
- **Jotai**: Atomic state approach has learning curve
```

### Component Complexity Checklist

Use this checklist to determine if a component needs refactoring:

```
Component Refactoring Signals:
□ Component file > 300 lines
□ More than 5 useState calls
□ More than 3 useEffect calls
□ Props interface > 10 properties
□ Nested ternary operators
□ Functions > 50 lines inside component
□ Duplicated logic across components
□ Hard to test in isolation

If 3+ boxes checked → Refactor component
```

---

## Summary Checklist for Frontend Architects

### Pre-Implementation
- [ ] Review design system and component library
- [ ] Plan component hierarchy and state flow
- [ ] Design navigation structure
- [ ] Establish form validation schemas
- [ ] Plan offline-first strategy
- [ ] Review accessibility requirements (WCAG 2.1 AA)

### During Implementation
- [ ] Follow component design patterns
- [ ] Implement type-safe props interfaces
- [ ] Add accessibility labels and roles
- [ ] Optimize list rendering (FlashList)
- [ ] Implement error boundaries
- [ ] Add loading and error states
- [ ] Write unit tests (>80% coverage)

### Pre-Deployment
- [ ] Run accessibility audit
- [ ] Performance testing (bundle size, FPS)
- [ ] Cross-platform testing (iOS, Android, Web)
- [ ] Offline functionality testing
- [ ] E2E test critical flows
- [ ] Verify secure storage implementation

### Post-Deployment
- [ ] Monitor crash analytics
- [ ] Track performance metrics
- [ ] Collect user feedback
- [ ] Plan OTA updates for bug fixes
- [ ] Update component documentation

---

**Document Version:** 1.0
**Last Updated:** December 20, 2025
**Next Review:** March 20, 2026
**Maintained By:** Frontend Architecture Team
