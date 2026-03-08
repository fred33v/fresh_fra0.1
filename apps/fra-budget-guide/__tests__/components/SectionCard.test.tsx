import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import SectionCard from '@/components/SectionCard';

describe('SectionCard', () => {
  it('renders title', () => {
    const { getByText } = render(
      <SectionCard title="Test Section">
        <Text>placeholder</Text>
      </SectionCard>
    );
    expect(getByText('Test Section')).toBeTruthy();
  });

  it('renders children', () => {
    const { getByText } = render(
      <SectionCard title="Section">
        <Text>Child content</Text>
      </SectionCard>
    );
    expect(getByText('Child content')).toBeTruthy();
  });

  it('renders subtitle when provided', () => {
    const { getByText } = render(
      <SectionCard title="Section" subtitle="A description">
        <Text>placeholder</Text>
      </SectionCard>
    );
    expect(getByText('A description')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const mockOnPress = jest.fn();
    const { getByText } = render(
      <SectionCard title="Pressable" onPress={mockOnPress}>
        <Text>placeholder</Text>
      </SectionCard>
    );
    fireEvent.press(getByText('Pressable'));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('renders without onPress as non-pressable', () => {
    const { getByText } = render(
      <SectionCard title="Static">
        <Text>placeholder</Text>
      </SectionCard>
    );
    expect(getByText('Static')).toBeTruthy();
  });
});
