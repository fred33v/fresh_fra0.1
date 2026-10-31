import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { BUDGET_HOLDER_REQUIRED_PARTS, type BudgetHolderProgress } from '@/lib/budget-holder';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Wallet } from 'lucide-react';

const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

/** Enterprise: the budget holder programme on the dashboard, marked as required when the employer asks for it. */
export function BudgetHolderCard() {
  const [me, setMe] = useState<BudgetHolderProgress | null>(null);

  useEffect(() => {
    api.get<BudgetHolderProgress>('/api/v1/budget-holder/me').then(setMe).catch(() => setMe(null));
  }, []);

  if (!me) return null;
  const total = BUDGET_HOLDER_REQUIRED_PARTS;
  const done = me.requiredPartsDone;
  const todo = me.status !== 'completed';

  return (
    <Card className={`mb-6 ${me.required && todo ? 'border-destructive/40' : ''}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
          <Wallet className="h-5 w-5 text-accent" aria-hidden="true" />
          Budget holder programme
          {me.required && <Badge variant={todo ? 'destructive' : 'default'}>Required by your employer</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1 text-sm">
          {me.status === 'completed' && <p>Completed on {formatDate(me.completedAt)}. Renew by {formatDate(me.renewalDueAt)}.</p>}
          {me.status === 'renewal_due' && <p>Your yearly renewal is due.</p>}
          {me.status === 'not_started' && <p>For everyone who approves spending: legal duties, real fraud cases, what to check, how to report, and your signed commitment.</p>}
          {me.status === 'in_progress' && (
            <div className="flex items-center gap-3">
              <Progress value={(done / total) * 100} className="h-2 w-40" aria-label={`${done} of ${total} parts done`} />
              <span>{done} of {total} parts done</span>
            </div>
          )}
        </div>
        <Button asChild variant={todo ? 'default' : 'outline'} size="sm">
          <Link to="/budget-holder">
            {me.status === 'completed' ? 'Review the programme' : me.status === 'renewal_due' ? 'Renew now' : me.status === 'in_progress' ? 'Continue the programme' : 'Start the programme'}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
