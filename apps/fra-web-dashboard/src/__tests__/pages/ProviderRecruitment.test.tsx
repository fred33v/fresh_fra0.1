import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProviderApplication from '@/pages/ProviderApplication';
import ProviderReview from '@/pages/ProviderReview';
import { api } from '@/lib/api';
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId:'user',organisationId:'org',role:'admin' } }) }));
vi.mock('@/components/layout/Layout', () => ({ Layout: ({children}: {children: React.ReactNode}) => <>{children}</> }));
function page(component: React.ReactNode) {
  return render(<MemoryRouter><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}>{component}</QueryClientProvider></MemoryRouter>);
}
beforeEach(() => vi.resetAllMocks());
it('gives an approved provider a customer link to copy without opening their own checkout', async () => {
  const code = 'PRV-' + 'a'.repeat(32);
  vi.mocked(api.get).mockImplementation(async path => path.endsWith('/statement') ? {balances:[],entries:[],payouts:[]} :
    path.endsWith('/assignments') ? [{id:'work',packageName:'Professional',reference:'SALE-1',service:'sales',status:'accepted'}] :
    {companyName:'Sales Ltd',status:'approved',providerCode:code});
  const writeText = vi.fn().mockResolvedValue(undefined);
  const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', {configurable:true,value:{writeText}});
  try {
    page(<ProviderApplication />);
    expect(await screen.findByRole('heading',{name:'Your provider portal'})).toBeInTheDocument();
    const link = await screen.findByLabelText('Customer referral link for SALE-1');
    const expected = new URL('/checkout?package=Professional&provider=' + code, window.location.origin).href;
    expect(link).toHaveValue(expected);
    expect(screen.queryByRole('link',{name:/Open referral checkout/})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Copy customer link for SALE-1'}));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expected));
    expect(await screen.findByText('Customer link copied.')).toBeInTheDocument();
    writeText.mockRejectedValueOnce(new Error('Clipboard denied'));
    fireEvent.click(screen.getByRole('button',{name:'Copy customer link for SALE-1'}));
    expect(await screen.findByText('Copy unavailable. Select and copy the customer link above.')).toBeInTheDocument();
    expect(link).toHaveValue(expected);
  } finally {
    if (clipboard) Object.defineProperty(navigator, 'clipboard', clipboard);
    else Reflect.deleteProperty(navigator, 'clipboard');
  }
});
it('submits a training application with experience and verified identity supplied by server', async () => {
  vi.mocked(api.get).mockImplementation(async path => path.endsWith('/statement') ? {balances:[],entries:[],payouts:[]} : null);
  vi.mocked(api.post).mockResolvedValue({companyName:'Training Ltd',status:'submitted'});
  page(<ProviderApplication />);
  fireEvent.change(await screen.findByLabelText('Company name'),{target:{value:'Training Ltd'}});
  fireEvent.change(screen.getByLabelText('I want to'),{target:{value:'training'}});
  fireEvent.change(screen.getByLabelText('Training experience and qualifications'),{target:{value:'Ten years delivering workshops'}});
  fireEvent.click(screen.getByRole('button',{name:'Submit application'}));
  await screen.findByText(/Awaiting review/);
  expect(api.post).toHaveBeenCalledWith('/api/v1/provider-applications/me',{
    companyName:'Training Ltd',serviceInterest:'training',trainingExperience:'Ten years delivering workshops',
  });
});
it('allows the approved applicant to accept an offer', async () => {
  vi.mocked(api.get).mockImplementation(async path => path.endsWith('/statement') ? {balances:[],entries:[],payouts:[]} : path.endsWith('/assignments') ?
    [{id:'offer',packageName:'Starter',reference:'WORK-1',service:'sales',status:'offered'}] :
    {companyName:'Sales Ltd',status:'approved',providerCode:'PRV-reference'});
  vi.mocked(api.post).mockResolvedValue({status:'accepted'});
  page(<ProviderApplication />);
  fireEvent.click(await screen.findByRole('button',{name:'Accept WORK-1'}));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/provider-applications/me/assignments/offer/decision',{status:'accepted'}));
  expect(screen.getByText('PRV-reference')).toBeInTheDocument();
});
it('shows a permission error instead of an empty review queue', async () => {
  vi.mocked(api.get).mockRejectedValue(new Error('Recruitment reviewer authority required'));
  page(<ProviderReview />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Recruitment reviewer authority required');
  expect(screen.queryByText('No applications yet.')).not.toBeInTheDocument();
});
it('submits an approval with concurrency revision, agreement and qualification evidence', async () => {
  vi.mocked(api.get).mockImplementation(async path => path.endsWith('/statement') ? {balances:[],entries:[],payouts:[]} : path.includes('/review?') ? [{
    id:'application',applicantName:'Alice',applicantEmail:'alice@example.test',companyName:'Training Ltd',
    serviceInterest:'training',trainingExperience:'Workshop delivery',status:'submitted',revision:3,
  }] : []);
  vi.mocked(api.post).mockResolvedValue({});
  page(<ProviderReview />);
  fireEvent.change(await screen.findByLabelText('Decision reason (visible to applicant)'),{target:{value:'Checked references and agreement'}});
  fireEvent.change(screen.getByLabelText('Completed signing document UUID'),{target:{value:'agreement-id'}});
  fireEvent.change(screen.getByLabelText('Qualification verification and training demonstration evidence'),{target:{value:'Register verified and demo observed'}});
  fireEvent.click(screen.getByRole('button',{name:'Save review decision'}));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/provider-applications/application/review',{
    revision:3,status:'approved',reason:'Checked references and agreement',qualificationEvidence:'Register verified and demo observed',agreementDocumentId:'agreement-id',
  }));
});
const reviewQueue = (application: object, packages: object[] = []) => vi.mocked(api.get).mockImplementation(async path =>
  path.endsWith('/statement') ? {balances:[],entries:[],payouts:[]} : path.includes('/review?') ? [application] :
  path.endsWith('/api/v1/packages') ? packages : []);
it('lets a reviewer reopen a declined application instead of leaving it stuck', async () => {
  reviewQueue({id:'application',applicantName:'Alice',applicantEmail:'alice@example.test',companyName:'Sales Ltd',
    serviceInterest:'sales',status:'declined',revision:2});
  vi.mocked(api.post).mockResolvedValue({});
  page(<ProviderReview />);
  const decision = await screen.findByLabelText('Decision');
  expect(decision).toHaveValue('submitted');
  expect(screen.queryByRole('option',{name:'Approve'})).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Decision reason (visible to applicant)'),{target:{value:'Evidence supplied later'}});
  fireEvent.click(screen.getByRole('button',{name:'Save review decision'}));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/provider-applications/application/review',
    {revision:2,status:'submitted',reason:'Evidence supplied later'}));
});
it('offers the first package in the catalogue, not a fixed id that may be inactive', async () => {
  reviewQueue({id:'application',applicantName:'Alice',applicantEmail:'alice@example.test',companyName:'Sales Ltd',
    serviceInterest:'sales',status:'approved',revision:1},[{id:'pkg_pro',name:'Professional'},{id:'pkg_plus',name:'Plus'}]);
  vi.mocked(api.post).mockResolvedValue({});
  page(<ProviderReview />);
  await screen.findByRole('option',{name:'Professional'});
  fireEvent.change(screen.getByLabelText('Unique work reference'),{target:{value:'WORK-1'}});
  fireEvent.click(screen.getByRole('button',{name:'Offer assignment'}));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/provider-applications/application/assignments',
    {packageId:'pkg_pro',reference:'WORK-1',service:'sales'}));
});
