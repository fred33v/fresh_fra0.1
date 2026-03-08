import React from 'react';
import { AlertOctagon, Phone, Building2, Mail } from 'lucide-react-native';
import { colors } from '@/constants/theme';

export const steps = [
  {
    id: 1,
    title: 'Do Not Confront',
    description: 'Never confront the individual. This may lead to evidence destruction, intimidation, or personal risk.',
    color: colors.danger,
  },
  {
    id: 2,
    title: 'Preserve Evidence',
    description: 'Make copies of suspicious documents. Save emails. Note dates, times, and people involved. Do not remove originals.',
    color: colors.warning,
  },
  {
    id: 3,
    title: 'Report Through Proper Channels',
    description: 'Use internal reporting channels below. Your report will be handled confidentially and professionally.',
    color: colors.success,
  },
];

export interface ContactInfo {
  role: string;
  icon: React.ComponentType<{ color: string; size: number }>;
  contactKey: 'fraudRiskOwner' | 'whistleblowingHotline' | 'internalAudit' | 'hrDepartment';
  bestFor: string;
}

export const contacts: ContactInfo[] = [
  {
    role: 'Fraud Risk Owner',
    icon: AlertOctagon,
    contactKey: 'fraudRiskOwner',
    bestFor: 'General fraud concerns, complex fraud, or concerns about your manager',
  },
  {
    role: 'Whistleblowing Hotline',
    icon: Phone,
    contactKey: 'whistleblowingHotline',
    bestFor: 'Sensitive concerns or when you prefer anonymity',
  },
  {
    role: 'Internal Audit',
    icon: Building2,
    contactKey: 'internalAudit',
    bestFor: 'Systemic control weaknesses or process issues',
  },
  {
    role: 'HR Department',
    icon: Mail,
    contactKey: 'hrDepartment',
    bestFor: 'Employment fraud (timesheets, expenses, payroll)',
  },
];
