import { Link } from 'react-router-dom';
import { LegalPage, type LegalSection } from '@/components/LegalPage';
import { LEGAL } from '@/lib/legal';

const mail = (address: string) => <a href={`mailto:${address}`} className="underline">{address}</a>;

const sections: LegalSection[] = [
  {
    id: 'about', title: 'About these terms',
    body: <p>
      These terms apply when an organisation buys or uses FRAUD-RISK.CO.UK, provided by {LEGAL.companyName} ({LEGAL.companyNumber},
      {' '}{LEGAL.registeredAddress}). The service is for organisations and the people they authorise; by creating an account you
      confirm you can accept these terms for your organisation.
    </p>,
  },
  {
    id: 'service', title: 'What the service is, and is not',
    body: <>
      <p>
        FRAUD-RISK.CO.UK provides fraud risk assessments, awareness training, registers and reports that help an organisation put in
        place and evidence its own fraud prevention procedures.
      </p>
      <p>
        <strong>It is a self-assessment tool, not legal advice.</strong> Scores against the Economic Crime and Corporate Transparency
        Act 2023 and the Government Functional Standard GovS 013 are indicators based on the records you hold in the platform. Whether
        an organisation has reasonable fraud prevention procedures is for that organisation, and ultimately a court, to decide. Take
        legal advice on your obligations.
      </p>
    </>,
  },
  {
    id: 'packages', title: 'Packages, prices and payment',
    body: <>
      <ul>
        <li><strong>Starter</strong>: one fraud risk assessment and report; a one-off purchase.</li>
        <li><strong>Professional</strong> and <strong>Enterprise</strong>: 12-month subscriptions with the features described on our pricing page.</li>
      </ul>
      <p>
        Prices are shown before VAT, which is added at the current rate (VAT number {LEGAL.vatNumber}). Payment is taken by card through
        Stripe when you order. Your package starts once payment is confirmed.
      </p>
      <p>
        Subscriptions do not renew automatically. You can renew in the last 30 days of your term; if you do not, access to subscription
        features ends when the term ends, and your records stay available to export for [period to be confirmed].
      </p>
    </>,
  },
  {
    id: 'cancellation', title: 'Cancellation and refunds',
    body: <p>
      [To be confirmed by the business: for example, whether a refund is available if a package is cancelled within 14 days and before
      it is used, and how unused key-passes are treated.] Nothing in these terms affects rights you have by law.
    </p>,
  },
  {
    id: 'accounts', title: 'Accounts, key-passes and security',
    body: <ul>
      <li>Keep sign-in details secure and tell us at {mail(LEGAL.supportEmail)} if you think an account has been misused.</li>
      <li>Key-passes let your employees join your organisation. Give each one to a single person, and revoke any that are no longer needed.</li>
      <li>API keys are read-only and give access to your organisation's records; protect them like passwords.</li>
    </ul>,
  },
  {
    id: 'your-data', title: 'Your organisation\'s data',
    body: <>
      <p>
        Your organisation owns the records it puts into the platform and is the controller of any personal data in them. We process that
        data only to provide the service and on your instructions, as described in our <Link to="/privacy" className="underline">privacy notice</Link>{' '}
        and [data processing agreement].
      </p>
      <p>You can export your records at any time, including the ECCTA evidence pack, and ask us to delete them when you leave.</p>
    </>,
  },
  {
    id: 'acceptable-use', title: 'Acceptable use',
    body: <ul>
      <li>Use the service lawfully and only for your organisation's fraud risk management.</li>
      <li>Do not try to access other organisations' data, overload or probe the service, or share access outside your organisation.</li>
      <li>Speak-up links must not be used to collect information for any purpose other than receiving and handling reports.</li>
    </ul>,
  },
  {
    id: 'availability', title: 'Availability and changes',
    body: <p>
      We aim to keep the service available and secure, but cannot promise it will be uninterrupted. We may improve or change features;
      if a change materially reduces a paid feature during your term, we will tell you and [offer a pro-rata refund].
    </p>,
  },
  {
    id: 'liability', title: 'Liability',
    body: <p>
      [Liability terms to be drafted by a legal adviser, including any cap on liability.] Nothing in these terms limits liability for
      death or personal injury caused by negligence, for fraud, or for anything else that cannot be limited by law.
    </p>,
  },
  {
    id: 'ending', title: 'Ending the agreement',
    body: <p>
      Either party may end the agreement if the other materially breaches these terms and does not put it right within 30 days of
      notice. We may suspend access straight away to protect the service or other customers from misuse.
    </p>,
  },
  {
    id: 'law', title: 'Law and contact',
    body: <p>
      These terms are governed by the law of England and Wales, and the courts of England and Wales have jurisdiction. Questions:
      {' '}{mail(LEGAL.supportEmail)}.
    </p>,
  },
];

export default function Terms() {
  return (
    <LegalPage
      title="Terms of service"
      intro={<p>These terms set out how organisations can use FRAUD-RISK.CO.UK, how payment works, and what each side is responsible for.</p>}
      sections={sections}
    />
  );
}
