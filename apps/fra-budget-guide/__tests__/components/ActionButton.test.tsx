import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ActionButton from '@/components/ActionButton';

describe('ActionButton', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders label correctly', () => {
    const { getByText } = render(
      <ActionButton label="Continue" onPress={mockOnPress} />
    );
    expect(getByText('Continue')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const { getByText } = render(
      <ActionButton label="Continue" onPress={mockOnPress} />
    );
    fireEvent.press(getByText('Continue'));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('shows loading indicator when loading', () => {
    const { queryByText } = render(
      <ActionButton label="Continue" onPress={mockOnPress} loading />
    );
    // When loading, label text should not be visible
    expect(queryByText('Continue')).toBeFalsy();
  });

  it('renders with disabled state', () => {
    const { getByText } = render(
      <ActionButton label="Continue" onPress={mockOnPress} disabled />
    );
    // Button should still render the label
    expect(getByText('Continue')).toBeTruthy();
  });

  it('renders with secondary variant', () => {
    const { getByText } = render(
      <ActionButton label="Cancel" onPress={mockOnPress} variant="secondary" />
    );
    expect(getByText('Cancel')).toBeTruthy();
  });

  it('renders with outline variant', () => {
    const { getByText } = render(
      <ActionButton label="Optional" onPress={mockOnPress} variant="outline" />
    );
    expect(getByText('Optional')).toBeTruthy();
  });
});
