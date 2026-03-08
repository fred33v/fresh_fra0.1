import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import { api, ApiError } from '@/lib/api';
import { createLogger } from '@/lib/logger';
const logger = createLogger('EmployerDashboard');
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Search,
  Loader2,
  ArrowLeft,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FileText,
  Download,
} from 'lucide-react';

const statusChartConfig = {
  completed: { label: 'Completed', color: 'hsl(var(--success))' },
  inProgress: { label: 'In Progress', color: 'hsl(var(--primary))' },
  notStarted: { label: 'Not Started', color: 'hsl(var(--muted-foreground))' },
} satisfies ChartConfig;

const riskChartConfig = {
  high: { label: 'High', color: 'hsl(var(--destructive))' },
  medium: { label: 'Medium', color: 'hsl(38 92% 50%)' },
  low: { label: 'Low', color: 'hsl(var(--success))' },
  none: { label: 'Not Assessed', color: 'hsl(var(--muted-foreground))' },
} satisfies ChartConfig;

interface EmployeeRow {
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

interface EmployeeDetail {
  userId: string;
  userName: string;
  email: string;
  assessments: {
    id: string;
    title: string;
    status: string;
    answers: Record<string, unknown>;
    createdAt: string;
    submittedAt: string | null;
  }[];
  keypasses: {
    code: string;
    status: string;
    usedAt: string | null;
  }[];
}

export default function EmployerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [employeeDetail, setEmployeeDetail] = useState<EmployeeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const expandedUserRef = useRef<string | null>(null);

