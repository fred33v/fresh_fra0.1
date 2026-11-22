import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
const base = '/api/v1/finance';
type Identity = { id: string; code: string; kind: 'supplier' | 'employee'; status: string };
type Profile = {
  id: string;
  identifier_id: string;
  kind: 'supplier' | 'payroll';
  version: number;
  revision: number;
  last4: string;
  status: string;
  verification_method: string | null;
};
type Fee = {
  id: string;
  identifier_id: string;
  delivery_id: string;
  version: number;
  revision: number;
  net_cents: number;
  vat_cents: number;
  total_cents: number;
  status: string;
  terms: string;
};
type Instruction = {
  id: string;
  identifier_id: string;
  kind: 'supplier_service_fee' | 'payroll_gross';
  gross_cents: number;
  revision: number;
  status: string;
  instruction_reference: string;
  confirmation_reference: string | null;
  external_reference: string | null;
  recording_method: string | null;
  prepared_by?: string;
  period_from?: string;
  period_until?: string;
};
function gbpCents(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value))
    throw new Error('Enter a GBP amount with at most two decimals');
  const [pounds, pence = ''] = value.split('.');
  const amount = Number(pounds) * 100 + Number(pence.padEnd(2, '0'));
  if (!Number.isSafeInteger(amount) || amount > 100000000)
    throw new Error('Amount exceeds the instruction limit');
  return amount;
}
const money = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'gbp' }).format(n / 100);
export default function FinanceHub() {
  const { user } = useAuth(),
    cache = useQueryClient();
  const [review, setReview] = useState(false);
  const config = useQuery({
    queryKey: ['finance-config', user?.userId, user?.organisationId],
    queryFn: () => api.get<{ bankVaultReady: boolean; financeAccess: boolean }>(`${base}/config`),
  });
  const view = review && config.data?.financeAccess ? '?view=review' : '';
  const key = ['finance-records', user?.userId, user?.organisationId, view];
  const records = useQuery({
    queryKey: key,
    queryFn: async () => {
      const [identities, profiles, fees, instructions] = await Promise.all([
        api.get<Identity[]>(`${base}/identities${view}`),
        api.get<Profile[]>(`${base}/profiles${view}`),
        api.get<Fee[]>(`${base}/fees${view}`),
        api.get<Instruction[]>(`${base}/instructions${view}`),
      ]);
      return { identities, profiles, fees, instructions };
    },
  });
  const refresh = async () => {
    await cache.invalidateQueries({ queryKey: ['finance-records'] });
  };
  const admin = !!view;
  const data = records.data;
  return (
    <main className="container max-w-5xl space-y-6 py-10">
      <h1 className="text-2xl font-bold">Payment details, service fees & payroll instructions</h1>
      <p>
        Supplier invoice fees and gross payroll are separate from 17% referral commissions. This app
        records approvals and external execution references; it does not send money or calculate
        PAYE, NIC or net wages.
      </p>
      {config.isError && <p role="alert">{config.error.message}</p>}
      {config.data && !config.data.bankVaultReady && (
        <p role="alert">
          The secure bank vault is not configured. Bank details cannot be collected until an
          administrator configures its private keyring.
        </p>
      )}
      {config.data?.financeAccess && (
        <label className="flex gap-2">
          <input type="checkbox" checked={review} onChange={(e) => setReview(e.target.checked)} />
          Restricted finance review view
        </label>
      )}
      {records.isPending && <p role="status">Loading finance records…</p>}
      {records.isError && <p role="alert">{records.error.message}</p>}
      {data && (
        <>
          {!admin && (
            <BankForm
              identities={data.identities.filter((i) => i.status === 'active')}
              profiles={data.profiles}
              enabled={!!config.data?.bankVaultReady}
              onSaved={refresh}
            />
          )}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Beneficiary payment profiles</h2>
            <p>
              Only masked account details appear here. “Approved” records a staff evidence review,
              not bank-API ownership verification. New details require fresh approval.
            </p>
            {data.profiles.length === 0 && <p>No payment profiles submitted.</p>}
            {data.profiles.map((p) => (
              <article className="space-y-2 rounded border p-3" key={p.id}>
                <p>
                  {data.identities.find((i) => i.id === p.identifier_id)?.code ?? p.identifier_id} ·{' '}
                  {p.kind} · account ending {p.last4} · version {p.version} · {p.status}
                </p>
                {admin && (
                  <ProfileReview key={`${p.id}:${p.revision}`} profile={p} onSaved={refresh} />
                )}
              </article>
            ))}
          </section>
          {admin && <FeeProposal onSaved={refresh} />}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Agreed service fees</h2>
            <p>
              Fixed supplier invoice amounts, including explicitly agreed VAT. These do not replace
              or recalculate referral commission.
            </p>
            {data.fees.length === 0 && <p>No service fee agreements.</p>}
            {data.fees.map((f) => (
              <FeeAgreement
                key={`${f.id}:${f.revision}`}
                fee={f}
                review={admin}
                onSaved={refresh}
              />
            ))}
          </section>
          {admin && (
            <PrepareInstruction
              identities={data.identities}
              profiles={data.profiles}
              fees={data.fees}
              onSaved={refresh}
            />
          )}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Finance instruction history</h2>
            <p>
              System references are generated automatically. “Recorded” means staff recorded an
              external bank transaction or payroll run; it is not an independent bank confirmation.
            </p>
            {data.instructions.length === 0 && <p>No instructions prepared.</p>}
            {data.instructions.map((p) => (
              <InstructionRow
                key={`${p.id}:${p.revision}`}
                instruction={p}
                review={admin}
                onSaved={refresh}
              />
            ))}
          </section>
          <p className="text-xs text-muted-foreground">
            Shows the latest 200 records in each category. Original commission balances and
            independent settlement controls remain in the provider commission statement.
          </p>
        </>
      )}
    </main>
  );
}
function BankForm({
  identities,
  profiles,
  enabled,
  onSaved,
}: {
  identities: Identity[];
  profiles: Profile[];
  enabled: boolean;
  onSaved: () => Promise<unknown>;
}) {
  const [selected, setSelected] = useState(''),
    [holder, setHolder] = useState(''),
    [sort, setSort] = useState(''),
    [account, setAccount] = useState(''),
    [confirm, setConfirm] = useState(''),
    [declared, setDeclared] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const identity = identities.find((i) => i.id === selected) ?? identities[0];
  async function save() {
    if (!identity || !enabled) return;
    setBusy(true);
    setError('');
    try {
      if (account !== confirm) throw new Error('Account numbers must match');
      const version = Math.max(
        0,
        ...profiles.filter((p) => p.identifier_id === identity.id).map((p) => p.version)
      );
      await api.post(`${base}/profiles`, {
        identifierId: identity.id,
        expectedVersion: version,
        accountHolder: holder,
        sortCode: sort,
        accountNumber: account,
        declaration: declared,
      });
      setHolder('');
      setSort('');
      setAccount('');
      setConfirm('');
      setDeclared(false);
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bank details submission failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="space-y-3 rounded border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <h2 className="text-xl font-semibold">Submit UK beneficiary bank details</h2>
      <p>
        Details are encrypted on the server. Never enter card numbers, PINs, passwords or banking
        login credentials.
      </p>
      <Label htmlFor="bank-identity">Supplier or employee reference</Label>
      <select
        id="bank-identity"
        className="block w-full rounded border bg-background p-2"
        value={identity?.id ?? ''}
        onChange={(e) => setSelected(e.target.value)}
        required
      >
        {identities.map((i) => (
          <option key={i.id} value={i.id}>
            {i.code} · {i.kind === 'employee' ? 'Payroll' : 'Supplier'}
          </option>
        ))}
      </select>
      <Label htmlFor="bank-holder">Account holder name</Label>
      <Input
        id="bank-holder"
        autoComplete="off"
        required
        maxLength={160}
        value={holder}
        onChange={(e) => setHolder(e.target.value)}
      />
      <Label htmlFor="bank-sort">UK sort code</Label>
      <Input
        id="bank-sort"
        autoComplete="off"
        inputMode="numeric"
        required
        maxLength={8}
        value={sort}
        onChange={(e) => setSort(e.target.value)}
      />
      <Label htmlFor="bank-account">UK account number</Label>
      <Input
        id="bank-account"
        autoComplete="off"
        inputMode="numeric"
        type="password"
        required
        pattern="[0-9]{8}"
        value={account}
        onChange={(e) => setAccount(e.target.value)}
      />
      <Label htmlFor="bank-confirm">Confirm account number</Label>
      <Input
        id="bank-confirm"
        autoComplete="off"
        inputMode="numeric"
        type="password"
        required
        pattern="[0-9]{8}"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      <label className="flex gap-2">
        <input
          type="checkbox"
          checked={declared}
          required
          onChange={(e) => setDeclared(e.target.checked)}
        />
        I am authorised to receive payments into this account and these details are accurate.
      </label>
      <Button disabled={busy || !enabled || !identity || !declared}>
        Submit encrypted bank details
      </Button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
function ProfileReview({
  profile: p,
  onSaved,
}: {
  profile: Profile;
  onSaved: () => Promise<unknown>;
}) {
  const [reason, setReason] = useState(''),
    [reference, setReference] = useState(''),
    [checked, setChecked] = useState(false),
    [password, setPassword] = useState(''),
    [bank, setBank] = useState<{
      accountHolder: string;
      sortCode: string;
      accountNumber: string;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    if (!bank) return;
    const timer = setTimeout(() => setBank(null), 60000);
    return () => clearTimeout(timer);
  }, [bank]);
  async function action(status: string) {
    setBusy(true);
    setError('');
    try {
      await api.post(`${base}/profiles/${p.id}/review`, {
        revision: p.revision,
        status,
        reason,
        ...(status === 'approved'
          ? { verificationReference: reference, evidenceChecked: checked }
          : {}),
      });
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bank profile review failed');
    } finally {
      setBusy(false);
    }
  }
  async function reveal() {
    setBusy(true);
    setError('');
    try {
      const value = await api.post<NonNullable<typeof bank>>(`${base}/profiles/${p.id}/reveal`, {
        reason,
        password,
      });
      setBank(value);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Restricted details access failed');
    } finally {
      setPassword('');
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      <Label htmlFor={`${p.id}-reason`}>Beneficiary evidence review purpose / reason</Label>
      <Textarea
        id={`${p.id}-reason`}
        minLength={10}
        maxLength={2000}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      {['submitted', 'approved'].includes(p.status) && (
        <>
          <Label htmlFor={`${p.id}-password`}>Re-enter your finance account password</Label>
          <Input
            id={`${p.id}-password`}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button
            variant="outline"
            disabled={busy || reason.trim().length < 10 || !password}
            onClick={() => void reveal()}
          >
            Inspect restricted bank details
          </Button>
          {bank && (
            <div className="space-y-1 rounded border p-3">
              <p>Account holder: {bank.accountHolder}</p>
              <p>Sort code: {bank.sortCode}</p>
              <p>Account number: {bank.accountNumber}</p>
              <p>Access is audited. This display closes after 60 seconds.</p>
              <Button variant="outline" onClick={() => setBank(null)}>
                Hide bank details
              </Button>
            </div>
          )}
        </>
      )}
      {p.status === 'submitted' && (
        <>
          <Label htmlFor={`${p.id}-reference`}>
            Beneficiary verification evidence reference (no bank numbers)
          </Label>
          <Input
            id={`${p.id}-reference`}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            maxLength={160}
          />
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />
            I independently checked beneficiary evidence. This is staff review, not automatic bank
            verification.
          </label>
          <div className="flex gap-2">
            <Button
              disabled={
                busy || !checked || reference.trim().length < 6 || reason.trim().length < 10
              }
              onClick={() => void action('approved')}
            >
              Approve payment profile
            </Button>
            <Button
              variant="outline"
              disabled={busy || reason.trim().length < 10}
              onClick={() => void action('rejected')}
            >
              Reject payment profile
            </Button>
          </div>
        </>
      )}
      {p.status === 'approved' && (
        <Button
          variant="outline"
          disabled={busy || reason.trim().length < 10}
          onClick={() => void action('suspended')}
        >
          Suspend payment profile
        </Button>
      )}
      {error && <p role="alert">{error}</p>}
      <History kind="profile" id={p.id} />
    </div>
  );
}
function FeeProposal({ onSaved }: { onSaved: () => Promise<unknown> }) {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [delivery, setDelivery] = useState(params.get('delivery') ?? ''),
    [lookup, setLookup] = useState(params.get('delivery') ?? ''),
    [purchase, setPurchase] = useState(''),
    [net, setNet] = useState(''),
    [vat, setVat] = useState('0'),
    [terms, setTerms] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const options = useQuery({
    queryKey: ['finance-fee-options', user?.userId, user?.organisationId, lookup],
    queryFn: () =>
      api.get<{
        title: string;
        status: string;
        version: number;
        purchases: Array<{
          id: string;
          status: string;
          netCents: number;
          verifiedAt: string | null;
        }>;
      }>(`${base}/fee-options?deliveryId=${encodeURIComponent(lookup)}`),
    enabled: !!lookup,
  });
  const choice =
    options.data?.purchases.find((p) => p.id === purchase) ?? options.data?.purchases[0];
  async function propose() {
    if (!choice || !options.data || delivery !== lookup) return;
    setBusy(true);
    setError('');
    try {
      await api.post(`${base}/fees`, {
        deliveryId: lookup,
        purchaseId: choice.id,
        expectedVersion: options.data.version,
        netCents: gbpCents(net),
        vatCents: gbpCents(vat),
        terms,
      });
      await onSaved();
      await options.refetch();
      setTerms('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fee proposal failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-3 rounded border p-4">
      <h2 className="text-xl font-semibold">Propose a fixed supplier service fee</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setLookup(delivery);
          setPurchase('');
        }}
      >
        <Label htmlFor="fee-delivery">
          Service delivery reference (or open this from the delivery portal)
        </Label>
        <Input
          id="fee-delivery"
          value={delivery}
          onChange={(e) => setDelivery(e.target.value.trim())}
          required
        />
        <Button variant="outline">Load fee context</Button>
      </form>
      {options.isError && <p role="alert">{options.error.message}</p>}
      {options.data && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void propose();
          }}
        >
          <p>
            {options.data.title} · service status {options.data.status}
          </p>
          <Label htmlFor="fee-purchase">Matching customer package payment</Label>
          <select
            id="fee-purchase"
            className="block w-full rounded border bg-background p-2"
            value={choice?.id ?? ''}
            onChange={(e) => setPurchase(e.target.value)}
            required
          >
            {options.data.purchases.map((p) => (
              <option value={p.id} key={p.id}>
                {p.id} · {p.status} · {money(p.netCents)} HT
              </option>
            ))}
          </select>
          <Label htmlFor="fee-net">Agreed invoice fee excluding VAT (GBP)</Label>
          <Input
            id="fee-net"
            inputMode="decimal"
            required
            value={net}
            onChange={(e) => setNet(e.target.value)}
          />
          <Label htmlFor="fee-vat">Agreed invoice VAT amount (GBP)</Label>
          <Input
            id="fee-vat"
            inputMode="decimal"
            required
            value={vat}
            onChange={(e) => setVat(e.target.value)}
          />
          <Label htmlFor="fee-terms">Service scope, invoice basis and fee terms</Label>
          <Textarea
            id="fee-terms"
            minLength={20}
            maxLength={4000}
            required
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
          />
          <Button disabled={busy || !choice || delivery !== lookup}>
            Propose supplier fee terms
          </Button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
function FeeAgreement({
  fee: f,
  review,
  onSaved,
}: {
  fee: Fee;
  review: boolean;
  onSaved: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function decide(status: string) {
    setBusy(true);
    try {
      await api.post(`${base}/fees/${f.id}/decision`, { revision: f.revision, status });
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fee decision failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="space-y-2 rounded border p-3">
      <p>
        Service {f.delivery_id} · fee version {f.version} · {f.status}
      </p>
      <p>
        HT {money(f.net_cents)} + invoice VAT {money(f.vat_cents)} = agreed total{' '}
        {money(f.total_cents)}
      </p>
      <p className="whitespace-pre-wrap">{f.terms}</p>
      {!review && f.status === 'proposed' && (
        <div className="flex gap-2">
          <Button disabled={busy} onClick={() => void decide('accepted')}>
            Accept these service fee terms
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => void decide('refused')}>
            Refuse these service fee terms
          </Button>
        </div>
      )}
      {review && <History kind="fee" id={f.id} />} {error && <p role="alert">{error}</p>}
    </article>
  );
}
function PrepareInstruction({
  identities,
  profiles,
  fees,
  onSaved,
}: {
  identities: Identity[];
  profiles: Profile[];
  fees: Fee[];
  onSaved: () => Promise<unknown>;
}) {
  const [kind, setKind] = useState('supplier_service_fee'),
    [profileId, setProfile] = useState(''),
    [feeId, setFee] = useState(''),
    [gross, setGross] = useState(''),
    [from, setFrom] = useState(''),
    [until, setUntil] = useState(''),
    [reason, setReason] = useState(''),
    [requestKey, setKey] = useState(() => crypto.randomUUID()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const eligible = profiles.filter(
    (p) =>
      p.status === 'approved' &&
      p.kind === (kind === 'payroll_gross' ? 'payroll' : 'supplier') &&
      !profiles.some((q) => q.identifier_id === p.identifier_id && q.version > p.version)
  );
  const chosen = eligible.find((p) => p.id === profileId) ?? eligible[0];
  const accepted = fees.filter(
    (f) =>
      f.status === 'accepted' &&
      f.identifier_id === chosen?.identifier_id &&
      !fees.some((q) => q.delivery_id === f.delivery_id && q.version > f.version)
  );
  const selected = accepted.find((f) => f.id === feeId) ?? accepted[0];
  async function prepare() {
    if (!chosen) return;
    setBusy(true);
    setError('');
    try {
      await api.post(`${base}/instructions`, {
        requestKey,
        kind,
        profileId: chosen.id,
        reason,
        ...(kind === 'payroll_gross'
          ? { grossCents: gbpCents(gross), periodFrom: from, periodUntil: until }
          : { feeId: selected?.id }),
      });
      setKey(crypto.randomUUID());
      setReason('');
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Finance instruction preparation failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="space-y-3 rounded border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void prepare();
      }}
    >
      <h2 className="text-xl font-semibold">Prepare a finance instruction</h2>
      <Label htmlFor="instruction-kind">Payment channel</Label>
      <select
        id="instruction-kind"
        className="block rounded border bg-background p-2"
        value={kind}
        onChange={(e) => {
          setKind(e.target.value);
          setProfile('');
          setFee('');
          setKey(crypto.randomUUID());
        }}
      >
        <option value="supplier_service_fee">Supplier service fee</option>
        <option value="payroll_gross">Gross payroll instruction</option>
      </select>
      <Label htmlFor="instruction-profile">Current approved beneficiary</Label>
      <select
        id="instruction-profile"
        className="block w-full rounded border bg-background p-2"
        value={chosen?.id ?? ''}
        onChange={(e) => {
          setProfile(e.target.value);
          setFee('');
          setKey(crypto.randomUUID());
        }}
        required
      >
        {eligible.map((p) => (
          <option key={p.id} value={p.id}>
            {identities.find((i) => i.id === p.identifier_id)?.code ?? p.identifier_id} · account
            ending {p.last4}
          </option>
        ))}
      </select>
      {kind === 'payroll_gross' ? (
        <>
          <p>
            Gross instruction for an external payroll system. Do not transfer this gross amount as
            net wages. PAYE, NIC, pension deductions and reporting are handled externally.
          </p>
          <Label htmlFor="payroll-gross">Agreed gross pay (GBP)</Label>
          <Input
            id="payroll-gross"
            inputMode="decimal"
            required
            value={gross}
            onChange={(e) => {
              setGross(e.target.value);
              setKey(crypto.randomUUID());
            }}
          />
          <Label htmlFor="payroll-from">Pay period from (inclusive)</Label>
          <Input
            id="payroll-from"
            type="date"
            required
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setKey(crypto.randomUUID());
            }}
          />
          <Label htmlFor="payroll-until">Pay period until (exclusive)</Label>
          <Input
            id="payroll-until"
            type="date"
            required
            value={until}
            onChange={(e) => {
              setUntil(e.target.value);
              setKey(crypto.randomUUID());
            }}
          />
        </>
      ) : (
        <>
          <Label htmlFor="instruction-fee">Supplier-accepted fee</Label>
          <select
            id="instruction-fee"
            className="block w-full rounded border bg-background p-2"
            value={selected?.id ?? ''}
            onChange={(e) => {
              setFee(e.target.value);
              setKey(crypto.randomUUID());
            }}
            required
          >
            {accepted.map((f) => (
              <option key={f.id} value={f.id}>
                {f.delivery_id} · version {f.version} · {money(f.total_cents)}
              </option>
            ))}
          </select>
          <p>
            Preparation and approval require a customer-accepted service and a freshly verified,
            unrefunded, undisputed package payment.
          </p>
        </>
      )}
      <Label htmlFor="instruction-reason">Finance preparation reason</Label>
      <Textarea
        id="instruction-reason"
        minLength={10}
        maxLength={2000}
        required
        value={reason}
        onChange={(e) => {
          setReason(e.target.value);
          setKey(crypto.randomUUID());
        }}
      />
      <Button disabled={busy || !chosen || (kind === 'supplier_service_fee' && !selected)}>
        Prepare instruction for independent approval
      </Button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
function InstructionRow({
  instruction: p,
  review,
  onSaved,
}: {
  instruction: Instruction;
  review: boolean;
  onSaved: () => Promise<unknown>;
}) {
  const { user } = useAuth();
  const [reason, setReason] = useState(''),
    [reference, setReference] = useState(''),
    [checked, setChecked] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function act(action: string) {
    setBusy(true);
    setError('');
    try {
      await api.post(`${base}/instructions/${p.id}/action`, {
        revision: p.revision,
        action,
        reason,
        ...(action === 'record'
          ? { externalReference: reference, externalExecutionChecked: checked }
          : {}),
      });
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Instruction action failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="space-y-2 rounded border p-3">
      <p>
        {p.kind === 'payroll_gross'
          ? 'External payroll gross instruction'
          : 'Supplier invoice service fee'}{' '}
        · {money(p.gross_cents)} · {p.status}
      </p>
      <p className="break-all">Generated instruction reference: {p.instruction_reference}</p>
      {p.confirmation_reference && (
        <p className="break-all">
          Generated app recording confirmation: {p.confirmation_reference}
        </p>
      )}
      {p.external_reference && (
        <p>
          Staff-entered external execution reference: {p.external_reference} ·{' '}
          {p.recording_method === 'staff_payroll_run_attestation'
            ? 'Staff-recorded external payroll run'
            : 'Staff-recorded external bank execution'}
        </p>
      )}
      {review && ['prepared', 'approved'].includes(p.status) && (
        <>
          <Label htmlFor={`${p.id}-reason`}>Independent finance decision reason</Label>
          <Textarea
            id={`${p.id}-reason`}
            minLength={10}
            maxLength={2000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          {p.status === 'prepared' && (
            <Button
              disabled={busy || p.prepared_by === user?.userId || reason.trim().length < 10}
              onClick={() => void act('approve')}
            >
              Approve instruction
            </Button>
          )}
          {p.status === 'approved' && (
            <>
              <Label htmlFor={`${p.id}-external`}>
                {p.kind === 'payroll_gross'
                  ? 'External payroll run reference'
                  : 'External bank transaction reference'}{' '}
                (never bank account details)
              </Label>
              <Input
                id={`${p.id}-external`}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                maxLength={160}
              />
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                />
                {p.kind === 'payroll_gross'
                  ? 'I checked the external payroll run. This is not a confirmation of net wages paid.'
                  : 'I checked the external bank execution. This is staff attestation, not bank-API confirmation.'}
              </label>
              <Button
                disabled={
                  busy ||
                  p.prepared_by === user?.userId ||
                  !checked ||
                  reference.trim().length < 6 ||
                  reason.trim().length < 10
                }
                onClick={() => void act('record')}
              >
                {p.kind === 'payroll_gross'
                  ? 'Record external payroll run'
                  : 'Record external bank execution'}
              </Button>
            </>
          )}
          <Button
            variant="outline"
            disabled={busy || reason.trim().length < 10}
            onClick={() => void act('cancel')}
          >
            Cancel unsettled instruction
          </Button>
        </>
      )}
      {review && <History kind="instruction" id={p.id} />} {error && <p role="alert">{error}</p>}
    </article>
  );
}
function History({ kind, id }: { kind: string; id: string }) {
  const [value, setValue] = useState<{
      verified: boolean;
      events: Array<{
        revision: number;
        occurred_at: string;
        snapshot: { status: string; reason?: string; action_reason?: string };
      }>;
    } | null>(null),
    [error, setError] = useState('');
  return (
    <div>
      <Button
        variant="outline"
        onClick={() => {
          setError('');
          void api
            .get<NonNullable<typeof value>>(`${base}/history/${kind}/${id}`)
            .then(setValue)
            .catch((e) => setError(e instanceof Error ? e.message : 'History verification failed'));
        }}
      >
        Verify finance history
      </Button>
      {value && (
        <>
          <p>{value.verified ? 'History verified' : 'History verification failed'}</p>
          <ol>
            {value.events.map((e) => (
              <li key={e.revision}>
                Revision {e.revision}: {e.snapshot.status} ·{' '}
                {new Date(e.occurred_at).toLocaleString('en-GB')} ·{' '}
                {e.snapshot.action_reason ?? e.snapshot.reason ?? ''}
              </li>
            ))}
          </ol>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
