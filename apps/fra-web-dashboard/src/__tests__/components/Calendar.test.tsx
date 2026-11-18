import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Calendar } from '@/components/ui/calendar';

describe('Calendar', () => {
  it('navigates months and selects dates using DayPicker 9 controls', async () => {
    const onSelect = vi.fn();
    render(<Calendar mode="single" defaultMonth={new Date(2026, 0, 1)} onSelect={onSelect} />);
    expect(screen.getByText('January 2026')).toBeInTheDocument();
    const next = screen.getByRole('button', { name: /next month/i });
    expect(next.querySelector('svg')).toHaveClass('lucide-chevron-right');
    expect(next).toHaveClass('h-7');
    await userEvent.click(next);
    expect(screen.getByText('February 2026')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Sunday, February 15th, 2026/i }));
    expect(onSelect).toHaveBeenCalledWith(new Date(2026, 1, 15), expect.any(Date), expect.any(Object), expect.any(Object));
    const previous = screen.getByRole('button', { name: /previous month/i });
    expect(previous.querySelector('svg')).toHaveClass('lucide-chevron-left');
    await userEvent.click(previous);
    expect(screen.getByText('January 2026')).toBeInTheDocument();
  });
});
