import { useEffect, useState, type ComponentType } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpenCheck, CheckCircle2, Circle } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { GUIDE_STEPS } from '@/data/budgetHolderGuide/content';
import {
  AuthoritySection, ChecklistsSection, FraudBasicsSection, LegalSection, MythsSection, PledgeSection,
  RedFlagsSection, ReportingSection, ResourcesSection, ScenariosSection, WhistleblowingSection,
} from '@/components/guide/GuideSections';
import { readLocal, writeLocal } from '@/lib/localPrefs';

const PROGRESS_KEY = 'guide.read';

const SECTIONS: Record<string, ComponentType> = {
  legal: LegalSection,
  'fraud-basics': FraudBasicsSection,
  scenarios: ScenariosSection,
  'red-flags': RedFlagsSection,
  checklists: ChecklistsSection,
  authority: AuthoritySection,
  reporting: ReportingSection,
  whistleblowing: WhistleblowingSection,
  myths: MythsSection,
  pledge: PledgeSection,
  resources: ResourcesSection,
};

/**
 * The budget-holder guide, open to everyone: what budget-holders need to know to
 * spot and prevent fraud in the spending they approve. Reading progress is kept on
 * this device; the pledge is recorded on the server when signed in.
 */
export default function BudgetHolderGuide() {
  const { step } = useParams<{ step?: string }>();
  const [read, setRead] = useState<string[]>(() => readLocal<string[]>(PROGRESS_KEY, []));
  const index = step ? GUIDE_STEPS.findIndex((s) => s.slug === step) : -1;
  const current = index >= 0 ? GUIDE_STEPS[index] : null;

  useEffect(() => {
    if (current) window.scrollTo({ top: 0 });
    if (current && !read.includes(current.slug)) {
      const next = [...read, current.slug];
      setRead(next);
      writeLocal(PROGRESS_KEY, next);
    }
  }, [current, read]);

  if (step && !current) return <Navigate to="/guide" replace />;

  const percent = Math.round((read.filter((r) => GUIDE_STEPS.some((s) => s.slug === r)).length / GUIDE_STEPS.length) * 100);

  if (!current) {
    const firstUnread = GUIDE_STEPS.find((s) => !read.includes(s.slug)) ?? GUIDE_STEPS[0];
    return (
      <Layout>
        <div className="container max-w-3xl py-8 lg:py-12 space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <BookOpenCheck className="h-8 w-8 text-primary" aria-hidden="true" />Budget-holder guide
            </h1>
            <p className="mt-2 text-muted-foreground">
              What you need to know to spot and stop fraud in the spending you approve: your legal duties, real scenarios,
              red flags, approval checklists and how to report concerns.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span>Your progress</span><span>{percent}%</span></div>
            <Progress value={percent} aria-label={`Guide progress ${percent}%`} />
          </div>
          <Button asChild size="lg">
            <Link to={`/guide/${firstUnread.slug}`}>{read.length ? 'Continue the guide' : 'Start the guide'}<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Link>
          </Button>
          <ol className="grid gap-3">
            {GUIDE_STEPS.map((s, i) => {
              const done = read.includes(s.slug);
              return (
                <li key={s.slug}>
                  <Link to={`/guide/${s.slug}`} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Card className="hover:shadow-md transition-shadow">
                      <CardContent className="flex items-center gap-4 p-4">
                        {done
                          ? <CheckCircle2 className="h-5 w-5 text-success shrink-0" aria-label="Read" />
                          : <Circle className="h-5 w-5 text-muted-foreground shrink-0" aria-label="Not read yet" />}
                        <div>
                          <div className="font-medium">{i + 1}. {s.title}</div>
                          <div className="text-sm text-muted-foreground">{s.summary}</div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      </Layout>
    );
  }

  const Section = SECTIONS[current.slug];
  const prev = GUIDE_STEPS[index - 1];
  const next = GUIDE_STEPS[index + 1];

  return (
    <Layout>
      <div className="container max-w-4xl py-8 lg:py-12 space-y-6">
        <nav aria-label="Breadcrumb" className="text-sm">
          <Link to="/guide" className="text-primary hover:underline">Budget-holder guide</Link>
          <span className="text-muted-foreground"> · Step {index + 1} of {GUIDE_STEPS.length}</span>
        </nav>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{current.title}</h1>
          <p className="mt-1 text-muted-foreground">{current.summary}</p>
        </div>
        <Section />
        <nav aria-label="Guide steps" className="flex flex-wrap justify-between gap-3 border-t pt-6">
          {prev ? (
            <Button variant="outline" asChild><Link to={`/guide/${prev.slug}`}><ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />{prev.title}</Link></Button>
          ) : <span />}
          {next ? (
            <Button asChild><Link to={`/guide/${next.slug}`}>{next.title}<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Link></Button>
          ) : (
            <Button asChild><Link to="/guide">Back to the guide</Link></Button>
          )}
        </nav>
      </div>
    </Layout>
  );
}
