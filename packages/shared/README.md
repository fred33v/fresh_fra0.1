# @stopfra/shared

Shared utilities, constants, and helpers for the Stop FRA platform.

## Installation

```bash
npm install @stopfra/shared
# or
yarn add @stopfra/shared
# or
pnpm add @stopfra/shared
```

## Features

- 🧮 **Risk Calculation Utilities** - Calculate inherent, residual, and priority risk scores
- 🔐 **Authentication Helpers** - Password validation, JWT parsing, token generation
- 💱 **Formatting Utilities** - Currency (GBP), dates (DD/MM/YYYY), HTML sanitization
- 🌐 **API Service** - Platform-agnostic HTTP client with token management
- 📊 **Constants** - Pre-defined constants for risk scores, packages, regulations, and more
- 📱 **Workshop Data** - Pre-built workshop sections, quiz questions, and scenarios
- 📝 **Logger** - Context-aware logging utility

## Usage

### Risk Scoring

```typescript
import {
  calculateInherentRisk,
  calculateResidualRisk,
  getRiskPriority,
} from '@stopfra/shared/utils';

// Calculate inherent risk (impact × likelihood)
const inherentRisk = calculateInherentRisk(4, 3); // Result: 12

// Apply control strength reduction
const residualRisk = calculateResidualRisk(12, 'VERY_STRONG'); // Result: 7

// Get risk priority level
const priority = getRiskPriority(12); // Result: 'MEDIUM'
```

### Password Validation

```typescript
import { validatePasswordStrength } from '@stopfra/shared/utils';

const validation = validatePasswordStrength('SecurePass123!');
// Returns:
// {
//   isValid: true,
//   score: 5,
//   requirements: {
//     minLength: true,
//     hasUppercase: true,
//     hasLowercase: true,
//     hasNumber: true,
//     hasSpecialChar: true
//   }
// }
```

### API Service

```typescript
import { ApiService } from '@stopfra/shared/services';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Initialize with AsyncStorage (React Native) or compatible storage
const api = new ApiService({
  baseUrl: 'https://api.fraud-risk.co.uk',
  refreshEndpoint: '/auth/refresh',
  storage: AsyncStorage,
  timeout: 30000,
});

// Make authenticated requests
const response = await api.get<Assessment>('/assessments/123', {
  requiresAuth: true,
});

if (response.success) {
  console.log(response.data);
}

// Logout (clears all tokens)
await api.clearTokens();
```

### Constants

```typescript
import { RISK_SCORES, PACKAGES, REGULATIONS } from '@stopfra/shared/constants';

// Access risk score bands
const highRiskMin = RISK_SCORES.HIGH.min; // 15

// Access package definitions
const trainingPlan = PACKAGES.STANDARD;
// { id: 2, name: 'Health Check + Training', features: [...] }

// Access regulations
const govStandard = REGULATIONS.GOVS013;
// { code: 'GovS-013', name: '...', url: '...' }
```

### Formatting

```typescript
import { formatDateUK, formatCurrencyGBP } from '@stopfra/shared/utils';

// Format dates in UK style (DD/MM/YYYY)
const date = formatDateUK('2026-03-08'); // '08/03/2026'

// Format currency with GBP symbol
const amount = formatCurrencyGBP(1234.56); // '£1,234.56'
```

### Logging

```typescript
import { createLogger } from '@stopfra/shared';

const logger = createLogger('MyComponent');

logger.debug('Debug message', { details: 'value' });
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message', error);
```

### Workshop Data

```typescript
import { workshopSections, sectionContent, quizQuestions, scenarioExercise, actionPlanTemplates } from '@stopfra/shared/data';

// Access workshop sections
workshopSections.forEach((section) => {
  console.log(section.title, section.duration);
});

// Get specific section content
const introContent = sectionContent[0];
// { title: '...', subtitle: '...', keyPoints: [...], discussionPrompt: '...' }

// Access quiz questions
quizQuestions.forEach((question) => {
  console.log(question.question);
  console.log(question.options); // Multiple choice options
  console.log(question.correctAnswer); // Index of correct answer
});

// Get scenario exercise for interactive training
console.log(scenarioExercise.title);
scenarioExercise.steps.forEach((step) => {
  console.log(step.description);
  // Each step has options with feedback
});

// Access action plan templates
const immediateActions = actionPlanTemplates.immediate;
const thirtyDayActions = actionPlanTemplates.thirtyDays;
const ninetyDayActions = actionPlanTemplates.ninetyDays;
```

## API Reference

### Utils

#### `calculateInherentRisk(impact: number, likelihood: number): number`
Calculates inherent risk score (impact × likelihood), clamped between 1-25.

#### `calculateResidualRisk(inherentRisk: number, controlStrength: ControlStrength): number`
Applies control strength reduction to inherent risk score.

#### `getRiskPriority(score: number): 'HIGH' | 'MEDIUM' | 'LOW'`
Classifies risk score into priority level.

#### `formatDateUK(date: Date | string): string`
Formats date to UK format (DD/MM/YYYY).

#### `formatCurrencyGBP(amount: number, decimals?: number): string`
Formats amount as GBP currency.

#### `generateKeyPassCode(prefix?: string): string`
Generates unique key-pass code for assessments.

#### `generateUUID(): string`
Generates UUID v4 string.

#### `isValidEmail(email: string): boolean`
Validates email address format.

#### `validatePasswordStrength(password: string): PasswordValidation`
Validates password strength against multiple criteria.

#### `hashString(str: string): Promise<string>`
Generates SHA-256 hash of a string.

#### `parseJWT(token: string): JWTPayload | null`
Parses JWT token without signature verification.

#### `calculateCompletionPercentage(completed: string[], total: number): number`
Calculates assessment completion percentage.

#### `sanitizeString(str: string): string`
Escapes HTML special characters for safe display.

### Logger

#### `createLogger(context: string): Logger`
Creates a context-aware logger with debug, info, warn, and error methods.

### ApiService

#### `constructor(config: ApiServiceConfig)`
Initializes API service with configuration.

#### `get<T>(endpoint: string, options?: ApiRequestOptions): Promise<ApiResponse<T>>`
Makes a GET request.

#### `post<T>(endpoint: string, body?: unknown, options?: ApiRequestOptions): Promise<ApiResponse<T>>`
Makes a POST request.

#### `put<T>(endpoint: string, body?: unknown, options?: ApiRequestOptions): Promise<ApiResponse<T>>`
Makes a PUT request.

#### `patch<T>(endpoint: string, body?: unknown, options?: ApiRequestOptions): Promise<ApiResponse<T>>`
Makes a PATCH request.

#### `delete<T>(endpoint: string, options?: ApiRequestOptions): Promise<ApiResponse<T>>`
Makes a DELETE request.

#### `clearTokens(): Promise<void>`
Clears stored tokens (logout).

#### `getRefreshToken(): string | null`
Gets stored refresh token.

## Types

All types are imported from `@stopfra/types`:

- `Assessment` - Fraud risk assessment
- `RiskLevel` - 'HIGH' | 'MEDIUM' | 'LOW'
- `ControlStrength` - 'VERY_STRONG' | 'REASONABLY_STRONG' | 'SOME_GAPS' | 'WEAK'
- `AssessmentModule` - 13 module identifiers
- `ApiResponse<T>` - Standard API response wrapper
- `ApiError` - Structured error response

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Lint
pnpm lint

# Type check
pnpm typecheck

# Watch mode
pnpm dev
```

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
