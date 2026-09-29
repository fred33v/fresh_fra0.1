import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PackageGate } from '@/components/PackageGate';
import { useAuth } from '@/hooks/useAuth';
import { useEntitlements, type Entitlements } from '@/hooks/useEntitlements';

vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useEntitlements');
vi.mock('@/components/layout/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseEntitlements = vi.mocked(useEntitlements);

function setup(features: Partial<Entitlements['features']>, opts: { role?: string; facilitator?: boolean; packageName?: string | null } = {}) {
  mockedUseAuth.mockReturnValue({
    user: { role: opts.role ?? 'employee' },
    hasRole: (r: string) => r === 'facilitator' && !!opts.facilitator,
  } as unknown as ReturnType<typeof useAuth>);
  mockedUseEntitlements.mockReturnValue({
    isLoading: false,
    entitlements: {
      packageName: opts.packageName === undefined ? 'Starter' : opts.packageName,
      features: { assessment: true, training: false, certificates: false, dashboard: false, compliance: false, ...features },
    } as Entitlements,
  });
  render(
    <MemoryRouter>
      <PackageGate feature="training"><p>Workshop content</p></PackageGate>
    </MemoryRouter>
  );
}

describe('PackageGate', () => {
  it('renders the page when the package includes the feature', () => {
    setup({ training: true });
    expect(screen.getByText('Workshop content')).toBeInTheDocument();
  });

  it('shows an upgrade prompt naming the required package', () => {
    setup({});
    expect(screen.queryByText('Workshop content')).not.toBeInTheDocument();
    expect(screen.getByText('Included in the Professional package')).toBeInTheDocument();
    expect(screen.getByText(/on the Starter package/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /See the Professional package/ })).toHaveAttribute('href', '/package/professional');
  });

  it('explains when there is no package at all', () => {
    setup({}, { packageName: null });
    expect(screen.getByText(/does not have an active package/)).toBeInTheDocument();
  });

  it('lets facilitators and admins through', () => {
    setup({}, { facilitator: true });
    expect(screen.getByText('Workshop content')).toBeInTheDocument();
  });
});
