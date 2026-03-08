// API configuration
export const API_DEFAULTS = {
  PRODUCTION_URL: 'https://api.fraud-risk.co.uk',
  DEV_URL: 'http://localhost:3000',
  ANDROID_EMULATOR_URL: 'http://10.0.2.2:3000',
  TIMEOUT: 30000,
} as const;

// Risk scoring constants
export const RISK_SCORES = {
  HIGH: { min: 15, max: 25, label: 'High' },
  MEDIUM: { min: 8, max: 14, label: 'Medium' },
  LOW: { min: 1, max: 7, label: 'Low' },
} as const;

// Control strength reductions
export const CONTROL_REDUCTIONS = {
  VERY_STRONG: 0.4,
  REASONABLY_STRONG: 0.2,
  SOME_GAPS: 0,
  WEAK: 0,
} as const;

// Assessment modules
export const ASSESSMENT_MODULES = [
  'risk-appetite',
  'fraud-triangle',
  'people-culture',
  'controls-technology',
  'procurement',
  'payroll-hr',
  'revenue',
  'cash-banking',
  'it-systems',
  'monitoring-evaluation',
  'fraud-response',
  'training-awareness',
  'compliance-mapping',
] as const;

// Package tiers
export const PACKAGES = {
  BASIC: {
    id: 1,
    name: 'Basic Health Check',
    features: ['health-check'],
  },
  STANDARD: {
    id: 2,
    name: 'Health Check + Training',
    features: ['health-check', 'awareness-training'],
  },
  PREMIUM: {
    id: 3,
    name: 'Full Dashboard',
    features: ['health-check', 'awareness-training', 'dashboard', 'employee-assessment'],
  },
} as const;

// Regulatory frameworks
export const REGULATIONS = {
  GOVS013: {
    code: 'GovS-013',
    name: 'Government Functional Standard for Counter-Fraud',
    url: 'https://www.gov.uk/government/publications/government-functional-standard-govs-013-counter-fraud',
  },
  ECCTA: {
    code: 'ECCTA-2023',
    name: 'Economic Crime and Corporate Transparency Act 2023',
    url: 'https://www.legislation.gov.uk/ukpga/2023/56',
  },
  FAILURE_TO_PREVENT: {
    code: 'FTP-2025',
    name: 'Failure to Prevent Fraud',
    deadline: '2025-09-01',
  },
} as const;

// Fraud triangle factors
export const FRAUD_TRIANGLE = {
  OPPORTUNITY: 'opportunity',
  PRESSURE: 'pressure',
  RATIONALIZATION: 'rationalization',
} as const;
