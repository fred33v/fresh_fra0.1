# Phase 2 Enhanced Modules - Developer Reference Guide

**Version:** 2.0  
**Last Updated:** March 8, 2026

---

## Quick Start: Adding Questions to a Module

### Basic Frequency Question
```tsx
import { QuestionGroup, QuestionOption } from '@/components/ui';
import type { Frequency } from '@/types/assessment';

const frequencyOptions: QuestionOption<Frequency>[] = [
  { value: 'always', label: 'Always' },
  { value: 'usually', label: 'Usually' },
  { value: 'sometimes', label: 'Sometimes' },
  { value: 'rarely', label: 'Rarely' },
  { value: 'never', label: 'Never' },
];

<QuestionGroup
  question="Your question here?"
  options={frequencyOptions}
  value={assessment.yourModule.fieldName}
  onChange={(value) =>
    updateAssessment({ yourModule: { ...assessment.yourModule, fieldName: value } })
  }
/>
```

### Currency Question (for Financial Tracking)
```tsx
import { CurrencyQuestion } from '@/components/ui';

<CurrencyQuestion
  question="What is your monthly spend?"
  hint="Total in GBP"
  value={assessment.yourModule.monthlySpend}
  onChange={(value) =>
    updateAssessment({ yourModule: { ...assessment.yourModule, monthlySpend: value } })
  }
/>
```

### Scale Question (1-5 Maturity/Confidence)
```tsx
import { ScaleQuestion } from '@/components/ui';

<ScaleQuestion
  question="How would you rate control maturity?"
  minLabel="Weak/Manual"
  maxLabel="Strong/Automated"
  value={assessment.yourModule.maturityScale}
  onChange={(value) =>
    updateAssessment({ yourModule: { ...assessment.yourModule, maturityScale: value } })
  }
/>
```

### Yes/No Question with Follow-up Description
```tsx
import { YesNoQuestion } from '@/components/ui';

<YesNoQuestion
  question="Has fraud been detected?"
  value={assessment.yourModule.fraudDetected}
  onChange={(value) =>
    updateAssessment({ yourModule: { ...assessment.yourModule, fraudDetected: value } })
  }
  followUpQuestion="Please describe the incident"
  followUpValue={assessment.yourModule.fraudDescription}
  onFollowUpChange={(text) =>
    updateAssessment({ yourModule: { ...assessment.yourModule, fraudDescription: text } })
  }
/>
```

### Text Area for Detailed Notes
```tsx
import { TextArea } from '@/components/ui';

<TextArea
  label="Additional Notes"
  hint="Describe any concerns or issues"
  value={assessment.yourModule.notes}
  onChangeText={(text) =>
    updateAssessment({ yourModule: { ...assessment.yourModule, notes: text } })
  }
  placeholder="Optional details..."
  numberOfLines={4}
/>
```

---

## Module Data Types Reference

### Complete Assessment Structure
```typescript
interface Assessment extends AssessmentData {
  id: string;
  status: 'draft' | 'submitted' | 'paid' | 'signed';
  createdAt: string;
  organisation: OrganisationInfo;
  
  // Module Data (13 modules)
  riskAppetite: RiskAppetite;
  fraudTriangle: FraudTriangle;
  procurement: EnhancedProcurementAnswers;
  cashBanking: EnhancedCashBankingAnswers;
  payrollHR: EnhancedPayrollHRAnswers;
  revenue: EnhancedRevenueAnswers;
  itSystems: EnhancedITSystemsAnswers;
  peopleCulture: EnhancedPeopleCultureAnswers;
  controlsTechnology: EnhancedControlsTechnologyAnswers;
  trainingAwareness: TrainingAwareness;
  monitoringEvaluation: MonitoringEvaluation;
  fraudResponsePlan: FraudResponsePlan;
  complianceMapping: ComplianceMapping;
}
```

### Phase 2 Enhancements by Module Type

