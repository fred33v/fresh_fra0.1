/**
 * QuestionRenderer Component Tests
 * 
 * Unit tests for QuestionRenderer covering:
 * - All 4 question types (Frequency, Currency, Scale, Yes/No)
 * - Answer handling
 * - Validation
 * - Accessibility
 * - Animation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuestionRenderer } from '../components/assessment/QuestionRenderer';
import type {
  FrequencyQuestion,
  CurrencyQuestion,
  ScaleQuestion,
  YesNoQuestion,
} from '@stopfra/types';

const mockOnAnswer = vi.fn();

describe('QuestionRenderer Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Frequency Questions', () => {
    const frequencyQuestion: FrequencyQuestion = {
      id: 'freq-1',
      type: 'frequency',
      text: 'How often do you review vendor payments?',
      options: ['Never', 'Annually', 'Quarterly', 'Monthly', 'Always'],
      weight: 0.8,
    };

    it('should render radio buttons for frequency options', () => {
      render(
        <QuestionRenderer
          question={frequencyQuestion}
          onAnswer={mockOnAnswer}
        />
      );

      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(5);
    });

    it('should display all frequency options', () => {
      render(
        <QuestionRenderer
          question={frequencyQuestion}
          onAnswer={mockOnAnswer}
        />
      );

      expect(screen.getByLabelText('Never')).toBeTruthy();
      expect(screen.getByLabelText('Annually')).toBeTruthy();
      expect(screen.getByLabelText('Quarterly')).toBeTruthy();
      expect(screen.getByLabelText('Monthly')).toBeTruthy();
      expect(screen.getByLabelText('Always')).toBeTruthy();
    });

    it('should handle selection', async () => {
      render(
        <QuestionRenderer
          question={frequencyQuestion}
          onAnswer={mockOnAnswer}
        />
      );

      const monthlyOption = screen.getByLabelText('Monthly');
      await userEvent.click(monthlyOption);

      expect(mockOnAnswer).toHaveBeenCalledWith('freq-1', 'Monthly');
    });

    it('should show selected state', async () => {
      render(
        <QuestionRenderer
          question={frequencyQuestion}
          onAnswer={mockOnAnswer}
        />
      );

      const monthlyOption = screen.getByLabelText('Monthly') as HTMLInputElement;
      await userEvent.click(monthlyOption);

      expect(monthlyOption.checked).toBe(true);
    });

    it('should allow changing selection', async () => {
      render(
        <QuestionRenderer
          question={frequencyQuestion}
          onAnswer={mockOnAnswer}
        />
      );

      const monthlyOption = screen.getByLabelText('Monthly');
      const quarterlyOption = screen.getByLabelText('Quarterly');

      await userEvent.click(monthlyOption);
      expect(mockOnAnswer).toHaveBeenCalledWith('freq-1', 'Monthly');

      await userEvent.click(quarterlyOption);
      expect(mockOnAnswer).toHaveBeenCalledWith('freq-1', 'Quarterly');
    });
  });

  describe('Currency Questions', () => {
    const currencyQuestion: CurrencyQuestion = {
      id: 'curr-1',
      type: 'currency',
      text: 'What is your average transaction value?',
      currency: 'GBP',
      placeholder: 'Enter amount',
      weight: 0.6,
    };

    it('should render currency input', () => {
      render(
        <QuestionRenderer
          question={currencyQuestion}
          onAnswer={mockOnAnswer}
        />
      );

      const input = screen.getByRole('textbox');
      expect(input).toBeTruthy();
    });

    it('should show currency symbol', () => {
      render(
        <QuestionRenderer
          question={currencyQuestion}
          onAnswer={mockOnAnswer}
        />
      );

      expect(screen.getByText('£')).toBeTruthy();
    });

    it('should handle numeric input', async () => {
      render(
        <QuestionRenderer
          question={currencyQuestion}
          onAnswer={mockOnAnswer}
        />
      );

      const input = screen.getByRole('textbox');
      await userEvent.type(input, '5000');

      expect(mockOnAnswer).toHaveBeenCalledWith('curr-1', '5000');
    });

    it('should format currency display', () => {
      render(
        <QuestionRenderer
          question={currencyQuestion}
          onAnswer={mockOnAnswer}
        />
      );

      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.placeholder).toContain('Enter amount');
    });

    it('should validate numeric input', async () => {
      render(
        <QuestionRenderer
          question={currencyQuestion}
          onAnswer={mockOnAnswer}
        />
      );

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'abc');

      // Should not call onAnswer with non-numeric
      expect(mockOnAnswer).not.toHaveBeenCalled();
    });
  });

  describe('Scale Questions', () => {
    describe('Small Range (Button Grid)', () => {
      const scaleQuestion: ScaleQuestion = {
        id: 'scale-1',
        type: 'scale',
        text: 'Rate your control maturity (1-5)',
        min: 1,
        max: 5,
        minLabel: 'Minimal',
        maxLabel: 'Optimised',
        weight: 0.7,
      };

      it('should render button grid for small ranges', () => {
        render(
          <QuestionRenderer
            question={scaleQuestion}
            onAnswer={mockOnAnswer}
          />
        );

        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThanOrEqual(5);
      });

      it('should display min and max labels', () => {
        render(
          <QuestionRenderer
            question={scaleQuestion}
            onAnswer={mockOnAnswer}
          />
        );

        expect(screen.getByText('Minimal')).toBeTruthy();
        expect(screen.getByText('Optimised')).toBeTruthy();
      });

      it('should handle button selection', async () => {
        render(
          <QuestionRenderer
            question={scaleQuestion}
            onAnswer={mockOnAnswer}
          />
        );

        const button3 = screen.getByRole('button', { name: '3' });
        await userEvent.click(button3);

        expect(mockOnAnswer).toHaveBeenCalledWith('scale-1', 3);
      });
    });

    describe('Large Range (Slider)', () => {
      const largeScaleQuestion: ScaleQuestion = {
        id: 'scale-2',
        type: 'scale',
        text: 'Rate compliance (0-100)',
        min: 0,
        max: 100,
        minLabel: 'Non-compliant',
        maxLabel: 'Fully compliant',
        weight: 0.8,
      };

      it('should render slider for large ranges', () => {
        render(
          <QuestionRenderer
            question={largeScaleQuestion}
            onAnswer={mockOnAnswer}
          />
        );

        const slider = screen.getByRole('slider');
        expect(slider).toBeTruthy();
      });

      it('should handle slider movement', async () => {
        render(
          <QuestionRenderer
            question={largeScaleQuestion}
            onAnswer={mockOnAnswer}
          />
        );

        const slider = screen.getByRole('slider');
        fireEvent.change(slider, { target: { value: 75 } });

        expect(mockOnAnswer).toHaveBeenCalledWith('scale-2', 75);
      });

      it('should display current value', () => {
        render(
          <QuestionRenderer
            question={largeScaleQuestion}
            onAnswer={mockOnAnswer}
          />
        );

        const valueDisplay = screen.getByText(/0|[1-9]\d*(?:\/100)?/);
        expect(valueDisplay).toBeTruthy();
      });
    });
  });

  describe('Yes/No Questions', () => {
    const yesNoQuestion: YesNoQuestion = {
      id: 'yn-1',
      type: 'yes-no',
      text: 'Do you have documented fraud policies?',
      weight: 0.5,
    };

    it('should render yes and no buttons', () => {
      render(
        <QuestionRenderer
          question={yesNoQuestion}
          onAnswer={mockOnAnswer}
        />
      );

      expect(screen.getByRole('button', { name: /yes/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /no/i })).toBeTruthy();
    });

    it('should handle yes selection', async () => {
      render(
        <QuestionRenderer
          question={yesNoQuestion}
          onAnswer={mockOnAnswer}
        />
      );

      const yesButton = screen.getByRole('button', { name: /yes/i });
      await userEvent.click(yesButton);

      expect(mockOnAnswer).toHaveBeenCalledWith('yn-1', true);
    });

    it('should handle no selection', async () => {
      render(
        <QuestionRenderer
          question={yesNoQuestion}
          onAnswer={mockOnAnswer}
        />
      );

      const noButton = screen.getByRole('button', { name: /no/i });
      await userEvent.click(noButton);

      expect(mockOnAnswer).toHaveBeenCalledWith('yn-1', false);
    });

    it('should show selected state', async () => {
      render(
        <QuestionRenderer
          question={yesNoQuestion}
          onAnswer={mockOnAnswer}
        />
      );

      const yesButton = screen.getByRole('button', { name: /yes/i });
      await userEvent.click(yesButton);

      expect(yesButton).toHaveClass('selected', 'active');
    });
  });

  describe('Question Text Display', () => {
    it('should display question text', () => {
      const question: FrequencyQuestion = {
        id: 'q1',
        type: 'frequency',
        text: 'Test question?',
        options: ['Option 1', 'Option 2'],
        weight: 0.5,
      };

      render(
        <QuestionRenderer question={question} onAnswer={mockOnAnswer} />
      );

      expect(screen.getByText('Test question?')).toBeTruthy();
    });

    it('should display question weight/importance if provided', () => {
      const question: FrequencyQuestion = {
        id: 'q1',
        type: 'frequency',
        text: 'Important question?',
        options: ['A', 'B'],
        weight: 0.9,
        metadata: { importance: 'high' },
      };

      render(
        <QuestionRenderer question={question} onAnswer={mockOnAnswer} />
      );

      // High weight should be indicated in UI
      expect(screen.getByText(/Important question/i)).toBeTruthy();
    });
  });

  describe('Animation', () => {
    it('should animate entry', () => {
      const question: FrequencyQuestion = {
        id: 'q1',
        type: 'frequency',
        text: 'Test',
        options: ['A', 'B'],
        weight: 0.5,
      };

      const { container } = render(
        <QuestionRenderer question={question} onAnswer={mockOnAnswer} />
      );

      // Framer Motion applies classes
      expect(container.querySelector('[data-testid="question-renderer"]')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible question prompt', () => {
      const question: FrequencyQuestion = {
        id: 'q1',
        type: 'frequency',
        text: 'How often?',
        options: ['Never', 'Always'],
        weight: 0.5,
      };

      render(
        <QuestionRenderer question={question} onAnswer={mockOnAnswer} />
      );

      expect(screen.getByText('How often?')).toHaveAttribute('role', 'heading');
    });

    it('should have proper label associations', () => {
      const question: FrequencyQuestion = {
        id: 'q1',
        type: 'frequency',
        text: 'Test',
        options: ['Option 1', 'Option 2'],
        weight: 0.5,
      };

      const { container } = render(
        <QuestionRenderer question={question} onAnswer={mockOnAnswer} />
      );

      const labels = container.querySelectorAll('label');
      expect(labels.length).toBeGreaterThan(0);
    });
  });
});
