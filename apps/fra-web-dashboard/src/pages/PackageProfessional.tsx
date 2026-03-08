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
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  RefreshCw,
  Mail,
  Award,
} from 'lucide-react';

export default function PackageProfessional() {
  const { user } = useAuth();

  const starterFeatures = [
    { icon: ClipboardCheck, text: 'Single fraud risk assessment across 13 key areas' },
    { icon: FileText, text: 'Professional PDF health check report' },
    { icon: Shield, text: 'ECCTA 2023 compliance snapshot' },
  ];

  const professionalFeatures = [
    { icon: BookOpen, title: 'Staff Awareness Training', desc: 'Interactive 30-minute fraud awareness workshop for your entire team — quizzes, scenarios, and certificates included.' },
    { icon: Users, title: 'Up to 50 Employee Key-Passes', desc: 'Distribute assessments across your workforce so every team member can complete their own fraud risk review.' },
    { icon: RefreshCw, title: 'Quarterly Reassessment', desc: 'Keep your risk profile current with automated reassessment reminders every quarter.' },
    { icon: Mail, title: 'Email Support', desc: 'Dedicated help with your assessment, training rollout, and compliance questions.' },
  ];

  const idealFor = [
    'SMEs with 10–100 employees',
    'Organisations needing staff training evidence for ECCTA compliance',
    'Charities and public-sector teams with governance obligations',
    'Budget-holders seeking quarterly fraud risk updates',
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
                Professional
                <br />
                <span className="text-accent">FRA + Training</span>
              </h1>

              <p className="text-lg text-primary-foreground/80 mb-4 max-w-xl mx-auto lg:mx-0">
                Everything in Starter, plus staff awareness training and up to 50 employee key-passes.
                Build a fraud-aware culture across your organisation.
              </p>

              <div className="flex items-center gap-3 mb-8 justify-center lg:justify-start">
                <span className="inline-flex items-center gap-1 rounded-full bg-green-500/20 px-3 py-1 text-sm font-semibold text-green-300">
                  Most Popular
                </span>
                <p className="text-2xl font-bold text-accent">
                  £1,799<span className="text-base font-medium text-primary-foreground/60">/year + VAT</span>
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90" asChild>
                  <Link to={user ? '/checkout?package=Professional&price=1799' : '/auth?mode=signup'}>
                    Choose Professional
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
              transition={{ duration: 0.5, delay: 0.2 }}
              className="relative"
            >
              <Card className="border-0 shadow-2xl bg-card/95 backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-xl">What's Included</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {starterFeatures.map((f) => (
                    <div key={f.text} className="flex items-start gap-3">
                      <f.icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">{f.text}</span>
                    </div>
                  ))}
                  <div className="border-t pt-3 mt-3">
                    <p className="text-xs font-semibold text-accent uppercase tracking-wide mb-3">+ Professional Features</p>
                    {professionalFeatures.map((f) => (
                      <div key={f.title} className="flex items-start gap-3 mb-2">
                        <f.icon className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                        <span className="text-sm font-medium">{f.title}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mt-6">
                {[
                  { value: '£1,799', label: 'Per Year', sublabel: 'Annual subscription' },
                  { value: '50', label: 'Key-Passes', sublabel: 'Employee access' },
                  { value: '4x', label: 'Per Year', sublabel: 'Quarterly reviews' },
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

      {/* Professional Features Section */}
      <section className="py-20 lg:py-32">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              Professional Features in Detail
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Go beyond a one-off assessment. Train your staff, distribute key-passes,
              and maintain compliance with quarterly reassessments.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            {professionalFeatures.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="h-full border-0 shadow-lg hover:shadow-xl transition-shadow">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <feature.icon className="h-6 w-6 text-primary" />
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

      {/* Why Upgrade Section */}
      <section className="py-20 lg:py-32 bg-muted/50">
        <div className="container">
          <div className="grid gap-12 lg:grid-cols-2 items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-6">
                Why Upgrade to Professional?
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Under ECCTA 2023, organisations must demonstrate "reasonable procedures" to prevent fraud —
                including staff training. The Professional package provides the evidence auditors expect.
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
                    Professional vs Starter
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <ul className="space-y-3">
                    {[
                      'Staff awareness training with certificates of completion',
                      '50 employee key-passes vs 1 in Starter',
                      'Quarterly reassessment vs one-off only',
                      'Email support included',
                      'Demonstrates "reasonable procedures" under ECCTA 2023',
                      'Ideal for organisations with compliance obligations',
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

      {/* CTA Section */}
      <section className="py-20 lg:py-32">
        <div className="container">
          <Card className="border-0 gradient-hero overflow-hidden">
            <CardContent className="p-12 lg:p-16 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl mb-4">
                Train Your Team. Prove Compliance.
              </h2>
              <p className="text-lg text-primary-foreground/80 mb-2 max-w-2xl mx-auto">
                Fraud risk assessment + staff awareness training + 50 employee key-passes.
              </p>
              <p className="text-2xl font-bold text-accent mb-8">
                £1,799/year + VAT
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90" asChild>
                  <Link to={user ? '/checkout?package=Professional&price=1799' : '/auth?mode=signup'}>
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
                Need unlimited key-passes and a real-time dashboard? Ask about our Enterprise package.
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
              <span className="font-semibold">Fraud Risk Awareness Workshop</span>
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
