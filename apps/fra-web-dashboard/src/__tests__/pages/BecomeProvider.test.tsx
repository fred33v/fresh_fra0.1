import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BecomeProvider, { SIGN_UP_TO_APPLY } from '@/pages/BecomeProvider';
import { useAuth } from '@/hooks/useAuth';
import { safeReturnPath } from '@/lib/return-path';

vi.mock('@/hooks/useAuth');
vi.mock('@/components/layout/Layout', () => ({ Layout: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

const mockedUseAuth = vi.mocked(useAuth);
const as = (user: unknown) => mockedUseAuth.mockReturnValue({ user } as ReturnType<typeof useAuth>);
const renderPage = () => render(<MemoryRouter><BecomeProvider /></MemoryRouter>);

describe('BecomeProvider (public)', () => {
  it('sends a signed-out visitor to sign up and then back to the application', () => {
    as(null);
    renderPage();
    expect(screen.getByRole('link', { name: 'Create an account and apply' })).toHaveAttribute('href', SIGN_UP_TO_APPLY);
    const returnTo = new URLSearchParams(SIGN_UP_TO_APPLY.split('?')[1]).get('returnTo');
    expect(safeReturnPath(returnTo)).toBe('/provider-application');
    expect(screen.getByRole('link', { name: 'I already have an account' })).toHaveAttribute(
      'href',
      '/auth?returnTo=%2Fprovider-application',
    );
  });

  it('takes a signed-in user straight to the application', () => {
    as({ userId: 'u1' });
    renderPage();
    expect(screen.getByRole('link', { name: 'Go to your application' })).toHaveAttribute('href', '/provider-application');
    expect(screen.queryByRole('link', { name: 'Create an account and apply' })).toBeNull();
  });

  it('leaves the main landmark to Layout, so the page has no second main or duplicate id', () => {
    as(null);
    const { container } = renderPage();
    expect(container.querySelector('main')).toBeNull();
    expect(container.querySelector('#main-content')).toBeNull();
  });

  it('explains the process and has a single h1', () => {
    as(null);
    renderPage();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(5);
  });
});
