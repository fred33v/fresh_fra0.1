import type { DbExecutor } from './db/transaction.js';
export async function recordCandidateRevision(
  db: DbExecutor,
  row: Record<string, unknown>,
  actorId: string,
  event: string
) {
  await db.query(
    `INSERT INTO public.provider_application_revisions(application_id,revision,snapshot,actor_id,event)
 VALUES($1,$2,$3,$4,$5) ON CONFLICT(application_id,revision) DO NOTHING`,
    [row.id, row.revision, row, actorId, event]
  );
}
export function candidateDossier(
  row: Record<string, unknown>,
  history: Array<{
    revision: number;
    snapshot: Record<string, unknown>;
    event: string;
    recorded_at: unknown;
  }>
) {
  return [
    'PROVIDER AGREEMENT PREPARATION DOSSIER — NOT A CONTRACT',
    'Private candidate information; authorised applicant/reviewer use only.',
    `Application: ${row.id} | revision: ${row.revision} | programme status: ${row.status}`,
    `Name/email recorded on application: ${row.applicant_name} / ${row.applicant_email}`,
    `Company: ${row.company_name} | service interest: ${row.service_interest}`,
    `Experience: ${row.training_experience ?? 'Not supplied'}`,
    '',
    'INDEPENDENT CANDIDATE DECLARATION (UNVERIFIED)',
    row.candidate_profile
      ? JSON.stringify(row.candidate_profile, null, 2)
      : 'No independent declaration supplied. Do not invent declarations for legacy or other engagement types.',
    '',
    'AGREEMENT PREPARATION',
    'Review the actual working arrangement and appropriate employment/tax status separately.',
    'Agree the legal parties, services/fees, payment timing, expenses, confidentiality, data handling, termination and governing law.',
    'Independent declarations propose no minimum assignments/hours/income; they do not establish employment/tax status or execute a contract.',
    'The existing programme pays 17% on eligible VAT-exclusive collected package sales; calculations, refund/dispute adjustments and settlements remain governed by the existing commission ledger.',
    'Use the existing signing workflow. The current #86 approval policy requires a completed retained document titled "Provider agreement ...", signed only by the applicant. This dossier is not that agreement.',
    'Approval, qualification verification and bank settlement remain separate existing controls. A recorded bank reference is staff attestation, not independent bank API confirmation.',
    '',
    'RETAINED APPLICATION AMENDMENTS',
    ...history.map((h) =>
      JSON.stringify(
        { revision: h.revision, event: h.event, recordedAt: h.recorded_at, snapshot: h.snapshot },
        null,
        2
      )
    ),
    '',
    'Other review, assignment and finance events remain in the existing recruitment audit and statement. No bank details, NI numbers or personal UTRs should be added to this dossier.',
  ].join('\n');
}
