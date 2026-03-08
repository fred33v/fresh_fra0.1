import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Checkout from '@/pages/Checkout';
import { api } from '@/lib/api';

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

function renderCheckout(searchParams = '?package=Professional&price=499') {
  return render(
    <MemoryRouter initialEntries={[`/checkout${searchParams}`]}>
      <Routes>
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/" element={<div data-testid="home-redirect">Home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Card Number'), '4242424242424242');
  await user.type(screen.getByLabelText('Expiry'), '12/30');
  await user.type(screen.getByLabelText('CVC'), '123');
  await user.type(screen.getByLabelText('Cardholder Name'), 'Alice Smith');
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
      renderCheckout('?package=InvalidPkg&price=499');

      expect(screen.getByTestId('home-redirect')).toBeInTheDocument();
    });

    it('redirects when price param is missing', () => {
      renderCheckout('?package=Professional');

      expect(screen.getByTestId('home-redirect')).toBeInTheDocument();
    });

    it('redirects when price is zero', () => {
      renderCheckout('?package=Professional&price=0');

      expect(screen.getByTestId('home-redirect')).toBeInTheDocument();
    });

    it('redirects when price is negative', () => {
      renderCheckout('?package=Professional&price=-100');

      expect(screen.getByTestId('home-redirect')).toBeInTheDocument();
    });

    it('redirects when price is NaN', () => {
      renderCheckout('?package=Professional&price=abc');

      expect(screen.getByTestId('home-redirect')).toBeInTheDocument();
    });
  });

  // ── Valid package rendering ──────────────────

  describe('valid package rendering', () => {
    it('accepts Professional package', () => {
      renderCheckout('?package=Professional&price=499');

      expect(screen.getByText('Professional')).toBeInTheDocument();
    });

    it('accepts Enterprise package', () => {
      renderCheckout('?package=Enterprise&price=999');

      expect(screen.getByText('Enterprise')).toBeInTheDocument();
    });

    it('accepts Health-Check package', () => {
      renderCheckout('?package=Health-Check&price=199');

      expect(screen.getByText('Health-Check')).toBeInTheDocument();
    });
  });

  // ── Order summary ───────────────────────────

  describe('order summary', () => {
    it('shows package name and subscription description', () => {
      renderCheckout('?package=Professional&price=499');

      expect(screen.getByText('Order Summary')).toBeInTheDocument();
      expect(screen.getByText('Professional')).toBeInTheDocument();
      expect(screen.getByText('FRA + Training - Annual Subscription')).toBeInTheDocument();
    });

    it('shows Enterprise subscription description', () => {
      renderCheckout('?package=Enterprise&price=999');

      expect(screen.getByText('Full Dashboard - Annual Subscription')).toBeInTheDocument();
    });

    it('shows price breakdown with VAT', () => {
      renderCheckout('?package=Professional&price=499');

      // Subtotal £499.00
      expect(screen.getByText('£499.00')).toBeInTheDocument();
      // VAT (20%) = £99.80
      expect(screen.getByText('£99.80')).toBeInTheDocument();
      // Total = £598.80
      expect(screen.getByText('£598.80')).toBeInTheDocument();
    });

    it('shows compliance badge', () => {
      renderCheckout('?package=Professional&price=499');

      expect(screen.getByText('GovS-013 & ECCTA 2023 Compliant')).toBeInTheDocument();
    });
  });

  // ── Payment form display ────────────────────

  describe('payment form display', () => {
    it('shows all form fields', () => {
      renderCheckout();

      expect(screen.getByLabelText('Card Number')).toBeInTheDocument();
      expect(screen.getByLabelText('Expiry')).toBeInTheDocument();
      expect(screen.getByLabelText('CVC')).toBeInTheDocument();
      expect(screen.getByLabelText('Cardholder Name')).toBeInTheDocument();
    });

    it('shows pay button with total amount', () => {
      renderCheckout('?package=Professional&price=499');

      expect(screen.getByRole('button', { name: /Pay £598\.80/ })).toBeInTheDocument();
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

    it('shows secure payment badge', () => {
      renderCheckout();

      expect(screen.getByText('Secure payment')).toBeInTheDocument();
    });
  });

  // ── Form validation ─────────────────────────

  describe('form validation', () => {
    it('shows error for empty card number', async () => {
      const user = userEvent.setup();
      renderCheckout();

      await user.click(screen.getByRole('button', { name: /Pay/ }));

      expect(screen.getByText('Enter a valid card number (13-19 digits)')).toBeInTheDocument();
    });

    it('shows error for short card number', async () => {
      const user = userEvent.setup();
      renderCheckout();

      await user.type(screen.getByLabelText('Card Number'), '1234');
      await user.click(screen.getByRole('button', { name: /Pay/ }));

      expect(screen.getByText('Enter a valid card number (13-19 digits)')).toBeInTheDocument();
    });

    it('shows error for non-digit card number', async () => {
      const user = userEvent.setup();
      renderCheckout();

      await user.type(screen.getByLabelText('Card Number'), 'abcdefghijklm');
      await user.click(screen.getByRole('button', { name: /Pay/ }));

      expect(screen.getByText('Enter a valid card number (13-19 digits)')).toBeInTheDocument();
    });

    it('shows error for empty expiry', async () => {
      const user = userEvent.setup();
      renderCheckout();

      await user.click(screen.getByRole('button', { name: /Pay/ }));

      expect(screen.getByText('Enter a valid expiry (MM/YY)')).toBeInTheDocument();
    });

    it('shows error for invalid expiry format', async () => {
      const user = userEvent.setup();
      renderCheckout();

      await user.type(screen.getByLabelText('Expiry'), '1234');
      await user.click(screen.getByRole('button', { name: /Pay/ }));

      expect(screen.getByText('Enter a valid expiry (MM/YY)')).toBeInTheDocument();
    });

    it('shows error for invalid month', async () => {
      const user = userEvent.setup();
      renderCheckout();

      await user.type(screen.getByLabelText('Expiry'), '13/30');
      await user.click(screen.getByRole('button', { name: /Pay/ }));

      expect(screen.getByText('Month must be 01-12')).toBeInTheDocument();
    });

    it('shows error for expired card', async () => {
      const user = userEvent.setup();
      renderCheckout();

      await user.type(screen.getByLabelText('Expiry'), '01/20');
      await user.click(screen.getByRole('button', { name: /Pay/ }));

      expect(screen.getByText('Card has expired')).toBeInTheDocument();
    });

    it('shows error for empty CVC', async () => {
      const user = userEvent.setup();
      renderCheckout();

      await user.click(screen.getByRole('button', { name: /Pay/ }));

      expect(screen.getByText('Enter a valid CVC (3-4 digits)')).toBeInTheDocument();
    });

    it('shows error for invalid CVC', async () => {
      const user = userEvent.setup();
      renderCheckout();

      await user.type(screen.getByLabelText('CVC'), '12');
      await user.click(screen.getByRole('button', { name: /Pay/ }));

      expect(screen.getByText('Enter a valid CVC (3-4 digits)')).toBeInTheDocument();
    });

    it('shows error for empty cardholder name', async () => {
      const user = userEvent.setup();
      renderCheckout();

      await user.click(screen.getByRole('button', { name: /Pay/ }));

      expect(screen.getByText('Enter the cardholder name')).toBeInTheDocument();
    });

    it('shows all field errors at once', async () => {
      const user = userEvent.setup();
      renderCheckout();

      await user.click(screen.getByRole('button', { name: /Pay/ }));

      const alerts = screen.getAllByRole('alert');
      expect(alerts.length).toBe(4);
    });

    it('sets aria-invalid on fields with errors', async () => {
      const user = userEvent.setup();
      renderCheckout();

      await user.click(screen.getByRole('button', { name: /Pay/ }));

      expect(screen.getByLabelText('Card Number')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByLabelText('Expiry')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByLabelText('CVC')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByLabelText('Cardholder Name')).toHaveAttribute('aria-invalid', 'true');
    });

    it('clears errors when form is resubmitted with valid data', async () => {
      const user = userEvent.setup();
      renderCheckout();

      // Submit with empty form to trigger errors
      await user.click(screen.getByRole('button', { name: /Pay/ }));
      expect(screen.getByText('Enter a valid card number (13-19 digits)')).toBeInTheDocument();

      // Fill valid data and resubmit — errors should clear even while processing
      await fillValidForm(user);
      await user.click(screen.getByRole('button', { name: /Pay/ }));

      expect(screen.queryByText('Enter a valid card number (13-19 digits)')).not.toBeInTheDocument();
    });
  });

  // ── Payment processing ──────────────────────

  describe('payment processing', () => {
    it('shows processing state during payment', async () => {
      const user = userEvent.setup();
      // Make the API call hang so the processing state remains visible
      vi.mocked(api.post).mockImplementationOnce(() => new Promise(() => {}));
      renderCheckout();

      await fillValidForm(user);
      await user.click(screen.getByRole('button', { name: /Pay/ }));

      expect(screen.getByText('Processing...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Processing/ })).toBeDisabled();
    });

    it('shows success screen after payment completes', async () => {
      const user = userEvent.setup();
      renderCheckout('?package=Professional&price=499');

      await fillValidForm(user);
      await user.click(screen.getByRole('button', { name: /Pay/ }));

      await waitFor(() => {
        expect(screen.getByText('Payment Successful!')).toBeInTheDocument();
      }, { timeout: 3000 });
      expect(screen.getByText(/Professional package is now active/)).toBeInTheDocument();
    }, 10000);

    it('shows correct total on success screen', async () => {
      const user = userEvent.setup();
      renderCheckout('?package=Professional&price=499');

      await fillValidForm(user);
      await user.click(screen.getByRole('button', { name: /Pay/ }));

      await waitFor(() => {
        expect(screen.getByText('Confirmed')).toBeInTheDocument();
      }, { timeout: 3000 });
      expect(screen.getByText('£598.80')).toBeInTheDocument();
    }, 10000);

    it('shows navigation links on success screen', async () => {
      const user = userEvent.setup();
      renderCheckout();

      await fillValidForm(user);
      await user.click(screen.getByRole('button', { name: /Pay/ }));

      await waitFor(() => {
        expect(screen.getByRole('link', { name: 'Go to Dashboard' })).toBeInTheDocument();
      }, { timeout: 3000 });
      expect(screen.getByRole('link', { name: 'Go to Dashboard' })).toHaveAttribute('href', '/dashboard');
      expect(screen.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/');
    }, 10000);
  });

  // ── Edge cases ──────────────────────────────

  describe('edge cases', () => {
    it('accepts 4-digit CVC', async () => {
      const user = userEvent.setup();
      renderCheckout();

      await user.type(screen.getByLabelText('Card Number'), '4242424242424242');
      await user.type(screen.getByLabelText('Expiry'), '12/30');
      await user.type(screen.getByLabelText('CVC'), '1234');
      await user.type(screen.getByLabelText('Cardholder Name'), 'Alice Smith');
      await user.click(screen.getByRole('button', { name: /Pay/ }));

      expect(screen.queryByText('Enter a valid CVC (3-4 digits)')).not.toBeInTheDocument();
      expect(screen.getByText('Payment Successful!')).toBeInTheDocument();
    });

    it('accepts card number with spaces', async () => {
      const user = userEvent.setup();
      renderCheckout();

      await user.type(screen.getByLabelText('Card Number'), '4242 4242 4242 4242');
      await user.type(screen.getByLabelText('Expiry'), '12/30');
      await user.type(screen.getByLabelText('CVC'), '123');
      await user.type(screen.getByLabelText('Cardholder Name'), 'Alice Smith');
      await user.click(screen.getByRole('button', { name: /Pay/ }));

      expect(screen.queryByText('Enter a valid card number (13-19 digits)')).not.toBeInTheDocument();
    });
  });
});
