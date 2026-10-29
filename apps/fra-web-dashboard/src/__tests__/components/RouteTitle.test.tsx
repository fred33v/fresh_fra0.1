import { render } from '@testing-library/react';
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
    expect(document.title).toBe('Join your organisation — Risk Aware');
    await userEvent.click(document.querySelector('a')!);
    expect(document.title).toBe('Privacy notice — Risk Aware');
  });
});
