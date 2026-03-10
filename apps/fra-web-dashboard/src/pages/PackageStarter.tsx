import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/layout/Layout';
import {
  Shield,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FileText,
} from 'lucide-react';

export default function PackageStarter() {
  const { user } = useAuth();

  const starterFeatures = [
    { icon: ClipboardCheck, text: 'Complete fraud risk assessment across 13 key areas' },
    { icon: FileText, text: 'Professional PDF health check report with risk scoring' },
    { icon: Shield, text: 'ECCTA 2023 compliance snapshot and recommendations' },
  ];

  const assessmentModules = [
    'Governance & Oversight',
    'Staff Awareness & Training',
    'Financial Controls',
    'Data Protection & Privacy',
    'Incident Management',
    'Third-Party Risk',
    'Systems & Technology',
    'Fraud Detection Tools',
    'Whistleblowing Procedures',
    'Procurement Controls',
    'Asset Management',
    'Case Management',
    'Culture & Tone',
  ];

  const idealFor = [
    'Sole traders and micro-businesses',
    'One-time compliance checks',
    'Budget-conscious organizations',
    'Initial fraud risk visibility',
    'Entry-level risk assessment',
  ];

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative overflow-hidden gradient-hero py-20 lg:py-32">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoNnYtNmgtNnptMCAwdi02aDZ2Nmgtengvex0WC8rMC8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />

        <div className="container relative">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center lg:text-left"
            >
              <div className="inline-flex items-center gap-2 rounded-full bg-accent/20 px-4 py-1.5 text-sm font-medium text-accent mb-6">
                <Shield className="h-4 w-4" />
                <span>GovS-013 & ECCTA 2023 Compliant</span>
              </div>

              <h1 className="text-4xl font-bold tracking-tight text-primary-foreground sm:text-5xl lg:text-6xl mb-6">
                Starter
                <br />
                <span className="text-accent">Fraud Risk Assessment</span>
              </h1>

              <p className="text-lg text-primary-foreground/80 mb-4 max-w-xl mx-auto lg:mx-0">
                Get a clear picture of your fraud vulnerabilities with our comprehensive one-time assessment.
                Perfect for organisations needing an immediate compliance snapshot.
              </p>

              <div className="flex items-center gap-3 mb-8 justify-center lg:justify-start">
                <p className="text-2xl font-bold text-accent">
                  £795<span className="text-base font-medium text-primary-foreground/60"> one-time</span>
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90" asChild>
                  <Link to={user ? '/checkout?package=Starter&price=795' : '/auth?mode=signup'}>
                    Start Assessment
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10" asChild>
                  <Link to="/resources">
                    <BookOpen className="mr-2 h-5 w-5" />
                    View Resources
                  </Link>
                </Button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="relative"
            >
              <div className="aspect-square rounded-lg bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center">
                <CheckCircle2 className="h-32 w-32 text-accent opacity-50" />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* What's Included */}
      <section className="py-16 lg:py-24">
        <div className="container">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl mb-12 text-center">
              What's Included
            </h2>
            <div className="grid gap-6">
              {starterFeatures.map((feature) => {
                const Icon = feature.icon;
                return (
                  <Card key={feature.text} className="border-primary-foreground/20">
                    <CardContent className="p-6 flex gap-4">
                      <div className="flex-shrink-0">
                        <Icon className="h-6 w-6 text-accent" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="text-lg font-medium text-primary-foreground">{feature.text}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Assessment Modules */}
      <section className="py-16 lg:py-24 bg-muted/50">
        <div className="container">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl mb-12 text-center">
              Complete Assessment of 13 Key Areas
            </h2>
            <p className="text-lg text-primary-foreground/80 text-center mb-12 max-w-2xl mx-auto">
              Our comprehensive assessment covers all critical fraud risk areas, helping you build a complete picture of your organization's vulnerabilities and readiness.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {assessmentModules.map((module) => (
                <div key={module} className="flex items-start gap-3 p-4 rounded-lg border border-primary-foreground/10 bg-background">
                  <CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="text-primary-foreground font-medium">{module}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Ideal For */}
      <section className="py-16 lg:py-24 bg-muted/50">
        <div className="container">
          <h2 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl mb-12 text-center">
            Why Choose Starter?
          </h2>
          <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
            {idealFor.map((item) => (
              <div key={item} className="flex items-start gap-3 p-4 rounded-lg border border-primary-foreground/10">
                <CheckCircle2 className="h-6 w-6 text-accent shrink-0 mt-0.5" aria-hidden="true" />
                <span className="text-primary-foreground">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Package Comparison */}
      <section className="py-16 lg:py-24">
        <div className="container">
          <h2 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl mb-12 text-center">
            Package Comparison
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-primary-foreground/20">
                  <th className="text-left py-4 px-4 font-bold text-primary-foreground">Feature</th>
                  <th className="text-center py-4 px-4 font-bold text-accent">Starter</th>
                  <th className="text-center py-4 px-4 font-semibold text-primary-foreground/60">Professional</th>
                  <th className="text-center py-4 px-4 font-semibold text-primary-foreground/60">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-primary-foreground/10">
                  <td className="py-4 px-4 text-primary-foreground">Fraud Risk Assessment</td>
                  <td className="text-center py-4 px-4"><CheckCircle2 className="h-5 w-5 text-accent inline" /></td>
                  <td className="text-center py-4 px-4"><CheckCircle2 className="h-5 w-5 text-primary-foreground/40 inline" /></td>
                  <td className="text-center py-4 px-4"><CheckCircle2 className="h-5 w-5 text-primary-foreground/40 inline" /></td>
                </tr>
                <tr className="border-b border-primary-foreground/10">
                  <td className="py-4 px-4 text-primary-foreground">PDF Report</td>
                  <td className="text-center py-4 px-4"><CheckCircle2 className="h-5 w-5 text-accent inline" /></td>
                  <td className="text-center py-4 px-4"><CheckCircle2 className="h-5 w-5 text-primary-foreground/40 inline" /></td>
                  <td className="text-center py-4 px-4"><CheckCircle2 className="h-5 w-5 text-primary-foreground/40 inline" /></td>
                </tr>
                <tr className="border-b border-primary-foreground/10">
                  <td className="py-4 px-4 text-primary-foreground">ECCTA Compliance</td>
                  <td className="text-center py-4 px-4"><CheckCircle2 className="h-5 w-5 text-accent inline" /></td>
                  <td className="text-center py-4 px-4"><CheckCircle2 className="h-5 w-5 text-primary-foreground/40 inline" /></td>
                  <td className="text-center py-4 px-4"><CheckCircle2 className="h-5 w-5 text-primary-foreground/40 inline" /></td>
                </tr>
                <tr className="border-b border-primary-foreground/10">
                  <td className="py-4 px-4 text-primary-foreground">Staff Training</td>
                  <td className="text-center py-4 px-4 text-muted-foreground">—</td>
                  <td className="text-center py-4 px-4"><CheckCircle2 className="h-5 w-5 text-green-500 inline" /></td>
                  <td className="text-center py-4 px-4"><CheckCircle2 className="h-5 w-5 text-green-500 inline" /></td>
                </tr>
                <tr className="border-b border-primary-foreground/10">
                  <td className="py-4 px-4 text-primary-foreground">Employee Key-Passes</td>
                  <td className="text-center py-4 px-4">1</td>
                  <td className="text-center py-4 px-4">50</td>
                  <td className="text-center py-4 px-4">Unlimited</td>
                </tr>
                <tr className="border-b border-primary-foreground/10">
                  <td className="py-4 px-4 text-primary-foreground">Reassessment</td>
                  <td className="text-center py-4 px-4 text-muted-foreground">One-time</td>
                  <td className="text-center py-4 px-4">Quarterly</td>
                  <td className="text-center py-4 px-4">Continuous</td>
                </tr>
                <tr className="border-b border-primary-foreground/10">
                  <td className="py-4 px-4 text-primary-foreground">Email Support</td>
                  <td className="text-center py-4 px-4 text-muted-foreground">—</td>
                  <td className="text-center py-4 px-4"><CheckCircle2 className="h-5 w-5 text-green-500 inline" /></td>
                  <td className="text-center py-4 px-4"><CheckCircle2 className="h-5 w-5 text-green-500 inline" /></td>
                </tr>
                <tr>
                  <td className="py-4 px-4 text-primary-foreground font-bold">Price</td>
                  <td className="text-center py-4 px-4 font-bold text-accent">£795</td>
                  <td className="text-center py-4 px-4 font-semibold text-primary-foreground/60">£1,799/year</td>
                  <td className="text-center py-4 px-4 font-semibold text-primary-foreground/60">£4,995/year</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 lg:py-24 border-t">
        <div className="container">
          <Card className="border-0 gradient-hero overflow-hidden">
            <CardContent className="p-12 lg:p-16 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl mb-4">
                Get Your Fraud Risk Assessment Today
              </h2>
              <p className="text-lg text-primary-foreground/80 mb-2 max-w-2xl mx-auto">
                One-time comprehensive assessment across 13 key fraud risk areas.
              </p>
              <p className="text-2xl font-bold text-accent mb-8">
                £795 (one-time)
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90" asChild>
                  <Link to={user ? '/checkout?package=Starter&price=795' : '/auth?mode=signup'}>
                    Start Assessment Now
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10" asChild>
                  <Link to="/">
                    Compare All Packages
                  </Link>
                </Button>
              </div>
              <p className="text-sm text-primary-foreground/50 mt-6">
                Need ongoing training and multiple key-passes? Explore our Professional or Enterprise packages.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 bg-muted/30">
        <div className="container">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <Shield className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-primary-foreground">Fraud Risk Assessment Service</span>
            </div>
            <p className="text-sm text-muted-foreground">
              GovS-013 & ECCTA 2023 Compliant
            </p>
          </div>
        </div>
      </footer>
    </Layout>
  );
}
