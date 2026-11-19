import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Checkout from '@/pages/Checkout';
import Auth from '@/pages/Auth';
import { api, ApiError } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: { post: vi.fn() },
  ApiError: class extends Error {
    constructor(public code: string, message: string) { super(message); }
  },
}));
vi.mock('@/hooks/useAuth', async () => {
  const { useState } = await import('react');
  return { useAuth: () => {
    const [signedIn, setSignedIn] = useState(false);
    return {
      user: signedIn ? {userId:'customer',organisationId:'customer-org',role:'employer'} : null,
      signIn: async () => { setSignedIn(true); return {error:null}; },
      signUp: vi.fn(), verifyEmail: vi.fn(),
    };
  } };
});
vi.mock('@/components/layout/Layout', () => ({ Layout: ({children}: {children: React.ReactNode}) => <>{children}</> }));
vi.mock('framer-motion', () => ({
  motion: {div: ({children}: {children: React.ReactNode}) => <div>{children}</div>},
  AnimatePresence: ({children}: {children: React.ReactNode}) => <>{children}</>,
}));
vi.mock('sonner', () => ({toast:{success:vi.fn(),error:vi.fn(),info:vi.fn()}}));

it('keeps an edited referral through checkout, real auth navigation and the retried purchase', async () => {
  const code = 'PRV-' + 'a'.repeat(32);
  vi.mocked(api.post).mockRejectedValueOnce(new ApiError('UNAUTHORIZED','Sign in required'))
    .mockResolvedValueOnce({purchaseId:'purchase',checkoutUrl:null,simulated:true})
    .mockResolvedValueOnce({});
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={['/checkout?package=Professional']}><Routes>
    <Route path="/checkout" element={<Checkout/>}/>
    <Route path="/auth" element={<Auth/>}/>
  </Routes></MemoryRouter>);
  await user.type(screen.getByLabelText('Provider referral reference (optional)'),code);
  await user.click(screen.getByRole('button',{name:/Continue to payment/}));
  await user.click(await screen.findByRole('link',{name:'Sign in'}));
  await user.type(screen.getByLabelText('Email'),'customer@example.test');
  await user.type(screen.getByLabelText('Password'),'Password123');
  await user.click(screen.getByRole('button',{name:'Sign In'}));
  expect(await screen.findByLabelText('Provider referral reference (optional)')).toHaveValue(code);
  await user.click(screen.getByRole('button',{name:/Continue to payment/}));
  await screen.findByRole('heading',{name:'Payment Successful!'});
  await waitFor(() => expect(api.post).toHaveBeenNthCalledWith(2,'/api/v1/purchases',{
    packageId:'pkg_training',client:'web',providerCode:code,
  }));
  expect(api.post).toHaveBeenNthCalledWith(3,'/api/v1/purchases/purchase/confirm',{paymentIntentId:undefined});
});
