import type { ActionItem, AssessmentData, RiskRegisterItem } from '@/types/assessment';

// Builds the exported documents from a completed assessment. Kept free of native modules
// so the content can be unit-tested; app/confirmation.tsx turns it into files and shares them.

const PRIORITY_LABEL: Record<RiskRegisterItem['priority'], string> = { high: 'High', medium: 'Medium', low: 'Low' };

/** Same rating rule the confirmation screen shows. */
export function overallRiskRating(riskRegister: RiskRegisterItem[]): 'High' | 'Medium' | 'Low' {
  const high = riskRegister.filter((r) => r.priority === 'high').length;
  return high > 3 ? 'High' : high > 0 ? 'Medium' : 'Low';
}

/** A file-name-safe slug, e.g. "Acme & Co Ltd" → "acme-co-ltd". */
export function fileSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'organisation';
}

// Prefix formula characters so a title like "=HYPERLINK(...)" is not run by Excel
function csvCell(value: string | number): string {
  const text = String(value).replace(/^([=+\-@\t\r])/, "'$1");
  return `"${text.replace(/"/g, '""')}"`;
}

/** Risk register as CSV, highest residual risk first. */
export function buildRiskRegisterCsv(riskRegister: RiskRegisterItem[]): string {
  const header = ['Risk ID', 'Title', 'Area', 'Description', 'Inherent score', 'Residual score', 'Priority', 'Suggested owner'];
  const rows = [...riskRegister]
    .sort((a, b) => b.residualScore - a.residualScore)
    .map((r) => [r.id, r.title, r.area, r.description, r.inherentScore, r.residualScore, PRIORITY_LABEL[r.priority], r.suggestedOwner].map(csvCell).join(','));
  // Leading BOM so Excel opens the file as UTF-8 (pound signs, en dashes)
  return '﻿' + [header.map(csvCell).join(','), ...rows].join('\r\n');
}

function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

function actionRows(items: ActionItem[]): string {
  return items.map((a) => `<tr><td>${esc(a.title)}</td><td>${esc(a.owner)}</td><td>${esc(a.timeline)}</td></tr>`).join('');
}

/** Printable HTML for the full FRA report (A4, rendered to PDF on the device). */
export function buildReportHtml(assessment: AssessmentData, generatedAt: Date = new Date()): string {
  const risks = [...assessment.riskRegister].sort((a, b) => b.residualScore - a.residualScore);
  const count = (p: RiskRegisterItem['priority']) => risks.filter((r) => r.priority === p).length;
  const rating = overallRiskRating(risks);
  const dc = assessment.documentControl;
  const plan = assessment.actionPlan;
  const sig = assessment.signature;
  // Only embed signature images we produced ourselves (data URIs), never remote URLs
  const sigImage = sig?.signatureImage?.startsWith('data:image/') ? `<img class="sig" src="${esc(sig.signatureImage)}" alt="Signature"/>` : '';

  const planSection = (title: string, items: ActionItem[]) => items.length === 0 ? '' : `
    <h3>${esc(title)}</h3>
    <table><thead><tr><th>Action</th><th>Owner</th><th>Timeline</th></tr></thead><tbody>${actionRows(items)}</tbody></table>`;

  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"/>
<title>Fraud Risk Assessment — ${esc(assessment.organisation.name)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #0b0c0c; font-size: 11pt; line-height: 1.45; }
  h1 { font-size: 20pt; margin: 0 0 4px; } h2 { font-size: 14pt; margin: 22px 0 8px; border-bottom: 2px solid #1d70b8; padding-bottom: 4px; }
  h3 { font-size: 12pt; margin: 14px 0 6px; } .muted { color: #505a5f; }
  h2, h3 { page-break-after: avoid; break-after: avoid; } /* never leave a heading alone at the foot of a page */
  table { width: 100%; border-collapse: collapse; margin: 6px 0 10px; } th, td { border: 1px solid #b1b4b6; padding: 5px 7px; text-align: left; vertical-align: top; }
  th { background: #f3f2f1; } tr { page-break-inside: avoid; } .num { text-align: right; }
  .p-high { color: #a4211b; font-weight: 600; } .p-medium { color: #8a4a00; font-weight: 600; } .p-low { color: #00703c; font-weight: 600; }
  .summary td { width: 25%; } .big { font-size: 16pt; font-weight: 700; } .sig { max-height: 60px; margin-top: 6px; }
</style></head><body>
  <h1>Comprehensive Fraud Risk Assessment</h1>
  <p class="muted">${esc(assessment.organisation.name)} · Aligned with GovS 013, the Fraud Prevention Standard and ECCTA 2023 · Generated ${esc(fmtDate(generatedAt.toISOString()))}</p>

  <h2>Document control</h2>
  <table>
    <tr><th>Version</th><td>${esc(dc.version)}</td><th>Last updated</th><td>${esc(fmtDate(dc.lastUpdated))}</td></tr>
    <tr><th>Classification</th><td>${esc(dc.classification)}</td><th>Retention period</th><td>${esc(dc.retentionPeriod)}</td></tr>
  </table>

  <h2>Executive summary</h2>
  <table class="summary"><tr>
    <td>Overall rating<br/><span class="big p-${rating.toLowerCase()}">${rating}</span></td>
    <td>High risks<br/><span class="big">${count('high')}</span></td>
    <td>Medium risks<br/><span class="big">${count('medium')}</span></td>
    <td>Low risks<br/><span class="big">${count('low')}</span></td>
  </tr></table>

  <h2>Risk register</h2>
  ${risks.length === 0 ? '<p class="muted">No risks were identified.</p>' : `
  <table><thead><tr><th>ID</th><th>Risk</th><th>Area</th><th class="num">Inherent</th><th class="num">Residual</th><th>Priority</th><th>Suggested owner</th></tr></thead><tbody>
  ${risks.map((r) => `<tr><td>${esc(r.id)}</td><td><strong>${esc(r.title)}</strong><br/><span class="muted">${esc(r.description)}</span></td><td>${esc(r.area)}</td><td class="num">${r.inherentScore}</td><td class="num">${r.residualScore}</td><td class="p-${r.priority}">${PRIORITY_LABEL[r.priority]}</td><td>${esc(r.suggestedOwner)}</td></tr>`).join('')}
  </tbody></table>
  <p class="muted">Inherent risk = impact × likelihood (1–25). Residual risk applies the control reduction. High 15–25, medium 8–14, low 1–7.</p>`}

  <h2>Action plan</h2>
  ${planSection('High priority', plan.highPriority)}${planSection('Medium priority', plan.mediumPriority)}${planSection('Low priority', plan.lowPriority)}
  ${plan.highPriority.length + plan.mediumPriority.length + plan.lowPriority.length === 0 ? '<p class="muted">No actions recorded.</p>' : ''}

  ${sig ? `<h2>Sign-off</h2><p>Signed by <strong>${esc(sig.signatoryName)}</strong>, ${esc(sig.signatoryRole)}, on ${esc(fmtDate(sig.signedAt))}.</p>${sigImage}` : ''}

  <p class="muted" style="margin-top:28px">FRAUD-RISK.CO.UK · assessment@fraud-risk.co.uk · This report supports, but does not replace, legal advice on ECCTA 2023.</p>
</body></html>`;
}
