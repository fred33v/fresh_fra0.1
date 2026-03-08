# Testing Architecture Strategy Template
## Stop FRA Platform - Quality Assurance & Testing Guide

**Version:** 1.0
**Last Updated:** December 20, 2025
**Target Audience:** Testing Architect Agents, QA Engineers, Test Automation Engineers

---

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Testing Strategy Overview](#testing-strategy-overview)
3. [Testing Pyramid & Coverage](#testing-pyramid-coverage)
4. [Unit Testing](#unit-testing)
5. [Integration Testing](#integration-testing)
6. [End-to-End Testing](#end-to-end-testing)
7. [API Testing](#api-testing)
8. [Mobile-Specific Testing](#mobile-specific-testing)
9. [Performance Testing](#performance-testing)
10. [Security Testing](#security-testing)
11. [Accessibility Testing](#accessibility-testing)
12. [Regression Testing](#regression-testing)
13. [Test Automation Strategy](#test-automation-strategy)
14. [Test Data Management](#test-data-management)
15. [CI/CD Integration](#cicd-integration)
16. [Bug Reporting & Tracking](#bug-reporting-tracking)
17. [Testing Tools & Frameworks](#testing-tools-frameworks)
18. [Decision Framework](#decision-framework)

---

## Testing Philosophy

### Core Principles

**1. Quality is Everyone's Responsibility**
- Developers write unit tests
- QA engineers write integration and E2E tests
- Product owners define acceptance criteria
- Security team performs penetration testing
- Accessibility specialists audit compliance

**2. Shift-Left Testing**
- Test early and often
- Catch bugs during development, not production
- Automate repetitive tests
- Provide fast feedback to developers

**3. Risk-Based Testing**
- Prioritize testing based on business risk
- Critical user flows get comprehensive coverage
- Non-critical features get basic coverage
- Compliance-related features get exhaustive coverage

**4. Test Pyramid Adherence**
```
                  ┌─────────────┐
                  │  Manual     │  (5% - Exploratory)
                  │  Testing    │
                  └─────────────┘
             ┌────────────────────────┐
             │    E2E Tests           │  (15% - Critical flows)
             │  (Detox, Playwright)   │
             └────────────────────────┘
        ┌──────────────────────────────────┐
        │    Integration Tests             │  (30% - API + DB)
        │   (Supertest, React Testing)     │
        └──────────────────────────────────┘
   ┌──────────────────────────────────────────┐
   │         Unit Tests                       │  (50% - Business logic)
   │    (Jest, React Native Testing Lib)      │
   └──────────────────────────────────────────┘
```

**5. Test Automation First**
- Automate everything that can be automated
- Manual testing for exploratory work only
- Regression suite runs automatically
- Performance benchmarks in CI/CD

**6. Compliance-Driven Testing**
- GovS-013 fraud prevention validation
- ECCTA 2023 compliance verification
- GDPR data handling tests
- WCAG 2.1 AA accessibility audits
- 6-year audit trail verification

---

## Testing Strategy Overview

### Testing Levels

| Level | Purpose | Tools | Coverage Target |
|-------|---------|-------|----------------|
| **Unit** | Test individual functions/components | Jest | 80%+ |
| **Integration** | Test component interactions | Supertest, RTL | 70%+ |
| **E2E** | Test complete user flows | Detox, Playwright | Critical flows |
| **API** | Test backend endpoints | Postman, Supertest | All endpoints |
| **Performance** | Test load, stress, scalability | k6, Lighthouse | Benchmarks |
| **Security** | Test vulnerabilities | OWASP ZAP, Burp | OWASP Top 10 |
| **Accessibility** | Test WCAG compliance | Axe, Pa11y | WCAG 2.1 AA |

### Critical Test Areas for Stop FRA

**1. Authentication & Authorization (HIGH RISK)**
- Login flows (employer, employee, key-pass)
- Token refresh mechanisms
- Session management
- RBAC enforcement
- Password security

**2. Assessment Flow (HIGH RISK)**
- Multi-step form progression
- Data persistence across steps
- Draft saving and recovery
- Submission and validation
- Risk scoring accuracy

**3. Payment Processing (CRITICAL RISK)**
- Stripe integration
- Payment confirmation
- Failed payment handling
- Refund processing
- Key-pass allocation after payment

**4. Key-Pass Management (HIGH RISK)**
- Generation algorithms
- Uniqueness validation
- Usage tracking
- Expiration handling
- Security of distribution

**5. Risk Scoring Engine (HIGH RISK)**
- Inherent score calculation
- Residual score calculation
- Priority classification
- Control strength adjustment
- Edge cases and boundaries

**6. Dashboard Analytics (MEDIUM RISK)**
- Metrics calculation accuracy
- Data aggregation correctness
- Real-time updates
- Export functionality
- Permission-based access

**7. Data Privacy & Compliance (CRITICAL RISK)**
- GDPR compliance (data deletion, export)
- Audit logging completeness
- Data encryption at rest
- Secure transmission
- 6-year retention policy

---

## Testing Pyramid & Coverage

### Coverage Requirements

**Overall Coverage Targets:**
```
Minimum Thresholds:
- Statements: 80%
- Branches: 75%
- Functions: 80%
- Lines: 80%

Critical Components (90%+ required):
- Authentication modules
- Payment processing
- Risk scoring engine
- Key-pass generation
- Data validation
- Encryption utilities
```

**Coverage Configuration (Jest):**
```json
// package.json
{
  "jest": {
    "collectCoverage": true,
    "coverageThreshold": {
      "global": {
        "statements": 80,
        "branches": 75,
        "functions": 80,
        "lines": 80
      },
      "./src/services/auth/**/*.ts": {
        "statements": 90,
        "branches": 85,
        "functions": 90,
        "lines": 90
      },
      "./src/services/payment/**/*.ts": {
        "statements": 90,
        "branches": 85,
        "functions": 90,
        "lines": 90
      },
      "./src/utils/riskScoring.ts": {
        "statements": 95,
        "branches": 90,
        "functions": 95,
        "lines": 95
      }
    }
  }
}
```

### Test Distribution Strategy

```typescript
// Test allocation by component
const testAllocation = {
  'Authentication': {
    unit: 60,         // 60 unit tests
    integration: 25,  // 25 integration tests
    e2e: 8           // 8 E2E scenarios
  },
  'Assessment Flow': {
    unit: 80,
    integration: 40,
    e2e: 12
  },
  'Payment Processing': {
    unit: 40,
    integration: 30,
    e2e: 10
  },
  'Risk Scoring': {
    unit: 100,        // Heavy unit testing
    integration: 20,
    e2e: 5
  },
  'Dashboard': {
    unit: 50,
    integration: 30,
    e2e: 6
  }
};
```

---

## Unit Testing

### Backend Unit Testing (Node.js + Jest)

**Test Structure:**
```typescript
// __tests__/services/riskScoring.test.ts
import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  calculateInherentScore,
  calculateResidualScore,
  determinePriority,
  applyControlReduction
} from '@/services/riskScoring';

describe('Risk Scoring Service', () => {
  describe('calculateInherentScore', () => {
    it('should calculate inherent score correctly for valid inputs', () => {
      const impact = 5;
      const likelihood = 4;
      const score = calculateInherentScore(impact, likelihood);

      expect(score).toBe(20);
    });

    it('should handle minimum values (1x1)', () => {
      expect(calculateInherentScore(1, 1)).toBe(1);
    });

    it('should handle maximum values (5x5)', () => {
      expect(calculateInherentScore(5, 5)).toBe(25);
    });

    it('should throw error for impact out of range', () => {
      expect(() => calculateInherentScore(6, 3)).toThrow('Impact must be between 1 and 5');
      expect(() => calculateInherentScore(0, 3)).toThrow('Impact must be between 1 and 5');
    });

    it('should throw error for likelihood out of range', () => {
      expect(() => calculateInherentScore(3, 6)).toThrow('Likelihood must be between 1 and 5');
      expect(() => calculateInherentScore(3, 0)).toThrow('Likelihood must be between 1 and 5');
    });

    it('should throw error for non-integer values', () => {
      expect(() => calculateInherentScore(3.5, 4)).toThrow('Values must be integers');
    });
  });

  describe('calculateResidualScore', () => {
    it('should apply 40% reduction for very-strong controls', () => {
      const inherentScore = 20;
      const residualScore = calculateResidualScore(inherentScore, 'very-strong');

      expect(residualScore).toBe(12);
    });

    it('should apply 20% reduction for reasonably-strong controls', () => {
      const inherentScore = 20;
      const residualScore = calculateResidualScore(inherentScore, 'reasonably-strong');

      expect(residualScore).toBe(16);
    });

    it('should apply 0% reduction for weak controls', () => {
      const inherentScore = 20;
      const residualScore = calculateResidualScore(inherentScore, 'weak');

      expect(residualScore).toBe(20);
    });

    it('should round residual score to nearest integer', () => {
      const inherentScore = 15; // 15 * 0.6 = 9
      const residualScore = calculateResidualScore(inherentScore, 'very-strong');

      expect(residualScore).toBe(9);
    });

    it('should throw error for invalid control strength', () => {
      expect(() => calculateResidualScore(20, 'invalid')).toThrow('Invalid control strength');
    });
  });

  describe('determinePriority', () => {
    it('should classify high priority correctly', () => {
      expect(determinePriority(25)).toBe('high');
      expect(determinePriority(20)).toBe('high');
      expect(determinePriority(15)).toBe('high');
    });

    it('should classify medium priority correctly', () => {
      expect(determinePriority(14)).toBe('medium');
      expect(determinePriority(10)).toBe('medium');
      expect(determinePriority(8)).toBe('medium');
    });

    it('should classify low priority correctly', () => {
      expect(determinePriority(7)).toBe('low');
      expect(determinePriority(5)).toBe('low');
      expect(determinePriority(1)).toBe('low');
    });

    it('should handle boundary values correctly', () => {
      expect(determinePriority(15)).toBe('high');  // Lower bound of high
      expect(determinePriority(14)).toBe('medium'); // Upper bound of medium
      expect(determinePriority(8)).toBe('medium');  // Lower bound of medium
      expect(determinePriority(7)).toBe('low');     // Upper bound of low
    });
  });

  describe('applyControlReduction (Integration)', () => {
    it('should calculate full risk scoring pipeline', () => {
      const impact = 5;
      const likelihood = 5;
      const controlStrength = 'very-strong';

      const inherentScore = calculateInherentScore(impact, likelihood);
      expect(inherentScore).toBe(25);

      const residualScore = calculateResidualScore(inherentScore, controlStrength);
      expect(residualScore).toBe(15); // 25 * 0.6

      const priority = determinePriority(residualScore);
      expect(priority).toBe('high');
    });
  });
});
```

**Mocking Dependencies:**
```typescript
// __tests__/services/auth.test.ts
import { login, signup } from '@/services/auth';
import { apiClient } from '@/services/api/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

jest.mock('@/services/api/client');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

describe('Auth Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should return user and token on successful login', async () => {
      const mockUser = {
        user_id: '123',
        email: 'test@example.com',
        password_hash: 'hashed_password',
        role: 'employer'
      };

      const mockToken = 'mock-jwt-token';

      (apiClient.query as jest.Mock).mockResolvedValue({ rows: [mockUser] });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      const result = await login('test@example.com', 'password123');

      expect(result).toEqual({
        user: { user_id: '123', email: 'test@example.com', role: 'employer' },
        token: mockToken
      });

      expect(apiClient.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email = $1',
        ['test@example.com']
      );
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashed_password');
    });

    it('should throw error for non-existent user', async () => {
      (apiClient.query as jest.Mock).mockResolvedValue({ rows: [] });

      await expect(login('nonexistent@example.com', 'password123'))
        .rejects
        .toThrow('Invalid credentials');
    });

    it('should throw error for incorrect password', async () => {
      const mockUser = {
        user_id: '123',
        email: 'test@example.com',
        password_hash: 'hashed_password'
      };

      (apiClient.query as jest.Mock).mockResolvedValue({ rows: [mockUser] });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(login('test@example.com', 'wrongpassword'))
        .rejects
        .toThrow('Invalid credentials');
    });
  });
});
```

### Frontend Unit Testing (React Native + Jest)

**Component Testing:**
```typescript
// __tests__/components/Button.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '@/components/ui/Button';

describe('Button Component', () => {
  it('renders correctly with text', () => {
    const { getByText } = render(
      <Button onPress={() => {}}>Click Me</Button>
    );

    expect(getByText('Click Me')).toBeTruthy();
  });

  it('calls onPress handler when pressed', () => {
    const onPressMock = jest.fn();
    const { getByText } = render(
      <Button onPress={onPressMock}>Click Me</Button>
    );

    fireEvent.press(getByText('Click Me'));

    expect(onPressMock).toHaveBeenCalledTimes(1);
  });

  it('shows loading indicator when loading prop is true', () => {
    const { getByTestId, queryByText } = render(
      <Button onPress={() => {}} loading>Click Me</Button>
    );

    expect(getByTestId('loading-spinner')).toBeTruthy();
    expect(queryByText('Click Me')).toBeNull();
  });

  it('is disabled when disabled prop is true', () => {
    const onPressMock = jest.fn();
    const { getByText } = render(
      <Button onPress={onPressMock} disabled>Click Me</Button>
    );

    fireEvent.press(getByText('Click Me'));

    expect(onPressMock).not.toHaveBeenCalled();
  });

  it('applies correct styles for variant prop', () => {
    const { getByText, rerender } = render(
      <Button onPress={() => {}} variant="primary">Primary</Button>
    );

    const button = getByText('Primary').parent;
    expect(button?.props.style).toContainEqual(
      expect.objectContaining({ backgroundColor: expect.any(String) })
    );

    rerender(
      <Button onPress={() => {}} variant="outline">Outline</Button>
    );

    const outlineButton = getByText('Outline').parent;
    expect(outlineButton?.props.style).toContainEqual(
      expect.objectContaining({ borderWidth: 1 })
    );
  });

  it('renders with icon when provided', () => {
    const { getByTestId } = render(
      <Button
        onPress={() => {}}
        icon={<View testID="custom-icon" />}
      >
        With Icon
      </Button>
    );

    expect(getByTestId('custom-icon')).toBeTruthy();
  });
});
```

**Hook Testing:**
```typescript
// __tests__/hooks/useAuth.test.ts
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/services/api/auth';

jest.mock('@/services/api/auth');

describe('useAuth Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should login successfully', async () => {
    const mockUser = { id: '123', email: 'test@example.com' };
    const mockToken = 'mock-token';

    (authApi.login as jest.Mock).mockResolvedValue({
      user: mockUser,
      token: mockToken
    });

    const { result } = renderHook(() => useAuth());

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);

    await act(async () => {
      await result.current.login('test@example.com', 'password123');
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
    expect(authApi.login).toHaveBeenCalledWith('test@example.com', 'password123');
  });

  it('should handle login failure', async () => {
    const mockError = new Error('Invalid credentials');
    (authApi.login as jest.Mock).mockRejectedValue(mockError);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      try {
        await result.current.login('wrong@example.com', 'wrongpass');
      } catch (error) {
        expect(error).toEqual(mockError);
      }
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should logout successfully', async () => {
    const mockUser = { id: '123', email: 'test@example.com' };
    (authApi.login as jest.Mock).mockResolvedValue({ user: mockUser, token: 'token' });

    const { result } = renderHook(() => useAuth());

    // Login first
    await act(async () => {
      await result.current.login('test@example.com', 'password123');
    });

    expect(result.current.isAuthenticated).toBe(true);

    // Logout
    act(() => {
      result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });
});
```

---

## Integration Testing

### API Integration Testing (Supertest)

```typescript
// __tests__/integration/assessments.test.ts
import request from 'supertest';
import app from '@/app';
import { setupTestDatabase, teardownTestDatabase, getTestToken } from '@/test/helpers';

describe('Assessments API Integration', () => {
  let authToken: string;
  let organisationId: string;
  let assessmentId: string;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    // Create test organisation and user
    const { token, orgId } = await getTestToken('employer');
    authToken = token;
    organisationId = orgId;
  });

  describe('POST /api/v1/assessments', () => {
    it('should create new assessment with valid data', async () => {
      const response = await request(app)
        .post('/api/v1/assessments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          organisationId: organisationId
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('assessment_id');
      expect(response.body.data.status).toBe('draft');
      expect(response.body.data.organisation_id).toBe(organisationId);

      assessmentId = response.body.data.assessment_id;
    });

    it('should return 401 for unauthenticated request', async () => {
      await request(app)
        .post('/api/v1/assessments')
        .send({ organisationId: organisationId })
        .expect(401);
    });

    it('should return 400 for missing organisationId', async () => {
      const response = await request(app)
        .post('/api/v1/assessments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 403 for accessing another organisation', async () => {
      const { token: otherToken } = await getTestToken('employer');

      await request(app)
        .post('/api/v1/assessments')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ organisationId: organisationId })
        .expect(403);
    });
  });

  describe('GET /api/v1/assessments/:id', () => {
    beforeEach(async () => {
      // Create assessment for testing
      const response = await request(app)
        .post('/api/v1/assessments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ organisationId: organisationId });

      assessmentId = response.body.data.assessment_id;
    });

    it('should retrieve assessment by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/assessments/${assessmentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.assessment_id).toBe(assessmentId);
    });

    it('should return 404 for non-existent assessment', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app)
        .get(`/api/v1/assessments/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('PATCH /api/v1/assessments/:id', () => {
    beforeEach(async () => {
      const response = await request(app)
        .post('/api/v1/assessments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ organisationId: organisationId });

      assessmentId = response.body.data.assessment_id;
    });

    it('should update assessment status', async () => {
      const response = await request(app)
        .patch(`/api/v1/assessments/${assessmentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'submitted' })
        .expect(200);

      expect(response.body.data.status).toBe('submitted');
    });

    it('should update assessment answers', async () => {
      const answers = {
        risk_appetite: 'medium',
        justification: 'We accept moderate risk for growth opportunities'
      };

      const response = await request(app)
        .patch(`/api/v1/assessments/${assessmentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ answers })
        .expect(200);

      // Verify answers were saved
      const getResponse = await request(app)
        .get(`/api/v1/assessments/${assessmentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.body.data.answers).toMatchObject(answers);
    });

    it('should validate status transitions', async () => {
      // Transition to submitted
      await request(app)
        .patch(`/api/v1/assessments/${assessmentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'submitted' })
        .expect(200);

      // Try to go back to draft (should fail)
      const response = await request(app)
        .patch(`/api/v1/assessments/${assessmentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'draft' })
        .expect(422);

      expect(response.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    });
  });

  describe('POST /api/v1/assessments/:id/submit', () => {
    beforeEach(async () => {
      const response = await request(app)
        .post('/api/v1/assessments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ organisationId: organisationId });

      assessmentId = response.body.data.assessment_id;

      // Add required answers
      await request(app)
        .patch(`/api/v1/assessments/${assessmentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          answers: {
            risk_appetite: 'medium',
            fraud_triangle: { pressure: 'Financial targets', opportunity: 'Weak controls' },
            // ... other required answers
          }
        });
    });

    it('should submit assessment and generate risk register', async () => {
      const response = await request(app)
        .post(`/api/v1/assessments/${assessmentId}/submit`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.status).toBe('submitted');
      expect(response.body.data.overall_risk_level).toBeDefined();
      expect(response.body.data.risk_register).toBeInstanceOf(Array);
      expect(response.body.data.risk_register.length).toBeGreaterThan(0);
    });

    it('should fail submission if required fields missing', async () => {
      // Create new incomplete assessment
      const newAssessment = await request(app)
        .post('/api/v1/assessments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ organisationId: organisationId });

      const response = await request(app)
        .post(`/api/v1/assessments/${newAssessment.body.data.assessment_id}/submit`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(422);

      expect(response.body.error.code).toBe('INCOMPLETE_ASSESSMENT');
      expect(response.body.error.details).toContain('Missing required sections');
    });
  });
});
```

### Database Integration Testing

```typescript
// __tests__/integration/database.test.ts
import { pool } from '@/config/database';
import { createAssessment, updateAssessment, getAssessmentById } from '@/repositories/assessments';

describe('Assessment Repository Integration', () => {
  let organisationId: string;
  let userId: string;

  beforeAll(async () => {
    // Create test organisation and user
    const orgResult = await pool.query(
      'INSERT INTO organisations (name, type, employee_band) VALUES ($1, $2, $3) RETURNING organisation_id',
      ['Test Org', 'private-sme', '11-50']
    );
    organisationId = orgResult.rows[0].organisation_id;

    const userResult = await pool.query(
      'INSERT INTO users (email, password_hash, name, role, organisation_id) VALUES ($1, $2, $3, $4, $5) RETURNING user_id',
      ['test@example.com', 'hashed', 'Test User', 'employer', organisationId]
    );
    userId = userResult.rows[0].user_id;
  });

  afterAll(async () => {
    // Cleanup
    await pool.query('DELETE FROM assessments WHERE organisation_id = $1', [organisationId]);
    await pool.query('DELETE FROM users WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM organisations WHERE organisation_id = $1', [organisationId]);
    await pool.end();
  });

  describe('createAssessment', () => {
    it('should create assessment with default values', async () => {
      const assessment = await createAssessment(organisationId, userId);

      expect(assessment).toHaveProperty('assessment_id');
      expect(assessment.status).toBe('draft');
      expect(assessment.organisation_id).toBe(organisationId);
      expect(assessment.created_by_user_id).toBe(userId);
    });

    it('should enforce foreign key constraints', async () => {
      const fakeOrgId = '00000000-0000-0000-0000-000000000000';

      await expect(createAssessment(fakeOrgId, userId))
        .rejects
        .toThrow('violates foreign key constraint');
    });
  });

  describe('updateAssessment', () => {
    let assessmentId: string;

    beforeEach(async () => {
      const assessment = await createAssessment(organisationId, userId);
      assessmentId = assessment.assessment_id;
    });

    it('should update assessment fields', async () => {
      const updated = await updateAssessment(assessmentId, {
        status: 'submitted',
        overall_risk_level: 'high'
      });

      expect(updated.status).toBe('submitted');
      expect(updated.overall_risk_level).toBe('high');
    });

    it('should update updated_at timestamp', async () => {
      const before = await getAssessmentById(assessmentId);

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 100));

      await updateAssessment(assessmentId, { status: 'submitted' });
      const after = await getAssessmentById(assessmentId);

      expect(new Date(after.updated_at).getTime())
        .toBeGreaterThan(new Date(before.updated_at).getTime());
    });
  });

  describe('Transaction handling', () => {
    it('should rollback on error', async () => {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        // Create assessment
        const assessment = await client.query(
          'INSERT INTO assessments (organisation_id, created_by_user_id, status) VALUES ($1, $2, $3) RETURNING *',
          [organisationId, userId, 'draft']
        );

        const assessmentId = assessment.rows[0].assessment_id;

        // Intentionally cause error with invalid status
        await client.query(
          'UPDATE assessments SET status = $1 WHERE assessment_id = $2',
          ['invalid_status', assessmentId] // This will fail CHECK constraint
        );

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');

        // Verify assessment was not created
        const result = await pool.query(
          'SELECT COUNT(*) FROM assessments WHERE organisation_id = $1',
          [organisationId]
        );

        expect(parseInt(result.rows[0].count)).toBe(0);
      } finally {
        client.release();
      }
    });
  });
});
```

---

## End-to-End Testing

### Mobile E2E Testing (Detox)

**Setup Configuration:**
```json
// .detoxrc.js
module.exports = {
  testRunner: {
    args: {
      '$0': 'jest',
      config: 'e2e/jest.config.js'
    },
    jest: {
      setupTimeout: 120000
    }
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/StopFRA.app',
      build: 'xcodebuild -workspace ios/StopFRA.xcworkspace -scheme StopFRA -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build'
    },
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      build: 'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug'
    }
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 15 Pro'
      }
    },
    emulator: {
      type: 'android.emulator',
      device: {
        avdName: 'Pixel_6_API_33'
      }
    }
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug'
    },
    'android.emu.debug': {
      device: 'emulator',
      app: 'android.debug'
    }
  }
};
```

**E2E Test Examples:**
```typescript
// e2e/assessmentFlow.test.ts
import { device, element, by, expect as detoxExpect, waitFor } from 'detox';

describe('Complete Assessment Flow', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { notifications: 'YES' }
    });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should complete full assessment from login to submission', async () => {
    // Step 1: Login
    await detoxExpect(element(by.id('login-screen'))).toBeVisible();

    await element(by.id('email-input')).typeText('employer@test.com');
    await element(by.id('password-input')).typeText('TestPass123!');
    await element(by.id('login-button')).tap();

    // Wait for dashboard
    await waitFor(element(by.id('dashboard-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Step 2: Start new assessment
    await element(by.id('new-assessment-button')).tap();

    await waitFor(element(by.id('risk-appetite-screen')))
      .toBeVisible()
      .withTimeout(3000);

    // Step 3: Fill Risk Appetite
    await element(by.id('risk-appetite-picker')).tap();
    await element(by.text('Medium')).tap();

    await element(by.id('justification-input')).typeText(
      'We accept moderate risk levels to support strategic growth while maintaining appropriate controls'
    );

    await element(by.id('board-approval-checkbox')).tap();

    await element(by.id('continue-button')).tap();

    // Step 4: Fill Fraud Triangle
    await waitFor(element(by.id('fraud-triangle-screen')))
      .toBeVisible()
      .withTimeout(2000);

    await element(by.id('pressure-input')).typeText('Financial performance targets');
    await element(by.id('opportunity-input')).typeText('Limited segregation of duties');
    await element(by.id('rationalization-input')).typeText('Competitive market pressures');

    await element(by.id('continue-button')).tap();

    // Step 5: Fill People & Culture
    await waitFor(element(by.id('people-culture-screen')))
      .toBeVisible()
      .withTimeout(2000);

    await element(by.id('culture-rating-4')).tap(); // Rating 4 out of 5
    await element(by.id('whistleblowing-yes')).tap();
    await element(by.id('training-frequency-picker')).tap();
    await element(by.text('Annual')).tap();

    await element(by.id('continue-button')).tap();

    // ... Continue through all 13 modules
    // (Abbreviated for brevity - full test would include all modules)

    // Step 13: Review Assessment
    await waitFor(element(by.id('review-screen')))
      .toBeVisible()
      .withTimeout(2000);

    // Verify data is displayed correctly
    await detoxExpect(element(by.text('Medium'))).toBeVisible(); // Risk appetite
    await detoxExpect(element(by.text('Financial performance targets'))).toBeVisible();

    // Scroll to bottom
    await element(by.id('review-scroll')).scrollTo('bottom');

    await element(by.id('submit-assessment-button')).tap();

    // Step 14: Verify Submission Success
    await waitFor(element(by.id('confirmation-screen')))
      .toBeVisible()
      .withTimeout(5000);

    await detoxExpect(element(by.text('Assessment Complete'))).toBeVisible();
    await detoxExpect(element(by.id('risk-register'))).toBeVisible();

    // Verify risk scores calculated
    await detoxExpect(element(by.id('overall-risk-score'))).toBeVisible();
  });

  it('should save draft and resume assessment', async () => {
    // Login
    await element(by.id('email-input')).typeText('employer@test.com');
    await element(by.id('password-input')).typeText('TestPass123!');
    await element(by.id('login-button')).tap();

    await waitFor(element(by.id('dashboard-screen'))).toBeVisible();

    // Start assessment
    await element(by.id('new-assessment-button')).tap();

    // Fill first section
    await element(by.id('risk-appetite-picker')).tap();
    await element(by.text('High')).tap();
    await element(by.id('justification-input')).typeText('High growth strategy');

    // Save draft and exit
    await element(by.id('save-draft-button')).tap();
    await element(by.id('back-to-dashboard')).tap();

    // Resume assessment
    await element(by.id('resume-draft-button')).tap();

    // Verify data was saved
    await waitFor(element(by.id('risk-appetite-screen'))).toBeVisible();
    await detoxExpect(element(by.text('High'))).toBeVisible();
    await detoxExpect(element(by.text('High growth strategy'))).toBeVisible();
  });

  it('should handle network errors gracefully', async () => {
    // Login
    await element(by.id('email-input')).typeText('employer@test.com');
    await element(by.id('password-input')).typeText('TestPass123!');
    await element(by.id('login-button')).tap();

    await waitFor(element(by.id('dashboard-screen'))).toBeVisible();

    // Disable network
    await device.setNetworkConnection('none');

    // Try to create assessment
    await element(by.id('new-assessment-button')).tap();

    // Should show offline message
    await waitFor(element(by.text('You are offline')))
      .toBeVisible()
      .withTimeout(3000);

    // Re-enable network
    await device.setNetworkConnection('wifi');

    // Retry
    await element(by.id('retry-button')).tap();

    // Should now work
    await waitFor(element(by.id('risk-appetite-screen')))
      .toBeVisible()
      .withTimeout(5000);
  });
});
```

### Web E2E Testing (Playwright)

```typescript
// e2e/web/assessmentFlow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Web Assessment Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://app.stopfra.com');
  });

  test('complete assessment on web platform', async ({ page }) => {
    // Login
    await page.fill('[name="email"]', 'employer@test.com');
    await page.fill('[name="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*dashboard/);

    // Start assessment
    await page.click('text=New Assessment');
    await expect(page).toHaveURL(/.*risk-appetite/);

    // Fill form
    await page.selectOption('[name="risk_appetite"]', 'medium');
    await page.fill('[name="justification"]', 'Moderate risk tolerance for strategic growth');
    await page.check('[name="board_approval"]');

    // Continue
    await page.click('text=Continue');
    await expect(page).toHaveURL(/.*fraud-triangle/);

    // Verify data persistence
    await page.goBack();
    await expect(page.locator('[name="risk_appetite"]')).toHaveValue('medium');
  });

  test('responsive design on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE

    await page.fill('[name="email"]', 'employer@test.com');
    await page.fill('[name="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');

    // Verify mobile menu
    await expect(page.locator('[aria-label="Menu"]')).toBeVisible();

    // Open menu
    await page.click('[aria-label="Menu"]');
    await expect(page.locator('nav')).toBeVisible();
  });

  test('keyboard navigation', async ({ page }) => {
    await page.keyboard.press('Tab'); // Focus email
    await page.keyboard.type('employer@test.com');

    await page.keyboard.press('Tab'); // Focus password
    await page.keyboard.type('TestPass123!');

    await page.keyboard.press('Tab'); // Focus submit button
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/.*dashboard/);
  });
});
```

---

## API Testing

### Postman/Newman Collection

```json
{
  "info": {
    "name": "Stop FRA API Tests",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "auth": {
    "type": "bearer",
    "bearer": [
      {
        "key": "token",
        "value": "{{authToken}}",
        "type": "string"
      }
    ]
  },
  "item": [
    {
      "name": "Authentication",
      "item": [
        {
          "name": "Login - Success",
          "event": [
            {
              "listen": "test",
              "script": {
                "exec": [
                  "pm.test('Status code is 200', () => {",
                  "  pm.response.to.have.status(200);",
                  "});",
                  "",
                  "pm.test('Returns user and token', () => {",
                  "  const jsonData = pm.response.json();",
                  "  pm.expect(jsonData.success).to.be.true;",
                  "  pm.expect(jsonData.data).to.have.property('user');",
                  "  pm.expect(jsonData.data).to.have.property('token');",
                  "});",
                  "",
                  "// Save token for subsequent requests",
                  "const jsonData = pm.response.json();",
                  "pm.collectionVariables.set('authToken', jsonData.data.token);"
                ]
              }
            }
          ],
          "request": {
            "method": "POST",
            "header": [],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"email\": \"employer@test.com\",\n  \"password\": \"TestPass123!\"\n}",
              "options": {
                "raw": {
                  "language": "json"
                }
              }
            },
            "url": {
              "raw": "{{baseUrl}}/auth/login",
              "host": ["{{baseUrl}}"],
              "path": ["auth", "login"]
            }
          }
        },
        {
          "name": "Login - Invalid Credentials",
          "event": [
            {
              "listen": "test",
              "script": {
                "exec": [
                  "pm.test('Status code is 401', () => {",
                  "  pm.response.to.have.status(401);",
                  "});",
                  "",
                  "pm.test('Returns error message', () => {",
                  "  const jsonData = pm.response.json();",
                  "  pm.expect(jsonData.success).to.be.false;",
                  "  pm.expect(jsonData.error.code).to.eql('UNAUTHORIZED');",
                  "});"
                ]
              }
            }
          ],
          "request": {
            "method": "POST",
            "header": [],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"email\": \"wrong@test.com\",\n  \"password\": \"wrongpass\"\n}",
              "options": {
                "raw": {
                  "language": "json"
                }
              }
            },
            "url": {
              "raw": "{{baseUrl}}/auth/login",
              "host": ["{{baseUrl}}"],
              "path": ["auth", "login"]
            }
          }
        }
      ]
    },
    {
      "name": "Assessments",
      "item": [
        {
          "name": "Create Assessment",
          "event": [
            {
              "listen": "test",
              "script": {
                "exec": [
                  "pm.test('Status code is 201', () => {",
                  "  pm.response.to.have.status(201);",
                  "});",
                  "",
                  "pm.test('Returns assessment with ID', () => {",
                  "  const jsonData = pm.response.json();",
                  "  pm.expect(jsonData.data).to.have.property('assessment_id');",
                  "  pm.expect(jsonData.data.status).to.eql('draft');",
                  "});",
                  "",
                  "pm.test('Response time is acceptable', () => {",
                  "  pm.expect(pm.response.responseTime).to.be.below(2000);",
                  "});",
                  "",
                  "// Save assessment ID",
                  "const jsonData = pm.response.json();",
                  "pm.collectionVariables.set('assessmentId', jsonData.data.assessment_id);"
                ]
              }
            }
          ],
          "request": {
            "method": "POST",
            "header": [],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"organisationId\": \"{{organisationId}}\"\n}",
              "options": {
                "raw": {
                  "language": "json"
                }
              }
            },
            "url": {
              "raw": "{{baseUrl}}/assessments",
              "host": ["{{baseUrl}}"],
              "path": ["assessments"]
            }
          }
        }
      ]
    }
  ],
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000/api/v1"
    },
    {
      "key": "authToken",
      "value": ""
    },
    {
      "key": "organisationId",
      "value": ""
    },
    {
      "key": "assessmentId",
      "value": ""
    }
  ]
}
```

### Contract Testing (Pact)

```typescript
// __tests__/contract/assessments.pact.test.ts
import { Pact } from '@pact-foundation/pact';
import { assessmentsApi } from '@/services/api/assessments';

