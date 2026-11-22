import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApplicantEvidence, ReviewerEvidence } from '@/components/providers/ProviderEvidence';
import type { EvidenceDocument } from '@/lib/providerEvidence';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), upload: vi.fn(), download: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'user', organisationId: 'org', role: 'employer' } }) }));
const mocked = vi.mocked(api);
const base = '/api/v1/provider-applications/me';

const doc = (over: Partial<EvidenceDocument> = {}): EvidenceDocument => ({
  id: 'doc-1',
  kind: 'identity',
  filename: 'passport.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 20480,
  sha256: 'a'.repeat(64),
  uploadedAt: '2026-11-20T10:00:00Z',
  status: 'pending',
  decisionReason: null,
  decidedAt: null,
  ...over,
});
const show = (ui: React.ReactNode) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);
const pdf = (bytes = 64) => new File([new Uint8Array(bytes)], 'scan.pdf', { type: 'application/pdf' });

beforeEach(() => {
  vi.resetAllMocks();
  mocked.get.mockResolvedValue([]);
  mocked.download.mockResolvedValue(undefined);
});

describe('applicant evidence', () => {
  it('lists documents with their status and the reason a document was not accepted', async () => {
    mocked.get.mockResolvedValue([
      doc(),
      doc({ id: 'doc-2', filename: 'insurance.png', kind: 'insurance', status: 'verified' }),
      doc({ id: 'doc-3', filename: 'dark.jpg', kind: 'qualification', status: 'rejected', decisionReason: 'The scan is too dark to read.' }),
    ]);
    show(<ApplicantEvidence base={base} status="submitted" />);
    expect(await screen.findByText('passport.pdf')).toBeInTheDocument();
    expect(screen.getByText('Awaiting review')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('Not accepted')).toBeInTheDocument();
    expect(screen.getByText(/The scan is too dark to read\./)).toBeInTheDocument();
    expect(mocked.get).toHaveBeenCalledWith(`${base}/documents`);
  });

  it('uploads the chosen type and file, then refreshes the list', async () => {
    mocked.upload.mockResolvedValue(doc());
    show(<ApplicantEvidence base={base} status="submitted" />);
    const user = userEvent.setup();
    await user.selectOptions(await screen.findByLabelText('Document type'), 'identity');
    await user.upload(screen.getByLabelText('File'), pdf());
    await user.click(screen.getByRole('button', { name: 'Upload document' }));
    await waitFor(() => expect(mocked.upload).toHaveBeenCalledTimes(1));
    const [path, form] = mocked.upload.mock.calls[0] as [string, FormData];
    expect(path).toBe(`${base}/documents`);
    expect(form.get('kind')).toBe('identity');
    expect((form.get('file') as File).name).toBe('scan.pdf');
    await waitFor(() => expect(mocked.get.mock.calls.length).toBeGreaterThan(1));
  });

  it('checks the type, the file and the size before calling the server', async () => {
    show(<ApplicantEvidence base={base} status="declined" />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Upload document' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose what kind of document');
    await user.selectOptions(screen.getByLabelText('Document type'), 'other');
    await user.click(screen.getByRole('button', { name: 'Upload document' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a file');
    await user.upload(screen.getByLabelText('File'), pdf(524289));
    await user.click(screen.getByRole('button', { name: 'Upload document' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('between 8 bytes and 512 KiB');
    expect(mocked.upload).not.toHaveBeenCalled();
  });

  describe('upload limits come from the server', () => {
    const answer = (limits: unknown) =>
      mocked.get.mockImplementation((path: string) => Promise.resolve(path.endsWith('/documents/limits') ? limits : []) as never);

    it('uses the larger limit and the scanning notice when the server reports them', async () => {
      answer({ minBytes: 8, maxBytes: 10485760, maxFiles: 10, scanning: true });
      show(<ApplicantEvidence base={base} status="submitted" />);
      expect(await screen.findByText(/up to 10 MiB each and 10 files in total/)).toBeInTheDocument();
      expect(screen.getByText(/checked for viruses before it is stored/)).toBeInTheDocument();
      expect(mocked.get).toHaveBeenCalledWith(`${base}/documents/limits`);
      // 600 KiB is over the old limit but within this one: it is sent to the server, not refused here
      mocked.upload.mockResolvedValue(doc());
      const user = userEvent.setup();
      await user.selectOptions(screen.getByLabelText('Document type'), 'identity');
      await user.upload(screen.getByLabelText('File'), pdf(600 * 1024));
      await user.click(screen.getByRole('button', { name: 'Upload document' }));
      await waitFor(() => expect(mocked.upload).toHaveBeenCalledTimes(1));
    });

    it('refuses a file over the server limit with that limit in the message', async () => {
      answer({ minBytes: 8, maxBytes: 10485760, maxFiles: 10, scanning: false });
      show(<ApplicantEvidence base={base} status="submitted" />);
      const user = userEvent.setup();
      await screen.findByText(/up to 10 MiB each/);
      await user.selectOptions(screen.getByLabelText('Document type'), 'identity');
      await user.upload(screen.getByLabelText('File'), pdf(10 * 1024 * 1024 + 1));
      await user.click(screen.getByRole('button', { name: 'Upload document' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('between 8 bytes and 10 MiB');
      expect(mocked.upload).not.toHaveBeenCalled();
      expect(screen.queryByText(/checked for viruses/)).not.toBeInTheDocument();
    });

    it.each([['an error', () => Promise.reject(new Error('down'))], ['a malformed answer', () => Promise.resolve({ maxBytes: 'lots' })], ['an old server', () => Promise.resolve([])]])(
      'keeps the 512 KiB default after %s',
      async (_name, respond) => {
        mocked.get.mockImplementation(((path: string) => (path.endsWith('/documents/limits') ? respond() : Promise.resolve([]))) as never);
        show(<ApplicantEvidence base={base} status="submitted" />);
        expect(await screen.findByText(/up to 512 KiB each and 10 files in total/)).toBeInTheDocument();
        expect(screen.queryByText(/checked for viruses/)).not.toBeInTheDocument();
      }
    );
  });

  it('shows a server refusal instead of pretending the file was added', async () => {
    mocked.upload.mockRejectedValue(new Error('Only PDF, PNG and JPEG evidence is accepted'));
    show(<ApplicantEvidence base={base} status="submitted" />);
    const user = userEvent.setup();
    await user.selectOptions(await screen.findByLabelText('Document type'), 'identity');
    await user.upload(screen.getByLabelText('File'), pdf());
    await user.click(screen.getByRole('button', { name: 'Upload document' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Only PDF, PNG and JPEG');
  });

  it('is read-only once the application is approved or suspended, but files can still be downloaded', async () => {
    mocked.get.mockResolvedValue([doc()]);
    show(<ApplicantEvidence base={base} status="approved" />);
    expect(await screen.findByText('passport.pdf')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upload document' })).not.toBeInTheDocument();
    expect(screen.getByText(/while your application is submitted or declined/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Download passport.pdf' }));
    expect(mocked.download).toHaveBeenCalledWith(`${base}/documents/doc-1/file`, 'passport.pdf');
  });

  it('stops offering uploads at the ten-document limit', async () => {
    mocked.get.mockResolvedValue(Array.from({ length: 10 }, (_, i) => doc({ id: `d${i}`, filename: `f${i}.pdf` })));
    show(<ApplicantEvidence base={base} status="submitted" />);
    expect(await screen.findByText(/maximum of 10 documents/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload document' })).toBeDisabled();
  });

  it('copes with a server that returns something other than a list', async () => {
    mocked.get.mockResolvedValue({ unexpected: true });
    show(<ApplicantEvidence base={base} status="submitted" />);
    expect(await screen.findByRole('button', { name: 'Upload document' })).toBeInTheDocument();
  });
});

describe('reviewer evidence', () => {
  const reviewBase = '/api/v1/provider-applications/app-1';
  const reviewerDoc = (over: Partial<EvidenceDocument> = {}) => doc({ applicationRevision: 3, uploadedBy: 'applicant', ...over });

  it('shows whether each file was virus-scanned, and sizes in MiB for large files', async () => {
    mocked.get.mockResolvedValue([
      reviewerDoc({ id: 'a', filename: 'scanned.pdf', scanStatus: 'clean', sizeBytes: 3 * 1024 * 1024 }),
      reviewerDoc({ id: 'b', filename: 'old.pdf', scanStatus: 'not_scanned' }),
    ]);
    show(<ReviewerEvidence applicationId="app-1" />);
    expect(await screen.findByText('Virus scan: clean')).toBeInTheDocument();
    expect(screen.getByText('Not virus-scanned')).toBeInTheDocument();
    expect(screen.getByText(/3 MiB/)).toBeInTheDocument();
    expect(screen.getByText(/20 KiB/)).toBeInTheDocument();
  });

  it('shows the hash and revision and downloads the file', async () => {
    mocked.get.mockResolvedValue([reviewerDoc()]);
    show(<ReviewerEvidence applicationId="app-1" />);
    expect(await screen.findByText(/SHA-256 a{64}/)).toBeInTheDocument();
    expect(screen.getByText(/revision 3/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Download passport.pdf' }));
    expect(mocked.download).toHaveBeenCalledWith(`${reviewBase}/documents/doc-1/file`, 'passport.pdf');
  });

  it('verifies without a reason', async () => {
    mocked.get.mockResolvedValue([reviewerDoc()]);
    mocked.post.mockResolvedValue({});
    show(<ReviewerEvidence applicationId="app-1" />);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Verify passport.pdf' }));
    await waitFor(() => expect(mocked.post).toHaveBeenCalledWith(`${reviewBase}/documents/doc-1/decision`, { status: 'verified' }));
  });

  it('will not reject without a reason of at least ten characters, then sends it', async () => {
    mocked.get.mockResolvedValue([reviewerDoc()]);
    mocked.post.mockResolvedValue({});
    show(<ReviewerEvidence applicationId="app-1" />);
    const user = userEvent.setup();
    const reject = await screen.findByRole('button', { name: 'Reject passport.pdf' });
    expect(reject).toBeDisabled();
    await user.type(screen.getByLabelText(/Reason \(visible to the applicant/), 'too short');
    expect(reject).toBeDisabled();
    await user.type(screen.getByLabelText(/Reason \(visible to the applicant/), ' to read clearly');
    expect(reject).toBeEnabled();
    await user.click(reject);
    await waitFor(() =>
      expect(mocked.post).toHaveBeenCalledWith(`${reviewBase}/documents/doc-1/decision`, { status: 'rejected', reason: 'too short to read clearly' })
    );
  });

  it('offers no decision on a document that has already been decided and shows the reason given', async () => {
    mocked.get.mockResolvedValue([reviewerDoc({ status: 'rejected', decisionReason: 'Expired document supplied.' })]);
    show(<ReviewerEvidence applicationId="app-1" />);
    const card = (await screen.findByText('passport.pdf')).closest('li') as HTMLElement;
    expect(within(card).getByText(/Expired document supplied\./)).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: /Verify|Reject/ })).not.toBeInTheDocument();
  });

  it('shows a refused decision to the reviewer', async () => {
    mocked.get.mockResolvedValue([reviewerDoc()]);
    mocked.post.mockRejectedValue(new Error('This document has already been decided'));
    show(<ReviewerEvidence applicationId="app-1" />);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Verify passport.pdf' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('already been decided');
  });
});
