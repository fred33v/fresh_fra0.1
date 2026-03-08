import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotFound from '@/pages/NotFound';

// ── Mocks ──────────────────────────────────────────────────

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}));

// ── Tests ──────────────────────────────────────────────────

function renderNotFound(path = '/nonexistent') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <NotFound />
    </MemoryRouter>,
  );
}

describe('NotFound', () => {
  it('shows 404 heading', () => {
    renderNotFound();

    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('shows "Oops! Page not found" message', () => {
    renderNotFound();

    expect(screen.getByText('Oops! Page not found')).toBeInTheDocument();
  });

  it('shows Return to Home link pointing to /', () => {
    renderNotFound();

    const link = screen.getByText('Return to Home');
    expect(link).toHaveAttribute('href', '/');
  });
});