const provider = new Pact({
  consumer: 'StopFRA-Mobile',
  provider: 'StopFRA-API',
  port: 1234,
  log: './logs/pact.log',
  dir: './pacts',
  logLevel: 'info'
});

describe('Assessments API Contract', () => {
  beforeAll(() => provider.setup());
  afterEach(() => provider.verify());
  afterAll(() => provider.finalize());

  describe('GET /assessments/:id', () => {
    it('returns assessment when exists', async () => {
      const assessmentId = '123e4567-e89b-12d3-a456-426614174000';

      await provider.addInteraction({
        state: 'assessment 123e4567-e89b-12d3-a456-426614174000 exists',
        uponReceiving: 'a request for assessment',
        withRequest: {
          method: 'GET',
          path: `/api/v1/assessments/${assessmentId}`,
          headers: {
            Authorization: 'Bearer token'
          }
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            success: true,
            data: {
              assessment_id: assessmentId,
              organisation_id: Pact.Match.uuid(),
              status: Pact.Match.regex({
                generate: 'draft',
                matcher: '^(draft|submitted|paid|signed)$'
              }),
              created_at: Pact.Match.iso8601DateTime()
            }
          }
        }
      });

      const response = await assessmentsApi.get(assessmentId);

      expect(response.data.assessment_id).toBe(assessmentId);
    });
  });
});
```

---

## Mobile-Specific Testing

### Platform-Specific Tests

```typescript
// __tests__/mobile/platform.test.ts
import { Platform } from 'react-native';
import { render } from '@testing-library/react-native';
import { PlatformSpecificComponent } from '@/components/PlatformSpecific';

