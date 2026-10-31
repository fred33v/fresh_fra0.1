import { render, screen } from '@testing-library/react';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';

// jsdom has no ResizeObserver, which the Radix slider needs
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

describe('accessible names and values on shared controls', () => {
  it('progress bar exposes its value to screen readers', () => {
    render(<Progress value={40} aria-label="Assessment progress" />);
    expect(screen.getByRole('progressbar', { name: 'Assessment progress' })).toHaveAttribute('aria-valuenow', '40');
  });

  it('slider thumb, the part that takes focus, is named by the question', () => {
    render(<><p id="q1">How many staff?</p><Slider aria-labelledby="q1" value={[3]} min={0} max={20} /></>);
    expect(screen.getByRole('slider', { name: 'How many staff?' })).toBeInTheDocument();
  });

  it('budget guide page can be lazy-loaded (default export)', async () => {
    const mod = await import('@/pages/BudgetGuide');
    expect(typeof mod.default).toBe('function');
  });
});
