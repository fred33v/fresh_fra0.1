import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import QuizOption from '@/components/QuizOption';

describe('QuizOption', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders label text', () => {
    const { getByText } = render(
      <QuizOption label="Option A" onPress={mockOnPress} />
    );
    expect(getByText('Option A')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const { getByText } = render(
      <QuizOption label="Option A" onPress={mockOnPress} />
    );
    fireEvent.press(getByText('Option A'));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('renders in default state', () => {
    const { getByText } = render(
      <QuizOption label="Default" />
    );
    expect(getByText('Default')).toBeTruthy();
  });

  it('renders in selected state', () => {
    const { getByText } = render(
      <QuizOption label="Selected" state="selected" onPress={mockOnPress} />
    );
    expect(getByText('Selected')).toBeTruthy();
  });

  it('renders in correct state with check icon', () => {
    const { getByText, getByTestId } = render(
      <QuizOption label="Correct" state="correct" />
    );
    expect(getByText('Correct')).toBeTruthy();
    // lucide icons are mocked as Text with testID="icon-Check"
    expect(getByTestId('icon-Check')).toBeTruthy();
  });

  it('renders in incorrect state with X icon', () => {
    const { getByText, getByTestId } = render(
      <QuizOption label="Wrong" state="incorrect" />
    );
    expect(getByText('Wrong')).toBeTruthy();
    expect(getByTestId('icon-X')).toBeTruthy();
  });
});
