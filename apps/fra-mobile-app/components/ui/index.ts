/**
 * UI Component Library - Stop FRA
 *
 * Centralized export of all reusable UI components
 * Reduces 800+ lines of duplicate code across assessment screens
 */

// Form Components
export { RadioOption } from './RadioOption';
export type { RadioOptionProps } from './RadioOption';

export { QuestionGroup } from './QuestionGroup';
export type { QuestionGroupProps, QuestionOption } from './QuestionGroup';

export { ScaleQuestion } from './ScaleQuestion';
export type { ScaleQuestionProps } from './ScaleQuestion';

export { CurrencyQuestion } from './CurrencyQuestion';
export type { CurrencyQuestionProps } from './CurrencyQuestion';

export { YesNoQuestion } from './YesNoQuestion';
export type { YesNoQuestionProps } from './YesNoQuestion';

export { TextArea } from './TextArea';
export type { TextAreaProps } from './TextArea';

// Button Components
export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';

// Layout Components
export { AssessmentScreen } from './AssessmentScreen';
export type { AssessmentScreenProps } from './AssessmentScreen';
