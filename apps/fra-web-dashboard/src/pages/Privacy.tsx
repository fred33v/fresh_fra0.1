import { LegalPage, type LegalSection } from '@/components/LegalPage';
import { LEGAL } from '@/lib/legal';

const mail = (address: string) => <a href={`mailto:${address}`} className="underline">{address}</a>;

const sections: LegalSection[] = [
  {
    id: 'who-we-are', title: 'Who we are and our role',
    body: <>
      <p>
        FRAUD-RISK.CO.UK is provided by {LEGAL.companyName}, a company registered in England and Wales
        (number {LEGAL.companyNumber}), registered office {LEGAL.registeredAddress}. We are registered with the
        Information Commissioner's Office ({LEGAL.icoRegistration}).
      </p>
      <p>
        <strong>We are the controller</strong> for the details of people who buy and manage accounts: names, work email addresses,
        billing records and how they use the service.
      </p>
      <p>
        <strong>We act as a processor</strong> for information an organisation puts into the platform about its own people and
        operations: staff assessments, risk registers, incidents, counter-fraud registers, training records and speak-up reports.
        The organisation is the controller of that information and decides how it is used. If you are an employee of one of our
        customers, contact your employer first about that information.
      </p>
    </>,
  },
  {
    id: 'what-we-collect', title: 'What we collect',
    body: <>
      <ul>
        <li><strong>Account details:</strong> name, work email address, organisation, department, role and an encrypted (hashed) password. We never store your password itself.</li>
        <li><strong>Assessment answers</strong> about fraud risks and controls, and the scores worked out from them.</li>
        <li><strong>Compliance records</strong> your organisation enters: risks, incidents, policies, board minutes, losses, associated persons and due diligence, gifts and hospitality, conflicts of interest.</li>
        <li><strong>Training records:</strong> workshop progress, quiz scores, action plans and certificates. Anyone who has a certificate's number (it is printed on the certificate, with a QR code) can check it on our verification page, which shows the holder's name, organisation, course, quiz score and date. Assessment certificates show the organisation's name and the date, never its answers or risk scores.</li>
        <li><strong>Payment records:</strong> what was bought, when and for how much. Card details are entered on Stripe's page and never reach us.</li>
        <li><strong>Security and audit records:</strong> sign-ins and changes to records, with the internet (IP) address and browser used, so organisations can evidence who did what. These are not kept for speak-up reports (see section 4).</li>
      </ul>
    </>,
  },
  {
    id: 'how-we-use', title: 'How we use it, and our lawful basis',
    body: <>
      <table>
        <thead><tr><th scope="col">Purpose</th><th scope="col">Lawful basis (UK GDPR)</th></tr></thead>
        <tbody>
          <tr><td>Providing the service you or your organisation bought</td><td>Contract</td></tr>
          <tr><td>Taking payment and keeping financial records</td><td>Contract; legal obligation (tax records)</td></tr>
          <tr><td>Keeping accounts secure, preventing misuse, keeping audit trails</td><td>Legitimate interests</td></tr>
          <tr><td>Service emails, such as password resets and changed-password notices</td><td>Contract; legitimate interests</td></tr>
          <tr><td>Processing your organisation's records on its instructions</td><td>As set by your organisation, as controller</td></tr>
        </tbody>
      </table>
      <p>We do not sell personal data, use it for advertising, or make decisions about people by automated means that have legal or similarly significant effects. Risk scores support an organisation's own judgement.</p>
    </>,
  },
  {
    id: 'speak-up', title: 'Speak-up reports',
    body: <>
      <p>Organisations can offer a speak-up link for reporting suspected fraud, bribery or corruption.</p>
      <ul>
        <li>You can report anonymously. We do not record the internet address of anyone making or following a report.</li>
        <li>If you choose to give your name or contact details, only the people your organisation allows to handle cases can see them.</li>
        <li>Your access key is stored only in a scrambled (hashed) form, so it cannot be read back, even by us.</li>
        <li>Case logs exported for audit leave out the report text and reporter identity.</li>
      </ul>
      <p>Whistleblowers may also be protected by the Public Interest Disclosure Act 1998 when reporting to their employer.</p>
    </>,
  },
  {
    id: 'sharing', title: 'Who we share it with',
    body: <>
      <p>We use these service providers (processors) under contracts that require them to protect the data:</p>
      <ul>
        <li><strong>Amazon Web Services</strong>: application hosting and file storage, Stockholm, Sweden (eu-north-1).</li>
        <li><strong>Neon</strong>: managed PostgreSQL database, encrypted at rest. [Region to be confirmed.]</li>
        <li><strong>Stripe</strong>: card payments. Stripe is the controller for the card details you give it.</li>
        <li><strong>Upstash</strong>: short-lived security data such as rate limits and password reset links.</li>
        <li><strong>[Email provider]</strong>: sending service emails.</li>
      </ul>
      <p>If an organisation connects its own tools through API keys or webhooks, records are sent where it directs. We may disclose information where the law requires it.</p>
    </>,
  },
  {
    id: 'transfers', title: 'Transfers outside the UK',
    body: <p>
      Our main hosting is in Sweden, in the European Economic Area, which the UK recognises as adequate. Where a provider processes
      data elsewhere outside the UK, such as Stripe in the United States, we rely on UK adequacy regulations or the International
      Data Transfer Agreement or Addendum to protect it. [Confirm against each provider's terms.]
    </p>,
  },
  {
    id: 'retention', title: 'How long we keep it',
    body: <>
      <table>
        <thead><tr><th scope="col">Record</th><th scope="col">Kept for</th></tr></thead>
        <tbody>
          <tr><td>Fraud assessments, audit logs, closed risks, resolved incidents, closed speak-up cases and most counter-fraud records</td><td>6 years</td></tr>
          <tr><td>Payment records</td><td>7 years</td></tr>
          <tr><td>Expired key-passes and workshop feedback</td><td>2 years</td></tr>
          <tr><td>Sign-in sessions</td><td>90 days</td></tr>
          <tr><td>Password reset links</td><td>1 hour</td></tr>
        </tbody>
      </table>
      <p>Open risks and unresolved incidents are kept while they are open. An organisation can ask us to delete its data earlier when its subscription ends.</p>
    </>,
  },
  {
    id: 'security', title: 'How we protect it',
    body: <p>
      Data is encrypted in transit and at rest; passwords and speak-up access keys are stored only as one-way hashes; access is
      limited by role and package; every change is logged; and card details never touch our systems.
    </p>,
  },
  {
    id: 'rights', title: 'Your rights',
    body: <>
      <p>
        You can ask to see the personal data we hold about you, have it corrected or deleted, restrict or object to its use, or
        receive it in a portable format. Email {mail(LEGAL.privacyEmail)}. We reply within one month.
      </p>
      <p>
        For information your employer put into the platform, we will pass your request to your organisation, as the controller, and
        help it respond.
      </p>
    </>,
  },
  {
    id: 'cookies', title: 'Cookies and local storage',
    body: <p>
      We do not use advertising or analytics cookies, so we do not ask for cookie consent. To keep you signed in, your browser stores
      sign-in tokens in its local storage, which is strictly necessary for the service. Some pages remember display preferences in
      the same way.
    </p>,
  },
  {
    id: 'complaints', title: 'Questions and complaints',
    body: <p>
      Contact us at {mail(LEGAL.privacyEmail)}. If you are unhappy with how we handle your data, you can complain to the Information
      Commissioner's Office at <a href="https://ico.org.uk/make-a-complaint/" className="underline">ico.org.uk</a> or on 0303 123 1113.
    </p>,
  },
  {
    id: 'changes', title: 'Changes to this notice',
    body: <p>We will update this page when our practices change, and tell account holders by email about significant changes.</p>,
  },
];

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy notice"
      intro={<p>This notice explains what personal data FRAUD-RISK.CO.UK holds, why, who it is shared with, how long it is kept, and your rights.</p>}
      sections={sections}
    />
  );
}
