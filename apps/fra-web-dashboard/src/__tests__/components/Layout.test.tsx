import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';

// ── Mocks ──────────────────────────────────────────────────

vi.mock('@/components/layout/Header', () => ({
  Header: () => <header data-testid="header">Header</header>,
}));

// ── Tests ──────────────────────────────────────────────────

describe('Layout', () => {
  it('renders children', () => {
    render(
      <MemoryRouter>
        <Layout>
          <p>Child content</p>
        </Layout>
      </MemoryRouter>,
    );

    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('renders Header by default', () => {
    render(
      <MemoryRouter>
        <Layout>
          <p>Page</p>
        </Layout>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('header')).toBeInTheDocument();
  });

  it('hides Header when showHeader is false', () => {
    render(
      <MemoryRouter>
        <Layout showHeader={false}>
          <p>Page</p>
        </Layout>
      </MemoryRouter>,
    );

    expect(screen.queryByTestId('header')).not.toBeInTheDocument();
  });

  it('renders children inside a main element', () => {
    render(
      <MemoryRouter>
        <Layout>
          <p>Inside main</p>
        </Layout>
      </MemoryRouter>,
    );

    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
    expect(main).toHaveTextContent('Inside main');
  });
});
