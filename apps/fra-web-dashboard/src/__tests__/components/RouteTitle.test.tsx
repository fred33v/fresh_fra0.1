import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Link, Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { RouteTitle } from '@/components/RouteTitle';

describe('RouteTitle', () => {
  it('sets the title for the current page and updates it on navigation', async () => {
    render(
      <MemoryRouter initialEntries={['/join']}>
        <RouteTitle />
        <Link to="/privacy">go</Link>
        <Routes><Route path="*" element={null} /></Routes>
      </MemoryRouter>,
    );
    expect(document.title).toBe('Join your organisation — fraud-risk.co.uk');
    await userEvent.click(document.querySelector('a')!);
    expect(document.title).toBe('Privacy notice — fraud-risk.co.uk');
  });

  it('moves focus to the main content after navigating, but not on first load', async () => {
    render(
      <MemoryRouter initialEntries={['/join']}>
        <RouteTitle />
        <Link to="/privacy">go</Link>
        <main id="main-content" tabIndex={-1}>content</main>
        <Routes><Route path="*" element={null} /></Routes>
      </MemoryRouter>,
    );
    await new Promise(r => setTimeout(r, 10));
    expect(document.activeElement).not.toBe(document.getElementById('main-content'));
    await userEvent.click(document.querySelector('a')!);
    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('main-content')));
  });
});
