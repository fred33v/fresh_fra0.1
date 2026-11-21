import type { IndependentEngagement } from '@/lib/providerCandidate';
const labels: Record<string, string> = {
  sole_trader: 'Sole trader',
  limited_company: 'Limited company',
  partnership: 'Partnership',
  limited_liability_partnership: 'Limited liability partnership',
  yes: 'Yes',
  no: 'No',
  not_sure: 'Needs discussion',
  self: 'Candidate decides method',
  client: 'Client directs method',
  shared: 'Agreed jointly',
  required: 'Personal service required',
  substitution_by_agreement: 'Substitute may be agreed',
};
export default function IndependentEngagementSummary({ value }: { value?: IndependentEngagement }) {
  if (!value)
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
        Independent engagement forms were not supplied at this revision. Previous information
        remains retained.
      </p>
    );
  return (
    <section className="space-y-4 border-t pt-4">
      <div>
        <h3 className="font-semibold">Independent engagement · No minimum commitment</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Candidate-supplied information; employment/tax status and a services agreement remain
          separate.
        </p>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Business structure</dt>
          <dd>{labels[value.legalStructure] ?? value.legalStructure}</dd>
        </div>
        {value.companyNumber && (
          <div>
            <dt className="text-muted-foreground">Company / LLP number</dt>
            <dd className="break-all">{value.companyNumber}</dd>
          </div>
        )}
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Business correspondence address</dt>
          <dd className="break-words">
            {[
              value.businessAddress.line1,
              value.businessAddress.line2,
              value.businessAddress.city,
              value.businessAddress.postalCode,
            ]
              .filter(Boolean)
              .join(', ')}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">VAT registered (declared)</dt>
          <dd>
            {labels[value.vatRegistered] ?? value.vatRegistered}
            {value.vatNumber ? ` · ${value.vatNumber}` : ''}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Can decline assignments</dt>
          <dd>{labels[value.declineAssignments] ?? value.declineAssignments}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Delivery method</dt>
          <dd>{labels[value.deliveryControl] ?? value.deliveryControl}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Other clients</dt>
          <dd>{labels[value.otherClients] ?? value.otherClients}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Personal service</dt>
          <dd>{labels[value.personalService] ?? value.personalService}</dd>
        </div>
      </dl>
      <div>
        <h4 className="text-sm font-medium">Availability</h4>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
          {value.availability}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Declaration recorded as {value.declarationName} · {value.formVersion}. No minimum guarantee,
        17% referral policy and accuracy acknowledged.
      </p>
    </section>
  );
}
