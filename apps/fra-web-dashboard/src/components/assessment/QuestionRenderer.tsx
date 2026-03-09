/**
 * QuestionRenderer Component
 * 
 * Renders different question types based on the backend question definition:
 * - frequency: Dropdown or radio selection (how often?)
 * - currency: Number input with currency formatting (how much?)
 * - scale: Numbered scale/slider (1-5, 1-10, etc.)
 * - yesno: Yes/No toggle or radio buttons
 * 
 * Integrates with @stopfra/ui-core component tokens for consistent styling
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface Question {
  id: string;
  text: string;
  type: 'frequency' | 'currency' | 'scale' | 'yesno';
  weight?: number;
  responseOptions?: string[];
  metadata?: {
    min?: number;
    max?: number;
    step?: number;
    scaleLabels?: string[];
    currency?: string;
  };
}

interface QuestionRendererProps {
  question: Question;
  value?: unknown;
  onChange: (value: unknown) => void;
}

/**
 * Frequency question: How often does this occur?
 * Common options: Never, Rarely, Sometimes, Often, Always
 */
function FrequencyQuestion({ question, value, onChange }: QuestionRendererProps) {
  const options = question.responseOptions || [
    'Never',
    'Rarely',
    'Sometimes',
    'Often',
    'Always',
  ];

  return (
    <RadioGroup value={value || ''} onValueChange={onChange}>
      <div className="space-y-3">
        {options.map((option) => (
          <div key={option} className="flex items-center space-x-2">
            <RadioGroupItem value={option} id={`${question.id}-${option}`} />
            <Label htmlFor={`${question.id}-${option}`} className="font-normal cursor-pointer">
              {option}
            </Label>
          </div>
        ))}
      </div>
    </RadioGroup>
  );
}

/**
 * Currency question: What is the monetary value?
 * Input field with currency formatting (e.g., £, $, €)
 */
function CurrencyQuestion({ question, value, onChange }: QuestionRendererProps) {
  const currency = question.metadata?.currency || '£';
  const [displayValue, setDisplayValue] = useState(
    value ? `${value}` : ''
  );

  useEffect(() => {
    setDisplayValue(value ? `${value}` : '');
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/[^\d.]/g, '');
    setDisplayValue(cleaned);
    onChange(cleaned ? parseFloat(cleaned) : undefined);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-lg font-medium text-muted-foreground">{currency}</span>
      <Input
        type="number"
        placeholder="0.00"
        value={displayValue}
        onChange={handleChange}
        className="font-mono"
        min="0"
        step="0.01"
      />
    </div>
  );
}

/**
 * Scale question: Rate on a numeric scale
 * Uses a slider or button grid depending on scale range
 */
function ScaleQuestion({ question, value, onChange }: QuestionRendererProps) {
  const min = question.metadata?.min || 1;
  const max = question.metadata?.max || 5;
  const step = question.metadata?.step || 1;
  const labels = question.metadata?.scaleLabels || [];

  // Use slider for larger ranges
  if (max - min > 5) {
    return (
      <div className="space-y-4 py-4">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{min}</span>
          <span className="text-lg font-semibold text-primary">{value || '—'}</span>
          <span>{max}</span>
        </div>
        <Slider
          value={[value || min]}
          onValueChange={(vals) => onChange(vals[0])}
          min={min}
          max={max}
          step={step}
          className="w-full"
        />
        {labels.length > 0 && (
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            {labels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Use button grid for smaller ranges
  return (
    <div className="grid grid-cols-5 gap-2">
      {Array.from({ length: max - min + 1 }).map((_, idx) => {
        const buttonValue = min + idx;
        const isSelected = value === buttonValue;

        return (
          <motion.button
            key={buttonValue}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onChange(buttonValue)}
            className={`py-3 rounded-lg font-semibold transition-all ${
              isSelected
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-muted hover:bg-muted-foreground/20'
            }`}
          >
            {buttonValue}
          </motion.button>
        );
      })}
    </div>
  );
}

/**
 * Yes/No question: Simple binary choice
 */
function YesNoQuestion({ value, onChange }: Omit<QuestionRendererProps, 'question'>) {
  return (
    <div className="flex items-center gap-4">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onChange('yes')}
        className={`px-6 py-3 rounded-lg font-medium transition-all ${
          value === 'yes'
            ? 'bg-success text-success-foreground shadow-md'
            : 'bg-muted hover:bg-muted-foreground/20'
        }`}
      >
        Yes
      </motion.button>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onChange('no')}
        className={`px-6 py-3 rounded-lg font-medium transition-all ${
          value === 'no'
            ? 'bg-destructive text-destructive-foreground shadow-md'
            : 'bg-muted hover:bg-muted-foreground/20'
        }`}
      >
        No
      </motion.button>
    </div>
  );
}

/**
 * Main renderer component
 * Routes to appropriate question type component
 */
export function QuestionRenderer({ question, value, onChange }: QuestionRendererProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mt-4"
    >
      {question.type === 'frequency' && (
        <FrequencyQuestion question={question} value={value} onChange={onChange} />
      )}

      {question.type === 'currency' && (
        <CurrencyQuestion question={question} value={value} onChange={onChange} />
      )}

      {question.type === 'scale' && (
        <ScaleQuestion question={question} value={value} onChange={onChange} />
      )}

      {question.type === 'yesno' && (
        <YesNoQuestion question={question} value={value} onChange={onChange} />
      )}

      {/* Help text for weight/importance */}
      {question.weight && (
        <div className="mt-3 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-xs">
            Weight: {question.weight}
          </Badge>
        </div>
      )}
    </motion.div>
  );
}
