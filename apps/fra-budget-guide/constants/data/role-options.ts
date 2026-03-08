import React from 'react';
import { FileText, CreditCard, Users, FileSignature, CheckSquare } from 'lucide-react-native';
import { UserRole } from '@/contexts/AppContext';

export interface RoleOption {
  id: UserRole;
  title: string;
  icon: React.ComponentType<{ color: string; size: number }>;
  description: string;
}

export const roleOptions: RoleOption[] = [
  {
    id: 'procurement',
    title: 'Procurement & Suppliers',
    icon: FileText,
    description: 'Managing suppliers, purchase orders, and procurement decisions',
  },
  {
    id: 'invoices',
    title: 'Invoices & Payments',
    icon: CreditCard,
    description: 'Approving invoices and authorizing payments',
  },
  {
    id: 'payroll',
    title: 'Payroll & Timesheets',
    icon: Users,
    description: 'Managing payroll, approving timesheets and HR functions',
  },
  {
    id: 'expenses',
    title: 'Expenses',
    icon: FileSignature,
    description: 'Reviewing and approving employee expense claims',
  },
  {
    id: 'contracts',
    title: 'Contracts',
    icon: CheckSquare,
    description: 'Managing and approving contracts with third parties',
  },
];