| Module | Key Metrics | Scale Type | Currency Tracking |
|--------|------------|------------|-------------------|
| **Procurement** | Spend, Due Diligence | 1-5 Scale | Monthly Spend (£) |
| **Cash Banking** | Daily Volume, Accounts | 1-5 Scale | Daily Cash (£) |
| **Payroll HR** | Employee Count | 1-5 Scale | Total Employees |
| **Revenue** | Monthly Volume, Unpaid % | 1-5 Scale | Monthly (£), % |
| **IT Systems** | Maturity, Incidents | 1-5 Scale | Incident Count |
| **People Culture** | Messaging, Whistleblowing | 1-5 Scale | Case Tracking |
| **Controls Tech** | SOD, Access, Monitoring | 1-5 Scale | Implementation % |
| **Training** | Completion Rates | Completion % | Staff Count |
| **Monitoring** | Incidents Detected | 1-5 Likelihood | Anomaly Count |
| **Fraud Response** | Loss Value, Speed | 1-5 Scale | Losses (£) |

---

## Common Patterns

### Pattern 1: Currency Question with Context
Use when tracking financial metrics:
```tsx
// In module file
assessment.yourModule = {
  monthlySpend: 500000,      // £500k
  percentageSpent: 75,        // 75% of budget
  largestTransaction: 50000,  // £50k max
};

// Component
<CurrencyQuestion
  question="Average monthly spend?"
  value={assessment.yourModule.monthlySpend}
/>
```

### Pattern 2: Scale + Frequency Combination
Use for control/maturity assessment:
```tsx
// Assessment captures both maturity level and frequency
assessment.controlsTechnology = {
  segregationMaturity: 4,      // Scale 1-5 (what state)
  segregation: 'well-separated',  // Categorical (current status)
};

// This captures both "how good" and "what is it"
<ScaleQuestion
  question="How mature is segregation of duties?"
  value={assessment.controlsTechnology.segregationMaturity}
/>

<QuestionGroup
  question="Current segregation status?"
  options={segregationOptions}
  value={assessment.controlsTechnology.segregation}
/>
```

### Pattern 3: Incident Tracking with Details
Use for fraud/security incident capture:
```tsx
assessment.yourModule = {
  incidentsDetected: 3,              // How many?
  incidentDescription: "...",        // What happened?
  responseTime: 24,                  // How fast? (hours)
  resolved: true,                    // Was it resolved?
};

// Component
<YesNoQuestion
  question="Have incidents been detected?"
  followUpQuestion="Describe the incidents"
/>
```

### Pattern 4: Multi-Level Assessment
Use for comprehensive control evaluation:
```tsx
assessment.trainingAwareness = {
  // Level 1: Overall completion
  overallCompletionRate: 92,
  
  // Level 2: By category breakdown
  mandatoryCompletedCount: 78,
  specialistCompletedCount: 12,
  boardCompletedCount: 7,
  
  // Level 3: Target gap analysis (calculated)
  // mandatoryGap = 5 - (78/85) * 100 = 8%
};
```

---

## Integration with Risk Scoring

### How Modules Feed Into Risk Scores
```
Fraud Triangle (Inherent Risk)
├── Pressure (module data)
├── Opportunity (opportunity exists?)
├── Rationalization (module data)
└── Estimated Loss (module data)

Process Risk by Area
├── Procurement
│   ├── Base risk: 8 (high-value transactions)
│   ├── Due diligence level adjustment: -1 per scale point
│   ├── Monthly spend context: threshold adjustment
│   └── Recent fraud history: +1 if yes
│
├── Cash & Banking
│   ├── Base risk: 6 (high-value, high-frequency)
│   ├── Daily volume context: per £M, +0.5 per £M
│   ├── Control effectiveness: -1 per scale point
│   └── Bank account complexity: -0.5 per account segregated
│
├── Payroll & HR
│   ├── Base risk: 7 (employee fraud common)
│   ├── Workforce size: +0.1 per 10 employees
│   ├── Change detection: -2 if strong controls
│   └── Unauthorized changes history: +1 if detected

[Similar patterns for other modules]
```

