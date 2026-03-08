import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import ScreenContainer from '@/components/ScreenContainer';

// Mock useApp
jest.mock('@/contexts/AppContext', () => ({
  useApp: jest.fn(() => ({
    completedChannels: [
      { channelId: 'legal', timestamp: '2024-01-01' },
      { channelId: 'fraud-basics', timestamp: '2024-01-02' },
    ],
  })),
}));

// Mock ProgressHeader to verify it receives correct props
jest.mock('@/components/ProgressHeader', () => {
  const React = require('react');
  return function MockProgressHeader(props: any) {
    return React.createElement('Text', { testID: 'progress-header' }, `Progress: ${props.completedScreens.length} completed`);
  };
});

describe('ScreenContainer', () => {
  it('renders children', () => {
    const { getByText } = render(
      <ScreenContainer>
        <Text>Test content</Text>
      </ScreenContainer>
    );
    expect(getByText('Test content')).toBeTruthy();
  });

  it('shows ProgressHeader when screenId provided', () => {
    const { getByTestId } = render(
      <ScreenContainer screenId="legal">
        <Text>Content</Text>
      </ScreenContainer>
    );
    expect(getByTestId('progress-header')).toBeTruthy();
  });

  it('does not show ProgressHeader when screenId omitted', () => {
    const { queryByTestId } = render(
      <ScreenContainer>
        <Text>Content</Text>
      </ScreenContainer>
    );
    expect(queryByTestId('progress-header')).toBeNull();
  });
});
