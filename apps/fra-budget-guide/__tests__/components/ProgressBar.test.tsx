import React from 'react';
import { render } from '@testing-library/react-native';
import ProgressBar from '@/components/ProgressBar';

describe('ProgressBar', () => {
  it('renders without crashing', () => {
    const tree = render(<ProgressBar current={3} max={10} />);
    expect(tree).toBeTruthy();
  });

  it('renders with custom color', () => {
    const tree = render(<ProgressBar current={5} max={10} color="#059669" />);
    expect(tree).toBeTruthy();
  });

  it('renders at 0 progress', () => {
    const tree = render(<ProgressBar current={0} max={10} />);
    expect(tree).toBeTruthy();
  });

  it('renders at full progress', () => {
    const tree = render(<ProgressBar current={10} max={10} />);
    expect(tree).toBeTruthy();
  });

  it('renders with label', () => {
    const { getByText } = render(<ProgressBar current={5} max={10} label="5 of 10 completed" />);
    expect(getByText('5 of 10 completed')).toBeTruthy();
  });
});
