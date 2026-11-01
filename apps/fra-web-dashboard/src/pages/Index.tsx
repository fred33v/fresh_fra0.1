import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/layout/Layout';
import {
  Shield,
  Target,
  Award,
  ArrowRight,
  Play,
  BookOpen,
  Clock,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  Map,
  Mail,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { PACKAGES, PACKAGE_CHOOSER_PATH, billingLabel, checkoutPath, formatPrice, signupPath } from '@/data/packages';
import { downloadableResources } from '@/data/workshopContent';

const [STARTER, PROFESSIONAL, ENTERPRISE] = PACKAGES;

export default function Index() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { hash, key } = useLocation();

  // React Router doesn't scroll to #anchors, so "Get Started" (/#packages) would otherwise do nothing.
  useEffect(() => {
    if (!hash) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(hash.slice(1))?.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  }, [hash, key]); // key changes on every click, so repeat clicks scroll again
  const [sessionCode, setSessionCode] = useState('');

  const handleJoinSession = () => {
    if (sessionCode.trim()) {
      navigate(`/workshop?session=${sessionCode.trim().toUpperCase()}`);
    }
  };

  const features = [
    {
      icon: Target,
      title: 'Assess 13 areas of fraud risk',
      description: 'Starter gives your organisation a structured assessment, risk scoring, and a downloadable health-check report.',
    },
    {
      icon: CheckCircle2,
      title: 'Understand what to address',
      description: 'Review identified risks, existing controls, and the compliance snapshot to see where further action may be needed.',
    },
    {
      icon: BookOpen,
      title: 'Extend awareness across your team',
      description: 'Professional includes 50 staff key-passes, awareness training, completion certificates, quarterly reassessment, and email support. Enterprise adds unlimited passes and organisation-wide oversight.',
    },
  ];

  const stats = [
    { value: '30', label: 'Minutes', sublabel: 'Workshop Duration' },
    { value: '6', label: 'Modules', sublabel: 'Comprehensive Coverage' },
    { value: '100%', label: 'Interactive', sublabel: 'Engaging Content' },
  ];

  return (
    <Layout showHeader={false}>
      {/* ===== GOV.UK-style top bar ===== */}
      <div className="bg-[#0b0c0c]">
        <div className="container flex h-10 items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-white no-underline">
            <Shield className="h-5 w-5 text-white" aria-hidden="true" />
            <span className="text-sm font-bold tracking-wide">FRAUD-RISK.CO.UK</span>
          </Link>
          <nav aria-label="Main navigation" className="flex items-center gap-3">
            <div className="hidden items-center gap-5 md:flex">
              <Link to="/#how-it-works" className="text-xs text-white/80 hover:text-white no-underline">How it works</Link>
              <Link to={PACKAGE_CHOOSER_PATH} className="text-xs text-white/80 hover:text-white no-underline">Packages</Link>
              <Link to="/#free-guides" className="text-xs text-white/80 hover:text-white no-underline">Free guides</Link>
              <Link to="/#faq-heading" className="text-xs text-white/80 hover:text-white no-underline">FAQs</Link>
            </div>
            {user ? (
              <Link to="/dashboard" className="text-xs text-white/80 hover:text-white no-underline">
                Dashboard
              </Link>
            ) : (
              <>
                <Link to="/auth" className="text-xs text-white/80 hover:text-white no-underline">
                  Sign in
                </Link>
                <Link
                  to="/auth?mode=signup"
                  className="rounded bg-white/10 px-3 py-1 text-xs font-medium text-white hover:bg-white/20 no-underline"
                >
                  Register
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>

      {/* ===== Blue service bar ===== */}
      <div className="border-b-[4px] border-[#1d70b8] bg-[#f3f2f1]">
        <div className="container flex h-12 items-center">
          <Link to="/" className="text-lg font-bold text-[#0b0c0c] no-underline hover:text-[#1d70b8]">
            Fraud Risk Assessment Service
          </Link>
        </div>
      </div>

      {/* ===== Phase banner ===== */}
      <div className="border-b border-[#b1b4b6] bg-white">
        <div className="container flex items-center gap-3 py-2.5">
          <span className="inline-block rounded bg-[#1d70b8] px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
            Beta
          </span>
          <span className="text-sm text-[#0b0c0c]">
            This is a new service — your{' '}
            <a href="mailto:help@fraud-risk.co.uk" className="text-[#1d70b8] underline hover:text-[#003078]">
              feedback
            </a>{' '}
            will help us improve it.
          </span>
        </div>
      </div>

      {/* ===== Hero Section ===== */}
      <section className="bg-[#1d70b8] py-16 lg:py-24" aria-label="Hero">
        <div className="container">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            <div>
              <h1 className="text-3xl font-bold text-white sm:text-4xl lg:text-5xl mb-4 leading-tight">
                Fraud risk assessment
                <br />
                <span className="text-[#ffdd00]">and prevention training</span>
              </h1>

              <p className="text-lg text-white/90 mb-6 max-w-xl leading-relaxed">
                A practical service for trustees, leaders, budget-holders, and teams. Assess 13 areas of fraud risk,
                understand your findings, and choose training and oversight that fits your organisation.
              </p>

              <div className="inline-flex items-center gap-2 rounded bg-[#003078]/40 px-4 py-2 text-sm font-semibold text-white mb-8">
                <Shield className="h-4 w-4 text-[#ffdd00]" aria-hidden="true" />
                <span>Self-assessment and awareness tools — not legal advice</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                {user ? (
                  <Link
                    to="/dashboard"
                    className="inline-flex items-center justify-center gap-2 rounded bg-[#00703c] px-6 py-3 text-lg font-bold text-white shadow-[0_2px_0_#002d18] hover:bg-[#005a30] no-underline"
                  >
                    <Play className="h-5 w-5" aria-hidden="true" />
                    Go to Dashboard
                  </Link>
                ) : (
                  <Link
                    to={PACKAGE_CHOOSER_PATH}
                    className="inline-flex items-center justify-center gap-2 rounded bg-[#00703c] px-6 py-3 text-lg font-bold text-white shadow-[0_2px_0_#002d18] hover:bg-[#005a30] no-underline"
                  >
                    Get Started
                    <ArrowRight className="h-5 w-5" aria-hidden="true" />
                  </Link>
                )}
                <Link
                  to="/#free-guides"
                  className="inline-flex items-center justify-center gap-2 rounded bg-white px-6 py-3 text-lg font-bold text-[#0b0c0c] shadow-[0_2px_0_#505a5f] hover:bg-[#f3f2f1] no-underline"
                >
                  <BookOpen className="h-5 w-5" aria-hidden="true" />
                  View Resources
                </Link>
              </div>
            </div>

            <div>
              <Card className="border-2 border-white/20 shadow-xl bg-white">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xl text-[#0b0c0c]">Join a Live Session</CardTitle>
                  <CardDescription className="text-[#505a5f]">
                    Enter the six-character code from your facilitator. Workshop access requires sign-in and a training package.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form onSubmit={(e) => { e.preventDefault(); handleJoinSession(); }} className="flex gap-3">
                    <Input
                      placeholder="6-character code"
                      value={sessionCode}
                      onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                      className="text-center text-lg font-mono tracking-widest uppercase border-2 border-[#0b0c0c]"
                      maxLength={6}
                      aria-label="Session code"
                    />
                    <Button
                      type="submit"
                      disabled={!sessionCode.trim()}
                      className="bg-[#1d70b8] hover:bg-[#003078] text-white"
                    >
                      Join
                    </Button>
                  </form>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-[#b1b4b6]" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-2 text-[#505a5f]">or</span>
                    </div>
                  </div>

                  <Button
                    variant="secondary"
                    className="w-full border-2 border-[#0b0c0c] bg-[#f3f2f1] text-[#0b0c0c] hover:bg-[#dbdad9]"
                    onClick={() => navigate(user ? '/workshop' : '/package/professional')}
                  >
                    {user ? 'Open Workshop' : 'Explore Training Package'}
                  </Button>
                </CardContent>
              </Card>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mt-6">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="text-center p-4 rounded bg-[#003078]/40 border border-white/30"
                  >
                    <div className="text-2xl font-bold text-white">{stat.value}</div>
                    <div className="text-sm font-medium text-white">{stat.label}</div>
                    <div className="text-xs text-white/90">{stat.sublabel}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Features Section ===== */}
      <section id="how-it-works" className="py-16 lg:py-24 bg-white scroll-mt-4" aria-labelledby="service-steps-heading">
        <div className="container">
          <div className="max-w-3xl mb-12">
            <h2 id="service-steps-heading" className="text-3xl font-bold text-[#0b0c0c] sm:text-4xl mb-4">
              From risk assessment to practical action
            </h2>
            <p className="text-lg text-[#505a5f]">
              Start with a clear picture of your exposure, decide what to improve, then build awareness across your team.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {features.map((feature, index) => (
              <article key={feature.title} className="h-full border-t-4 border-[#1d70b8] bg-[#f3f2f1] p-6">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded bg-[#1d70b8] text-sm font-bold text-white" aria-hidden="true">
                    {index + 1}
                  </span>
                  <feature.icon className="h-5 w-5 text-[#1d70b8]" aria-hidden="true" />
                </div>
                <h3 className="mb-2 text-lg font-bold text-[#0b0c0c]">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-[#505a5f]">{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Browser tools across the platform ===== */}
      <section className="bg-[#f3f2f1] py-16" aria-labelledby="platform-tools-heading">
        <div className="container">
          <div className="mb-8 max-w-3xl">
            <h2 id="platform-tools-heading" className="mb-3 text-3xl font-bold text-[#0b0c0c]">Choose a way to continue</h2>
            <p className="text-lg text-[#505a5f]">
              Open one of the project’s browser-based tools. Account and package requirements are shown before protected features begin.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {[
              {
                title: 'Fraud risk assessment',
                description: 'Open the fraud risk assessment app and review the organisation’s key risk areas.',
                href: '/assessment',
                action: 'Open assessment',
              },
              {
                title: 'Staff training',
                description: 'Explore workshop sections, scenarios, quizzes, and training resources.',
                href: '/workshop',
                action: 'Open training',
              },
              {
                title: 'Budget holder guide',
                description: 'Read practical guidance for budget-holders and explore fraud prevention topics.',
                href: '/budget-holder',
                action: 'Open budget guide',
              },
            ].map((tool) => (
              <Card key={tool.href} className="border-[#b1b4b6] bg-white">
                <CardHeader>
                  <CardTitle className="text-xl text-[#0b0c0c]">{tool.title}</CardTitle>
                  <CardDescription className="leading-relaxed text-[#505a5f]">
                    {tool.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <a
                    href={tool.href}
                    className="inline-flex items-center gap-2 font-bold text-[#1d70b8] underline underline-offset-4 hover:text-[#003078]"
                  >
                    {tool.action}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Packages / Pricing Section ===== */}
      <section id="packages" className="scroll-mt-4 py-16 lg:py-24 bg-[#f3f2f1]" aria-labelledby="packages-heading">
        <div className="container">
          <div className="max-w-3xl mb-12">
            <h2 id="packages-heading" className="text-3xl font-bold text-[#0b0c0c] sm:text-4xl mb-4">
              Choose Your Package
            </h2>
            <p className="text-lg text-[#505a5f]">
              Compare a one-off assessment with team training and enterprise oversight. Each package includes the features listed below.
            </p>
            <p className="mt-3 text-sm text-[#505a5f]">Prices exclude VAT; VAT is added at the current rate.</p>
          </div>

          <div className="grid gap-8 md:grid-cols-3 items-stretch">
            {/* Package 1: Starter */}
            <div>
              <div className="h-full flex flex-col bg-white border border-[#b1b4b6] p-6">
                <span className="inline-block self-start rounded bg-[#f3f2f1] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#505a5f] mb-4">
                  Package 1
                </span>
                <h3 className="text-2xl font-bold text-[#0b0c0c] mb-1">Starter</h3>
                <p className="text-sm text-[#505a5f] mb-4">
                  {STARTER.tagline}
                </p>
                <p className="text-xs text-[#505a5f] mb-4"><span className="font-bold text-[#0b0c0c]">For:</span> {STARTER.audience}</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-[#0b0c0c]">{formatPrice(STARTER)}</span>
                  <span className="ml-1 text-sm text-[#505a5f]">{billingLabel(STARTER)}</span>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {STARTER.features.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-[#00703c] shrink-0 mt-0.5" aria-hidden="true" />
                      <span className="text-sm text-[#0b0c0c]">{item}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/package/starter"
                  className="inline-flex items-center justify-center gap-2 rounded bg-[#f3f2f1] border-2 border-[#0b0c0c] px-4 py-3 text-sm font-bold text-[#0b0c0c] hover:bg-[#dbdad9] no-underline"
                >
                  View Starter details
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>

            {/* Package 2: Professional (Most Popular) */}
            <div className="md:-mt-2 md:mb-[-8px]">
              <div className="h-full flex flex-col bg-white border-4 border-[#1d70b8] p-6 relative">
                <div className="absolute -top-4 left-6">
                  <span className="inline-flex items-center gap-1.5 rounded bg-[#1d70b8] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white">
                    <Award className="h-3.5 w-3.5" aria-hidden="true" />
                    Training & support
                  </span>
                </div>
                <span className="inline-block self-start rounded bg-[#1d70b8]/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#1d70b8] mb-4 mt-4">
                  Package 2
                </span>
                <h3 className="text-2xl font-bold text-[#0b0c0c] mb-1">Professional</h3>
                <p className="text-sm text-[#505a5f] mb-4">
                  {PROFESSIONAL.tagline}
                </p>
                <p className="text-xs text-[#505a5f] mb-4"><span className="font-bold text-[#0b0c0c]">For:</span> {PROFESSIONAL.audience}</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-[#0b0c0c]">{formatPrice(PROFESSIONAL)}</span>
                  <span className="ml-1 text-sm text-[#505a5f]">{billingLabel(PROFESSIONAL)}</span>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {PROFESSIONAL.features.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-[#00703c] shrink-0 mt-0.5" aria-hidden="true" />
                      <span className="text-sm text-[#0b0c0c]">{item}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to={user ? checkoutPath(PROFESSIONAL) : signupPath(PROFESSIONAL)}
                  className="inline-flex items-center justify-center gap-2 rounded bg-[#00703c] px-4 py-3 text-sm font-bold text-white shadow-[0_2px_0_#002d18] hover:bg-[#005a30] no-underline"
                >
                  Choose Professional
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>

            {/* Package 3: Enterprise */}
            <div>
              <div className="h-full flex flex-col bg-white border-2 border-[#f47738] p-6">
                <span className="inline-flex items-center gap-1.5 self-start rounded bg-[#f47738]/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#8a3a0f] mb-4">
                  <Shield className="h-3 w-3" aria-hidden="true" />
                  Package 3
                </span>
                <h3 className="text-2xl font-bold text-[#0b0c0c] mb-1">Enterprise</h3>
                <p className="text-sm text-[#505a5f] mb-4">
                  {ENTERPRISE.tagline}
                </p>
                <p className="text-xs text-[#505a5f] mb-4"><span className="font-bold text-[#0b0c0c]">For:</span> {ENTERPRISE.audience}</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-[#0b0c0c]">{formatPrice(ENTERPRISE)}</span>
                  <span className="ml-1 text-sm text-[#505a5f]">{billingLabel(ENTERPRISE)}</span>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {ENTERPRISE.features.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-[#00703c] shrink-0 mt-0.5" aria-hidden="true" />
                      <span className="text-sm text-[#0b0c0c]">{item}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to={user ? checkoutPath(ENTERPRISE) : signupPath(ENTERPRISE)}
                  className="inline-flex items-center justify-center gap-2 rounded bg-[#b8501f] px-4 py-3 text-sm font-bold text-white shadow-[0_2px_0_#6e3619] hover:bg-[#9a4119] no-underline"
                >
                  Choose Enterprise
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Workshop Overview Section ===== */}
      <section className="py-16 lg:py-24 bg-white" aria-label="Workshop overview">
        <div className="container">
          <div className="grid gap-12 lg:grid-cols-2 items-start">
            <div>
              <h2 className="text-3xl font-bold text-[#0b0c0c] sm:text-4xl mb-6">
                A Comprehensive 30-Minute Journey
              </h2>
              <p className="text-lg text-[#505a5f] mb-8">
                Move from understanding fraud risks to identifying proportionate controls and practical next steps for your organisation.
              </p>

              <div className="space-y-0 border-l-4 border-[#1d70b8] ml-2">
                {[
                  { time: '5 min', title: 'Fraud Prevention Landscape', desc: 'Relevant UK guidance, standards, and responsibilities' },
                  { time: '5 min', title: 'Fraud Types & Risks', desc: 'Understanding common fraud schemes' },
                  { time: '5 min', title: 'Defence Strategies', desc: 'Practical controls and prevention measures' },
                  { time: '5 min', title: 'Organisational Impact', desc: 'The true cost of fraud incidents' },
                  { time: '5 min', title: 'Interactive Scenarios', desc: 'Real-world case studies and exercises' },
                  { time: '5 min', title: 'Action Planning', desc: 'Your personalised next steps' },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="flex items-start gap-4 pl-6 py-3"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium text-[#1d70b8] min-w-[60px]">
                      <Clock className="h-4 w-4" aria-hidden="true" />
                      {item.time}
                    </div>
                    <div>
                      <div className="font-bold text-[#0b0c0c]">{item.title}</div>
                      <div className="text-sm text-[#505a5f]">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="bg-[#1d70b8] p-6 text-white mb-0">
                <h3 className="flex items-center gap-2 text-xl font-bold mb-0">
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                  What You'll Learn
                </h3>
              </div>
              <div className="border-2 border-[#1d70b8] border-t-0 bg-white p-6">
                <ul className="space-y-3">
                  {[
                    'Understand relevant UK fraud-prevention guidance and responsibilities',
                    'Identify common fraud schemes targeting your sector',
                    'Implement practical defence strategies immediately',
                    'Recognise red flags and early warning signs',
                    'Develop a personalised fraud prevention action plan',
                    'Access downloadable resources and tools',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-[#00703c] shrink-0 mt-0.5" aria-hidden="true" />
                      <span className="text-sm text-[#0b0c0c]">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Public resources ===== */}
      <section id="free-guides" className="scroll-mt-4 bg-white py-16 lg:py-24" aria-labelledby="free-guides-heading">
        <div className="container">
          <div className="mb-10 max-w-3xl">
            <h2 id="free-guides-heading" className="mb-4 text-3xl font-bold text-[#0b0c0c] sm:text-4xl">
              Free fraud prevention guides
            </h2>
            <p className="text-lg text-[#505a5f]">
              Download practical materials for a first review, budget-holder controls, or a structured 90-day improvement plan. No account is needed for these PDFs.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {downloadableResources.map((resource, index) => {
              const ResourceIcon = [ClipboardCheck, FileText, Map][index] ?? FileText;
              return (
                <Card key={resource.id} className="flex h-full flex-col border-[#b1b4b6] bg-white">
                  <CardHeader>
                    <div className="mb-2 flex h-11 w-11 items-center justify-center rounded bg-[#e8f1f8]">
                      <ResourceIcon className="h-5 w-5 text-[#1d70b8]" aria-hidden="true" />
                    </div>
                    <CardTitle className="text-lg text-[#0b0c0c]">{resource.title}</CardTitle>
                    <CardDescription className="leading-relaxed text-[#505a5f]">{resource.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto">
                    <a
                      href={`/resources/${resource.filename}`}
                      download
                      className="inline-flex items-center gap-2 font-bold text-[#1d70b8] underline underline-offset-4 hover:text-[#003078] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2"
                      aria-label={`Download ${resource.title} as a PDF`}
                    >
                      Download PDF
                      <Download className="h-4 w-4" aria-hidden="true" />
                    </a>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== Frequently asked questions ===== */}
      <section className="bg-[#f3f2f1] py-16 lg:py-24" aria-labelledby="faq-heading">
        <div className="container max-w-4xl">
          <h2 id="faq-heading" className="mb-8 text-3xl font-bold text-[#0b0c0c] sm:text-4xl">Frequently asked questions</h2>
          <div className="divide-y divide-[#b1b4b6] border-y border-[#b1b4b6] bg-white">
            <details className="group p-5">
              <summary className="cursor-pointer text-lg font-bold text-[#0b0c0c] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2">
                Who is the service for?
              </summary>
              <p className="mt-3 leading-relaxed text-[#505a5f]">
                The assessment and learning materials are designed for trustees, board members, executive leaders, budget-holders, finance and procurement teams, and other staff with fraud-prevention responsibilities.
              </p>
            </details>
            <details className="group p-5">
              <summary className="cursor-pointer text-lg font-bold text-[#0b0c0c] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2">
                What does Starter include?
              </summary>
              <p className="mt-3 leading-relaxed text-[#505a5f]">
                Starter is a one-off purchase for one fraud risk assessment across 13 key areas, a downloadable health-check report with risk scoring, an ECCTA 2023 compliance snapshot, and one key-pass.
              </p>
            </details>
            <details className="group p-5">
              <summary className="cursor-pointer text-lg font-bold text-[#0b0c0c] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2">
                Which packages include staff training?
              </summary>
              <p className="mt-3 leading-relaxed text-[#505a5f]">
                Professional includes 50 employee key-passes, staff awareness training with certificates, quarterly reassessment, and email support. Enterprise includes Professional features plus unlimited key-passes, a real-time dashboard, risk register and action tracking, API access, priority support, and compliance reports.
              </p>
            </details>
            <details className="group p-5">
              <summary className="cursor-pointer text-lg font-bold text-[#0b0c0c] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2">
                Is this legal advice or a compliance guarantee?
              </summary>
              <p className="mt-3 leading-relaxed text-[#505a5f]">
                No. FRAUD-RISK.CO.UK provides self-assessment and awareness tools. Scores and reports reflect information entered into the platform; they do not determine whether an organisation has reasonable procedures or replace legal advice or formal assurance. Read our <Link to="/terms" className="font-bold text-[#1d70b8] underline">Terms of Service</Link> for details.
              </p>
            </details>
            <details className="group p-5">
              <summary className="cursor-pointer text-lg font-bold text-[#0b0c0c] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2">
                Can I review materials before choosing a package?
              </summary>
              <p className="mt-3 leading-relaxed text-[#505a5f]">
                Yes. The checklist, budget-holder guidance, and 90-day roadmap above are public downloads. Package pages explain the paid features and account access.
              </p>
            </details>
            <details className="group p-5">
              <summary className="cursor-pointer text-lg font-bold text-[#0b0c0c] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2">
                Do I need an account to use the service?
              </summary>
              <p className="mt-3 leading-relaxed text-[#505a5f]">
                You can compare packages and download the public guides without signing in. Account-based assessments require an active package; the workshop and certificates are included with Professional and Enterprise.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* ===== CTA Section ===== */}
      <section className="py-16 lg:py-24 bg-[#f3f2f1]" aria-label="Call to action">
        <div className="container">
          <div className="bg-[#1d70b8] p-10 lg:p-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl mb-4">
              Choose your next step
            </h2>
            <p className="text-lg text-white/90 mb-8 max-w-2xl mx-auto">
              Compare packages, download a free guide, or return to your organisation's dashboard.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to={user ? '/dashboard' : PACKAGE_CHOOSER_PATH}
                className="inline-flex items-center justify-center gap-2 rounded bg-[#00703c] px-8 py-3 text-lg font-bold text-white shadow-[0_2px_0_#002d18] hover:bg-[#005a30] no-underline"
              >
                {user ? 'Go to Dashboard' : 'Compare Packages'}
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Link>
              <Link
                to="/#free-guides"
                className="inline-flex items-center justify-center gap-2 rounded bg-white px-8 py-3 text-lg font-bold text-[#0b0c0c] shadow-[0_2px_0_#505a5f] hover:bg-[#f3f2f1] no-underline"
              >
                Download Free Guides
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="bg-[#0b0c0c] pt-10 pb-8" aria-label="Site footer">
        <div className="container">
          <div className="grid gap-8 md:grid-cols-3 mb-10">
            {/* Column 1: About */}
            <div>
              <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">About</h3>
              <ul className="space-y-2">
                <li>
                  <Link to="/#free-guides" className="text-sm text-[#b1b4b6] hover:text-white no-underline">
                    Free guides
                  </Link>
                </li>
                <li>
                  <Link to={user ? '/workshop' : '/package/professional'} className="text-sm text-[#b1b4b6] hover:text-white no-underline">
                    Workshop
                  </Link>
                </li>
                <li>
                  <Link to={user ? '/action-plan' : '/package/professional'} className="text-sm text-[#b1b4b6] hover:text-white no-underline">
                    Action Plans
                  </Link>
                </li>
              </ul>
            </div>
            {/* Column 2: Compliance */}
            <div>
              <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Standards and limitations</h3>
              <ul className="space-y-2">
                <li className="text-sm text-[#b1b4b6]">Informed by UK counter-fraud guidance, including GovS 013</li>
                <li className="text-sm text-[#b1b4b6]">Self-assessment indicators, not legal advice or formal assurance</li>
                <li><Link to="/privacy" className="text-sm text-[#b1b4b6] hover:text-white">How we handle personal data</Link></li>
              </ul>
            </div>
            {/* Column 3: Contact */}
            <div>
              <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Contact</h3>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-[#b1b4b6]" aria-hidden="true" />
                  <a href="mailto:assessment@fraud-risk.co.uk" className="text-sm text-[#b1b4b6] hover:text-white no-underline">
                    assessment@fraud-risk.co.uk
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-[#b1b4b6]" aria-hidden="true" />
                  <a href="mailto:help@fraud-risk.co.uk" className="text-sm text-[#b1b4b6] hover:text-white no-underline">
                    help@fraud-risk.co.uk
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-[#b1b4b6]" aria-hidden="true" />
                  <a href="mailto:recruitment@fraud-risk.co.uk" className="text-sm text-[#b1b4b6] hover:text-white no-underline">
                    recruitment@fraud-risk.co.uk
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-[#505a5f] pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-white" aria-hidden="true" />
              <span className="font-bold text-white">FRAUD-RISK.CO.UK</span>
            </div>
            <nav aria-label="Legal" className="flex gap-4 text-sm">
              <Link to="/privacy" className="text-[#b1b4b6] hover:text-white">Privacy notice</Link>
              <Link to="/terms" className="text-[#b1b4b6] hover:text-white">Terms of service</Link>
            </nav>
            <p className="text-sm text-[#b1b4b6]">
              © {new Date().getFullYear()} FRAUD-RISK.CO.UK. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </Layout>
  );
}
