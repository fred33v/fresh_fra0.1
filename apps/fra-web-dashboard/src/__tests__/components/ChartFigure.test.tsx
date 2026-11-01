import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChartFigure } from '@/components/ChartFigure';

describe('ChartFigure', () => {
  const renderFigure = () => render(
    <ChartFigure
      summary="Chart: Staff by risk level, 3 staff. High: 1, Low: 2."
      caption="Staff by risk level"
      columns={['Risk level', 'Staff']}
      rows={[['High', 1], ['Low', 2]]}
    >
      <svg data-testid="chart" />
    </ChartFigure>,
  );

  it('names the figure with the summary and hides the chart drawing from screen readers', () => {
    renderFigure();
    expect(screen.getByRole('figure', { name: /Staff by risk level, 3 staff\. High: 1, Low: 2\./ })).toBeInTheDocument();
    expect(screen.getByTestId('chart').parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  it('gives the figures as a table with row and column headers', () => {
    renderFigure();
    expect(screen.getByText('Show the figures as a table')).toBeInTheDocument();
    const table = screen.getByRole('table', { hidden: true, name: 'Staff by risk level' });
    expect(table).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader', { hidden: true }).map(h => h.textContent)).toEqual(['Risk level', 'Staff']);
    expect(screen.getAllByRole('rowheader', { hidden: true }).map(h => h.textContent)).toEqual(['High', 'Low']);
  });
});
