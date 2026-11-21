import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Statement = {
  balances: {currency:string;earned:number;recorded:number;reserved:number;available:number}[];
  entries: {id:number;deltaCents:number;currency:string;reason:string;createdAt:string}[];
  payouts: {id:string;amountCents:number;currency:string;status:string;settlementReference:string|null;instructionReference?:string;confirmationReference?:string|null;beneficiarySource?:string;beneficiaryLast4?:string|null;preparedBy?:string;createdAt:string}[];
};
const money=(cents:number,currency:string)=>new Intl.NumberFormat('en-GB',{style:'currency',currency}).format(cents/100);
export function ProviderStatement({ applicationId }: { applicationId?: string }) {
  const {user}=useAuth();
  const client=useQueryClient();
  const endpoint=`/api/v1/provider-applications/${applicationId??'me'}`;
  const [amount,setAmount]=useState('');
  const [reason,setReason]=useState('');
  const [reference,setReference]=useState('');
  const [sent,setSent]=useState(false);
  const [requestKey,setRequestKey]=useState(()=>crypto.randomUUID());
  const query=useQuery({queryKey:['provider-statement',user?.userId,user?.organisationId,applicationId],queryFn:()=>api.get<Statement>(`${endpoint}/statement`),retry:false});
  const payout=useMutation({mutationFn:()=>{
    if(!/^\d+(\.\d{1,2})?$/.test(amount))throw new Error('Enter a GBP amount with at most two decimal places');
    const [pounds,pence='']=amount.split('.');
    return api.post(`${endpoint}/payouts`,{requestKey,currency:'gbp',amountCents:Number(pounds)*100+Number(pence.padEnd(2,'0')),reason});
  },onSuccess:async()=>{setAmount('');setRequestKey(crypto.randomUUID());await client.invalidateQueries({queryKey:['provider-statement']});}});
  const action=useMutation({mutationFn:({id,action}:{id:string;action:string})=>api.post(`/api/v1/provider-applications/payouts/${id}/action`,{
    action,reason,settlementReference:action==='record'?reference:undefined,
  }),onSuccess:async()=>{setReference('');setSent(false);await client.invalidateQueries({queryKey:['provider-statement']});}});
  return <section className="space-y-4 rounded border p-4" aria-label="Provider commission statement">
    <h2 className="text-xl font-semibold">Commission and payouts</h2>
    <p>Commission is 17% of eligible sales excluding VAT, before processing/bank fees. Gross refunds reduce the HT base proportionally and disputed payments are held. Negative balances are recovered from future commission.</p>
    <Button variant="outline" onClick={()=>void query.refetch()}>Refresh commission statement</Button>
    {query.isPending&&<p role="status">Loading statement…</p>}
    {query.isError&&<p role="alert">{query.error.message}</p>}
    {query.data?.balances.length===0&&<p>No verified commission earnings yet.</p>}
    {query.data?.balances.map(b=><div key={b.currency}>
      <p>Earned: {money(b.earned,b.currency)} · Settlements recorded: {money(b.recorded,b.currency)} · Reserved: {money(b.reserved,b.currency)}</p>
      <p>Available balance: <strong>{money(b.available,b.currency)}</strong></p>
    </div>)}
    {applicationId&&<div className="space-y-3">
      <h3 className="font-semibold">Prepare a GBP bank payout</h3>
      <p>Preparation reserves commission. A reviewer other than the preparer must approve it. The bank payment is sent outside this app, then a reviewer other than the preparer (the approver may do this) records its reference here.</p>
      <Label htmlFor={`${applicationId}-amount`}>Amount in GBP</Label>
      <Input id={`${applicationId}-amount`} inputMode="decimal" value={amount} onChange={e=>{setAmount(e.target.value);setRequestKey(crypto.randomUUID());}} />
      <Label htmlFor={`${applicationId}-payout-reason`}>Finance review reason</Label>
      <Input id={`${applicationId}-payout-reason`} value={reason} minLength={10} maxLength={2000} onChange={e=>setReason(e.target.value)} />
      <Button disabled={payout.isPending||reason.trim().length<10||!amount} onClick={()=>payout.mutate()}>Prepare payout</Button>
      {payout.isSuccess&&<p role="status">Payout reserved for independent review.</p>}
      {payout.isError&&<p role="alert">{payout.error.message}</p>}
      <Label htmlFor={`${applicationId}-bank-reference`}>External bank transaction reference (no bank account details)</Label>
      <Input id={`${applicationId}-bank-reference`} value={reference} maxLength={160} onChange={e=>setReference(e.target.value)} />
      <Label className="flex gap-2"><input type="checkbox" checked={sent} onChange={e=>setSent(e.target.checked)} />I verified this payment was sent through our bank.</Label>
      {action.isError&&<p role="alert">{action.error.message}</p>}
    </div>}
    <h3 className="font-semibold">Payout history</h3>
    <p>“Recorded” means staff recorded a bank settlement; it is not an automatic bank confirmation.</p>
    {query.data?.payouts.map(p=><article className="space-y-2 rounded border p-3" key={p.id}>
      {p.beneficiarySource&&<p>{p.beneficiarySource==='approved_payment_profile'?`Beneficiary: reviewed payment profile, account ending ${p.beneficiaryLast4??'unknown'}`:'Beneficiary: legacy external bank workflow; details held outside this app'}</p>}
      {p.instructionReference&&<p className="break-all text-xs">System instruction: {p.instructionReference}</p>}{p.confirmationReference&&<p className="break-all text-xs">System recording confirmation: {p.confirmationReference}</p>}
      <p>{money(p.amountCents,p.currency)} — {p.status}{p.settlementReference?` · ${p.settlementReference}`:''}</p>
      {applicationId&&['prepared','approved'].includes(p.status)&&<div className="flex flex-wrap gap-2">
        {p.status==='prepared'&&<Button disabled={reason.trim().length<10||action.isPending||p.preparedBy===user?.userId} onClick={()=>action.mutate({id:p.id,action:'approve'})}>Approve {p.id}</Button>}
        {p.status==='approved'&&<Button disabled={!sent||reference.trim().length<6||reason.trim().length<10||action.isPending||p.preparedBy===user?.userId} onClick={()=>action.mutate({id:p.id,action:'record'})}>Record settlement {p.id}</Button>}
        <Button variant="outline" disabled={reason.trim().length<10||action.isPending} onClick={()=>action.mutate({id:p.id,action:'cancel'})}>Cancel payout {p.id}</Button>
      </div>}
    </article>)}
    <details><summary>Commission adjustments</summary><ul>{query.data?.entries.map(e=><li key={e.id}>{e.createdAt}: {money(e.deltaCents,e.currency)} — {e.reason}</li>)}</ul></details>
  </section>;
}
