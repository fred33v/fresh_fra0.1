import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock useAuth
const mockUseAuth = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { ProtectedRoute } from '@/components/ProtectedRoute';
import type { AppRole } from '@/types/workshop';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function renderRoute(initialPath: string, requiredRole?: AppRole) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute requiredRole={requiredRole}>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/auth" element={<div>Auth Page</div>} />
          <Route path="/dashboard" element={<div>Dashboard Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ProtectedRoute', () => {
  it('shows loading spinner while auth is loading', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: true, hasRole: () => false });
    renderRoute('/protected');
    // Loader2 renders an SVG with animate-spin
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('redirects to /auth when not authenticated', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false, hasRole: () => false });
    renderRoute('/protected');
    expect(screen.getByText('Auth Page')).toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { userId: '1', email: 'test@test.com' },
      isLoading: false,
      hasRole: () => false,
    });
    renderRoute('/protected');
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects to /dashboard when lacking required role', () => {
    mockUseAuth.mockReturnValue({
      user: { userId: '1', email: 'test@test.com' },
      isLoading: false,
      hasRole: () => false,
    });
    renderRoute('/protected', 'facilitator');
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
  });

  it('renders children when user has required role', () => {
    mockUseAuth.mockReturnValue({
      user: { userId: '1', email: 'test@test.com' },
      isLoading: false,
      hasRole: (role: string) => role === 'facilitator',
    });
    renderRoute('/protected', 'facilitator');
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});