describe('Platform-Specific Behavior', () => {
  it('renders iOS-specific UI on iOS', () => {
    Platform.OS = 'ios';

    const { getByTestId } = render(<PlatformSpecificComponent />);

    expect(getByTestId('ios-picker')).toBeTruthy();
  });

  it('renders Android-specific UI on Android', () => {
    Platform.OS = 'android';

    const { getByTestId } = render(<PlatformSpecificComponent />);

    expect(getByTestId('android-picker')).toBeTruthy();
  });
});
```

### Device Compatibility Testing

```typescript
// e2e/deviceCompatibility.test.ts
describe('Device Compatibility', () => {
  const devices = [
    { name: 'iPhone SE (2nd gen)', width: 375, height: 667 },
    { name: 'iPhone 15 Pro', width: 393, height: 852 },
    { name: 'iPhone 15 Pro Max', width: 430, height: 932 },
    { name: 'iPad Pro 11"', width: 834, height: 1194 },
    { name: 'Pixel 6', width: 412, height: 915 },
    { name: 'Galaxy S21', width: 360, height: 800 }
  ];

  devices.forEach(({ name, width, height }) => {
    it(`should render correctly on ${name}`, async () => {
      await device.launchApp({
        newInstance: true,
        deviceName: name
      });

      // Verify critical UI elements are visible
      await expect(element(by.id('login-form'))).toBeVisible();
      await expect(element(by.id('login-button'))).toBeVisible();

      // Verify no UI overflow
      const screenshot = await device.takeScreenshot(name);
      // Visual regression testing with screenshot comparison
    });
  });
});
```

### Orientation Testing

```typescript
// e2e/orientation.test.ts
describe('Screen Orientation', () => {
  it('should handle portrait to landscape rotation', async () => {
    await device.launchApp();

    // Portrait
    await device.setOrientation('portrait');
    await expect(element(by.id('portrait-layout'))).toBeVisible();

    // Rotate to landscape
    await device.setOrientation('landscape');
    await expect(element(by.id('landscape-layout'))).toBeVisible();

    // Verify data persistence
    await element(by.id('email-input')).typeText('test@example.com');
    await device.setOrientation('portrait');
    await expect(element(by.id('email-input'))).toHaveText('test@example.com');
  });
});
```

---

## Performance Testing

### Load Testing (k6)

```javascript
// loadTests/assessmentAPI.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 200 },  // Ramp up to 200 users
    { duration: '5m', target: 200 },  // Stay at 200 users
    { duration: '2m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests under 500ms
    http_req_failed: ['rate<0.01'],    // Error rate below 1%
    errors: ['rate<0.1'],              // Custom error rate below 10%
  },
};

