import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { LEGAL } from '@/lib/legal';

export type LegalSection = { id: string; title: string; body: ReactNode };

type LegalPageProps = {
  title: string;
  intro: ReactNode;
  sections: LegalSection[];
  /** Defaults to the legal texts' date */
  lastUpdated?: string;
  /** The draft banner is for the texts awaiting legal review; other pages can turn it off */
  draftNotice?: boolean;
};

/** A readable long-form page: contents list, numbered sections, and the draft notice until legal review. */
export function LegalPage({ title, intro, sections, lastUpdated = LEGAL.lastUpdated, draftNotice = true }: LegalPageProps) {
  return (
    <Layout>
      <div className="container max-w-3xl py-10 lg:py-14">
        {draftNotice && !LEGAL.reviewed && (
          <div role="note" className="mb-8 flex gap-3 rounded-md border border-amber-500/60 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
            <p>
              <strong>Draft for legal review.</strong> This text has not yet been approved and may change before the service launches.
            </p>
          </div>
        )}
        <h1 className="text-3xl font-bold tracking-tight mb-2">{title}</h1>
        <p className="text-sm text-muted-foreground mb-6">Last updated {lastUpdated}</p>
        <div className="space-y-4 text-base leading-relaxed">{intro}</div>

        <nav aria-label="Contents" className="my-8 rounded-md border p-4">
          <h2 className="text-sm font-semibold mb-2">Contents</h2>
          <ol className="list-decimal pl-5 space-y-1 text-sm">
            {sections.map((s) => <li key={s.id}><a href={`#${s.id}`} className="underline">{s.title}</a></li>)}
          </ol>
        </nav>

        {sections.map((s, i) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="mb-8 scroll-mt-20">
            <h2 id={`${s.id}-title`} className="text-xl font-semibold mb-3">{i + 1}. {s.title}</h2>
            <div className="space-y-3 leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_table]:w-full [&_table]:text-sm [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:p-2 [&_th]:text-left [&_th]:bg-muted">
              {s.body}
            </div>
          </section>
        ))}

        <p className="text-sm text-muted-foreground border-t pt-6">
          See also our <Link to="/privacy" className="underline">privacy notice</Link>, <Link to="/terms" className="underline">terms of service</Link> and <Link to="/accessibility" className="underline">accessibility statement</Link>.
        </p>
      </div>
    </Layout>
  );
}
