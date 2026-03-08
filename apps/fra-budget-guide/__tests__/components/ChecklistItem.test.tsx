import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ChecklistItem from '@/components/ChecklistItem';

describe('ChecklistItem', () => {
  const mockOnToggle = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders label text', () => {
    const { getByText } = render(
      <ChecklistItem label="Check this" checked={false} onToggle={mockOnToggle} />
    );
    expect(getByText('Check this')).toBeTruthy();
  });

  it('calls onToggle when pressed', () => {
    const { getByText } = render(
      <ChecklistItem label="Check this" checked={false} onToggle={mockOnToggle} />
    );
    fireEvent.press(getByText('Check this'));
    expect(mockOnToggle).toHaveBeenCalledTimes(1);
  });

  it('renders description when provided', () => {
    const { getByText } = render(
      <ChecklistItem
        label="Check this"
        description="More details here"
        checked={false}
        onToggle={mockOnToggle}
      />
    );
    expect(getByText('More details here')).toBeTruthy();
  });

  it('renders checked state correctly', () => {
    const { getByText } = render(
      <ChecklistItem label="Checked item" checked={true} onToggle={mockOnToggle} />
    );
    expect(getByText('Checked item')).toBeTruthy();
  });
});