### Using Risk Scores in Components
```tsx
import { useAssessmentRiskScore } from '@/hooks';

export function ModuleRiskIndicator() {
  const riskScore = useAssessmentRiskScore('procurement');
  
  return (
    <View style={[
      styles.indicator,
      riskScore > 7 && styles.highRisk,
      riskScore > 4 && styles.mediumRisk,
      riskScore <= 4 && styles.lowRisk,
    ]}>
      <Text>Procurement Risk: {riskScore}/10</Text>
    </View>
  );
}
```

---

## Testing Module Changes

### Unit Test Template
```typescript
describe('YourModule', () => {
  let assessment: AssessmentData;

  beforeEach(() => {
    assessment = createBlankAssessment();
  });

  it('should track currency values correctly', () => {
    assessment.yourModule.monthlySpend = 500000;
    expect(assessment.yourModule.monthlySpend).toBe(500000);
  });

  it('should validate scale values 1-5', () => {
    [1, 2, 3, 4, 5].forEach(value => {
      assessment.yourModule.maturity = value;
      expect(assessment.yourModule.maturity).toBeGreaterThanOrEqual(1);
      expect(assessment.yourModule.maturity).toBeLessThanOrEqual(5);
    });
  });

  it('should handle yes/no with descriptions', () => {
    assessment.yourModule.fraudDetected = 'yes';
    assessment.yourModule.fraudDescription = 'Employee filled own invoice';
    expect(assessment.yourModule.fraudDescription.length).toBeGreaterThan(0);
  });
});
```

### E2E Test Template
```typescript
describe('YourModule - E2E', () => {
  it('should capture flow from question to risk score', () => {
    // 1. User answers questions
    assessment.yourModule.monthlySpend = 500000;
    assessment.yourModule.dueDiligenceLevel = 3; // Medium

    // 2. Risk calculation includes module data
    const riskScore = calculateModuleRisk('yourModule', assessment);

    // 3. Verify scoring logic
    expect(riskScore).toBeGreaterThan(0);
    expect(riskScore).toBeLessThanOrEqual(10);

    // 4. Verify action plan includes recommendations
    const actions = generateActionPlan(assessment);
    const relevant = actions.filter(a => a.area === 'yourModule');
    expect(relevant.length).toBeGreaterThan(0);
  });
});
```

---

## Common Errors & Solutions

### Error 1: "Cannot read property of undefined"
**Cause:** Module data not initialized  
**Solution:**
```tsx
// ❌ Wrong
value={assessment.yourModule.fieldName}

// ✅ Correct
value={assessment.yourModule?.fieldName || null}
```

### Error 2: "Scale value out of range"
**Cause:** Storing values outside 1-5 range  
**Solution:**
```tsx
// ❌ Wrong
value={assessment.yourModule.maturity} // Could be 0, 6, etc.

// ✅ Correct
value={Math.max(1, Math.min(5, assessment.yourModule.maturity)) as ScaleValue}
```

### Error 3: "Type mismatch for CurrencyValue"
**Cause:** Storing string instead of number  
**Solution:**
```tsx
// ❌ Wrong
monthlySpend: "500000"

// ✅ Correct
monthlySpend: 500000 // Always number type
```

### Error 4: "Not-started assessment shows stale data"
**Cause:** Not clearing assessment state on refresh  
**Solution:**
```tsx
// ✅ Use useEffect to reset
useEffect(() => {
  if (assessment.status === 'draft') {
    resetModuleData('yourModule');
  }
}, [assessment.status]);
```

---

## Adding a New Module (Phase 3+)

