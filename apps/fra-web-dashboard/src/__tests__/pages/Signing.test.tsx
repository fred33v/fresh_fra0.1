import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Signing from '@/pages/Signing';
import { api } from '@/lib/api';
import type { SigningDocument, SigningField } from '@/lib/esign';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    upload: vi.fn(),
    blob: vi.fn(),
    download: vi.fn(),
  },
}));
vi.mock('@/components/layout/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'test-manager' } }) }));
const confirm = vi.fn();
vi.mock('@/hooks/useConfirm', () => ({ useConfirm: () => confirm }));
vi.mock('@/components/esign/PdfFieldEditor', () => ({
  default: ({
    fields,
    onChange,
  }: {
    fields: SigningField[];
    onChange: (v: SigningField[]) => void;
  }) => (
    <button
      onClick={() =>
        onChange([
          ...fields,
          {
            signerId: 'recipient-1',
            page: 0,
            x: 35,
            y: 200,
            width: 180,
            height: 44,
            kind: 'signature',
          },
        ])
      }
    >
      Place test signature
    </button>
  ),
}));
const mocked = vi.mocked(api);
let doc: SigningDocument;
function show(path = '/signing') {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/signing" element={<Signing />} />
          <Route path="/signing/:id" element={<Signing />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  confirm.mockResolvedValue(true);
  doc = {
    id: 'doc-1',
    title: 'Supplier agreement',
    status: 'draft',
    pages: [{ width: 595, height: 842 }],
    signers: [],
    fields: [],
    createdAt: '2026-11-18T10:00:00Z',
    expiresAt: null,
  };
  mocked.get.mockImplementation(async (path) =>
    path.includes('offset=') ? { documents: [], hasMore: false } : structuredClone(doc)
  );
  mocked.blob.mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));
});
it('uploads a multipart PDF, adds a recipient, saves fields and sends after explicit review', async () => {
  const user = userEvent.setup();
  mocked.upload.mockResolvedValue({ id: 'doc-1' });
  mocked.post.mockImplementation(async (path) => {
    if (path.endsWith('/signers')) {
      doc.signers.push({
        id: 'recipient-1',
        name: 'Alex Morgan',
        email: 'alex@example.test',
        status: 'pending',
        signed_at: null,
        invitation_sent_at: null,
      });
      return { id: 'recipient-1' };
    }
    doc.status = 'sent';
    return { deliveries: [{ signerId: 'recipient-1', sent: false }] };
  });
  mocked.put.mockImplementation(async (_path, body) => {
    doc.fields = (body as { fields: SigningField[] }).fields.map(({ signerId, ...f }) => ({
      ...f,
      signer_id: signerId,
    }));
    return {};
  });
  show('/signing/new');
  await user.type(screen.getByLabelText('Document title'), 'Supplier agreement');
  await user.upload(
    screen.getByLabelText('Choose your PDF'),
    new File(['%PDF-1.7'], 'agreement.pdf', { type: 'application/pdf' })
  );
  fireEvent.submit(screen.getByRole('button', { name: 'Upload & continue' }).closest('form')!);
  expect(await screen.findByText('Who needs to sign?')).toBeInTheDocument();
  const form = mocked.upload.mock.calls[0][1];
  expect(form.get('title')).toBe('Supplier agreement');
  expect(form.get('file')).toBeInstanceOf(File);
  await user.type(screen.getByLabelText('Full name'), 'Alex Morgan');
  await user.type(screen.getByLabelText('Email address'), 'alex@example.test');
  await user.click(screen.getByRole('button', { name: 'Add recipient' }));
  await user.click(await screen.findByRole('button', { name: 'Place signature fields' }));
  expect(screen.getByRole('button', { name: 'Save fields & review' })).toBeDisabled();
  await user.click(await screen.findByRole('button', { name: 'Place test signature' }));
  await user.click(screen.getByRole('button', { name: 'Save fields & review' }));
  expect(await screen.findByText('Ready to send?')).toBeInTheDocument();
  const send = screen.getByRole('button', { name: 'Send invitations' });
  expect(send).toBeDisabled();
  await user.click(screen.getByRole('checkbox'));
  await user.click(send);
  expect(await screen.findByText(/1 invitation\(s\) could not be sent/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Resend invitation' })).toBeInTheDocument();
  expect(confirm).toHaveBeenCalled();
});
it('lists saved documents and filters only the current page', async () => {
  mocked.get.mockResolvedValue({
    documents: [
      {
        id: 'doc-1',
        title: 'Supplier agreement',
        status: 'completed',
        created_at: doc.createdAt,
        expires_at: null,
        signer_count: 1,
        signed_count: 1,
      },
    ],
    hasMore: false,
  });
  show();
  expect(await screen.findByRole('link', { name: 'Supplier agreement' })).toHaveAttribute(
    'href',
    '/signing/doc-1'
  );
  await userEvent.selectOptions(screen.getByLabelText('Filter this page by status'), 'draft');
  expect(screen.getByText('No documents with this status on this page.')).toBeInTheDocument();
});
it('shows an actionable disabled-service failure instead of an empty document list', async () => {
  mocked.get.mockRejectedValue(new Error('Electronic signing is not enabled'));
  show();
  expect(await screen.findByRole('alert')).toHaveTextContent('Electronic signing is not enabled');
});
it('does not send after the user cancels confirmation and strips database field metadata when saving', async () => {
  doc.signers = [
    {
      id: 'recipient-1',
      name: 'Alex',
      email: 'alex@example.test',
      status: 'pending',
      signed_at: null,
      invitation_sent_at: null,
    },
  ];
  doc.fields = [
    {
      id: 'db-field',
      document_id: 'doc-1',
      signer_id: 'recipient-1',
      page: 0,
      x: 35,
      y: 200,
      width: 180,
      height: 44,
      kind: 'signature',
    } as SigningDocument['fields'][number],
  ];
  mocked.put.mockResolvedValue({});
  confirm.mockResolvedValue(false);
  show('/signing/doc-1');
  await userEvent.click(await screen.findByRole('button', { name: 'Place signature fields' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Save fields & review' }));
  await screen.findByText('Ready to send?');
  expect(mocked.put).toHaveBeenCalledWith('/api/v1/esign/documents/doc-1/fields', {
    fields: [
      {
        signerId: 'recipient-1',
        page: 0,
        x: 35,
        y: 200,
        width: 180,
        height: 44,
        kind: 'signature',
      },
    ],
  });
  await userEvent.click(screen.getByRole('checkbox'));
  await userEvent.click(screen.getByRole('button', { name: 'Send invitations' }));
  await waitFor(() => expect(confirm).toHaveBeenCalled());
  expect(mocked.post).not.toHaveBeenCalled();
});
it('verifies retained audit evidence and exposes downloads for completed documents', async () => {
  doc.status = 'completed';
  mocked.get.mockImplementation(async (path) =>
    path.endsWith('/audit') ? { entries: [], retainedCheckpointVerified: true } : doc
  );
  show('/signing/doc-1');
  await userEvent.click(await screen.findByRole('button', { name: 'Signed PDF' }));
  expect(mocked.download).toHaveBeenCalledWith(
    '/api/v1/esign/documents/doc-1/final',
    'signed-document.pdf'
  );
  await userEvent.click(screen.getByRole('button', { name: 'Verify activity record' }));
  expect(
    await screen.findByText('Audit chain and retained evidence checkpoint verified.')
  ).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Send invitations' })).not.toBeInTheDocument();
});
