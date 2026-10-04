import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CheckoutComplete from '@/pages/CheckoutComplete';
import { api, ApiError } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: { post: vi.fn() },
  ApiError: class ApiError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock('@/components/layout/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const PURCHASE = '6f1c2b0e-8d4a-4c1e-9b2f-3a5d7e9f1c2b';

function renderPage(query: string) {
  return render(
    <MemoryRouter initialEntries={[`/checkout/complete${query}`]}>
      <Routes><Route path="/checkout/complete" element={<CheckoutComplete />} /></Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('CheckoutComplete', () => {
  it('asks the server to check the payment with Stripe and confirms it', async () => {
    vi.mocked(api.post).mockResolvedValue({ status: 'succeeded' });
    renderPage(`?purchase=${PURCHASE}`);

    expect(screen.getByText('Confirming your payment…')).toBeInTheDocument();
    expect(await screen.findByText('Payment successful')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith(`/api/v1/purchases/${PURCHASE}/confirm`, {});
    expect(screen.getByRole('link', { name: 'Go to dashboard' })).toHaveAttribute('href', '/dashboard');
  });

  it('keeps checking while Stripe settles the payment, then reassures the buyer', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(api.post).mockRejectedValue(new ApiError('PAYMENT_PENDING', 'pending'));
    renderPage(`?purchase=${PURCHASE}`);

    for (let i = 0; i < 5; i++) await vi.advanceTimersByTimeAsync(2000);
    await waitFor(() => expect(screen.getByText('Payment is still processing')).toBeInTheDocument());
    expect(api.post).toHaveBeenCalledTimes(5);
    expect(screen.getByText(/you do not need to pay again/)).toBeInTheDocument();
  });

  it('says the payment was not completed when Stripe has no payment', async () => {
    vi.mocked(api.post).mockRejectedValue(new ApiError('PAYMENT_NOT_COMPLETED', 'no'));
    renderPage(`?purchase=${PURCHASE}`);
    expect(await screen.findByText('Payment not completed')).toBeInTheDocument();
  });

  describe('mobile buyers', () => {
    const assign = vi.fn();
    beforeEach(() => {
      assign.mockReset();
      Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, assign } });
    });

    it('hands them back to the app, which confirms the purchase itself', () => {
      renderPage(`?purchase=${PURCHASE}&client=mobile`);
      expect(assign).toHaveBeenCalledWith('fra-mobile://payment-complete');
      expect(screen.getByText('Payment complete')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Return to the app' })).toHaveAttribute('href', 'fra-mobile://payment-complete');
      expect(api.post).not.toHaveBeenCalled();
    });

    it('tells the app when the buyer cancelled', () => {
      renderPage(`?purchase=${PURCHASE}&client=mobile&cancelled=1`);
      expect(assign).toHaveBeenCalledWith('fra-mobile://payment-complete?cancelled=1');
      expect(screen.getByText('Payment cancelled')).toBeInTheDocument();
    });
  });

  it('rejects a malformed purchase reference', () => {
    renderPage('?purchase=not-a-purchase');
    expect(screen.getByText('Payment not completed')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });
});
