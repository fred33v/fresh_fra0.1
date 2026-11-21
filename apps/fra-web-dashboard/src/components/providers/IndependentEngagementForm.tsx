import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { IndependentEngagement } from '@/lib/providerCandidate';
export default function IndependentEngagementForm({
  value,
  onChange,
  country,
}: {
  value: IndependentEngagement;
  onChange: (value: IndependentEngagement) => void;
  country: string;
}) {
  const change = <K extends keyof IndependentEngagement>(key: K, data: IndependentEngagement[K]) =>
    onChange({ ...value, [key]: data });
  const registeredCompany = ['limited_company', 'limited_liability_partnership'].includes(
    value.legalStructure
  );
  const questions = [
    {
      key: 'declineAssignments' as const,
      label: 'Can you choose whether to accept a proposed assignment?',
      options: [
        ['yes', 'Yes'],
        ['no', 'No'],
        ['not_sure', 'Not sure / needs discussion'],
      ],
    },
    {
      key: 'deliveryControl' as const,
      label: 'Who would normally decide how the agreed services are delivered?',
      options: [
        ['self', 'I decide the method'],
        ['client', 'The client directs the method'],
        ['shared', 'Agreed jointly'],
        ['not_sure', 'Not sure / needs discussion'],
      ],
    },
    {
      key: 'otherClients' as const,
      label: 'Do you currently provide services to other clients?',
      options: [
        ['yes', 'Yes'],
        ['no', 'No'],
        ['not_sure', 'Not sure / needs discussion'],
      ],
    },
    {
      key: 'personalService' as const,
      label: 'What personal-service arrangement is proposed?',
      options: [
        ['required', 'My personal service is required'],
        ['substitution_by_agreement', 'A suitably qualified substitute may be agreed'],
        ['not_sure', 'Not sure / needs discussion'],
      ],
    },
  ];
  return (
    <div className="space-y-6 border-t pt-6">
      <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950">
        <h3 className="font-semibold">Independent engagement — no minimum commitment</h3>
        <p className="mt-2 leading-relaxed">
          This application proposes independent services with no guaranteed assignments, hours or
          income. The referral commission is 17% of VAT-exclusive package sales you bring, subject
          to attribution, refunds and disputes. This is not a payroll zero-hours employment
          contract.
        </p>
        <p className="mt-2 leading-relaxed">
          These forms record your information and proposed arrangements. They do not determine
          employment/tax status or execute a services agreement.
        </p>
      </div>
      <fieldset className="space-y-4">
        <legend className="mb-3 text-base font-semibold">Business and invoicing information</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="engagement-structure">Business legal structure</Label>
            <select
              id="engagement-structure"
              className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm"
              value={value.legalStructure}
              required
              onChange={(e) =>
                onChange({
                  ...value,
                  legalStructure: e.target.value as IndependentEngagement['legalStructure'],
                  companyNumber: '',
                })
              }
            >
              <option value="">Choose a structure</option>
              <option value="sole_trader">Sole trader</option>
              <option value="limited_company">Limited company</option>
              <option value="partnership">Partnership</option>
              <option value="limited_liability_partnership">Limited liability partnership</option>
            </select>
          </div>
          {registeredCompany && (
            <div>
              <Label htmlFor="engagement-company">Company / LLP registration number</Label>
              <Input
                id="engagement-company"
                className="mt-1"
                value={value.companyNumber}
                onChange={(e) => change('companyNumber', e.target.value)}
                minLength={2}
                maxLength={32}
                required
              />
            </div>
          )}
        </div>
        <div>
          <Label htmlFor="engagement-address">Business correspondence address</Label>
          <Input
            id="engagement-address"
            className="mt-1"
            value={value.businessAddress.line1}
            onChange={(e) =>
              change('businessAddress', { ...value.businessAddress, line1: e.target.value })
            }
            minLength={2}
            maxLength={160}
            required
            autoComplete="address-line1"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Use the address you would put on business correspondence or invoices.
          </p>
        </div>
        <div>
          <Label htmlFor="engagement-address2">Address line 2 (optional)</Label>
          <Input
            id="engagement-address2"
            className="mt-1"
            value={value.businessAddress.line2}
            onChange={(e) =>
              change('businessAddress', { ...value.businessAddress, line2: e.target.value })
            }
            maxLength={160}
            autoComplete="address-line2"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="engagement-city">Town / city</Label>
            <Input
              id="engagement-city"
              className="mt-1"
              value={value.businessAddress.city}
              onChange={(e) =>
                change('businessAddress', { ...value.businessAddress, city: e.target.value })
              }
              minLength={2}
              maxLength={120}
              required
              autoComplete="address-level2"
            />
          </div>
          <div>
            <Label htmlFor="engagement-postcode">
              Postcode / postal code{country !== 'GB' ? ' (if applicable)' : ''}
            </Label>
            <Input
              id="engagement-postcode"
              className="mt-1"
              value={value.businessAddress.postalCode}
              onChange={(e) =>
                change('businessAddress', { ...value.businessAddress, postalCode: e.target.value })
              }
              maxLength={24}
              required={country === 'GB'}
              autoComplete="postal-code"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="engagement-vat">Are you VAT registered?</Label>
            <select
              id="engagement-vat"
              className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm"
              value={value.vatRegistered}
              required
              onChange={(e) =>
                onChange({
                  ...value,
                  vatRegistered: e.target.value as IndependentEngagement['vatRegistered'],
                  vatNumber: '',
                })
              }
            >
              <option value="">Choose an answer</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          {value.vatRegistered === 'yes' && (
            <div>
              <Label htmlFor="engagement-vat-number">Declared VAT registration number</Label>
              <Input
                id="engagement-vat-number"
                className="mt-1"
                value={value.vatNumber}
                onChange={(e) => change('vatNumber', e.target.value)}
                minLength={4}
                maxLength={32}
                required
              />
            </div>
          )}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          VAT registration is recorded as declared and is not verified by this form. VAT on your own
          invoices is separate from the VAT-exclusive package revenue used for the 17% commission.
          Do not provide a UTR, National Insurance number or bank details here.
        </p>
      </fieldset>
      <fieldset className="space-y-4 border-t pt-5">
        <legend className="mb-3 text-base font-semibold">
          Availability and proposed working arrangements
        </legend>
        <div>
          <Label htmlFor="engagement-availability">
            Availability and preferred working arrangements
          </Label>
          <Textarea
            id="engagement-availability"
            className="mt-1"
            rows={3}
            value={value.availability}
            onChange={(e) => change('availability', e.target.value)}
            minLength={10}
            maxLength={1000}
            required
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Tell us when you would usually be available. This does not create fixed hours or a
            minimum-work guarantee.
          </p>
        </div>
        {questions.map((question) => (
          <div key={question.key}>
            <Label htmlFor={`engagement-${question.key}`}>{question.label}</Label>
            <select
              id={`engagement-${question.key}`}
              className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm"
              value={value[question.key]}
              required
              onChange={(e) => onChange({ ...value, [question.key]: e.target.value })}
            >
              <option value="">Choose an answer</option>
              {question.options.map(([answer, label]) => (
                <option key={answer} value={answer}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        ))}
        <p className="text-xs leading-relaxed text-muted-foreground">
          Answer according to the actual proposed arrangements. No answer automatically classifies
          you as self-employed or removes employment rights.{' '}
          <a
            href="https://www.gov.uk/guidance/check-employment-status-for-tax"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            HMRC status-check guidance
          </a>{' '}
          explains the separate tax-status assessment.
        </p>
      </fieldset>
      <fieldset className="space-y-3 border-t pt-5">
        <legend className="mb-3 text-base font-semibold">Candidate declarations</legend>
        {(
          [
            [
              'noMinimumAccepted',
              'I understand that no minimum assignments, hours or income are guaranteed.',
            ],
            [
              'commissionAccepted',
              'I understand the 17% commission applies to VAT-exclusive package sales I bring, subject to attribution, refunds and disputes; it is not a fee on my services.',
            ],
            [
              'informationAccurate',
              'I confirm the business information and proposed working-arrangement answers are accurate to the best of my knowledge and will report changes.',
            ],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={value[key]}
              onChange={(e) => change(key, e.target.checked)}
              required
            />
            <span>{label}</span>
          </label>
        ))}
        <div>
          <Label htmlFor="engagement-declaration-name">Declaration full name</Label>
          <Input
            id="engagement-declaration-name"
            className="mt-1"
            value={value.declarationName}
            onChange={(e) => change('declarationName', e.target.value)}
            minLength={2}
            maxLength={120}
            required
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Type the same full name as in your application. This records an application declaration,
            not an executed services contract.
          </p>
        </div>
      </fieldset>
    </div>
  );
}
