import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Privacy from '@/pages/Privacy';
import Terms from '@/pages/Terms';

vi.mock('@/components/layout/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

const renderPage = (page: React.ReactNode) => render(<MemoryRouter>{page}</MemoryRouter>);

describe('Legal pages', () => {
  it('privacy notice: draft banner until reviewed, contents linking to each section, speak-up protections', () => {
    renderPage(<Privacy />);
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy notice' })).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('Draft for legal review');

    const contents = screen.getByRole('navigation', { name: 'Contents' });
    for (const link of within(contents).getAllByRole('link')) {
      const id = link.getAttribute('href')!.slice(1);
      expect(document.getElementById(id)).not.toBeNull();
    }
    const speakUp = screen.getByRole('region', { name: /Speak-up reports/ });
    expect(speakUp).toHaveTextContent('We do not record the internet address');
    expect(screen.getByRole('region', { name: /How long we keep it/ })).toHaveTextContent('Payment records');
  });

  it('terms: says plainly the service is not legal advice', () => {
    renderPage(<Terms />);
    expect(screen.getByRole('heading', { level: 1, name: 'Terms of service' })).toBeInTheDocument();
    expect(screen.getByText('It is a self-assessment tool, not legal advice.')).toBeInTheDocument();
    for (const link of screen.getAllByRole('link', { name: 'privacy notice' })) expect(link).toHaveAttribute('href', '/privacy');
  });
});
