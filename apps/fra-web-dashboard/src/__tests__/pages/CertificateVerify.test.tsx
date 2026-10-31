import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import CertificateVerify from '@/pages/CertificateVerify';

const mockAnonGet = vi.fn();

vi.mock('@/lib/api', () => ({
  anonymousApi: { get: (...args: unknown[]) => mockAnonGet(...args) },
  ApiError: class ApiError extends Error {
    code: string;
    constructor(code: string, message: string) { super(message); this.code = code; }
  },
}));

vi.mock('@/components/layout/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const training = {
  valid: true, kind: 'training', certificateNumber: 'FRA-1A2B-3C4D-5E6F', issuedAt: '2026-10-31T10:00:00.000Z',
  holderName: 'Ada Lovelace', organisationName: 'Analytical Trust', title: 'Fraud Risk Awareness Workshop',
  quizScore: 100, areasAssessed: null, verifyUrl: 'https://fraud-risk.co.uk/certificate/verify?n=FRA-1A2B-3C4D-5E6F',
};

function renderAt(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><CertificateVerify /></MemoryRouter>);
}

describe('CertificateVerify', () => {
  beforeEach(() => { mockAnonGet.mockReset(); });

  it('checks the number from the QR code link straight away, without signing in', async () => {
    mockAnonGet.mockResolvedValue(training);
    renderAt('/certificate/verify?n=FRA-1A2B-3C4D-5E6F');

    expect(await screen.findByText('Certificate is valid')).toBeInTheDocument();
    expect(mockAnonGet).toHaveBeenCalledWith('/api/v1/certificates/verify/FRA-1A2B-3C4D-5E6F');
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Analytical Trust')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('31 October 2026')).toBeInTheDocument();
  });

  it('shows an assessment certificate with the organisation and the areas covered', async () => {
    mockAnonGet.mockResolvedValue({
      ...training, kind: 'assessment', holderName: 'Northwind Charity', organisationName: 'Northwind Charity',
      title: 'Q1 assessment', quizScore: null, areasAssessed: 13,
    });
    renderAt('/certificate/verify?n=FRA-AAAA-BBBB-CCCC');

    expect(await screen.findByText('Fraud risk assessment')).toBeInTheDocument();
    expect(screen.getByText('Q1 assessment (13 risk areas)')).toBeInTheDocument();
    expect(screen.queryByText('Quiz score')).not.toBeInTheDocument();
  });

  it('says plainly when no certificate has the number entered', async () => {
    const { ApiError } = await import('@/lib/api');
    const notFound = new (ApiError as unknown as new (code: string, message: string, details?: unknown) => Error)('NOT_FOUND', 'No certificate has this number');
    mockAnonGet.mockRejectedValue(notFound);
    const user = userEvent.setup();
    renderAt('/certificate/verify');

    expect(mockAnonGet).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('Certificate number'), 'FRA-0000-0000-0000');
    await user.click(screen.getByRole('button', { name: 'Check' }));

    expect(await screen.findByText('Not verified')).toBeInTheDocument();
    expect(screen.getByText(/No certificate has this number/)).toBeInTheDocument();
  });
});