const BASE_URL = 'https://api-staging.stopfra.com/api/v1';

export default function () {
  // Login
  const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: `user${__VU}@test.com`,
    password: 'TestPass123!'
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(loginRes, {
    'login status is 200': (r) => r.status === 200,
    'login response time < 500ms': (r) => r.timings.duration < 500,
  }) || errorRate.add(1);

  const authToken = loginRes.json('data.token');

  sleep(1);

  // Create assessment
  const createRes = http.post(`${BASE_URL}/assessments`, JSON.stringify({
    organisationId: loginRes.json('data.user.organisation_id')
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
  });

  check(createRes, {
    'create status is 201': (r) => r.status === 201,
    'create response time < 1000ms': (r) => r.timings.duration < 1000,
  }) || errorRate.add(1);

  const assessmentId = createRes.json('data.assessment_id');

  sleep(2);

  // Update assessment
  const updateRes = http.patch(`${BASE_URL}/assessments/${assessmentId}`, JSON.stringify({
    answers: {
      risk_appetite: 'medium',
      justification: 'Moderate risk tolerance for growth'
    }
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
  });

  check(updateRes, {
    'update status is 200': (r) => r.status === 200,
    'update response time < 500ms': (r) => r.timings.duration < 500,
  }) || errorRate.add(1);

  sleep(1);
}
```

### Mobile Performance Testing

```typescript
// __tests__/performance/rendering.test.ts
import { render } from '@testing-library/react-native';
import { Dashboard } from '@/app/dashboard';

describe('Performance Tests', () => {
  it('dashboard renders in under 100ms', () => {
    const startTime = performance.now();

    render(<Dashboard />);

    const renderTime = performance.now() - startTime;

    expect(renderTime).toBeLessThan(100);
  });

  it('list scrolling maintains 60 FPS', async () => {
    const { getByTestId } = render(<AssessmentList assessments={mockAssessments} />);

    const list = getByTestId('assessment-list');

    // Measure frame rate during scroll
    const frameRate = await measureScrollPerformance(list);

    expect(frameRate).toBeGreaterThanOrEqual(60);
  });

  it('bundle size is within limits', () => {
    const bundleSize = getBundleSize();

    expect(bundleSize.ios).toBeLessThan(50 * 1024 * 1024); // 50 MB
    expect(bundleSize.android).toBeLessThan(50 * 1024 * 1024);
  });
});
```

### Lighthouse Performance Audits

```javascript
// performance/lighthouse.js
const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');

async function runLighthouse(url) {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });

  const options = {
    logLevel: 'info',
    output: 'html',
    onlyCategories: ['performance'],
    port: chrome.port
  };

  const runnerResult = await lighthouse(url, options);

  const reportHtml = runnerResult.report;
  const score = runnerResult.lhr.categories.performance.score * 100;

  console.log(`Performance score: ${score}`);

  await chrome.kill();

  // Assert minimum performance score
  if (score < 90) {
    throw new Error(`Performance score ${score} is below threshold of 90`);
  }

  return { score, reportHtml };
}

