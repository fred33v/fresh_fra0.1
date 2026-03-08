import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { downloadableResources } from '@/data/workshopContent';
import {
  FileText,
  Download,
  ArrowLeft,
  ClipboardCheck,
  Map,
  BookOpen,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  ClipboardCheck,
  FileText,
  Map,
};

export default function Resources() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]" role="status" aria-label="Loading resources">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        </div>
      </Layout>
    );
  }

  if (!user) return null;

  const handleDownload = (resourceTitle: string) => {
    toast.info(`"${resourceTitle}" will be available for download after your organisation completes the full assessment.`, {
      duration: 5000,
    });
  };

  const preWorkshopResources = [
    {
      title: 'Understanding the Economic Crime Act 2023',
      description: 'A brief overview of the key provisions and implications for organisations',
      type: 'article',
    },
    {
      title: 'Fraud Risk Primer',
      description: 'Introduction to common fraud schemes and red flags',
      type: 'guide',
    },
    {
      title: 'Regulatory Compliance Checklist',
      description: 'Quick reference for compliance requirements',
      type: 'checklist',
    },
  ];

  return (
    <Layout>
      <div className="container py-8 lg:py-12">
        <Button variant="ghost" className="mb-6" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          Back
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold tracking-tight mb-2">Workshop Resources</h1>
          <p className="text-lg text-muted-foreground mb-8">
            Download materials and tools to support your fraud risk management journey
          </p>

          {/* Downloadable Resources */}
          <section className="mb-12" aria-label="Core workshop materials">
            <h2 className="text-xl font-semibold mb-4">Core Workshop Materials</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {downloadableResources.map((resource, index) => {
                const IconComponent = iconMap[resource.icon] || FileText;
                
                return (
                  <motion.div
                    key={resource.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="h-full hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                          <IconComponent className="h-6 w-6 text-primary" aria-hidden="true" />
                        </div>
                        <CardTitle className="text-lg">{resource.title}</CardTitle>
                        <CardDescription>{resource.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button variant="outline" className="w-full" onClick={() => handleDownload(resource.title)} aria-label={`Download ${resource.title} PDF`}>
                          <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                          Download PDF
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </section>

          {/* Pre-Workshop Reading */}
          <section className="mb-12" aria-label="Pre-workshop reading">
            <h2 className="text-xl font-semibold mb-4">Pre-Workshop Reading</h2>
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {preWorkshopResources.map((resource) => (
                    <div
                      key={resource.title}
                      className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                          <BookOpen className="h-5 w-5 text-accent" aria-hidden="true" />
                        </div>
                        <div>
                          <div className="font-medium">{resource.title}</div>
                          <div className="text-sm text-muted-foreground">{resource.description}</div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" aria-label={`Read ${resource.title}`}>
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Additional Resources */}
          <section aria-label="External resources">
            <h2 className="text-xl font-semibold mb-4">External Resources</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Government Guidance</CardTitle>
                  <CardDescription>
                    Official guidance on the Economic Crime and Corporate Transparency Act
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full" asChild>
                    <a href="https://www.gov.uk" target="_blank" rel="noopener noreferrer" aria-label="Visit GOV.UK (opens in new window)">
                      Visit GOV.UK
                      <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
                    </a>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">ACFE Resources</CardTitle>
                  <CardDescription>
                    Association of Certified Fraud Examiners reports and tools
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full" asChild>
                    <a href="https://www.acfe.com" target="_blank" rel="noopener noreferrer" aria-label="Visit ACFE (opens in new window)">
                      Visit ACFE
                      <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </section>
        </motion.div>
      </div>
    </Layout>
  );
}