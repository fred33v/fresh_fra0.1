import React from 'react';
import { render } from '@testing-library/react-native';
import IconBadge from '@/components/IconBadge';

// Create a mock icon (lucide-react-native icons are already mocked in jest.setup.js)
const MockIcon = ({ color, size }: { color: string; size: number }) => null;

describe('IconBadge', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(
      <IconBadge icon={MockIcon} />
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders with custom sizes', () => {
    const { toJSON } = render(
      <IconBadge icon={MockIcon} size={32} circleSize={64} />
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders with custom colors', () => {
    const { toJSON } = render(
      <IconBadge icon={MockIcon} bgColor="#ff0000" iconColor="#00ff00" />
    );
    expect(toJSON()).toBeTruthy();
  });
});
