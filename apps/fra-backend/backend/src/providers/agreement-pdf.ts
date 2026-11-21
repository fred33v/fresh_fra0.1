import { PDFDocument, StandardFonts } from 'pdf-lib';
import type { Application } from './access.js';
import type { AgreementTerms } from './agreement-policy.js';

export async function agreementPdf(
  application: Application,
  terms: AgreementTerms,
  agreementId: string
) {
  const { fullName, businessName, country, engagement } = application.profile as {
    fullName: string;
    businessName: string;
    country: string;
    engagement: {
      businessAddress: Record<string, string>;
      legalStructure: string;
      companyNumber: string;
      vatRegistered: string;
      vatNumber: string;
    };
  };
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages: Array<{ width: number; height: number }> = [];
  let page = pdf.addPage([595, 842]),
    y = 780;
  pages.push({ width: 595, height: 842 });
  const line = (value: string, size = 10) => {
    if (y < 65) {
      page = pdf.addPage([595, 842]);
      pages.push({ width: 595, height: 842 });
      y = 780;
    }
    page.drawText(value, { x: 45, y, size, font });
    y -= size + 6;
  };
  const paragraph = (value: string) => {
    for (const raw of value.split(/\r?\n/)) {
      let remaining = raw;
      while (remaining.length) {
        let cut = remaining.length;
        while (cut > 1 && font.widthOfTextAtSize(remaining.slice(0, cut), 10) > 500) cut--;
        const space = remaining.lastIndexOf(' ', cut);
        if (cut < remaining.length && space > 0) cut = space;
        line(remaining.slice(0, cut));
        remaining = remaining.slice(cut).trimStart();
      }
      line('');
    }
  };
  line('INDEPENDENT SERVICES AGREEMENT', 16);
  paragraph(
    `Agreement ${agreementId}\nApplication ${application.id} - revision ${application.version}`
  );
  paragraph(
    'Proposed agreement for review and signature by both parties. No guaranteed minimum assignments, hours or income. No work is authorised merely by programme approval.'
  );
  for (const [heading, value] of [
    [
      'Contracting organisation',
      `${terms.operatorName}\n${terms.operatorAddress}\nAuthorised signatory: ${terms.signatoryName} (${terms.signatoryEmail})`,
    ],
    [
      'Provider / referrer',
      `${fullName} - ${businessName}\n${engagement.legalStructure} - ${country}\n${Object.values(engagement.businessAddress).filter(Boolean).join(', ')}\nCompany / LLP: ${engagement.companyNumber || 'Not applicable'}\nVAT (declared): ${engagement.vatRegistered} ${engagement.vatNumber}`,
    ],
    ['Services and assignments', terms.scope],
    [
      'Referral remuneration',
      'The provider or referrer receives 17% of the VAT-exclusive package sales they bring. This referral commission is not a fee on professional services. No minimum sales or income is guaranteed.',
    ],
    ['Payment, attribution, refunds and disputes', terms.paymentTerms],
    ['Expenses', terms.expenses],
    ['Confidentiality', terms.confidentiality],
    ['Data handling', terms.dataHandling],
    ['Termination', terms.termination],
    ['Governing law', terms.governingLaw],
  ]) {
    line(heading, 12);
    paragraph(value);
  }
  // A separate page keeps both signature rectangles clear of the terms.
  page = pdf.addPage([595, 842]);
  pages.push({ width: 595, height: 842 });
  y = 780;
  line('SIGNATURES', 16);
  paragraph(
    `Agreement ${agreementId}\nBy signing, each signatory confirms that they have reviewed the preceding agreement and intend to enter into it on behalf of the named party.`
  );
  y = 560;
  line('Provider / referrer signature', 11);
  y = 380;
  line('Organisation authorised signature', 11);
  return {
    pdf: Buffer.from(await pdf.save({ useObjectStreams: false })),
    pages,
    signaturePage: pages.length - 1,
  };
}