### Step 1: Define Types
```typescript
// In types/assessment.ts
export interface YourNewModuleAnswers extends ProcessRiskAnswers {
  metric1: CurrencyValue;
  metric2: ScaleValue;
  incident: YesNoUnsure;
  incidentDescription: string;
}

export interface AssessmentData {
  // ... existing ...
  yourNewModule: YourNewModuleAnswers;
}
```

### Step 2: Create Component
```typescript
// In app/your-new-module.tsx
import React from 'react';
import { useAssessment } from '@/contexts/AssessmentContext';
import { AssessmentScreen, ScaleQuestion, CurrencyQuestion, YesNoQuestion } from '@/components/ui';

export default function YourNewModuleScreen() {
  const { assessment, updateAssessment } = useAssessment();

  return (
    <AssessmentScreen
      title="Your Module Title"
      nextRoute="/next-module"
      previousRoute="/previous-module"
      progress={{ current: X, total: 13 }}
    >
      {/* Add questions here */}
    </AssessmentScreen>
  );
}
```

### Step 3: Add to Risk Scoring
```typescript
// In services/riskScoringEngine.ts
function scoreYourModule(data: YourNewModuleAnswers): RiskScore {
  let baseRisk = 6; // Base risk level
  baseRisk -= (data.metric2 - 1) * 0.5; // Adjust for control maturity
  if (data.incident === 'yes') baseRisk += 1;
  return {
    inherent: Math.round(baseRisk),
    residual: calculateResidualRisk(baseRisk, data),
  };
}
```

### Step 4: Add to Navigation
```typescript
// In app/_layout.tsx or routing configuration
{
  name: 'your-new-module',
  title: 'Your New Module',
  route: 'app/your-new-module.tsx',
  progress: X,
}
```

### Step 5: Add Tests
```typescript
// In __tests__/examples/your-new-module.test.ts
describe('YourNewModule - E2E', () => {
  // Test implementation following patterns above
});
```

---

## Performance Optimization Tips

### Tip 1: Memoize Expensive Calculations
```tsx
const riskScore = useMemo(
  () => calculateModuleRisk('yourModule', assessment),
  [assessment.yourModule]
);
```

### Tip 2: Batch Updates
```tsx
// ❌ Slow - 5 separate updates
updateAssessment({ yourModule: { ...a, field1: v1 } });
updateAssessment({ yourModule: { ...a, field2: v2 } });
// ... more updates

// ✅ Fast - single update
const updated = {
  field1: v1,
  field2: v2,
  field3: v3,
  field4: v4,
  field5: v5,
};
updateAssessment({ yourModule: { ...assessment.yourModule, ...updated } });
```

### Tip 3: Lazy Load Heavy Components
```tsx
const HeavyChart = lazy(() => import('./HeavyChart'));

<Suspense fallback={<Spinner />}>
  <HeavyChart data={assessment.yourModule} />
</Suspense>
```

---

## Debugging Guide

### Check Assessment Data
```typescript
// In browser console
const assessment = window.__assessment; // If exposed
console.log(JSON.stringify(assessment, null, 2));
```

### Verify Risk Calculation
```typescript
import { riskScoringEngine } from '@/services/riskScoringEngine';

const moduleRisk = riskScoringEngine.scoreModule('yourModule', assessment);
console.log('Inherent Risk:', moduleRisk.inherent);
console.log('Residual Risk:', moduleRisk.residual);
```

### Monitor State Changes
```typescript
const { assessment, updateAssessment } = useAssessment();

useEffect(() => {
  console.log('Assessment updated:', assessment);
}, [assessment]);
```

---

## Resources & Further Reading

- **Type Definitions:** `types/assessment.ts`
- **Scoring Rules:** `services/riskScoringEngine.ts`
- **Component Library:** `components/ui/index.ts`
- **Example Implementation:** `app/cash-banking.tsx`
- **Test Examples:** `__tests__/examples/assessment-workflow.test.ts`

---

**Last Updated:** March 8, 2026  
**Version:** 2.0 (Phase 2 Enhanced Modules)  