runLighthouse('https://app-staging.stopfra.com');
```

---

## Security Testing

### OWASP Security Tests

```typescript
// __tests__/security/owasp.test.ts
import request from 'supertest';
import app from '@/app';

describe('OWASP Security Tests', () => {
  describe('SQL Injection', () => {
    it('should prevent SQL injection in login', async () => {
      const sqlInjectionPayloads = [
        "admin' OR '1'='1",
        "admin'--",
        "admin' OR 1=1--",
        "' UNION SELECT NULL--"
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: payload,
            password: 'password'
          });

        expect([400, 401]).toContain(response.status);
        expect(response.body.success).toBe(false);
      }
    });
  });

  describe('XSS Protection', () => {
    it('should sanitize HTML in input fields', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        '<svg onload=alert("XSS")>'
      ];

      const token = await getTestToken();

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/v1/assessments')
          .set('Authorization', `Bearer ${token}`)
          .send({
            organisationId: 'valid-uuid',
            answers: {
              justification: payload
            }
          });

        // Should either reject or sanitize
        if (response.status === 200) {
          expect(response.body.data.answers.justification).not.toContain('<script>');
          expect(response.body.data.answers.justification).not.toContain('onerror');
        }
      }
    });
  });

  describe('Authentication', () => {
    it('should enforce strong password requirements', async () => {
      const weakPasswords = [
        'password',      // Too common
        '12345678',      // All numbers
        'abcdefgh',      // All lowercase
        'Pass123',       // Too short
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/v1/auth/signup')
          .send({
            email: 'test@example.com',
            password: password,
            organisationName: 'Test Org'
          });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('WEAK_PASSWORD');
      }
    });

    it('should implement rate limiting', async () => {
      const requests = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/v1/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrong'
          })
      );

      const responses = await Promise.all(requests);

      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('Authorization', () => {
    it('should prevent horizontal privilege escalation', async () => {
      const user1Token = await getTestToken('user1');
      const user2OrgId = await getOrganisationId('user2');

      const response = await request(app)
        .get(`/api/v1/dashboard/organisation/${user2OrgId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should prevent vertical privilege escalation', async () => {
      const employeeToken = await getTestToken('employee');

      const response = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('Data Exposure', () => {
    it('should not expose password hashes', async () => {
      const token = await getTestToken();

      const response = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.body.data).not.toHaveProperty('password_hash');
      expect(response.body.data).not.toHaveProperty('password');
    });

    it('should not expose internal error details in production', async () => {
      process.env.NODE_ENV = 'production';

      const response = await request(app)
        .get('/api/v1/invalid-endpoint');

      expect(response.body).not.toHaveProperty('stack');
      expect(response.body.error.message).not.toContain('at Object');
    });
  });
});
```

### Penetration Testing Checklist

```markdown
# Security Penetration Testing Checklist

## Authentication & Session Management
- [ ] Test password reset functionality
- [ ] Test session timeout
- [ ] Test concurrent sessions
- [ ] Test remember me functionality
- [ ] Test logout functionality
- [ ] Test authentication bypass attempts

## Authorization
- [ ] Test role-based access control
- [ ] Test horizontal privilege escalation
- [ ] Test vertical privilege escalation
- [ ] Test direct object reference
- [ ] Test parameter tampering

## Input Validation
- [ ] Test SQL injection (all input fields)
- [ ] Test XSS (reflected, stored, DOM-based)
- [ ] Test command injection
- [ ] Test file upload vulnerabilities
- [ ] Test buffer overflow
- [ ] Test XML injection

## Data Exposure
- [ ] Test sensitive data in URLs
- [ ] Test sensitive data in logs
- [ ] Test error messages for information disclosure
- [ ] Test API responses for excessive data
- [ ] Test browser caching of sensitive data

## Cryptography
- [ ] Test weak encryption algorithms
- [ ] Test insecure random number generation
- [ ] Test certificate validation
- [ ] Test SSL/TLS configuration
- [ ] Test data encryption at rest

## Business Logic
- [ ] Test payment processing edge cases
- [ ] Test key-pass generation collisions
- [ ] Test risk scoring manipulation
- [ ] Test assessment submission bypass
- [ ] Test package upgrade/downgrade logic
```

---

## Accessibility Testing

### Automated Accessibility Testing

```typescript
// __tests__/accessibility/a11y.test.ts
import { render } from '@testing-library/react-native';
import { axe, toHaveNoViolations } from 'jest-axe';
import { LoginScreen } from '@/app/auth/login';

expect.extend(toHaveNoViolations);

describe('Accessibility Tests', () => {
  it('login screen has no accessibility violations', async () => {
    const { container } = render(<LoginScreen />);
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });

  it('has proper accessibility labels', () => {
    const { getByLabelText } = render(<LoginScreen />);

    expect(getByLabelText('Email address')).toBeTruthy();
    expect(getByLabelText('Password')).toBeTruthy();
    expect(getByLabelText('Login button')).toBeTruthy();
  });

  it('has minimum touch target size', () => {
    const { getByRole } = render(<Button>Submit</Button>);

    const button = getByRole('button');
    const { width, height } = button.props.style;

    expect(width).toBeGreaterThanOrEqual(44);
    expect(height).toBeGreaterThanOrEqual(44);
  });

  it('has sufficient color contrast', () => {
    const { getByText } = render(<Button>Submit</Button>);

    const button = getByText('Submit');
    const { color, backgroundColor } = button.props.style;

    const contrastRatio = calculateContrastRatio(color, backgroundColor);

    expect(contrastRatio).toBeGreaterThanOrEqual(4.5); // WCAG AA
  });
});
```

### Manual Accessibility Testing Checklist

```markdown
# Manual Accessibility Testing Checklist (WCAG 2.1 AA)

## Perceivable
- [ ] All images have alt text
- [ ] Text has minimum 4.5:1 contrast ratio
- [ ] Large text (18pt+) has 3:1 contrast ratio
- [ ] Color is not the only visual means of conveying information
- [ ] Audio/video has captions and transcripts

## Operable
- [ ] All functionality available via keyboard
- [ ] No keyboard traps
- [ ] Touch targets minimum 44x44 points
- [ ] Sufficient time to complete actions
- [ ] Pause/stop/hide for moving content
- [ ] No content flashing more than 3 times per second

## Understandable
- [ ] Language of page is identified
- [ ] Navigation is consistent
- [ ] Form inputs have labels
- [ ] Error messages are clear and helpful
- [ ] Instructions are provided where needed

## Robust
- [ ] Valid HTML/markup
- [ ] Name, role, value for UI components
- [ ] Status messages programmatically determined
- [ ] Compatible with assistive technologies
```

---

## Regression Testing

### Regression Test Suite

```typescript
// __tests__/regression/criticalFlows.test.ts
describe('Regression Test Suite - Critical Flows', () => {
  describe('Authentication Flow', () => {
    it('employer can login and access dashboard', async () => {
      // Test critical path
    });

    it('employee can login with key-pass', async () => {
      // Test critical path
    });

    it('token refresh works correctly', async () => {
      // Test critical path
    });
  });

  describe('Assessment Creation Flow', () => {
    it('can create and submit complete assessment', async () => {
      // Test critical path
    });

    it('draft saving and resumption works', async () => {
      // Test critical path
    });

    it('risk scoring calculates correctly', async () => {
      // Test critical path
    });
  });

  describe('Payment Flow', () => {
    it('successful payment allocates key-passes', async () => {
      // Test critical path
    });

    it('failed payment does not allocate key-passes', async () => {
      // Test critical path
    });
  });

  describe('Dashboard Analytics', () => {
    it('metrics calculate correctly', async () => {
      // Test critical path
    });

    it('export functionality works', async () => {
      // Test critical path
    });
  });
});
```

### Visual Regression Testing

```typescript
// __tests__/visual/screenshots.test.ts
import { device, element, by } from 'detox';

describe('Visual Regression Tests', () => {
  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('login screen matches baseline', async () => {
    const screenshot = await device.takeScreenshot('login-screen');

    // Compare with baseline using image diffing
    const diff = await compareWithBaseline(screenshot, 'login-screen-baseline.png');

    expect(diff.percentage).toBeLessThan(0.1); // < 0.1% difference
  });

  it('dashboard layout matches baseline', async () => {
    await login();

    const screenshot = await device.takeScreenshot('dashboard');
    const diff = await compareWithBaseline(screenshot, 'dashboard-baseline.png');

    expect(diff.percentage).toBeLessThan(0.1);
  });
});
```

---

## Test Automation Strategy

### CI/CD Pipeline Integration

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main, develop]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run database migrations
        run: npm run db:migrate

      - name: Run integration tests
        run: npm run test:integration

  e2e-tests:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Build iOS app
        run: npm run build:ios:test

      - name: Run E2E tests
        run: npm run test:e2e:ios

      - name: Upload test artifacts
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: e2e-screenshots
          path: e2e/artifacts/

  security-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run OWASP dependency check
        run: npm audit

      - name: Run security tests
        run: npm run test:security

  accessibility-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run accessibility tests
        run: npm run test:a11y

  quality-gate:
    needs: [unit-tests, integration-tests, e2e-tests, security-tests, accessibility-tests]
    runs-on: ubuntu-latest
    steps:
      - name: Check all tests passed
        run: echo "All tests passed!"
```

---

## Test Data Management

### Test Data Strategy

```typescript
// test/fixtures/testData.ts
export const testUsers = {
  employer: {
    email: 'employer@test.com',
    password: 'TestPass123!',
    name: 'Test Employer',
    role: 'employer'
  },
  employee: {
    email: 'employee@test.com',
    password: 'TestPass123!',
    name: 'Test Employee',
    role: 'employee'
  },
  admin: {
    email: 'admin@test.com',
    password: 'AdminPass123!',
    name: 'Test Admin',
    role: 'admin'
  }
};

export const testOrganisations = {
  small: {
    name: 'Small Test Org',
    type: 'private-sme',
    employee_band: '1-10'
  },
  medium: {
    name: 'Medium Test Org',
    type: 'charity',
    employee_band: '51-100'
  },
  large: {
    name: 'Large Test Org',
    type: 'large-corporate',
    employee_band: '1001+'
  }
};

export const testAssessments = {
  draft: {
    status: 'draft',
    answers: {
      risk_appetite: 'medium'
    }
  },
  complete: {
    status: 'signed',
    overall_risk_level: 'medium',
    answers: {
      risk_appetite: 'medium',
      fraud_triangle: {
        pressure: 'Financial targets',
        opportunity: 'Weak controls',
        rationalization: 'Competitive pressure'
      },
      // ... all 13 modules
    }
  }
};
```

### Test Database Setup

```typescript
// test/helpers/database.ts
import { pool } from '@/config/database';

export async function setupTestDatabase() {
  // Create test schema
  await pool.query('CREATE SCHEMA IF NOT EXISTS test');
  await pool.query('SET search_path TO test');

  // Run migrations
  await runMigrations();

  // Seed test data
  await seedTestData();
}

export async function teardownTestDatabase() {
  // Clean up test data
  await pool.query('DROP SCHEMA IF EXISTS test CASCADE');
}

export async function resetDatabase() {
  // Truncate all tables
  await pool.query(`
    TRUNCATE TABLE
      users,
      organisations,
      assessments,
      assessment_answers,
      risk_register_items,
      keypasses,
      purchases
    CASCADE
  `);
}

async function seedTestData() {
  // Insert test organisations
  const orgResult = await pool.query(
    'INSERT INTO organisations (name, type, employee_band) VALUES ($1, $2, $3) RETURNING organisation_id',
    ['Test Org', 'private-sme', '11-50']
  );

  // Insert test users
  await pool.query(
    'INSERT INTO users (email, password_hash, name, role, organisation_id) VALUES ($1, $2, $3, $4, $5)',
    ['test@example.com', '$2b$10$hash', 'Test User', 'employer', orgResult.rows[0].organisation_id]
  );
}
```

---

## Bug Reporting & Tracking

### Bug Report Template

```markdown
# Bug Report Template

## Bug ID
BUG-XXXX

## Title
[Concise description of the issue]

## Severity
- [ ] Critical (System crash, data loss, security vulnerability)
- [ ] High (Major feature broken, no workaround)
- [ ] Medium (Feature partially broken, workaround exists)
- [ ] Low (Minor issue, cosmetic)

## Priority
- [ ] P0 (Immediate fix required)
- [ ] P1 (Fix in current sprint)
- [ ] P2 (Fix in next sprint)
- [ ] P3 (Backlog)

## Environment
- Platform: [iOS / Android / Web]
- Device: [iPhone 15 Pro / Pixel 6 / Desktop]
- OS Version: [iOS 17.0 / Android 13 / macOS 14.0]
- App Version: [1.0.0]
- Build Number: [123]

## Steps to Reproduce
1. Navigate to login screen
2. Enter email: test@example.com
3. Enter password: TestPass123!
4. Tap login button
5. Observe error

## Expected Behavior
User should be logged in and redirected to dashboard.

## Actual Behavior
Error message "Network request failed" is displayed.

## Screenshots/Video
[Attach screenshots or video recording]

## Console Logs
```
[2025-12-20 10:30:45] ERROR: Network request failed
[2025-12-20 10:30:45] Stack trace: ...
```

## Additional Context
- Issue occurs only on iOS 17.0
- Works fine on Android
- Network connection is stable

## Possible Root Cause
CORS configuration may be blocking iOS requests.

## Suggested Fix
Update CORS settings to allow iOS user agents.
```

---

## Testing Tools & Frameworks

### Recommended Toolchain

```typescript
// Backend Testing
- Jest                    // Unit testing framework
- Supertest              // HTTP assertions
- @testing-library/react // React component testing
- ts-jest                // TypeScript support for Jest

// Frontend Testing
- Jest                   // Unit testing
- React Native Testing Library // Component testing
- Detox                  // E2E testing (mobile)
- Playwright             // E2E testing (web)

// API Testing
- Postman/Newman        // API testing & collection runner
- Pact                  // Contract testing
- Swagger/OpenAPI       // API documentation & testing

// Performance Testing
- k6                    // Load testing
- Lighthouse            // Web performance
- React DevTools Profiler // React performance

// Security Testing
- OWASP ZAP            // Security scanner
- npm audit            // Dependency vulnerabilities
- ESLint security plugins // Static analysis

// Accessibility Testing
- jest-axe             // Automated a11y testing
- Pa11y                // Automated a11y auditing
- Screen readers       // Manual testing

// CI/CD
- GitHub Actions       // CI/CD pipeline
- CodeCov              // Coverage reporting
- SonarQube           // Code quality
```

---

## Decision Framework

### Testing Decision Matrix

| Scenario | Test Type | Priority | Automation |
|----------|-----------|----------|------------|
| New feature | Unit, Integration, E2E | High | Yes |
| Bug fix | Regression, Unit | High | Yes |
| UI change | Visual regression, E2E | Medium | Yes |
| API change | Contract, Integration | High | Yes |
| Performance | Load, Stress | Medium | Yes |
| Security | Penetration, OWASP | Critical | Partial |
| Accessibility | Automated + Manual | High | Partial |

### When to Skip Tests

```typescript
// NEVER skip tests for:
- Authentication & authorization
- Payment processing
- Risk scoring calculations
- Data encryption/decryption
- Compliance-related features

// Consider skipping tests for:
- Prototype/POC features
- Internal tools (non-production)
- Temporary workarounds
- Features scheduled for removal

// But document why and track debt:
describe.skip('Feature X - Skipped due to prototype status', () => {
  // TODO: Add tests before production deployment
  // Tracking: TECH-DEBT-123
});
```

---

## Summary Checklist for Testing Architects

### Pre-Implementation
- [ ] Review acceptance criteria
- [ ] Identify critical test scenarios
- [ ] Plan test data requirements
- [ ] Set up test environments
- [ ] Configure test automation tools
- [ ] Define coverage targets

### During Implementation
- [ ] Write unit tests (80%+ coverage)
- [ ] Write integration tests (70%+ coverage)
- [ ] Write E2E tests for critical flows
- [ ] Perform security testing (OWASP Top 10)
- [ ] Perform accessibility testing (WCAG 2.1 AA)
- [ ] Run performance benchmarks

### Pre-Deployment
- [ ] Run full regression suite
- [ ] Verify coverage thresholds met
- [ ] Review and triage open bugs
- [ ] Perform smoke testing
- [ ] Validate test reports
- [ ] Document known issues

### Post-Deployment
- [ ] Monitor production errors
- [ ] Analyze user feedback
- [ ] Update test cases based on issues
- [ ] Maintain test data
- [ ] Review and update test strategy

---

**Document Version:** 1.0
**Last Updated:** December 20, 2025
**Next Review:** March 20, 2026
**Maintained By:** QA & Testing Team
