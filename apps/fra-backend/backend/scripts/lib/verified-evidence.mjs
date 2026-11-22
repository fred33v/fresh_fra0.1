// Test fixture: attach one reviewer-verified evidence document to an application, so approval (which needs one)
// can be exercised by scripts that are about something else. Documents are inserted directly as verified, which the
// table's CHECK constraints allow; the upload and decision routes are covered by provider-documents-integration.
const PDF = Buffer.from('%PDF-1.7\n1 0 obj<<>>endobj\n%%EOF\n');

export async function addVerifiedEvidence(pool, applicationId, reviewerId, kind = 'identity') {
  const { rowCount } = await pool.query(
    `INSERT INTO public.provider_application_documents
       (application_id, application_revision, kind, filename, mime_type, content, sha256, uploaded_by,
        status, decided_by, decided_at, decision_reason)
     SELECT id, revision, $3, 'fixture.pdf', 'application/pdf', $4::bytea, encode(sha256($4::bytea), 'hex'),
            applicant_id, 'verified', $2, now(), 'Fixture document checked by reviewer'
     FROM public.provider_applications WHERE id = $1`,
    [applicationId, reviewerId, kind, PDF]
  );
  if (rowCount !== 1) throw new Error(`No application ${applicationId} to attach evidence to`);
}
