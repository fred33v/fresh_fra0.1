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
      const certs = await api.get<CertificateType[]>('/api/v1/workshop/certificates');
      if (certs.length > 0) {
        setCertificate(certs[0]);
      }
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

  const handleDownloadPDF = () => {
    if (!certificateRef.current) return;

    // Add print-only styles dynamically
    const style = document.createElement('style');
    style.id = 'certificate-print-styles';
    style.textContent = `
      @media print {
        body * { visibility: hidden !important; }
        #certificate-printable, #certificate-printable * { visibility: visible !important; }
        #certificate-printable {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          padding: 40px !important;
        }
        @page { size: landscape; margin: 20mm; }
      }
    `;
    document.head.appendChild(style);
    window.print();
    // Clean up after print dialog closes
    setTimeout(() => {
      document.getElementById('certificate-print-styles')?.remove();
    }, 1000);
  };

  const handleShareCertificate = async () => {
    if (!certificate || !profile) return;

    const safeName = profile.full_name.replace(/[\n\r\t]/g, ' ').trim();
    const shareData = {
      title: 'Fraud Risk Awareness Certificate',
      text: `${safeName} has completed the Fraud Risk Awareness Workshop. Certificate: ${certificate.certificate_number}`,
      url: window.location.href,
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
      toast.success('Certificate link copied to clipboard');
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

  const isCompleted = progress?.completed_at !== null;

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
              <h2 className="text-xl font-semibold mb-2">Complete the Workshop First</h2>
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
          className="max-w-4xl mx-auto"
        >
          {certificate ? (
            <>
              {/* Certificate Display */}
              <Card id="certificate-printable" ref={certificateRef} className="overflow-hidden mb-6" role="article" aria-label="Certificate of Completion">
                <div className="gradient-hero p-8 lg:p-12 text-center">
                  <div className="flex justify-center mb-6">
                    <div className="h-20 w-20 rounded-full bg-accent flex items-center justify-center">
                      <Award className="h-10 w-10 text-accent-foreground" aria-hidden="true" />
                    </div>
                  </div>
                  <h1 className="text-3xl lg:text-4xl font-bold text-primary-foreground mb-2">
                    Certificate of Completion
                  </h1>
                  <p className="text-primary-foreground/80 text-lg">
                    Fraud Risk Awareness Workshop
                  </p>
                </div>

                <CardContent className="p-8 lg:p-12">
                  <div className="text-center mb-8">
                    <p className="text-muted-foreground mb-2">This is to certify that</p>
                    <h2 className="text-2xl font-bold mb-2">{profile.full_name}</h2>
                    <p className="text-muted-foreground">{profile.organization_name}</p>
                  </div>

                  <div className="text-center mb-8">
                    <p className="text-muted-foreground">
                      has successfully completed the Fraud Risk Awareness Workshop
                      for trustees, executive leadership, and budget-holders.
                    </p>
                  </div>

                  <div className="flex flex-wrap justify-center gap-8 text-sm">
                    <div className="text-center">
                      <p className="text-muted-foreground">Certificate Number</p>
                      <p className="font-mono font-medium">{certificate.certificate_number}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground">Date Issued</p>
                      <p className="font-medium">
                        {new Date(certificate.issued_at).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="mt-8 pt-8 border-t flex flex-wrap justify-center gap-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
                      <span>Regulatory Landscape</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
                      <span>Fraud Types & Risks</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
                      <span>Defence Strategies</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
                      <span>Case Studies</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex flex-wrap gap-4 justify-center">
                <Button size="lg" onClick={handleDownloadPDF}>
                  <Download className="mr-2 h-5 w-5" aria-hidden="true" />
                  Download PDF
                </Button>
                <Button size="lg" variant="outline" onClick={handleShareCertificate}>
                  <Share2 className="mr-2 h-5 w-5" aria-hidden="true" />
                  Share Certificate
                </Button>
              </div>
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