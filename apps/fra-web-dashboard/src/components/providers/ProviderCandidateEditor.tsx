import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import IndependentEngagementForm from './IndependentEngagementForm';
import type { CandidateProfile } from '@/lib/providerCandidate';
export default function ProviderCandidateEditor({
  value,
  onChange,
}: {
  value: CandidateProfile;
  onChange: (v: CandidateProfile) => void;
}) {
  return (
    <section className="space-y-4 rounded border p-4">
      <h2 className="font-semibold">Independent candidate declaration</h2>
      <p className="text-sm text-muted-foreground">
        Optional for independent services. This does not change the existing provider approval,
        signed-agreement or commission policy.
      </p>
      <Label htmlFor="candidate-name">Candidate full name</Label>
      <Input
        id="candidate-name"
        required
        minLength={2}
        maxLength={120}
        value={value.fullName}
        onChange={(e) => onChange({ ...value, fullName: e.target.value })}
      />
      <Label htmlFor="candidate-country">Business country code</Label>
      <Input
        id="candidate-country"
        required
        minLength={2}
        maxLength={2}
        pattern="[A-Za-z]{2}"
        value={value.country}
        onChange={(e) => onChange({ ...value, country: e.target.value.toUpperCase() })}
      />
      <Label htmlFor="candidate-website">Professional website (optional HTTPS)</Label>
      <Input
        id="candidate-website"
        type="url"
        maxLength={2048}
        value={value.website}
        onChange={(e) => onChange({ ...value, website: e.target.value })}
      />
      <fieldset className="space-y-2">
        <legend className="font-medium">Declared areas of experience</legend>
        {Object.entries({
          fraud_prevention: 'Fraud prevention',
          risk_assessment: 'Risk assessment',
          training: 'Training',
          investigation: 'Investigation',
        }).map(([key, label]) => (
          <label key={key} className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.expertise.includes(key)}
              onChange={(e) =>
                onChange({
                  ...value,
                  expertise: e.target.checked
                    ? [...value.expertise, key]
                    : value.expertise.filter((k) => k !== key),
                })
              }
            />
            {label}
          </label>
        ))}
      </fieldset>
      <Label htmlFor="candidate-experience">Experience and proposed contribution</Label>
      <Textarea
        id="candidate-experience"
        required
        minLength={30}
        maxLength={3000}
        value={value.experience}
        onChange={(e) => onChange({ ...value, experience: e.target.value })}
      />
      {value.engagement && (
        <IndependentEngagementForm
          value={value.engagement}
          country={value.country}
          onChange={(engagement) => onChange({ ...value, engagement })}
        />
      )}
    </section>
  );
}
