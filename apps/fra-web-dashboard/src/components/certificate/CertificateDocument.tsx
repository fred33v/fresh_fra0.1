import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import './certificate.css';

/**
 * A certificate laid out like the printed one: cream paper, double gold frame,
 * serif title, the holder's name, what was completed, and a footer with the
 * key facts, a QR code to the public verification page and the issuer.
 *
 * Everything is real text, so it can be read by screen readers, copied and
 * changed in code. The server's PDF uses the same design
 * (apps/fra-backend/backend/src/certificates.ts): change both together.
 */

export type CertificateKind = 'training' | 'assessment';

export interface CertificateDocumentProps {
  kind: CertificateKind;
  /** Training: the person. Assessment: the organisation. */
  holderName: string;
  /** Training only: shown under the person's name. */
  organisationName?: string | null;
  /** Assessment only: the assessment's title. */
  assessmentTitle?: string | null;
  certificateNumber: string;
  /** ISO date the certificate was issued (also the completion date). */
  issuedAt: string;
  /** Training only: quiz score in percent. */
  quizScore?: number | null;
  /** Assessment only: number of risk areas covered. */
  areasAssessed?: number | null;
  /** Where the QR code points: the public verification page for this number. */
  verifyUrl: string;
  /** Marks the certificate as an example (package pages). */
  sample?: boolean;
  className?: string;
}

const TRAINING_COURSE = 'Fraud Risk Awareness Workshop';
const TRAINING_DURATION = '30 minutes';
const ISSUER = 'fraud-risk.co.uk';

function certificateHeading(kind: CertificateKind): string {
  return kind === 'training' ? 'Certificate of Training Completion' : 'Certificate of Fraud Risk Assessment';
}

function longDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' });
}

function ShieldMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path d="M24 3 6 10v12c0 11.5 7.7 20.6 18 23 10.3-2.4 18-11.5 18-23V10L24 3Z" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="m15.5 24.5 6 6 11-12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Seal() {
  // A round issuer's seal (not a signature): ring, dotted inner ring and the shield mark
  return (
    <svg className="cert-seal" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="32" cy="32" r="25.5" fill="none" stroke="currentColor" strokeWidth="0.9" strokeDasharray="1.2 2.2" />
      <path d="M32 15 20 19.5v8c0 7.7 5.1 13.8 12 15.5 6.9-1.7 12-7.8 12-15.5v-8L32 15Z" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="m26.5 29.5 4 4 7.5-8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <text x="32" y="51" textAnchor="middle" fontSize="4.4" fontFamily="Helvetica, Arial, sans-serif" fontWeight="700" letterSpacing="1.2" fill="currentColor">VERIFIED</text>
    </svg>
  );
}

function useQrSvg(url: string): string | null {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#3b2a1a', light: '#ffffff' } })
      .then((value) => { if (!cancelled) setSvg(value); })
      .catch(() => { if (!cancelled) setSvg(null); });
    return () => { cancelled = true; };
  }, [url]);
  return svg;
}

export function CertificateDocument(props: CertificateDocumentProps) {
  const {
    kind, holderName, organisationName, assessmentTitle, certificateNumber, issuedAt,
    quizScore, areasAssessed, verifyUrl, sample, className,
  } = props;
  const training = kind === 'training';
  const heading = certificateHeading(kind);
  const qrSvg = useQrSvg(verifyUrl);
  const issued = longDate(issuedAt);
  const verifyHost = verifyUrl.replace(/^https?:\/\//, '').split('?')[0];

  return (
    <div className={['cert', className].filter(Boolean).join(' ')}>
      <article className="cert-sheet" aria-label={sample ? `Example ${heading}` : heading}>
        <div className="cert-frame-h" aria-hidden="true" />
        <div className="cert-frame-v" aria-hidden="true" />
        {sample && <div className="cert-sample">Example</div>}

        <div className="cert-body">
          <div className="cert-brand">
            <ShieldMark />
            <div className="cert-brand-name">
              {ISSUER}
              <small>Built for GovS 013 &amp; ECCTA 2023</small>
            </div>
          </div>

          <h2 className="cert-title">{heading}</h2>

          <p className="cert-lead">This is to certify that</p>
          <p className="cert-holder">{holderName}</p>
          {training && organisationName ? <p className="cert-org">{organisationName}</p> : null}
          <div className="cert-rule" aria-hidden="true" />

          <p className="cert-completed">{training ? 'has successfully completed' : 'has completed a fraud risk assessment'}</p>
          <p className="cert-course">{training ? TRAINING_COURSE : (assessmentTitle || 'Fraud Risk Assessment')}</p>

          <p className="cert-description">
            {training
              ? 'This certificate confirms that the participant has completed fraud risk awareness training for trustees, executive leadership and budget holders, covering the UK regulatory landscape (including the Economic Crime and Corporate Transparency Act 2023 and GovS 013), common fraud types and risks, practical defence strategies and real-world case studies.'
              : `This certificate confirms that the organisation has completed a structured fraud risk assessment covering ${areasAssessed ?? 13} risk areas, from governance and financial controls to whistleblowing and third-party risk, to support the reasonable fraud prevention procedures expected under the Economic Crime and Corporate Transparency Act 2023.`}
          </p>

          <div className="cert-footer">
            <dl className="cert-facts cert-facts-left">
              {training ? (
                <>
                  <div><dt>Course duration</dt><dd>{TRAINING_DURATION}</dd></div>
                  <div><dt>Completion date</dt><dd>{issued}</dd></div>
                  {typeof quizScore === 'number' && <div><dt>Quiz score</dt><dd>{quizScore}%</dd></div>}
                </>
              ) : (
                <>
                  <div><dt>Risk areas assessed</dt><dd>{areasAssessed ?? 13}</dd></div>
                  <div><dt>Completion date</dt><dd>{issued}</dd></div>
                </>
              )}
            </dl>

            <div className="cert-qr">
              <div className="cert-qr-code" role="img" aria-label={`QR code linking to the verification page for certificate ${certificateNumber}`}>
                {qrSvg ? <span dangerouslySetInnerHTML={{ __html: qrSvg }} /> : null}
              </div>
              <span>Scan to confirm<br />it is genuine</span>
            </div>

            <div className="cert-issuer">
              <Seal />
              <div className="cert-issuer-name">{ISSUER}</div>
              <div className="cert-issuer-role">Certificate issuer</div>
            </div>

            <dl className="cert-facts cert-facts-right">
              <div><dt>Certificate number</dt><dd className="cert-mono">{certificateNumber}</dd></div>
              <div><dt>Issued</dt><dd>{issued}</dd></div>
              <div><dt>Verify at</dt><dd>{verifyHost}</dd></div>
            </dl>
          </div>
        </div>
      </article>
    </div>
  );
}
