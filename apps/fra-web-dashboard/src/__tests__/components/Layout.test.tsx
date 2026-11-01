import { render, screen, within } from '@testing-library/react';
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

describe('Layout: skip link and footer', () => {
  const renderLayout = (props = {}) => render(
    <MemoryRouter>
      <Layout {...props}><p>Page</p></Layout>
    </MemoryRouter>,
  );

  it('starts with a skip link to the main content', () => {
    renderLayout();
    const skip = screen.getByRole('link', { name: 'Skip to main content' });
    expect(skip).toHaveAttribute('href', '#main-content');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
    // first focusable element on the page
    expect(document.querySelector('a, button')).toBe(skip);
  });

  it('footer links to the accessibility statement and the help address', () => {
    renderLayout();
    const legal = screen.getByRole('navigation', { name: 'Legal' });
    expect(within(legal).getByRole('link', { name: 'Accessibility statement' })).toHaveAttribute('href', '/accessibility');
    expect(screen.getByRole('link', { name: 'help@fraud-risk.co.uk' })).toHaveAttribute('href', 'mailto:help@fraud-risk.co.uk');
  });

  it('leaves the footer out when the page draws its own', () => {
    renderLayout({ showFooter: false });
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  });

  it("puts a page's own header and footer outside <main>, so the skip link jumps past them", () => {
    renderLayout({ showHeader: false, showFooter: false, header: <header>Own header</header>, footer: <footer>Own footer</footer> });
    const main = screen.getByRole('main');
    expect(within(main).queryByText('Own header')).not.toBeInTheDocument();
    expect(within(main).queryByText('Own footer')).not.toBeInTheDocument();
    expect(screen.getByRole('banner')).toHaveTextContent('Own header');
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Own footer');
  });
});
