import type { RiskPriority } from '@/types/assessment';

export type TabType = 'overview' | 'employees' | 'keypasses' | 'signoff';
export type FilterStatus = 'all' | 'completed' | 'in-progress' | 'not-started';
export type SortOption = 'name' | 'status' | 'risk' | 'department';
export type ViewMode = 'list' | 'grid';

export interface EmployeeData {
  userId: string;
  userName: string;
  email: string;
  department: string;
  status: 'completed' | 'in-progress' | 'not-started';
  startedAt: string | null;
  completedAt: string | null;
  overallRiskLevel: RiskPriority | null;
}

export interface VisibleMetrics {
  keyPasses: boolean;
  completionRate: boolean;
  riskDistribution: boolean;
  departmentBreakdown: boolean;
}

export interface CompletionByDepartment {
  department: string;
  completed: number;
  total: number;
}

export interface CompletionTrend {
  date: string;
  completed: number;
}
