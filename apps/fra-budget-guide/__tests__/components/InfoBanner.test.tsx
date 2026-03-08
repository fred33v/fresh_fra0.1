import React from 'react';
import { render } from '@testing-library/react-native';
import InfoBanner from '@/components/InfoBanner';

describe('InfoBanner', () => {
  it('renders message text', () => {
    const { getByText } = render(
      <InfoBanner message="This is important" variant="info" />
    );
    expect(getByText('This is important')).toBeTruthy();
  });

  it('renders with info variant', () => {
    const { getByText } = render(
      <InfoBanner message="Info message" variant="info" />
    );
    expect(getByText('Info message')).toBeTruthy();
  });

  it('renders with warning variant', () => {
    const { getByText } = render(
      <InfoBanner message="Warning message" variant="warning" />
    );
    expect(getByText('Warning message')).toBeTruthy();
  });

  it('renders with success variant', () => {
    const { getByText } = render(
      <InfoBanner message="Success message" variant="success" />
    );
    expect(getByText('Success message')).toBeTruthy();
  });

  it('renders with danger variant', () => {
    const { getByText } = render(
      <InfoBanner message="Danger message" variant="danger" />
    );
    expect(getByText('Danger message')).toBeTruthy();
  });
});
