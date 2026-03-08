import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/layout/Layout';
import {
  Shield,
  Users,
  Target,
  Award,
  ArrowRight,
  Play,
  BookOpen,
  Clock,
  CheckCircle2,
  Mail,
  Phone,
} from 'lucide-react';
import { useState } from 'react';

export default function Index() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessionCode, setSessionCode] = useState('');

  const handleJoinSession = () => {
    if (sessionCode.trim()) {
      navigate(`/workshop?session=${sessionCode.trim().toUpperCase()}`);
    }
  };

  const features = [
    {
      icon: BookOpen,
      title: 'Interactive Learning',
      description: 'Engage with dynamic slides, quizzes, and real-world scenarios tailored to your sector.',
    },
    {
      icon: Users,
      title: 'Live Collaboration',
      description: 'Participate in real-time polls and Q&A sessions with your colleagues and facilitator.',
    },
    {
      icon: Target,
      title: 'Personalised Action Plans',
      description: 'Receive customised recommendations based on your responses and organisation needs.',
    },
    {
      icon: Award,
      title: 'Certificate of Completion',
      description: 'Earn a verified certificate documenting your fraud risk awareness training.',
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
          <nav className="flex items-center gap-3">
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
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <h1 className="text-3xl font-bold text-white sm:text-4xl lg:text-5xl mb-4 leading-tight">
                FRAUD-RISK.CO.UK
                <br />
                <span className="text-[#ffdd00]">Protect Your Organisation</span>
              </h1>

              <p className="text-lg text-white/90 mb-6 max-w-xl leading-relaxed">
                An interactive 30-minute workshop designed for trustees, executive leadership, and budget-holders.
                Build fraud resilience through engaging content and practical action plans.
              </p>

              <div className="inline-flex items-center gap-2 rounded bg-white/10 px-4 py-2 text-sm font-semibold text-white mb-8">
                <Shield className="h-4 w-4 text-[#ffdd00]" aria-hidden="true" />
                <span>GovS-013 & ECCTA 2023 Compliant</span>
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
                    to="/auth?mode=signup"
                    className="inline-flex items-center justify-center gap-2 rounded bg-[#00703c] px-6 py-3 text-lg font-bold text-white shadow-[0_2px_0_#002d18] hover:bg-[#005a30] no-underline"
                  >
                    Get Started
                    <ArrowRight className="h-5 w-5" aria-hidden="true" />
                  </Link>
                )}
                <Link
                  to="/resources"
                  className="inline-flex items-center justify-center gap-2 rounded bg-white px-6 py-3 text-lg font-bold text-[#0b0c0c] shadow-[0_2px_0_#505a5f] hover:bg-[#f3f2f1] no-underline"
                >
                  <BookOpen className="h-5 w-5" aria-hidden="true" />
                  View Resources
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.15 }}
            >
              <Card className="border-2 border-white/20 shadow-xl bg-white">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xl text-[#0b0c0c]">Join a Live Session</CardTitle>
                  <CardDescription className="text-[#505a5f]">
                    Enter the session code provided by your facilitator
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form onSubmit={(e) => { e.preventDefault(); handleJoinSession(); }} className="flex gap-3">
                    <Input
                      placeholder="Enter session code"
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
                    onClick={() => navigate(user ? '/workshop' : '/auth?mode=signup')}
                  >
                    Start Self-Paced Workshop
                  </Button>
                </CardContent>
              </Card>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mt-6">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="text-center p-4 rounded bg-white/10 border border-white/20"
                  >
                    <div className="text-2xl font-bold text-white">{stat.value}</div>
                    <div className="text-sm font-medium text-white/90">{stat.label}</div>
                    <div className="text-xs text-white/70">{stat.sublabel}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ===== Features Section ===== */}
      <section className="py-16 lg:py-24 bg-white" aria-label="Features">
        <div className="container">
          <div className="max-w-3xl mb-12">
            <h2 className="text-3xl font-bold text-[#0b0c0c] sm:text-4xl mb-4">
              What You'll Experience
            </h2>
            <p className="text-lg text-[#505a5f]">
              Our workshop combines cutting-edge interactive technology with expert-curated content
              to deliver an engaging and impactful learning experience.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
                viewport={{ once: true }}
              >
                <div className="h-full border-t-4 border-[#1d70b8] bg-[#f3f2f1] p-6">
                  <div className="h-10 w-10 rounded bg-[#1d70b8] flex items-center justify-center mb-4">
                    <feature.icon className="h-5 w-5 text-white" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-bold text-[#0b0c0c] mb-2">{feature.title}</h3>
                  <p className="text-[#505a5f] text-sm leading-relaxed">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Packages / Pricing Section ===== */}
      <section className="py-16 lg:py-24 bg-[#f3f2f1]" aria-label="Packages">
        <div className="container">
          <div className="max-w-3xl mb-12">
            <h2 className="text-3xl font-bold text-[#0b0c0c] sm:text-4xl mb-4">
              Choose Your Package
            </h2>
            <p className="text-lg text-[#505a5f]">
              Select the plan that best fits your organisation's fraud risk
              management needs — from a one-off assessment to full enterprise
              coverage.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3 items-stretch">
            {/* Package 1: Starter */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0 }}
              viewport={{ once: true }}
            >
              <div className="h-full flex flex-col bg-white border border-[#b1b4b6] p-6">
                <span className="inline-block self-start rounded bg-[#f3f2f1] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#505a5f] mb-4">
                  Package 1
                </span>
                <h3 className="text-2xl font-bold text-[#0b0c0c] mb-1">Starter</h3>
                <p className="text-sm text-[#505a5f] mb-4">
                  Ideal for a one-time fraud risk health-check
                </p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-[#0b0c0c]">£795</span>
                  <span className="ml-1 text-sm text-[#505a5f]">one-time</span>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {[
                    'Single fraud risk assessment',
                    'Comprehensive PDF report',
                    'ECCTA compliance snapshot',
                    '1 key-pass included',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-[#00703c] shrink-0 mt-0.5" aria-hidden="true" />
                      <span className="text-sm text-[#0b0c0c]">{item}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/auth?mode=signup"
                  className="inline-flex items-center justify-center gap-2 rounded bg-[#f3f2f1] border-2 border-[#0b0c0c] px-4 py-3 text-sm font-bold text-[#0b0c0c] hover:bg-[#dbdad9] no-underline"
                >
                  Start Assessment
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </motion.div>

            {/* Package 2: Professional (Most Popular) */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.12 }}
              viewport={{ once: true }}
              className="md:-mt-2 md:mb-[-8px]"
            >
              <div className="h-full flex flex-col bg-white border-4 border-[#1d70b8] p-6 relative">
                <div className="absolute -top-4 left-6">
                  <span className="inline-flex items-center gap-1.5 rounded bg-[#1d70b8] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white">
                    <Award className="h-3.5 w-3.5" aria-hidden="true" />
                    Most Popular
                  </span>
                </div>
                <span className="inline-block self-start rounded bg-[#1d70b8]/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#1d70b8] mb-4 mt-4">
                  Package 2
                </span>
                <h3 className="text-2xl font-bold text-[#0b0c0c] mb-1">Professional</h3>
                <p className="text-sm text-[#505a5f] mb-4">
                  Ongoing protection with training & support
                </p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-[#0b0c0c]">£1,799</span>
                  <span className="ml-1 text-sm text-[#505a5f]">/ year</span>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {[
                    'Everything in Starter',
                    'Fraud awareness training workshop',
                    '50 key-passes included',
                    'Quarterly reassessment',
                    'Email support',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-[#00703c] shrink-0 mt-0.5" aria-hidden="true" />
                      <span className="text-sm text-[#0b0c0c]">{item}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to={user ? '/checkout?package=Professional&price=1799' : '/auth?mode=signup'}
                  className="inline-flex items-center justify-center gap-2 rounded bg-[#00703c] px-4 py-3 text-sm font-bold text-white shadow-[0_2px_0_#002d18] hover:bg-[#005a30] no-underline"
                >
                  Choose Professional
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </motion.div>

            {/* Package 3: Enterprise */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.24 }}
              viewport={{ once: true }}
            >
              <div className="h-full flex flex-col bg-white border-2 border-[#f47738] p-6">
                <span className="inline-flex items-center gap-1.5 self-start rounded bg-[#f47738]/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#f47738] mb-4">
                  <Shield className="h-3 w-3" aria-hidden="true" />
                  Package 3
                </span>
                <h3 className="text-2xl font-bold text-[#0b0c0c] mb-1">Enterprise</h3>
                <p className="text-sm text-[#505a5f] mb-4">
                  Full-scale fraud risk management for large organisations
                </p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-[#0b0c0c]">£4,995</span>
                  <span className="ml-1 text-sm text-[#505a5f]">/ year</span>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {[
                    'Everything in Professional',
                    'Full management dashboard',
                    'Unlimited key-passes',
                    'Organisation risk register',
                    'API access',
                    'Priority support',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-[#00703c] shrink-0 mt-0.5" aria-hidden="true" />
                      <span className="text-sm text-[#0b0c0c]">{item}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to={user ? '/checkout?package=Enterprise&price=4995' : '/auth?mode=signup'}
                  className="inline-flex items-center justify-center gap-2 rounded bg-[#f47738] px-4 py-3 text-sm font-bold text-white shadow-[0_2px_0_#6e3619] hover:bg-[#e0621e] no-underline"
                >
                  Choose Enterprise
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </motion.div>
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
                From regulatory updates to practical action planning, our workshop covers
                everything you need to strengthen your organisation's fraud defences.
              </p>

              <div className="space-y-0 border-l-4 border-[#1d70b8] ml-2">
                {[
                  { time: '5 min', title: 'Regulatory Landscape', desc: 'Current compliance requirements and legislation' },
                  { time: '5 min', title: 'Fraud Types & Risks', desc: 'Understanding common fraud schemes' },
                  { time: '5 min', title: 'Defence Strategies', desc: 'Practical controls and prevention measures' },
                  { time: '5 min', title: 'Organisational Impact', desc: 'The true cost of fraud incidents' },
                  { time: '5 min', title: 'Interactive Scenarios', desc: 'Real-world case studies and exercises' },
                  { time: '5 min', title: 'Action Planning', desc: 'Your personalised next steps' },
                ].map((item, index) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    viewport={{ once: true }}
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
                  </motion.div>
                ))}
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              viewport={{ once: true }}
            >
              <div className="bg-[#1d70b8] p-6 text-white mb-0">
                <h3 className="flex items-center gap-2 text-xl font-bold mb-0">
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                  What You'll Learn
                </h3>
              </div>
              <div className="border-2 border-[#1d70b8] border-t-0 bg-white p-6">
                <ul className="space-y-3">
                  {[
                    'Understand your obligations under the Economic Crime Act 2023',
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
            </motion.div>
          </div>
        </div>
      </section>

      {/* ===== CTA Section ===== */}
      <section className="py-16 lg:py-24 bg-[#f3f2f1]" aria-label="Call to action">
        <div className="container">
          <div className="bg-[#1d70b8] p-10 lg:p-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl mb-4">
              Ready to Strengthen Your Fraud Defences?
            </h2>
            <p className="text-lg text-white/90 mb-8 max-w-2xl mx-auto">
              Join thousands of professionals who have enhanced their fraud awareness
              through FRAUD-RISK.CO.UK's interactive workshop platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to={user ? '/workshop' : '/auth?mode=signup'}
                className="inline-flex items-center justify-center gap-2 rounded bg-[#00703c] px-8 py-3 text-lg font-bold text-white shadow-[0_2px_0_#002d18] hover:bg-[#005a30] no-underline"
              >
                Start Workshop Now
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Link>
              <Link
                to="/resources"
                className="inline-flex items-center justify-center gap-2 rounded bg-white px-8 py-3 text-lg font-bold text-[#0b0c0c] shadow-[0_2px_0_#505a5f] hover:bg-[#f3f2f1] no-underline"
              >
                Download Resources
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
                  <Link to="/resources" className="text-sm text-[#b1b4b6] hover:text-white no-underline">
                    Resources
                  </Link>
                </li>
                <li>
                  <Link to={user ? '/workshop' : '/auth?mode=signup'} className="text-sm text-[#b1b4b6] hover:text-white no-underline">
                    Workshop
                  </Link>
                </li>
                <li>
                  <Link to={user ? '/action-plan' : '/auth?mode=signup'} className="text-sm text-[#b1b4b6] hover:text-white no-underline">
                    Action Plans
                  </Link>
                </li>
              </ul>
            </div>
            {/* Column 2: Compliance */}
            <div>
              <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Compliance</h3>
              <ul className="space-y-2">
                <li className="text-sm text-[#b1b4b6]">GovS-013 Aligned</li>
                <li className="text-sm text-[#b1b4b6]">ECCTA 2023 Compliant</li>
                <li className="text-sm text-[#b1b4b6]">GDPR Compliant</li>
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
                  <Phone className="h-4 w-4 text-[#b1b4b6]" aria-hidden="true" />
                  <a href="mailto:help@fraud-risk.co.uk" className="text-sm text-[#b1b4b6] hover:text-white no-underline">
                    help@fraud-risk.co.uk
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
            <p className="text-sm text-[#b1b4b6]">
              © {new Date().getFullYear()} FRAUD-RISK.CO.UK. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </Layout>
  );
}
