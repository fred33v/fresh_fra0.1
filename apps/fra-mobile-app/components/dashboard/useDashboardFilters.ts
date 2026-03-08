import { useState, useEffect, useMemo, useCallback } from 'react';
import type { FilterStatus, SortOption, ViewMode, EmployeeData } from './types';
import { apiService } from '@/services/api.service';

interface EmployeeApiRow {
  userId: string;
  userName: string;
  email: string;
  role: string;
  department: string | null;
  status: 'completed' | 'in-progress' | 'not-started';
  startedAt: string | null;
  completedAt: string | null;
  assessmentCount: number;
  latestAssessmentStatus: string | null;
  riskLevel: 'high' | 'medium' | 'low' | null;
}

export function useDashboardFilters() {
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [filterRisk, setFilterRisk] = useState<string>('all');

  const fetchEmployees = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiService.get<EmployeeApiRow[]>('/api/v1/analytics/employees');
      if (response.success && response.data) {
        const mapped: EmployeeData[] = response.data.map((row) => ({
          userId: row.userId,
          userName: row.userName,
          email: row.email,
          department: row.department || 'General',
          status: row.status,
          startedAt: row.startedAt,
          completedAt: row.completedAt,
          overallRiskLevel: row.riskLevel,
        }));
        setEmployees(mapped);
      } else {
        setError('Unable to load employee data. Please try again.');
      }
    } catch {
      setError('Could not connect to the server. Please check your connection and try again.');
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const filteredEmployees = useMemo(() => {
    let filtered = employees.filter((e: EmployeeData) => {
      if (filterStatus !== 'all' && e.status !== filterStatus) return false;
      if (filterDepartment !== 'all' && e.department !== filterDepartment) return false;
      if (filterRisk !== 'all' && e.overallRiskLevel !== filterRisk) return false;
      if (searchQuery && !e.userName.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !e.email.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });

    filtered.sort((a: EmployeeData, b: EmployeeData) => {
      switch (sortBy) {
        case 'name':
          return a.userName.localeCompare(b.userName);
        case 'status': {
          const statusOrder: Record<string, number> = { 'not-started': 0, 'in-progress': 1, 'completed': 2 };
          return statusOrder[a.status] - statusOrder[b.status];
        }
        case 'department':
          return a.department.localeCompare(b.department);
        case 'risk': {
          const riskOrder: Record<string, number> = { 'high': 0, 'medium': 1, 'low': 2 };
          return (riskOrder[a.overallRiskLevel ?? ''] ?? 3) -
                 (riskOrder[b.overallRiskLevel ?? ''] ?? 3);
        }
        default:
          return 0;
      }
    });

    return filtered;
  }, [employees, filterStatus, filterDepartment, filterRisk, searchQuery, sortBy]);

  const departments = useMemo(() => {
    const depts = new Set(employees.map(e => e.department).filter(Boolean));
    return ['all', ...Array.from(depts)];
  }, [employees]);

  const clearAllFilters = () => {
    setSearchQuery('');
    setFilterStatus('all');
    setFilterDepartment('all');
    setFilterRisk('all');
  };

  return {
    filterStatus,
    setFilterStatus,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
    filterDepartment,
    setFilterDepartment,
    filterRisk,
    setFilterRisk,
    filteredEmployees,
    departments,
    clearAllFilters,
    isLoading,
    error,
    refetch: fetchEmployees,
  };
}
