import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CertificateDocument } from '@/components/certificate/CertificateDocument';

describe('CertificateDocument', () => {
  it('shows a training certificate as real text: name, course, score, number and dates', () => {
    render(
      <CertificateDocument
        kind="training" holderName="Alice Smith" organisationName="Northwind Charity"
        certificateNumber="FRA-1A2B-3C4D-5E6F" issuedAt="2026-11-05T10:00:00Z" quizScore={100}
        verifyUrl="https://fraud-risk.co.uk/certificate/verify?n=FRA-1A2B-3C4D-5E6F"
      />,
    );
    expect(screen.getByRole('article', { name: 'Certificate of Training Completion' })).toBeInTheDocument();
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Northwind Charity')).toBeInTheDocument();
    expect(screen.getByText('Fraud Risk Awareness Workshop')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('FRA-1A2B-3C4D-5E6F')).toBeInTheDocument();
    expect(screen.getAllByText('5 November 2026')).toHaveLength(2);
    expect(screen.getByText('fraud-risk.co.uk/certificate/verify')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /QR code/ })).toBeInTheDocument();
  });

  it('shows an assessment certificate for the organisation, marked as an example when asked', () => {
    render(
      <CertificateDocument
        kind="assessment" sample holderName="Your Organisation Ltd" assessmentTitle="Annual assessment"
        certificateNumber="FRA-0000-0000-0000" issuedAt="2026-11-05T10:00:00Z" areasAssessed={13}
        verifyUrl="https://fraud-risk.co.uk/certificate/verify"
      />,
    );
    expect(screen.getByRole('article', { name: 'Example Certificate of Fraud Risk Assessment' })).toBeInTheDocument();
    expect(screen.getByText('Example')).toBeInTheDocument();
    expect(screen.getByText('Annual assessment')).toBeInTheDocument();
    expect(screen.getByText(/covering 13 risk areas/)).toBeInTheDocument();
    expect(screen.queryByText(/Quiz score/)).not.toBeInTheDocument();
  });
});
