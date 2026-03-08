import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/layout/Layout';
import {
  Shield,
  Users,
  ArrowRight,
  CheckCircle2,
  LayoutDashboard,
  BarChart3,
  Key,
  Headphones,
  FileText,
  Award,
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export default function PackageEnterprise() {
  const { user } = useAuth();

  const professionalFeatures = [
    { icon: CheckCircle2, text: 'Fraud risk assessment across 13 key areas' },
    { icon: CheckCircle2, text: 'Staff awareness training with certificates' },
    { icon: CheckCircle2, text: 'Quarterly reassessment and email support' },
  ];

  const enterpriseFeatures = [
    { icon: LayoutDashboard, title: 'Real-Time Monitoring Dashboard', desc: 'Live view of assessments, risk scores, and compliance status across your entire organisation — updated in real time.' },
    { icon: Users, title: 'Unlimited Employee Key-Passes', desc: 'No cap on how many staff can complete assessments. Scale fraud awareness across every department.' },
    { icon: BarChart3, title: 'Risk Register & Action Tracking', desc: 'Inherent and residual risk scoring with priority bands, owner assignment, and progress monitoring.' },
    { icon: Key, title: 'API Access', desc: 'Integrate fraud risk data with your existing GRC tools, SIEM platforms, or internal dashboards via RESTful API.' },
    { icon: Headphones, title: 'Priority Support', desc: 'Dedicated assistance with onboarding, compliance queries, and ongoing platform support.' },
    { icon: FileText, title: 'Compliance Reports', desc: 'GovS-013 and ECCTA 2023 compliance reports ready for auditors, regulators, and board-level reporting.' },
  ];

  const idealFor = [
    'Large organisations with 100+ employees',
    'Public sector and NHS bodies',
    'Organisations requiring real-time compliance oversight',
    'Teams needing API integration with existing GRC tools',
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
                Enterprise
                <br />
                <span className="text-amber-400">Full Dashboard</span>
              </h1>

              <p className="text-lg text-primary-foreground/80 mb-4 max-w-xl mx-auto lg:mx-0">
                The complete fraud risk management solution. Real-time monitoring dashboard,
                unlimited employee key-passes, and full compliance reporting.
              </p>

              <div className="flex items-center gap-3 mb-8 justify-center lg:justify-start">
                <p className="text-2xl font-bold text-amber-400">
                  £4,995<span className="text-base font-medium text-primary-foreground/60">/year + VAT</span>
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button size="lg" className="bg-amber-500 text-white hover:bg-amber-600" asChild>
                  <Link to={user ? '/checkout?package=Enterprise&price=4995' : '/auth?mode=signup'}>
                    Choose Enterprise
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10" asChild>
                  <Link to="/">
                    Compare All Packages
                  </Link>
                </Button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="relative"
            >
              <Card className="border-0 shadow-2xl bg-card/95 backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-xl">Everything in Professional</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {professionalFeatures.map((f) => (
                    <div key={f.text} className="flex items-start gap-3">
                      <f.icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">{f.text}</span>
                    </div>
                  ))}
                  <div className="border-t pt-3 mt-3">
                    <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-3">+ Enterprise Features</p>
                    {enterpriseFeatures.map((f) => (
                      <div key={f.title} className="flex items-start gap-3 mb-2">
                        <f.icon className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <span className="text-sm font-medium">{f.title}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mt-6">
                {[
                  { value: '£4,995', label: 'Per Year', sublabel: 'Annual subscription' },
                  { value: '∞', label: 'Key-Passes', sublabel: 'Unlimited access' },
                  { value: 'Live', label: 'Dashboard', sublabel: 'Real-time data' },
                ].map((stat, index) => (
                  <motion.div
                    key={stat.label + stat.value}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.4 + index * 0.1 }}
                    className="text-center p-4 rounded-lg bg-primary-foreground/5 backdrop-blur"
                  >
                    <div className="text-2xl font-bold text-primary-foreground">{stat.value}</div>
                    <div className="text-sm font-medium text-primary-foreground/80">{stat.label}</div>
                    <div className="text-xs text-primary-foreground/60">{stat.sublabel}</div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Enterprise Features Section */}
      <section className="py-20 lg:py-32">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              Enterprise Features in Detail
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Full organisational oversight with real-time dashboards, unlimited scaling,
              and API integration for your existing compliance infrastructure.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {enterpriseFeatures.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="h-full border-0 shadow-lg hover:shadow-xl transition-shadow">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg bg-amber-500/10 flex items-center justify-center mb-4">
                      <feature.icon className="h-6 w-6 text-amber-600" />
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{feature.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Enterprise Section */}
      <section className="py-20 lg:py-32 bg-muted/50">
        <div className="container">
          <div className="grid gap-12 lg:grid-cols-2 items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-6">
                Why Choose Enterprise?
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Large organisations need more than assessments — they need ongoing visibility.
                The Enterprise package delivers a live compliance dashboard, unlimited staff access,
                and the API integrations auditors and regulators expect.
              </p>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Ideal for:</h3>
                {idealFor.map((item, index) => (
                  <motion.div
                    key={item}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    viewport={{ once: true }}
                    className="flex items-start gap-3"
                  >
                    <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
            >
              <Card className="border-0 shadow-xl">
                <CardHeader className="gradient-hero text-primary-foreground rounded-t-lg">
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    Enterprise vs Professional
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <ul className="space-y-3">
                    {[
                      'Real-time monitoring dashboard vs static reports',
                      'Unlimited key-passes vs 50 in Professional',
                      'Risk register with inherent/residual scoring',
                      'API access for GRC tool integration',
                      'Priority support with dedicated onboarding',
                      'Board-ready compliance reports for GovS-013 & ECCTA',
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                        <span className="text-sm">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Onboarding Steps */}
      <section className="py-20 lg:py-32">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              Your Enterprise Onboarding
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From purchase to live dashboard in days, not months.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { step: 1, title: 'Complete Payment', time: '5 minutes', desc: 'Secure checkout with instant confirmation.' },
              { step: 2, title: 'Team Invitation', time: 'Within 24 hours', desc: 'Distribute key-passes and invite your team.' },
              { step: 3, title: 'Initial Setup', time: '30 minutes', desc: 'Configure departments, roles, and risk areas.' },
              { step: 4, title: 'Dashboard Live', time: 'Same day', desc: 'Real-time monitoring and compliance reports.' },
            ].map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-lg font-bold dark:bg-amber-500/20 dark:text-amber-400">
                  {item.step}
                </div>
                <h3 className="font-semibold mb-1">{item.title}</h3>
                <p className="text-sm text-amber-600 font-medium mb-2">{item.time}</p>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 lg:py-32 bg-muted/50">
        <div className="container max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              Common Questions
            </h2>
            <p className="text-lg text-muted-foreground">
              Everything you need to know about the Enterprise package.
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="onboarding">
              <AccordionTrigger>How long is the onboarding process?</AccordionTrigger>
              <AccordionContent>
                Most organisations are fully operational within 1–2 business days. You can distribute key-passes and begin assessments immediately after payment. Dashboard configuration typically takes 30 minutes.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="upgrade">
              <AccordionTrigger>Can I upgrade from Professional mid-year?</AccordionTrigger>
              <AccordionContent>
                Yes. Contact our team and we will apply your remaining Professional subscription value as credit towards the Enterprise package. The upgrade takes effect immediately.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="api">
              <AccordionTrigger>Is API access included or paid separately?</AccordionTrigger>
              <AccordionContent>
                API access is included at no additional cost with the Enterprise package. You will receive API documentation and credentials during onboarding.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="support">
              <AccordionTrigger>What does priority support cover?</AccordionTrigger>
              <AccordionContent>
                Priority support includes dedicated assistance Monday to Friday, 9am–6pm GMT, with a 4-hour response guarantee. This covers onboarding help, compliance queries, and ongoing platform support.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="keypasses">
              <AccordionTrigger>How do employee key-passes work?</AccordionTrigger>
              <AccordionContent>
                Key-passes are unique access codes you distribute to staff. Each code allows an employee to create an account and complete their fraud risk assessment. Enterprise includes unlimited key-passes with no cap on team size.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 lg:py-32 bg-muted/30">
        <div className="container">
          <Card className="border-0 gradient-hero overflow-hidden">
            <CardContent className="p-12 lg:p-16 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl mb-4">
                Full Visibility. Total Compliance.
              </h2>
              <p className="text-lg text-primary-foreground/80 mb-2 max-w-2xl mx-auto">
                Real-time dashboard + unlimited key-passes + API access + priority support.
              </p>
              <p className="text-2xl font-bold text-amber-400 mb-8">
                £4,995/year + VAT
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" className="bg-amber-500 text-white hover:bg-amber-600" asChild>
                  <Link to={user ? '/checkout?package=Enterprise&price=4995' : '/auth?mode=signup'}>
                    Get Started Now
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
                Need a smaller team solution? Check out our Professional package at £1,799/year.
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
              <span className="font-semibold">Fraud Risk Enterprise Platform</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </Layout>
  );
}
