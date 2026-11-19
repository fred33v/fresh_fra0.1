import { providerKindLabels, providerStatusLabels, type ProviderApplication } from './providers';

export const engagementPreparationSteps = [
  'Review the actual working arrangements and any unanswered questions with the candidate.',
  'Assess the applicable employment-rights and tax status for the proposed engagement.',
  'Agree the service scope, contracting parties, payment timing, expenses, confidentiality, data handling and termination terms.',
  'Prepare and review the services agreement, then send the approved PDF through Documents & signing.',
  'Complete signing and verify the retained final PDF before starting the agreed engagement.',
];

const supplied = (value: string | undefined) => value || 'Not supplied';
const answer = (value: string | undefined) =>
  !value ? 'Not supplied' : value === 'not_sure' ? 'Needs discussion' : value.replaceAll('_', ' ');
const declaration = (value: boolean | undefined) =>
  value === true ? 'Acknowledged' : 'Not recorded';

/** A current-revision handover, never an agreement or proof of completion. */
export function providerPreparationText(application: ProviderApplication): string {
  const p = application.profile;
  const e = p.engagement;
  const address = e ? Object.values(e.businessAddress).filter(Boolean).join(', ') : 'Not supplied';
  return [
    'INDEPENDENT ENGAGEMENT — PREPARATION DOSSIER',
    'Private candidate information. Share only with authorised reviewers.',
    'This is an application summary, not a contract, signature certificate or status assessment.',
    '',
    `Application: ${application.id}`,
    `Revision: ${application.version}`,
    `Updated: ${application.updatedAt}`,
    `Programme decision: ${providerStatusLabels[application.status]}`,
    `Candidate: ${p.fullName}`,
    `Business: ${p.businessName}`,
    `Contact email recorded on application: ${application.contactEmail}`,
    `Country (declared): ${p.country}`,
    `Programme: ${providerKindLabels[p.kind]}`,
    `Website (declared): ${p.website || 'Not supplied'}`,
    `Expertise (declared): ${p.expertise.join(', ')}`,
    `Experience / contribution: ${p.experience}`,
    '',
    'OWNER-CONFIRMED PROGRAMME BASIS',
    'Independent services; no guaranteed minimum assignments, hours or income.',
    'Provider/referrer receives 17% of VAT-exclusive package sales they bring.',
    'This is a referral commission, not a fee on professional services.',
    'Approval does not activate payouts or determine employment/tax status.',
    `Programme terms version: ${application.termsVersion}`,
    '',
    'CANDIDATE-SUPPLIED INFORMATION (NOT VERIFIED)',
    `Forms complete for current review: ${application.independentEngagementComplete ? 'Yes' : 'No — request an updated application'}`,
    `Business structure: ${answer(e?.legalStructure)}`,
    `Company / LLP number: ${supplied(e?.companyNumber)}`,
    `Correspondence address: ${address}`,
    `VAT registered: ${answer(e?.vatRegistered)}`,
    `VAT number: ${supplied(e?.vatNumber)}`,
    `Availability: ${supplied(e?.availability)}`,
    `Can decline assignments: ${answer(e?.declineAssignments)}`,
    `Delivery method control: ${answer(e?.deliveryControl)}`,
    `Other clients: ${answer(e?.otherClients)}`,
    `Personal service / substitution: ${answer(e?.personalService)}`,
    `Declaration name: ${supplied(e?.declarationName)}`,
    `No minimum guarantee: ${declaration(e?.noMinimumAccepted)}`,
    `17% referral basis: ${declaration(e?.commissionAccepted)}`,
    `Accuracy declaration: ${declaration(e?.informationAccurate)}`,
    `Form version: ${supplied(e?.formVersion)}`,
    '',
    'PREPARATION STILL REQUIRED — COMPLETION IS NOT RECORDED BY THIS DOSSIER',
    ...engagementPreparationSteps.map((step, index) => `${index + 1}. ${step}`),
    '',
    'Do not sign this dossier as a services agreement. Prepare the agreed contract separately.',
    'Do not add bank details, National Insurance numbers or personal UTRs to this dossier.',
    'Stripe recipient onboarding and commission payment controls are deferred to the final financial increment.',
    '',
  ].join('\n');
}

export function downloadProviderPreparation(application: ProviderApplication): void {
  const url = URL.createObjectURL(
    new Blob([providerPreparationText(application)], { type: 'text/plain;charset=utf-8' })
  );
  const link = document.createElement('a');
  link.href = url;
  // The application UUID and numeric revision are server-owned; no candidate name in the filename.
  link.download = `provider-${application.id}-revision-${application.version}-preparation.txt`;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
