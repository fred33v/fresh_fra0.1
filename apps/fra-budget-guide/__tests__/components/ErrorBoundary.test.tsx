import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import ErrorBoundary from '@/components/ErrorBoundary';

const ThrowingComponent = () => {
  throw new Error('Test error');
};

const GoodComponent = () => <Text>Everything is fine</Text>;

describe('ErrorBoundary', () => {
  // Suppress console.error for expected errors
  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  afterAll(() => {
    consoleSpy.mockRestore();
  });

  it('renders children when no error', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <GoodComponent />
      </ErrorBoundary>
    );
    expect(getByText('Everything is fine')).toBeTruthy();
  });

  it('renders fallback when child throws', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );
    expect(getByText('Something went wrong')).toBeTruthy();
  });
});
