/**
 * Report export - Unit Tests
 *
 * Content of the PDF report and CSV risk register built on the confirmation screen.
 */

import { createEmptyAssessment } from '@/utils/assessment';
import { buildReportHtml, buildRiskRegisterCsv, fileSlug, overallRiskRating } from '@/utils/reportExport';
import type { RiskRegisterItem } from '@/types/assessment';

const risk = (overrides: Partial<RiskRegisterItem>): RiskRegisterItem => ({
  id: 'FRA-001',
  title: 'Supplier bank detail change',
  area: 'Procurement',
  description: 'Bank details changed without call-back verification',
  inherentScore: 20,
  residualScore: 16,
  priority: 'high',
  suggestedOwner: 'Finance Director',
  ...overrides,
});

function assessmentWith(riskRegister: RiskRegisterItem[]) {
  const a = createEmptyAssessment('u1', 'o1');
  a.organisation.name = 'Acme & Co <Ltd>';
  a.riskRegister = riskRegister;
  return a;
}

describe('buildRiskRegisterCsv', () => {
  it('lists risks highest residual score first, with a header row', () => {
    const csv = buildRiskRegisterCsv([
      risk({ id: 'FRA-002', title: 'Low one', residualScore: 4, priority: 'low' }),
      risk({}),
    ]);
    const lines = csv.replace(/^﻿/, '').split('\r\n');

    expect(lines[0]).toBe('"Risk ID","Title","Area","Description","Inherent score","Residual score","Priority","Suggested owner"');
    expect(lines[1]).toContain('"FRA-001"');
    expect(lines[1]).toContain('"High"');
    expect(lines[2]).toContain('"Low one"');
  });

  it('starts with a byte order mark so Excel reads UTF-8', () => {
    expect(buildRiskRegisterCsv([risk({})]).charCodeAt(0)).toBe(0xfeff);
  });

  it('escapes quotes and neutralises spreadsheet formulas', () => {
    const csv = buildRiskRegisterCsv([risk({ title: '=HYPERLINK("http://x")', description: 'Said "urgent"' })]);

    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(csv).toContain('"Said ""urgent"""');
  });
});

describe('buildReportHtml', () => {
  it('includes the summary counts, the risk register and the organisation name, escaped', () => {
    const html = buildReportHtml(assessmentWith([risk({}), risk({ id: 'FRA-002', priority: 'medium', residualScore: 9 })]));

    expect(html).toContain('Acme &amp; Co &lt;Ltd&gt;');
    expect(html).not.toContain('<Ltd>');
    expect(html).toContain('FRA-001');
    expect(html).toContain('Supplier bank detail change');
    expect(html).toMatch(/High risks<br\/><span class="big">1</);
    expect(html).toMatch(/Medium risks<br\/><span class="big">1</);
  });

  it('says so when no risks were identified', () => {
    expect(buildReportHtml(assessmentWith([]))).toContain('No risks were identified.');
  });

  it('embeds a data-URI signature but never a remote image', () => {
    const signed = assessmentWith([]);
    signed.signature = {
      id: 's1', assessmentId: 'a1', signedByUserId: 'u1', signatoryName: 'Jane Smith', signatoryRole: 'CFO',
      signatureImage: 'data:image/png;base64,AAAA', signedAt: '2026-10-03T10:00:00Z',
    };
    expect(buildReportHtml(signed)).toContain('src="data:image/png;base64,AAAA"');

    signed.signature = { ...signed.signature, signatureImage: 'https://evil.example/track.png' };
    const html = buildReportHtml(signed);
    expect(html).toContain('Jane Smith');
    expect(html).not.toContain('evil.example');
  });
});

describe('overallRiskRating and fileSlug', () => {
  it('rates High above three high risks, Medium with any, otherwise Low', () => {
    expect(overallRiskRating([])).toBe('Low');
    expect(overallRiskRating([risk({})])).toBe('Medium');
    expect(overallRiskRating([risk({}), risk({}), risk({}), risk({})])).toBe('High');
  });

  it('makes a safe file name', () => {
    expect(fileSlug('Acme & Co <Ltd>')).toBe('acme-co-ltd');
    expect(fileSlug('***')).toBe('organisation');
  });
});
