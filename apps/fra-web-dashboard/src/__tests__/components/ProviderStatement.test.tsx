import { render,screen,fireEvent,waitFor } from '@testing-library/react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { ProviderStatement } from '@/components/ProviderStatement';
import { api } from '@/lib/api';
vi.mock('@/lib/api',()=>({api:{get:vi.fn(),post:vi.fn()}}));
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({user:{userId:'reviewer-b',organisationId:'operator'}})}));
const statement={balances:[{currency:'gbp',earned:17000,recorded:0,reserved:0,available:17000}],entries:[],payouts:[]};
function show(id?:string){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ProviderStatement applicationId={id}/></QueryClientProvider>);}
beforeEach(()=>{vi.resetAllMocks();vi.mocked(api.get).mockResolvedValue(statement);vi.mocked(api.post).mockResolvedValue({});});
it('shows provider balances without staff payout controls',async()=>{
  show();expect(await screen.findByText('£170.00')).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Prepare payout'})).not.toBeInTheDocument();
});
it('prepares a payout using exact minor units and an idempotency key',async()=>{
  show('provider');await screen.findByText('£170.00');
  fireEvent.change(screen.getByLabelText('Amount in GBP'),{target:{value:'12.34'}});
  fireEvent.change(screen.getByLabelText('Finance review reason'),{target:{value:'Verified company receipt'}});
  fireEvent.click(screen.getByRole('button',{name:'Prepare payout'}));
  await waitFor(()=>expect(api.post).toHaveBeenCalledWith('/api/v1/provider-applications/provider/payouts',{
    requestKey:expect.any(String),currency:'gbp',amountCents:1234,reason:'Verified company receipt',
  }));
});
it('requires the bank settlement reference and staff confirmation before recording',async()=>{
  vi.mocked(api.get).mockResolvedValue({...statement,payouts:[{id:'payment',amountCents:1000,currency:'gbp',status:'approved',settlementReference:null,preparedBy:'reviewer-a',createdAt:'2026-11-18'}]});
  show('provider');const record=await screen.findByRole('button',{name:'Record settlement payment'});
  expect(record).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Finance review reason'),{target:{value:'Bank payment verified'}});
  fireEvent.change(screen.getByLabelText('Bank payment reference (no bank account details)'),{target:{value:'BANK-12345'}});
  expect(record).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(record);
  await waitFor(()=>expect(api.post).toHaveBeenCalledWith('/api/v1/provider-applications/payouts/payment/action',{
    action:'record',reason:'Bank payment verified',settlementReference:'BANK-12345',
  }));
});