  const isEmployerOrAdmin = user?.role === 'employer' || user?.role === 'admin';

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const empData = await api.get<EmployeeRow[]>('/api/v1/analytics/employees');
      setEmployees(empData);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === 'PACKAGE_REQUIRED') {
        setError('The employer dashboard requires the Full package. Please upgrade to access employee analytics.');
      } else {
        const message = err instanceof Error ? err.message : 'Failed to load dashboard data';
        setError(message);
      }
      logger.error('Failed to fetch employer dashboard data', err);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (isEmployerOrAdmin) {
      fetchData();
    }
  }, [isEmployerOrAdmin]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (riskFilter !== 'all' && e.riskLevel !== riskFilter) return false;
      if (departmentFilter !== 'all' && (e.department || 'General') !== departmentFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return e.userName.toLowerCase().includes(q) || e.email.toLowerCase().includes(q);
      }
      return true;
    });
  }, [employees, statusFilter, riskFilter, departmentFilter, searchQuery]);

  const departments = useMemo(() => {
    const depts = new Set(employees.map(e => e.department || 'General'));
    return Array.from(depts).sort();
  }, [employees]);

  const stats = useMemo(() => {
    const total = employees.length;
    const completed = employees.filter(e => e.status === 'completed').length;
    const inProgress = employees.filter(e => e.status === 'in-progress').length;
    const highRisk = employees.filter(e => e.riskLevel === 'high').length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, highRisk, completionRate };
  }, [employees]);

  const statusChartData = useMemo(() => [
    { name: 'completed', value: stats.completed, fill: 'var(--color-completed)' },
    { name: 'inProgress', value: stats.inProgress, fill: 'var(--color-inProgress)' },
    { name: 'notStarted', value: stats.total - stats.completed - stats.inProgress, fill: 'var(--color-notStarted)' },
  ].filter(d => d.value > 0), [stats]);

  const riskChartData = useMemo(() => {
    const high = employees.filter(e => e.riskLevel === 'high').length;
    const medium = employees.filter(e => e.riskLevel === 'medium').length;
    const low = employees.filter(e => e.riskLevel === 'low').length;
    const none = employees.filter(e => !e.riskLevel).length;
    return [
      { name: 'High', value: high, fill: 'var(--color-high)' },
      { name: 'Medium', value: medium, fill: 'var(--color-medium)' },
      { name: 'Low', value: low, fill: 'var(--color-low)' },
      { name: 'Not Assessed', value: none, fill: 'var(--color-none)' },
    ].filter(d => d.value > 0);
  }, [employees]);

  const fetchEmployeeDetail = async (userId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const detail = await api.get<EmployeeDetail>(`/api/v1/analytics/employees/${userId}`);
      // Guard: only update if this user is still the expanded one
      if (expandedUserRef.current !== userId) return;
      setEmployeeDetail(detail);
    } catch (err) {
      if (expandedUserRef.current !== userId) return;
      logger.error('Failed to fetch employee detail', err);
      setEmployeeDetail(null);
      setDetailError('Failed to load employee details. Please try again.');
    }
    if (expandedUserRef.current === userId) setDetailLoading(false);
  };

  const toggleEmployeeDetail = async (userId: string) => {
    if (expandedUserId === userId) {
      expandedUserRef.current = null;
      setExpandedUserId(null);
      setEmployeeDetail(null);
      setDetailError(null);
      return;
    }
    expandedUserRef.current = userId;
    setExpandedUserId(userId);
    await fetchEmployeeDetail(userId);
  };

  if (!user) return null;

  if (!isEmployerOrAdmin) {
    return (
      <Layout>
        <div className="container py-8 lg:py-12">
          <Button variant="ghost" className="mb-6" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <Card className="max-w-2xl mx-auto">
            <CardContent className="pt-6 text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
              <p className="text-muted-foreground mb-6">
                The employer dashboard is only available for employer and admin accounts.
              </p>
              <Button onClick={() => navigate('/dashboard')}>
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-8 lg:py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1">Organisation Dashboard</h1>
            <p className="text-muted-foreground">Employee fraud risk awareness overview</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6">
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="pt-6 text-center">
                <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
                <p className="text-destructive font-medium mb-4">{error}</p>
                <Button variant="outline" size="sm" onClick={fetchData}>
                  Try Again
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {isLoading ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
                  <CardContent><Skeleton className="h-8 w-16" /></CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardContent className="pt-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full mb-2" />
                ))}
              </CardContent>
            </Card>
          </div>
        ) : !error && (
          <>
            {/* Summary Cards */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8"
            >
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Employees</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Completion Rate</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.completionRate}%</div>
                  <p className="text-xs text-muted-foreground">{stats.completed} of {stats.total} completed</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
                  <Loader2 className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.inProgress}</div>
                  <p className="text-xs text-muted-foreground">Currently training</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">High Risk</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.highRisk}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats.highRisk > 0 ? 'Require attention' : 'No high-risk employees'}
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Charts */}
            {stats.total > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="grid gap-4 sm:grid-cols-2 mb-8"
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Status Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={statusChartConfig} className="mx-auto aspect-square max-h-[250px]">
                      <PieChart>
                        <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                        <Pie data={statusChartData} dataKey="value" nameKey="name" innerRadius={50} strokeWidth={2}>
                          {statusChartData.map((entry) => (
                            <Cell key={entry.name} fill={entry.fill} />
                          ))}
                        </Pie>
                        <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                      </PieChart>
                    </ChartContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Risk Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={riskChartConfig} className="aspect-square max-h-[250px] w-full">
                      <BarChart data={riskChartData} layout="vertical" margin={{ left: 20 }}>
                        <CartesianGrid horizontal={false} />
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis type="category" dataKey="name" width={90} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {riskChartData.map((entry) => (
                            <Cell key={entry.name} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Filters */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-6"
            >
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="not-started">Not Started</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={riskFilter} onValueChange={setRiskFilter}>
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Filter by risk" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Risk Levels</SelectItem>
                        <SelectItem value="high">High Risk</SelectItem>
                        <SelectItem value="medium">Medium Risk</SelectItem>
                        <SelectItem value="low">Low Risk</SelectItem>
                      </SelectContent>
                    </Select>
                    {departments.length > 1 && (
                      <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                          <SelectValue placeholder="Filter by department" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Departments</SelectItem>
                          {departments.map(dept => (
                            <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Employee Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">
                    Employees ({filteredEmployees.length}{filteredEmployees.length !== employees.length ? ` of ${employees.length}` : ''})
                  </CardTitle>
                  {filteredEmployees.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const csvEscape = (v: string) => `"${v.replace(/"/g, '""')}"`;
                        const header = 'Name,Email,Department,Status,Risk Level,Assessments,Completed';
                        const rows = filteredEmployees.map(e => [
                          csvEscape(e.userName),
                          csvEscape(e.email),
                          csvEscape(e.department || 'General'),
                          e.status,
                          e.riskLevel || 'N/A',
                          e.assessmentCount,
                          e.completedAt ? new Date(e.completedAt).toLocaleDateString('en-GB') : '',
                        ].join(','));
                        const csv = [header, ...rows].join('\n');
                        const blob = new Blob([csv], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `employees-${new Date().toISOString().split('T')[0]}.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Export CSV
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {filteredEmployees.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">
                        {employees.length === 0
                          ? 'No employees found. Distribute key-passes to get started.'
                          : 'No employees match your filters.'}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-8"></TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Risk Level</TableHead>
                            <TableHead>Assessments</TableHead>
                            <TableHead>Completed</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredEmployees.map((employee) => {
                            const isExpanded = expandedUserId === employee.userId;
                            const hasCompleted = employee.status === 'completed';
                            return (
                              <React.Fragment key={employee.userId}>
                                <TableRow
                                  className={hasCompleted ? 'cursor-pointer hover:bg-muted/50' : ''}
                                  onClick={() => hasCompleted && toggleEmployeeDetail(employee.userId)}
                                >
                                  <TableCell className="px-2">
                                    {hasCompleted && (
                                      isExpanded
                                        ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                        : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                    )}
                                  </TableCell>
                                  <TableCell className="font-medium">{employee.userName}</TableCell>
                                  <TableCell className="text-muted-foreground">{employee.email}</TableCell>
                                  <TableCell className="text-muted-foreground">{employee.department || '—'}</TableCell>
                                  <TableCell>
                                    <StatusBadge status={employee.status} />
                                  </TableCell>
                                  <TableCell>
                                    <RiskBadge riskLevel={employee.riskLevel} />
                                  </TableCell>
                                  <TableCell>{employee.assessmentCount}</TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {employee.completedAt
                                      ? new Date(employee.completedAt).toLocaleDateString('en-GB', {
                                          day: 'numeric',
                                          month: 'short',
                                          year: 'numeric',
                                        })
                                      : '—'}
                                  </TableCell>
                                </TableRow>
                                {isExpanded && (
                                  <TableRow>
                                    <TableCell colSpan={8} className="bg-muted/30 p-0">
                                      <EmployeeDetailPanel
                                        detail={employeeDetail}
                                        loading={detailLoading}
                                        error={detailError}
                                        onRetry={() => fetchEmployeeDetail(employee.userId)}
                                      />
                                    </TableCell>
                                  </TableRow>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </div>
    </Layout>
  );
}

function EmployeeDetailPanel({ detail, loading, error, onRetry }: { detail: EmployeeDetail | null; loading: boolean; error: string | null; onRetry: () => void }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
        <span className="text-sm text-muted-foreground">Loading assessment details...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center gap-3 py-6">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <span className="text-sm text-destructive">{error}</span>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3 w-3 mr-1" />
          Retry
        </Button>
      </div>
    );
  }

  if (!detail || detail.assessments.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-muted-foreground">
        No assessment data available for this employee.
      </div>
    );
  }

  return (
    <div className="px-6 py-4 space-y-4">
      {detail.assessments.map((assessment) => {
        const answerCount = Object.keys(assessment.answers).length;
        return (
          <div key={assessment.id} className="rounded-lg border bg-background p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">{assessment.title || 'Assessment'}</span>
              </div>
              <Badge variant="secondary" className="text-xs">{assessment.status}</Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground block text-xs">Answers</span>
                <span className="font-medium">{answerCount}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">Started</span>
                <span className="font-medium">
                  {new Date(assessment.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">Submitted</span>
                <span className="font-medium">
                  {assessment.submittedAt
                    ? new Date(assessment.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                    : '—'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">ID</span>
                <span className="font-mono text-xs text-muted-foreground">{assessment.id.slice(0, 8)}...</span>
              </div>
            </div>
          </div>
        );
      })}
      {detail.keypasses.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {detail.keypasses.length} key-pass{detail.keypasses.length !== 1 ? 'es' : ''} associated
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <Badge className="bg-success/10 text-success border-success/20">Completed</Badge>;
    case 'in-progress':
      return <Badge className="bg-primary/10 text-primary border-primary/20">In Progress</Badge>;
    case 'not-started':
      return <Badge variant="secondary">Not Started</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function RiskBadge({ riskLevel }: { riskLevel: string | null }) {
  if (!riskLevel) return <span className="text-muted-foreground">—</span>;
  switch (riskLevel) {
    case 'high':
      return <Badge className="bg-destructive/10 text-destructive border-destructive/20">High</Badge>;
    case 'medium':
      return <Badge className="bg-warning/10 text-warning border-warning/20">Medium</Badge>;
    case 'low':
      return <Badge className="bg-success/10 text-success border-success/20">Low</Badge>;
    default:
      return <Badge variant="secondary">{riskLevel}</Badge>;
  }
}
