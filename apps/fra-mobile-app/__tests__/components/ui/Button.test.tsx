/**
 * Button Component - Unit Tests
 *
 * Tests rendering, interaction, disabled/loading states, and accessibility
 * for the reusable Button component.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '@/components/ui/Button';

describe('Button', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------

  describe('rendering', () => {
    it('should render the button text', () => {
      const { getByText } = render(
        <Button onPress={mockOnPress}>Click me</Button>,
      );

      expect(getByText('Click me')).toBeTruthy();
    });

    it('should render with different variants without crashing', () => {
      const variants = ['primary', 'secondary', 'outline', 'danger', 'success'] as const;
      for (const variant of variants) {
        const { getByText } = render(
          <Button onPress={mockOnPress} variant={variant}>
            {variant}
          </Button>,
        );
        expect(getByText(variant)).toBeTruthy();
      }
    });

    it('should render with different sizes without crashing', () => {
      const sizes = ['small', 'medium', 'large'] as const;
      for (const size of sizes) {
        const { getByText } = render(
          <Button onPress={mockOnPress} size={size}>
            {size}
          </Button>,
        );
        expect(getByText(size)).toBeTruthy();
      }
    });
  });

  // -----------------------------------------------------------------------
  // Interaction
  // -----------------------------------------------------------------------

  describe('interaction', () => {
    it('should call onPress when pressed', () => {
      const { getByText } = render(
        <Button onPress={mockOnPress}>Press</Button>,
      );

      fireEvent.press(getByText('Press'));

      expect(mockOnPress).toHaveBeenCalledTimes(1);
    });

    it('should not call onPress when disabled', () => {
      const { getByText } = render(
        <Button onPress={mockOnPress} disabled>
          Disabled
        </Button>,
      );

      fireEvent.press(getByText('Disabled'));

      expect(mockOnPress).not.toHaveBeenCalled();
    });

    it('should not call onPress when loading', () => {
      const { getByRole } = render(
        <Button onPress={mockOnPress} loading>
          Loading
        </Button>,
      );

      fireEvent.press(getByRole('button'));

      expect(mockOnPress).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------

  describe('loading state', () => {
    it('should show an ActivityIndicator when loading', () => {
      const { queryByText, UNSAFE_queryByType } = render(
        <Button onPress={mockOnPress} loading>
          Submit
        </Button>,
      );

      // The text should not be rendered when loading
      expect(queryByText('Submit')).toBeNull();
    });

    it('should show the text when not loading', () => {
      const { getByText } = render(
        <Button onPress={mockOnPress} loading={false}>
          Submit
        </Button>,
      );

      expect(getByText('Submit')).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // Accessibility
  // -----------------------------------------------------------------------

  describe('accessibility', () => {
    it('should have the "button" accessibility role', () => {
      const { getByRole } = render(
        <Button onPress={mockOnPress}>OK</Button>,
      );

      expect(getByRole('button')).toBeTruthy();
    });

    it('should set accessibilityState.disabled when disabled', () => {
      const { getByRole } = render(
        <Button onPress={mockOnPress} disabled>
          No
        </Button>,
      );

      const btn = getByRole('button');
      expect(btn.props.accessibilityState?.disabled).toBe(true);
    });

    it('should set accessibilityState.busy when loading', () => {
      const { getByRole } = render(
        <Button onPress={mockOnPress} loading>
          Wait
        </Button>,
      );

      const btn = getByRole('button');
      expect(btn.props.accessibilityState?.busy).toBe(true);
    });

    it('should set accessibilityLabel to children text', () => {
      const { getByRole } = render(
        <Button onPress={mockOnPress}>Save</Button>,
      );

      const btn = getByRole('button');
      expect(btn.props.accessibilityLabel).toBe('Save');
    });

    it('should append ", loading" to accessibilityLabel when loading', () => {
      const { getByRole } = render(
        <Button onPress={mockOnPress} loading>
          Save
        </Button>,
      );

      const btn = getByRole('button');
      expect(btn.props.accessibilityLabel).toBe('Save, loading');
    });
  });

  // -----------------------------------------------------------------------
  // testID
  // -----------------------------------------------------------------------

  describe('testID', () => {
    it('should forward the testID prop', () => {
      const { getByTestId } = render(
        <Button onPress={mockOnPress} testID="my-button">
          Go
        </Button>,
      );

      expect(getByTestId('my-button')).toBeTruthy();
    });
  });
});
