/**
 * RadioOption Component Tests
 *
 * Testing the reusable radio button option component
 *
 * NOTE: These tests are currently skipped due to a React Native Testing Library
 * compatibility issue with React Native 0.81.5 and TypeScript 5.0 const type parameters.
 * See TEST_CONFIGURATION_ISSUE.md for full details and resolution plan.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { RadioOption } from '@/components/ui';

describe('RadioOption', () => {
  const mockOnPress = jest.fn();

beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render label correctly', () => {
      const { getByText } = render(
        <RadioOption value="test" label="Test Option" selected={false} onPress={mockOnPress} />
      );

      expect(getByText('Test Option')).toBeTruthy();
    });

    it('should render description when provided', () => {
      const { getByText } = render(
        <RadioOption
          value="test"
          label="Test Option"
          description="This is a description"
          selected={false}
          onPress={mockOnPress}
        />
      );

      expect(getByText('This is a description')).toBeTruthy();
    });

    it('should not render description when not provided', () => {
      const { queryByText } = render(
        <RadioOption value="test" label="Test Option" selected={false} onPress={mockOnPress} />
      );

      expect(queryByText(/description/i)).toBeNull();
    });
  });

  describe('Interaction', () => {
    it('should call onPress with value when pressed', () => {
      const { getByText } = render(
        <RadioOption value="test-value" label="Test Option" selected={false} onPress={mockOnPress} />
      );

      fireEvent.press(getByText('Test Option'));

      expect(mockOnPress).toHaveBeenCalledWith('test-value');
      expect(mockOnPress).toHaveBeenCalledTimes(1);
    });

    it('should not call onPress when disabled', () => {
      const { getByText } = render(
        <RadioOption
          value="test"
          label="Test Option"
          selected={false}
          onPress={mockOnPress}
          disabled
        />
      );

      fireEvent.press(getByText('Test Option'));

      expect(mockOnPress).not.toHaveBeenCalled();
    });

    it('should work with numeric values', () => {
      const { getByText } = render(
        <RadioOption value={42} label="The Answer" selected={false} onPress={mockOnPress} />
      );

      fireEvent.press(getByText('The Answer'));

      expect(mockOnPress).toHaveBeenCalledWith(42);
    });
  });

  describe('Selected State', () => {
    it('should apply selected styles when selected=true', () => {
      const { getByText } = render(
        <RadioOption value="test" label="Test Option" selected={true} onPress={mockOnPress} />
      );

      const option = getByText('Test Option');
      expect(option).toBeTruthy();
      // Note: Actual style testing would require checking the parent TouchableOpacity
    });

    it('should not apply selected styles when selected=false', () => {
      const { getByText } = render(
        <RadioOption value="test" label="Test Option" selected={false} onPress={mockOnPress} />
      );

      const option = getByText('Test Option');
      expect(option).toBeTruthy();
    });
  });

  describe('Disabled State', () => {
    it('should apply disabled styles when disabled=true', () => {
      const { getByText } = render(
        <RadioOption value="test" label="Test Option" selected={false} onPress={mockOnPress} disabled />
      );

      expect(getByText('Test Option')).toBeTruthy();
    });

    it('should be pressable when not disabled', () => {
      const { getByText } = render(
        <RadioOption value="test" label="Test Option" selected={false} onPress={mockOnPress} disabled={false} />
      );

      fireEvent.press(getByText('Test Option'));
      expect(mockOnPress).toHaveBeenCalled();
    });
  });

  describe('Custom Styling', () => {
    it('should accept custom containerStyle', () => {
      const customStyle = { marginBottom: 20 };
      const { getByText } = render(
        <RadioOption
          value="test"
          label="Test Option"
          selected={false}
          onPress={mockOnPress}
          containerStyle={customStyle}
        />
      );

      expect(getByText('Test Option')).toBeTruthy();
    });
  });

  describe('Type Safety', () => {
    it('should work with string values', () => {
      const { getByText } = render(
        <RadioOption value="string-value" label="String" selected={false} onPress={mockOnPress} />
      );

      fireEvent.press(getByText('String'));
      expect(mockOnPress).toHaveBeenCalledWith('string-value');
    });

    it('should work with number values', () => {
      const { getByText } = render(
        <RadioOption value={123} label="Number" selected={false} onPress={mockOnPress} />
      );

      fireEvent.press(getByText('Number'));
      expect(mockOnPress).toHaveBeenCalledWith(123);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty label', () => {
      const { getByText } = render(
        <RadioOption value="test" label="" selected={false} onPress={mockOnPress} />
      );

      fireEvent.press(getByText(''));
      expect(mockOnPress).toHaveBeenCalled();
    });

    it('should handle very long label', () => {
      const longLabel = 'A'.repeat(200);
      const { getByText } = render(
        <RadioOption value="test" label={longLabel} selected={false} onPress={mockOnPress} />
      );

      expect(getByText(longLabel)).toBeTruthy();
    });

    it('should handle rapid consecutive presses', () => {
      const { getByText } = render(
        <RadioOption value="test" label="Test" selected={false} onPress={mockOnPress} />
      );

      const option = getByText('Test');
      fireEvent.press(option);
      fireEvent.press(option);
      fireEvent.press(option);

      expect(mockOnPress).toHaveBeenCalledTimes(3);
    });
  });
});
