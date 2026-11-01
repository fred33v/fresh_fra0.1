import { LegalPage, type LegalSection } from '@/components/LegalPage';
import { LEGAL } from '@/lib/legal';

// When the site is tested again, update these dates and the lists of known problems below.
const ACCESSIBILITY = {
  lastUpdated: '1 November 2026',
  preparedOn: '31 October 2026',
  lastTested: '1 November 2026',
  standard: 'Web Content Accessibility Guidelines (WCAG) version 2.2 AA',
};

const mail = (address: string) => <a href={`mailto:${address}`} className="underline">{address}</a>;
const external = (href: string, text: string) => (
  <a href={href} className="underline" target="_blank" rel="noopener noreferrer">{text} (opens in a new tab)</a>
);

const sections: LegalSection[] = [
  {
    id: 'using', title: 'Using this website',
    body: <>
      <p>We want as many people as possible to be able to use this website. For example, you should be able to:</p>
      <ul>
        <li>change colours, contrast levels and fonts using your browser or device settings</li>
        <li>move through the website using just a keyboard, with a link at the top of each page to skip straight to the content</li>
        <li>use the website with speech recognition software (we have not tested this yet, see section 6)</li>
        <li>listen to the website using a screen reader, such as NVDA, JAWS or VoiceOver (we have not tested this yet, see section 6)</li>
      </ul>
      <p>We have also tried to make the text as simple as possible to understand.</p>
      <p>{external('https://mcmw.abilitynet.org.uk/', 'AbilityNet')} has advice on making your device easier to use if you have a disability.</p>
    </>,
  },
  {
    id: 'how-accessible', title: 'How accessible this website is',
    body: <>
      <p>Some parts of this website may not be fully accessible:</p>
      <ul>
        <li>we have not yet tested the website with a screen reader, so some problems for screen reader users may not be known yet</li>
        <li>the downloadable PDFs (workshop resources and certificates) are produced with tags, but have not yet been checked with a screen reader</li>
      </ul>
      <p>Section 6 explains what is left to test and when we plan to do it.</p>
    </>,
  },
  {
    id: 'other-formats', title: 'Asking for information in another format',
    body: <>
      <p>If you need information on this website in a different format, such as accessible PDF, large print or plain text, email {mail(LEGAL.supportEmail)}.</p>
      <p>Tell us the web address (URL) of the page or the name of the document, your name and email address, and the format you need.</p>
      <p>We will consider your request and aim to get back to you within 5 working days.</p>
    </>,
  },
  {
    id: 'reporting', title: 'Reporting accessibility problems with this website',
    body: <>
      <p>
        We are always looking to improve the accessibility of this website. If you find any problems not listed on this page, or think we
        are not meeting accessibility requirements, email {mail(LEGAL.supportEmail)}. Please tell us the page, what you were trying to do,
        and the browser and any assistive technology you were using.
      </p>
      <p>
        If you are not happy with how we respond, you can contact the {external('https://www.equalityadvisoryservice.com/', 'Equality Advisory and Support Service (EASS)')}.
      </p>
    </>,
  },
  {
    id: 'compliance', title: 'Technical information about this website’s accessibility',
    body: <>
      <p>We are committed to making our website accessible, in line with the Equality Act 2010.</p>
      <p>
        This website is <strong>partially compliant</strong> with the {ACCESSIBILITY.standard}, because some content has not yet been
        fully tested, as listed in section 6.
      </p>
    </>,
  },
  {
    id: 'non-accessible', title: 'Non-accessible content',
    body: <>
      <p>The content listed below may not be fully accessible, for the following reasons.</p>
      <h3 className="font-semibold">Content we have not fully tested</h3>
      <ul>
        <li>
          The website as a whole with a screen reader or speech recognition software. Our checks so far are automated tools and
          keyboard-only use. We plan to test it with VoiceOver, NVDA and Voice Control by 3 November 2026.
        </li>
        <li>
          PDF documents, including the workshop resources and the training and assessment certificates. They are generated with tags and
          a document language, but we have not yet tested them with a screen reader. If you cannot use one, ask us for another format
          (see section 3).
        </li>
      </ul>
      <h3 className="font-semibold">Content provided by others</h3>
      <p>
        Card payments are taken on a page provided by Stripe. Stripe is responsible for that page’s accessibility; tell us if you have
        trouble paying and we will help.
      </p>
    </>,
  },
  {
    id: 'improving', title: 'What we are doing to improve accessibility',
    body: <>
      <p>
        We check every page with automated accessibility tools and a keyboard each time we test the site, and fix problems as we find
        them. Next, we plan to test the website and its PDFs with screen readers (NVDA and VoiceOver) and with people who use assistive
        technology.
      </p>
    </>,
  },
  {
    id: 'preparation', title: 'Preparation of this accessibility statement',
    body: <>
      <p>This statement was prepared on {ACCESSIBILITY.preparedOn}. It was last reviewed on {ACCESSIBILITY.lastUpdated}.</p>
      <p>
        This website was last tested on {ACCESSIBILITY.lastTested}. The test was carried out by our own team, against WCAG 2.2 AA, using
        automated checks (axe-core) and keyboard-only navigation in a Chromium browser on a desktop screen.
      </p>
      <p>
        We tested every page of the website: 32 pages, including each tab of the organisation dashboard and the compliance pages,
        checkout, the speak-up pages and the staff dashboard. Signed-in pages were tested with a sample organisation of 500 staff, and the
        fraud risk assessment was completed with a keyboard only. Each chart has a text summary and a table of its figures.
      </p>
    </>,
  },
];

export default function Accessibility() {
  return (
    <LegalPage
      title="Accessibility statement"
      lastUpdated={ACCESSIBILITY.lastUpdated}
      draftNotice={false}
      intro={<p>
        This accessibility statement applies to FRAUD-RISK.CO.UK, the fraud risk assessment and training service at fraud-risk.co.uk.
      </p>}
      sections={sections}
    />
  );
}
