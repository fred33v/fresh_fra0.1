import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Checkout from '@/pages/Checkout';
import { api, ApiError } from '@/lib/api';

// ── Mocks ──────────────────────────────────────────────────

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
  Layout: ({ children }: { children: React.ReactNode }) => <div data-testid="layout">{children}</div>,
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}));

// ── Helpers ────────────────────────────────────────────────

function renderCheckout(searchParams = '?package=Professional') {
  return render(
    <MemoryRouter initialEntries={[`/checkout${searchParams}`]}>
      <Routes>
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/" element={<div data-testid="home-redirect">Home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

// ── Tests ──────────────────────────────────────────────────

const mockPurchaseResponse = {
  purchaseId: 'purchase-1',
  paymentIntentId: 'pi_test',
  clientSecret: 'secret',
  packageId: 'pkg_training',
  organisationId: 'org-1',
  status: 'requires_confirmation',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.post).mockResolvedValue(mockPurchaseResponse);
});

describe('Checkout', () => {
  // ── Redirect for invalid params ──────────────

  describe('redirect for invalid params', () => {
    it('redirects when package param is missing', () => {
      renderCheckout('?price=499');

      expect(screen.getByTestId('home-redirect')).toBeInTheDocument();
    });

    it('redirects when package name is invalid', () => {
      renderCheckout('?package=InvalidPkg');

      expect(screen.getByTestId('home-redirect')).toBeInTheDocument();
    });

    it('uses the catalogue price and ignores a price in the URL', () => {
      renderCheckout('?package=Professional&price=1');

      expect(screen.getByText('£1,799.00')).toBeInTheDocument();
      expect(screen.queryByText('£1.00')).not.toBeInTheDocument();
    });
  });

  // ── Valid package rendering ──────────────────

  describe('valid package rendering', () => {
    it('accepts Professional package', () => {
      renderCheckout('?package=Professional');

      expect(screen.getByText('Professional')).toBeInTheDocument();
    });

    it('accepts Enterprise package', () => {
      renderCheckout('?package=Enterprise');

      expect(screen.getByText('Enterprise')).toBeInTheDocument();
    });

    it('treats the old Health-Check name as Starter', () => {
      renderCheckout('?package=Health-Check');

      expect(screen.getByText('Starter')).toBeInTheDocument();
      expect(screen.getByText('£795.00')).toBeInTheDocument();
    });
  });

  // ── Order summary ───────────────────────────

  describe('order summary', () => {
    it('shows package name and subscription description', () => {
      renderCheckout('?package=Professional');

      expect(screen.getByText('Order Summary')).toBeInTheDocument();
      expect(screen.getByText('Professional')).toBeInTheDocument();
      expect(screen.getByText('FRA + Training - Annual Subscription')).toBeInTheDocument();
    });

    it('shows Enterprise subscription description', () => {
      renderCheckout('?package=Enterprise');

      expect(screen.getByText('Full Dashboard - Annual Subscription')).toBeInTheDocument();
    });

    it('shows price breakdown with VAT', () => {
      renderCheckout('?package=Professional');

      // Subtotal £1,799 from the catalogue
      expect(screen.getByText('£1,799.00')).toBeInTheDocument();
      // VAT (20%) = £359.80
      expect(screen.getByText('£359.80')).toBeInTheDocument();
      // Total = £2,158.80
      expect(screen.getByText('£2,158.80')).toBeInTheDocument();
    });

    it('shows compliance badge', () => {
      renderCheckout('?package=Professional');

      expect(screen.getByText('Built for GovS 013 & ECCTA 2023')).toBeInTheDocument();
    });
  });

  // ── Payment form display ────────────────────

  describe('payment form display', () => {
    it('collects no card details on this page', () => {
      renderCheckout();

      expect(screen.queryByLabelText('Card Number')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('CVC')).not.toBeInTheDocument();
      expect(screen.getByText("Pay by card on Stripe's secure page")).toBeInTheDocument();
      expect(screen.getByText(/We never see or store your card number/)).toBeInTheDocument();
    });

    it('shows the continue button with the total amount', () => {
      renderCheckout('?package=Professional');

      expect(screen.getByRole('button', { name: /Continue to payment · £2,158\.80/ })).toBeInTheDocument();
    });

    it('shows breadcrumb navigation', () => {
      renderCheckout();

      expect(screen.getByLabelText('Breadcrumb')).toBeInTheDocument();
      expect(screen.getByText('Checkout')).toBeInTheDocument();
    });

    it('shows checkout steps indicator', () => {
      renderCheckout();

      expect(screen.getByText('Select Package')).toBeInTheDocument();
      expect(screen.getByText('Payment')).toBeInTheDocument();
      expect(screen.getByText('Confirmation')).toBeInTheDocument();
    });

    it('says who processes the payment', () => {
      renderCheckout();

      expect(screen.getByText('Payments processed securely by Stripe')).toBeInTheDocument();
    });

    it('tells a buyer who cancelled on Stripe that nothing was charged', () => {
      renderCheckout('?package=Professional&cancelled=1');

      expect(screen.getByRole('status')).toHaveTextContent('Payment was cancelled and you have not been charged');
    });
  });

  // ── Payment ─────────────────────────────────

  describe('payment', () => {
    const assign = vi.fn();
    beforeEach(() => {
      assign.mockReset();
      Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, assign } });
    });

    it('sends the buyer to Stripe and stays busy while the page changes', async () => {
      const user = userEvent.setup();
      vi.mocked(api.post).mockResolvedValueOnce({ purchaseId: 'purchase-1', checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_1' });
      renderCheckout('?package=Enterprise');

      await user.click(screen.getByRole('button', { name: /Continue to payment/ }));

      expect(api.post).toHaveBeenCalledWith('/api/v1/purchases', { packageId: 'pkg_full', client: 'web' });
      expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test_1');
      expect(api.post).toHaveBeenCalledTimes(1); // no confirm: the server checks with Stripe on return
      expect(screen.getByRole('button', { name: /Opening secure payment/ })).toBeDisabled();
    });

    it('confirms straight away when the server simulates payment (local development)', async () => {
      const user = userEvent.setup();
      vi.mocked(api.post)
        .mockResolvedValueOnce({ purchaseId: 'purchase-1', checkoutUrl: null, simulated: true, paymentIntentId: 'pi_sim' })
        .mockResolvedValueOnce({ status: 'succeeded' });
      renderCheckout('?package=Professional');

      await user.click(screen.getByRole('button', { name: /Continue to payment/ }));

      await waitFor(() => expect(screen.getByText('Payment Successful!')).toBeInTheDocument());
      expect(api.post).toHaveBeenLastCalledWith('/api/v1/purchases/purchase-1/confirm', { paymentIntentId: 'pi_sim' });
      expect(screen.getByText('£2,158.80')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Go to Dashboard' })).toHaveAttribute('href', '/dashboard');
      expect(assign).not.toHaveBeenCalled();
    });

    it('asks a signed-out buyer to sign in, keeping their package', async () => {
      const user = userEvent.setup();
      vi.mocked(api.post).mockRejectedValueOnce(new ApiError('UNAUTHORIZED', 'Missing or invalid access token'));
      renderCheckout('?package=Professional');

      await user.click(screen.getByRole('button', { name: /Continue to payment/ }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Sign in or create your organisation account to continue.');
      expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/auth?package=Professional');
      expect(screen.getByRole('button', { name: /Continue to payment/ })).toBeEnabled();
    });

    it('explains a duplicate subscription', async () => {
      const user = userEvent.setup();
      vi.mocked(api.post).mockRejectedValueOnce(new ApiError('DUPLICATE_PURCHASE', 'exists'));
      renderCheckout();

      await user.click(screen.getByRole('button', { name: /Continue to payment/ }));

      expect(await screen.findByRole('alert')).toHaveTextContent('You already have an active subscription for this package.');
    });

    it('explains when Stripe cannot be reached', async () => {
      const user = userEvent.setup();
      vi.mocked(api.post).mockRejectedValueOnce(new ApiError('PAYMENT_PROVIDER_ERROR', 'down'));
      renderCheckout();

      await user.click(screen.getByRole('button', { name: /Continue to payment/ }));

      expect(await screen.findByRole('alert')).toHaveTextContent('The secure payment page could not be opened.');
    });
  });
});
