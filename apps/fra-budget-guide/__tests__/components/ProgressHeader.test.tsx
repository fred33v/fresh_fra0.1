import React from 'react';
import { render } from '@testing-library/react-native';
import ProgressHeader from '@/components/ProgressHeader';

describe('ProgressHeader', () => {
  it('shows completed count', () => {
    const { getByText } = render(
      <ProgressHeader completedScreens={['legal', 'fraud-basics']} />
    );
    expect(getByText('2 of 11 sections completed')).toBeTruthy();
  });

  it('shows section position when currentScreen provided', () => {
    const { getByText } = render(
      <ProgressHeader completedScreens={[]} currentScreen="red-flags" />
    );
    // red-flags is index 3 (0-based) in ALL_SCREENS, so Section 4/11
    expect(getByText('Section 4/11')).toBeTruthy();
  });

  it('does not show section position when currentScreen omitted', () => {
    const { queryByText } = render(
      <ProgressHeader completedScreens={['legal']} />
    );
    expect(queryByText(/Section/)).toBeNull();
  });

  it('shows all completed', () => {
    const allScreens = ['legal', 'fraud-basics', 'scenarios', 'red-flags', 'checklists', 'authority', 'reporting', 'whistleblower', 'myths', 'pledge', 'resources'];
    const { getByText } = render(
      <ProgressHeader completedScreens={allScreens} />
    );
    expect(getByText('11 of 11 sections completed')).toBeTruthy();
  });
});
