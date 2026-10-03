// Banding follows docs/COMPLIANCE.md: High 15-25, Medium 8-14, Low 1-7 (impact × likelihood).
function heatCellClass(impact: number, likelihood: number) {
  const score = impact * likelihood;
  if (score >= 15) return 'bg-destructive/20';
  if (score >= 8) return 'bg-amber-200/60 dark:bg-amber-900/50';
  return 'bg-emerald-200/60 dark:bg-emerald-900/40';
}

/** 5×5 inherent-risk grid; heatMap[impact-1][likelihood-1] holds the number of open risks. */
export function RiskHeatMap({ heatMap }: { heatMap: number[][] }) {
  return (
    <div className="grid w-fit grid-cols-[auto_repeat(5,2.25rem)] gap-1 text-xs" role="table" aria-label="Risk heat map">
      {[5, 4, 3, 2, 1].map((impact) => (
        <div key={impact} className="contents" role="row">
          <span className="pr-2 self-center text-muted-foreground" role="rowheader">{impact}</span>
          {[1, 2, 3, 4, 5].map((likelihood) => {
            const count = heatMap[impact - 1]?.[likelihood - 1] ?? 0;
            return (
              <span
                key={likelihood}
                role="cell"
                aria-label={`Impact ${impact}, likelihood ${likelihood}: ${count} risks`}
                className={`h-9 rounded flex items-center justify-center font-medium ${heatCellClass(impact, likelihood)}`}
              >
                {count || ''}
              </span>
            );
          })}
        </div>
      ))}
      <span />
      {[1, 2, 3, 4, 5].map((l) => <span key={l} className="text-center text-muted-foreground">{l}</span>)}
    </div>
  );
}
