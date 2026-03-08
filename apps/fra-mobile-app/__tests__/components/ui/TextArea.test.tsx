/**
 * TextArea Component - Unit Tests
 *
 * Tests rendering, interaction, character counting, required indicator,
 * error display, maxLength, and accessibility for the TextArea component.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TextArea } from '@/components/ui/TextArea';

describe('TextArea', () => {
  const defaultProps = {
    label: 'Notes',
    value: '',
    onChangeText: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------

  describe('rendering', () => {
    it('should render the label', () => {
      const { getByText } = render(<TextArea {...defaultProps} />);

      expect(getByText('Notes')).toBeTruthy();
    });

    it('should render the hint when provided', () => {
      const { getByText } = render(
        <TextArea {...defaultProps} hint="Provide additional context" />,
      );

      expect(getByText('Provide additional context')).toBeTruthy();
    });

    it('should not render a hint when none is provided', () => {
      const { queryByText } = render(<TextArea {...defaultProps} />);

      expect(queryByText('Provide additional context')).toBeNull();
    });

    it('should render the required indicator when required is true', () => {
      const { getByText } = render(<TextArea {...defaultProps} required />);

      // The label renders with " *" appended as a child <Text>
      expect(getByText('*')).toBeTruthy();
    });

    it('should not render the required indicator when required is false', () => {
      const { queryByText } = render(<TextArea {...defaultProps} required={false} />);

      expect(queryByText('*')).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Interaction
  // -----------------------------------------------------------------------

  describe('interaction', () => {
    it('should call onChangeText when text is entered', () => {
      const onChangeText = jest.fn();
      const { getByPlaceholderText } = render(
        <TextArea {...defaultProps} onChangeText={onChangeText} />,
      );

      fireEvent.changeText(getByPlaceholderText('Enter details...'), 'hello');

      expect(onChangeText).toHaveBeenCalledWith('hello');
    });

    it('should display the current value', () => {
      const { getByDisplayValue } = render(
        <TextArea {...defaultProps} value="existing text" />,
      );

      expect(getByDisplayValue('existing text')).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // Character count
  // -----------------------------------------------------------------------

  describe('character count', () => {
    it('should show character count when showCount is true', () => {
      const { getByText } = render(
        <TextArea {...defaultProps} value="hello" showCount />,
      );

      expect(getByText('5')).toBeTruthy();
    });

    it('should show character count with maxLength denominator', () => {
      const { getByText } = render(
        <TextArea {...defaultProps} value="abc" maxLength={100} />,
      );

      // Renders "3 / 100"
      expect(getByText(/3/)).toBeTruthy();
      expect(getByText(/100/)).toBeTruthy();
    });

    it('should show 0 character count for an empty value with showCount', () => {
      const { getByText } = render(
        <TextArea {...defaultProps} value="" showCount />,
      );

      expect(getByText('0')).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // Error state
  // -----------------------------------------------------------------------

  describe('error state', () => {
    it('should display the error message when provided', () => {
      const { getByText } = render(
        <TextArea {...defaultProps} error="This field is required" />,
      );

      expect(getByText('This field is required')).toBeTruthy();
    });

    it('should not display an error message when error is undefined', () => {
      const { queryByText } = render(<TextArea {...defaultProps} />);

      expect(queryByText('This field is required')).toBeNull();
    });

    it('should render the error with the alert accessibility role', () => {
      const { getByRole } = render(
        <TextArea {...defaultProps} error="Bad input" />,
      );

      expect(getByRole('alert')).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // maxLength
  // -----------------------------------------------------------------------

  describe('maxLength', () => {
    it('should pass maxLength to the underlying TextInput', () => {
      const { getByPlaceholderText } = render(
        <TextArea {...defaultProps} maxLength={200} />,
      );

      const input = getByPlaceholderText('Enter details...');
      expect(input.props.maxLength).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // Accessibility
  // -----------------------------------------------------------------------

  describe('accessibility', () => {
    it('should set accessibilityLabel to the label text', () => {
      const { getByPlaceholderText } = render(<TextArea {...defaultProps} />);

      const input = getByPlaceholderText('Enter details...');
      expect(input.props.accessibilityLabel).toBe('Notes');
    });

    it('should append ", required" to accessibilityLabel when required', () => {
      const { getByPlaceholderText } = render(
        <TextArea {...defaultProps} required />,
      );

      const input = getByPlaceholderText('Enter details...');
      expect(input.props.accessibilityLabel).toBe('Notes, required');
    });

    it('should set accessibilityHint to the hint text when provided', () => {
      const { getByPlaceholderText } = render(
        <TextArea {...defaultProps} hint="Be specific" />,
      );

      const input = getByPlaceholderText('Enter details...');
      expect(input.props.accessibilityHint).toBe('Be specific');
    });

    it('should set accessibilityHint about maxLength when no hint is provided', () => {
      const { getByPlaceholderText } = render(
        <TextArea {...defaultProps} maxLength={500} />,
      );

      const input = getByPlaceholderText('Enter details...');
      expect(input.props.accessibilityHint).toBe('Maximum 500 characters');
    });
  });

  // -----------------------------------------------------------------------
  // testID
  // -----------------------------------------------------------------------

  describe('testID', () => {
    it('should forward the testID prop to the TextInput', () => {
      const { getByTestId } = render(
        <TextArea {...defaultProps} testID="notes-input" />,
      );

      expect(getByTestId('notes-input')).toBeTruthy();
    });
  });
});
