import { ReactNode, useId } from 'react';

interface ChartFigureProps {
  /** One sentence giving the main point of the chart, read first by screen readers (WCAG 1.1.1) */
  summary: string;
  /** Table caption, e.g. "Risk score by module" */
  caption: string;
  /** Headings: the first column names each row, the others hold its figures */
  columns: string[];
  /** One row per bar or slice, in the same order as the columns */
  rows: Array<Array<string | number>>;
  /** The chart itself: hidden from screen readers, which get the summary and the table instead */
  children: ReactNode;
}

/**
 * Wraps a chart with a text alternative: a summary sentence for screen readers and the chart's figures
 * as a table that anyone can open under the chart.
 * Give Recharts charts `accessibilityLayer={false}` and pies `rootTabIndex={-1}`: otherwise the hidden chart stays in the tab order.
 */
export function ChartFigure({ summary, caption, columns, rows, children }: ChartFigureProps) {
  const summaryId = useId();
  return (
    // aria-labelledby as well as figcaption: not every screen reader names a figure from its caption
    <figure aria-labelledby={summaryId}>
      <div aria-hidden="true">{children}</div>
      <figcaption id={summaryId} className="sr-only">{summary}</figcaption>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-primary underline underline-offset-4">
          Show the figures as a table
          <span className="sr-only">: {caption}</span>
        </summary>
        <table className="mt-2 w-full border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th key={c} scope="col" className={`border-b py-1 pr-4 font-semibold ${i > 0 ? 'text-right' : ''}`}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, ...values]) => (
              <tr key={String(label)}>
                <th scope="row" className="border-b py-1 pr-4 font-normal">{label}</th>
                {values.map((v, i) => (
                  <td key={i} className="border-b py-1 pr-4 text-right tabular-nums">{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
