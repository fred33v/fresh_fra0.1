import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useWorkshopProgress } from '@/hooks/useWorkshopProgress';
import { api } from '@/lib/api';
import { createLogger } from '@/lib/logger';
const logger = createLogger('Certificate');
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CertificateDocument } from '@/components/certificate/CertificateDocument';
import { Certificate as CertificateType } from '@/types/workshop';
import {
  Award,
  Download,
  ArrowLeft,
  Share2,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

export default function Certificate() {
  const { user, profile } = useAuth();
  const { progress } = useWorkshopProgress();
  const navigate = useNavigate();
  const [certificate, setCertificate] = useState<CertificateType | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingCert, setIsLoadingCert] = useState(true);
  const certificateRef = useRef<HTMLDivElement>(null);

  const fetchCertificate = useCallback(async () => {
    if (!user) return;

    try {
      // The API returns the user's latest certificate, or null when none has been issued
      const cert = await api.get<CertificateType | null>('/api/v1/workshop/certificates');
      if (cert) setCertificate(cert);
    } catch (err: unknown) {
      logger.error('Error fetching certificate', err);
      toast.error('Failed to load certificate');
    }

    setIsLoadingCert(false);
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchCertificate();
    }
  }, [user, fetchCertificate]);

  const generateCertificate = async () => {
    if (!user || !progress?.completed_at) return;

    setIsGenerating(true);

    try {
      const data = await api.post<CertificateType>('/api/v1/workshop/certificates', {});
      setCertificate(data);
      toast.success('Certificate generated!');
    } catch (err: unknown) {
      toast.error('Failed to generate certificate. Please try again.');
      logger.error('Error generating certificate', err);
    }

    setIsGenerating(false);
  };

  const [isDownloading, setIsDownloading] = useState(false);

  /** The PDF is made by the server, with a QR code that opens the public verification page */
  const handleDownloadPDF = async () => {
    if (!certificate) return;
    setIsDownloading(true);
    try {
      await api.download(
        `/api/v1/certificates/${encodeURIComponent(certificate.certificate_number)}/pdf`,
        `certificate-${certificate.certificate_number}.pdf`,
      );
    } catch (err: unknown) {
      logger.error('Error downloading certificate', err);
      toast.error('The certificate PDF could not be downloaded. Please try again.');
    }
    setIsDownloading(false);
  };

  const verifyLink = certificate
    ? `${window.location.origin}/certificate/verify?n=${encodeURIComponent(certificate.certificate_number)}`
    : '';

  const handleShareCertificate = async () => {
    if (!certificate || !profile) return;

    const safeName = profile.full_name.replace(/[\n\r\t]/g, ' ').trim();
    // The verification link works for anyone, without signing in
    const shareData = {
      title: 'Fraud Risk Awareness Certificate',
      text: `${safeName} has completed the Fraud Risk Awareness Workshop. Certificate: ${certificate.certificate_number}`,
      url: verifyLink,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err: unknown) {
        // User cancelled or share failed - fall back to clipboard
        if ((err as Error).name !== 'AbortError') {
          await copyToClipboard(shareData);
        }
      }
    } else {
      await copyToClipboard(shareData);
    }
  };

  const copyToClipboard = async (shareData: { text: string; url: string }) => {
    try {
      await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
      toast.success('Verification link copied to clipboard');
    } catch {
      toast.error('Unable to copy to clipboard');
    }
  };

  if (!user || !profile) return null;

  if (isLoadingCert) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]" role="status" aria-label="Loading certificate">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        </div>
      </Layout>
    );
  }

  // No progress yet (or no workshop package) is not completion
  const isCompleted = !!progress?.completed_at;

  if (!isCompleted) {
    return (
      <Layout>
        <div className="container py-8 lg:py-12">
          <Button variant="ghost" className="mb-6" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          <Card className="max-w-2xl mx-auto">
            <CardContent className="pt-6 text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Award className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
              </div>
              <h1 className="text-xl font-semibold mb-2">Complete the Workshop First</h1>
              <p className="text-muted-foreground mb-6">
                You need to complete all workshop sections before you can receive your certificate.
              </p>
              <Button onClick={() => navigate('/workshop')}>
                Continue Workshop
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-8 lg:py-12">
        <Button variant="ghost" className="mb-6" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-5xl mx-auto"
        >
          {certificate ? (
            <>
              <h1 className="sr-only">Your certificate</h1>
              {/* Certificate Display: the same design as the PDF */}
              <div id="certificate-printable" ref={certificateRef} className="mb-6 shadow-elegant">
                <CertificateDocument
                  kind="training"
                  holderName={profile.full_name}
                  organisationName={profile.organization_name}
                  certificateNumber={certificate.certificate_number}
                  issuedAt={certificate.issued_at}
                  quizScore={typeof certificate.quiz_score === 'number' ? certificate.quiz_score : null}
                  verifyUrl={verifyLink}
                />
              </div>

              <ul className="mb-8 flex flex-wrap justify-center gap-4" aria-label="Workshop sections completed">
                {['Regulatory Landscape', 'Fraud Types & Risks', 'Defence Strategies', 'Case Studies'].map((section) => (
                  <li key={section} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
                    <span>{section}</span>
                  </li>
                ))}
              </ul>

              {/* Actions */}
              <div className="flex flex-wrap gap-4 justify-center">
                <Button size="lg" onClick={handleDownloadPDF} disabled={isDownloading} aria-busy={isDownloading}>
                  {isDownloading
                    ? <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
                    : <Download className="mr-2 h-5 w-5" aria-hidden="true" />}
                  Download PDF
                </Button>
                <Button size="lg" variant="outline" onClick={handleShareCertificate}>
                  <Share2 className="mr-2 h-5 w-5" aria-hidden="true" />
                  Share Certificate
                </Button>
              </div>
              <p className="text-center text-sm text-muted-foreground mt-4">
                Anyone can check this certificate is genuine at{' '}
                <a href={verifyLink} className="underline">{window.location.host}/certificate/verify</a>.
                The PDF has a QR code that opens this check.
              </p>
            </>
          ) : (
            <Card className="text-center">
              <CardHeader>
                <div className="flex justify-center mb-4">
                  <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center">
                    <Award className="h-8 w-8 text-success" aria-hidden="true" />
                  </div>
                </div>
                <CardTitle className="text-2xl">Congratulations!</CardTitle>
                <CardDescription>
                  You've completed the Fraud Risk Awareness Workshop
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-6">
                  Generate your certificate of completion to document your training.
                </p>
                <Button size="lg" onClick={generateCertificate} disabled={isGenerating} aria-busy={isGenerating}>
                  {isGenerating ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Award className="mr-2 h-5 w-5" aria-hidden="true" />
                  )}
                  Generate Certificate
                </Button>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
    </Layout>
  );
}