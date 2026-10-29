import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuestionRenderer } from '@/components/assessment/QuestionRenderer';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    button: ({ children, whileHover: _h, whileTap: _t, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & Record<string, unknown>) => <button {...props}>{children}</button>,
  },
}));

function renderQuestion(question: Parameters<typeof QuestionRenderer>[0]['question'], value?: unknown, onChange = vi.fn()) {
  render(
    <>
      <p id="q-label">{question.text}</p>
      <QuestionRenderer question={question} value={value} onChange={onChange} labelledBy="q-label" />
    </>,
  );
  return onChange;
}

describe('QuestionRenderer accessibility', () => {
  it('names a scale by its question and says which answer is selected', async () => {
    const onChange = renderQuestion({ id: 'riskAppetite.tolerance', text: 'How would you rate your tolerance?', type: 'scale' }, 3);

    const group = screen.getByRole('group', { name: 'How would you rate your tolerance?' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '4' })).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(screen.getByRole('button', { name: '5' }));
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it('says which end of a 1 to 5 scale is which, so nobody has to guess the best answer', () => {
    renderQuestion({
      id: 'procurement.controlMaturity', text: 'How mature are your purchasing approval controls?', type: 'scale',
      metadata: { min: 1, max: 5, scaleLabels: ['Very weak', 'Very strong'] },
    });

    expect(screen.getByText('1 = Very weak')).toBeVisible();
    expect(screen.getByText('5 = Very strong')).toBeVisible();
    // Screen readers hear the ends when they reach the group
    const group = screen.getByRole('group', { name: 'How mature are your purchasing approval controls?' });
    expect(group).toHaveAccessibleDescription('1 = Very weak 5 = Very strong');
  });

  it('shows no end labels when the question has none', () => {
    renderQuestion({ id: 'x.y', text: 'Rate it', type: 'scale' });
    expect(screen.queryByText(/ = /)).not.toBeInTheDocument();
  });

  it('names yes/no answers by their question and exposes the choice', () => {
    renderQuestion({ id: 'fraudResponse.responsePlan', text: 'Do you have a documented fraud response plan?', type: 'yesno' }, 'no');

    expect(screen.getByRole('group', { name: 'Do you have a documented fraud response plan?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Yes' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('labels radio options, including ones with spaces, and the group by its question', () => {
    renderQuestion({
      id: 'fraudResponse.responseSpeed', text: 'How quickly do you act?', type: 'frequency',
      responseOptions: ['Within 24 hours', 'Within a week'],
    });

    expect(screen.getByRole('radiogroup', { name: 'How quickly do you act?' })).toBeInTheDocument();
    const option = screen.getByRole('radio', { name: 'Within 24 hours' });
    expect(option.id).toBe('fraudResponse-responseSpeed-Within-24-hours');
  });

  it('labels the amount box with its question', () => {
    renderQuestion({ id: 'fraudResponse.lossesLastThreeYears', text: 'What fraud losses have been identified?', type: 'currency' });
    expect(screen.getByRole('spinbutton', { name: 'What fraud losses have been identified?' })).toBeInTheDocument();
  });
});
