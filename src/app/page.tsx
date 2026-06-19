import Link from 'next/link'
import {
  Trophy, Coins, ShoppingBag, ArrowRight,
  Building2, Target, MessageSquare, BarChart3,
  Check, TrendingUp,
} from 'lucide-react'
import { ScrollReelTestimonials } from '@/components/ui/scroll-reel-testimonials'
import FeaturesSection from '@/components/landing/FeaturesSection'
import StatsSection from '@/components/landing/StatsSection'
import HowItWorksSection from '@/components/landing/HowItWorksSection'

// ── Testimonials data ──────────────────────────────────────────
const TESTIMONIALS = [
  {
    quote:
      'Completion rates jumped 40% in our first quarter. Promiseforge gave every manager a structured way to set real goals — and gave employees something concrete to work toward.',
    author: 'Sarah Chen — Head of People, Nexus Technologies',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80&auto=format&fit=crop',
    alt: 'Sarah Chen',
  },
  {
    quote:
      'The token marketplace changed how we think about recognition entirely. It\'s not a Slack message that disappears — it\'s something employees can hold and spend.',
    author: 'Marcus Rivera — VP Operations, Stride Health',
    image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&q=80&auto=format&fit=crop',
    alt: 'Marcus Rivera',
  },
  {
    quote:
      'Setting up the org hierarchy, assigning token budgets, publishing challenges — it all took under an hour. It\'s the only engagement tool our managers actually open.',
    author: 'Priya Nair — HR Director, Aether Group',
    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&q=80&auto=format&fit=crop',
    alt: 'Priya Nair',
  },
]

// ── Data: pain points ──────────────────────────────────────────
const PAIN_POINTS = [
  {
    Icon: Target,
    title: 'Goals vanish by February',
    body: 'Annual targets get set with fanfare, then fade into the background. Without structured checkpoints and real stakes, nothing sticks past Q1.',
  },
  {
    Icon: MessageSquare,
    title: 'Recognition is ephemeral',
    body: 'A Slack emoji is forgotten in minutes. Employees crave recognition that\'s tangible, trackable, and worth something beyond a fleeting feel-good moment.',
  },
  {
    Icon: BarChart3,
    title: 'Managers fly blind',
    body: 'Without a structured system, it\'s impossible to know who\'s performing, which goals are stalling, and where motivation is breaking down.',
  },
]

// ── Data: roles ────────────────────────────────────────────────
const ROLES = [
  {
    Icon: Building2,
    role: 'Admin / HR',
    tagline: 'Full control, zero chaos',
    desc: 'Set the org structure, manage budgets, curate the marketplace, and get visibility across the entire organization.',
    bullets: [
      'Full organization visibility',
      'Token budget allocation',
      'Marketplace management',
      'Challenge publishing',
      'Org hierarchy & level labels',
    ],
    colors: {
      icon: 'bg-blue-50 border-blue-200 text-blue-600',
      tag: 'text-blue-600',
      check: 'bg-blue-50 border-blue-200 text-blue-600',
    },
  },
  {
    Icon: Trophy,
    role: 'Manager',
    tagline: 'Structured goals for your team',
    desc: 'Create team challenges, allocate token budgets to employees, and track exactly who\'s hitting their targets.',
    bullets: [
      'Create scoped team challenges',
      'Allocate tokens to employees',
      'Track team completion rates',
      'View org subtree & peers',
      'Manage your own budget pool',
    ],
    colors: {
      icon: 'bg-purple-50 border-purple-200 text-purple-600',
      tag: 'text-purple-600',
      check: 'bg-purple-50 border-purple-200 text-purple-600',
    },
  },
  {
    Icon: Coins,
    role: 'Employee',
    tagline: 'Clear incentives, real rewards',
    desc: 'See exactly what\'s expected, earn tokens for every challenge completed, and spend them on rewards that actually matter.',
    bullets: [
      'Browse active challenges',
      'Track earnings & history',
      'Redeem tokens in marketplace',
      'View completion status',
      'Group bonus visibility',
    ],
    colors: {
      icon: 'bg-emerald-50 border-emerald-200 text-emerald-600',
      tag: 'text-emerald-600',
      check: 'bg-emerald-50 border-emerald-200 text-emerald-600',
    },
  },
]

// ── Hero dashboard mockup ──────────────────────────────────────
function HeroDashboardMockup() {
  const avatarColors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#6366f1']
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-2xl shadow-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <Trophy size={13} className="text-white" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-900 leading-tight">Nexus Technologies</p>
            <p className="text-[9px] text-slate-400">Admin Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] text-emerald-700 font-semibold">Live</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 border-b border-slate-100">
        {[
          { label: 'Active Challenges', value: '12', Icon: Trophy, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Tokens Issued', value: '8,450', Icon: Coins, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Avg Completion', value: '73%', Icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map((s, i) => (
          <div key={s.label} className={`px-4 py-3 flex flex-col gap-1 ${i < 2 ? 'border-r border-slate-100' : ''}`}>
            <div className={`w-6 h-6 rounded-md ${s.bg} flex items-center justify-center`}>
              <s.Icon size={11} className={s.color} />
            </div>
            <div className={`text-base font-black ${s.color}`}>{s.value}</div>
            <div className="text-[9px] text-slate-400 font-medium leading-tight">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Active challenges */}
      <div className="p-4 space-y-2">
        <p className="text-[9px] uppercase tracking-widest text-slate-400 font-semibold mb-3">Active Challenges</p>
        {[
          { title: 'Q2 Sales Sprint', tokens: 150, progress: 75, count: '9/12', color: 'bg-emerald-400' },
          { title: 'New Hire Onboarding', tokens: 200, progress: 20, count: '3/15', color: 'bg-blue-400' },
        ].map((c) => (
          <div key={c.title} className="rounded-xl bg-slate-50 border border-slate-100 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-800">{c.title}</span>
              <div className="flex items-center gap-1 text-[10px] text-amber-600 font-bold">
                <Coins size={9} /> {c.tokens}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-slate-200">
                <div className={`h-full rounded-full ${c.color}`} style={{ width: `${c.progress}%` }} />
              </div>
              <span className="text-[9px] text-slate-400 font-medium">{c.count}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Team strip */}
      <div className="px-4 pb-4 flex items-center justify-between">
        <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Team</p>
        <div className="flex items-center -space-x-1.5">
          {['S', 'M', 'A', 'P', 'J'].map((initial, i) => (
            <div
              key={i}
              className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold"
              style={{ backgroundColor: avatarColors[i] + '18', color: avatarColors[i] }}
            >
              {initial}
            </div>
          ))}
          <div className="w-7 h-7 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-500">
            +7
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────
export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-900">

      {/* ── 1. Nav ─────────────────────────────────────────────── */}
      <nav className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-8 py-6">
        <span className="font-bold text-lg tracking-tight select-none text-slate-900">
          Promise<span className="text-blue-600">forge</span>
        </span>
        <div className="flex items-center gap-6">
          <Link href="#features" className="hidden sm:block text-sm text-slate-500 hover:text-slate-900 transition-colors">
            Features
          </Link>
          <Link href="#how-it-works" className="hidden sm:block text-sm text-slate-500 hover:text-slate-900 transition-colors">
            How it works
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            Sign in <ArrowRight size={14} />
          </Link>
        </div>
      </nav>

      {/* ── 2. Hero ────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-white pt-28 pb-16 md:pt-36 md:pb-24">
        {/* Dot grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            opacity: 0.55,
          }}
        />
        {/* Colour blobs */}
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[560px] bg-gradient-to-br from-blue-100 via-sky-50 to-transparent rounded-full blur-3xl opacity-70 pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-50 rounded-full blur-3xl opacity-50 pointer-events-none" />

        <div className="relative z-10 max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Left: Copy */}
            <div className="flex flex-col gap-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-200 bg-blue-50 text-blue-600 text-xs font-semibold tracking-wide uppercase w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                Employee Engagement Platform
              </div>

              <h1 className="font-bold leading-[1.1]">
                <span className="block text-5xl sm:text-6xl text-slate-900">Forge a Culture of</span>
                <span className="block text-5xl sm:text-6xl text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">
                  Achievement
                </span>
              </h1>

              <p className="text-slate-500 text-lg leading-relaxed max-w-lg">
                Set performance challenges, reward completions with tokens, and give your team a
                marketplace where effort turns into real recognition.
              </p>

              <div className="flex items-center gap-3">
                <Link
                  href="/login"
                  className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-colors shadow-lg shadow-blue-500/25"
                >
                  Get Started Free
                </Link>
                <Link
                  href="/login"
                  className="px-6 py-3 rounded-xl border border-slate-200 hover:border-slate-300 bg-white text-slate-600 hover:text-slate-900 text-sm font-semibold transition-colors"
                >
                  Sign In
                </Link>
              </div>

              <div className="flex items-center gap-3 flex-wrap pt-1">
                {[
                  { Icon: Trophy,      label: 'Performance Challenges', color: 'text-amber-500' },
                  { Icon: Coins,       label: 'Token Rewards',          color: 'text-emerald-500' },
                  { Icon: ShoppingBag, label: 'Reward Marketplace',     color: 'text-blue-500' },
                ].map(({ Icon, label, color }) => (
                  <div
                    key={label}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm text-xs text-slate-600"
                  >
                    <Icon size={12} className={color} />
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Dashboard mockup */}
            <div className="relative hidden lg:block">
              <div className="absolute -inset-6 bg-blue-500/5 rounded-3xl blur-2xl pointer-events-none" />
              <HeroDashboardMockup />
            </div>

          </div>
        </div>
      </section>

      {/* ── 3. Trust Bar ──────────────────────────────────────── */}
      <section className="border-t border-slate-100 py-10 bg-slate-50">
        <p className="text-center text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold mb-7">
          Trusted by high-performing teams across industries
        </p>
        <div className="relative overflow-hidden px-12">
          <div className="absolute inset-y-0 left-0 w-24 z-10" style={{ background: 'linear-gradient(to right, #f8fafc, transparent)' }} />
          <div className="absolute inset-y-0 right-0 w-24 z-10" style={{ background: 'linear-gradient(to left, #f8fafc, transparent)' }} />
          <div className="flex items-center justify-center gap-10 sm:gap-16 flex-wrap">
            {['Nexus Technologies', 'Stride Health', 'Aether Group', 'Vantage Labs', 'Meridian Co.'].map((name) => (
              <span key={name} className="text-slate-300 font-bold text-sm tracking-tight whitespace-nowrap">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. Problem ─────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-3">The problem</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Employee engagement is broken
            </h2>
            <p className="text-slate-500 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
              Most recognition programs fail because they&apos;re inconsistent, unmemorable, and
              disconnected from actual performance.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {PAIN_POINTS.map(({ Icon, title, body }) => (
              <div
                key={title}
                className="rounded-2xl bg-white border border-slate-200 p-6 hover:border-slate-300 hover:shadow-sm transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center mb-5">
                  <Icon size={18} className="text-red-500" />
                </div>
                <h3 className="font-bold text-slate-900 text-base mb-2">{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-slate-500 text-sm">
              Promiseforge fixes all three.{' '}
              <span className="text-blue-600 font-semibold">Here&apos;s how ↓</span>
            </p>
          </div>
        </div>
      </section>

      {/* ── 5. How It Works ───────────────────────────────────── */}
      <HowItWorksSection />

      {/* ── 6. Features (client) ──────────────────────────────── */}
      <div id="features">
        <FeaturesSection />
      </div>

      {/* ── 7. Roles ───────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-3">Made for everyone</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
              Built for every seat in your org
            </h2>
            <p className="text-slate-500 text-sm max-w-md mx-auto">
              Every role gets exactly the features they need — no extra complexity, no missing context.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {ROLES.map(({ Icon, role, tagline, desc, bullets, colors }) => (
              <div
                key={role}
                className="rounded-2xl bg-white border border-slate-200 p-6 hover:border-slate-300 hover:shadow-sm transition-all flex flex-col"
              >
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-4 ${colors.icon}`}>
                  <Icon size={18} />
                </div>
                <div className={`text-xs font-semibold tracking-wide mb-1 ${colors.tag}`}>{role}</div>
                <h3 className="text-slate-900 font-bold text-lg mb-2">{tagline}</h3>
                <p className="text-slate-500 text-sm mb-6 leading-relaxed">{desc}</p>
                <ul className="space-y-2.5 mt-auto">
                  {bullets.map((item) => (
                    <li key={item} className="flex items-center gap-2.5 text-sm text-slate-600">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${colors.check}`}>
                        <Check size={9} />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 8. Stats (client) ──────────────────────────────────── */}
      <StatsSection />

      {/* ── 9. Testimonials ────────────────────────────────────── */}
      <section className="flex flex-col items-center gap-12 px-6 py-24 bg-white">
        <div className="text-center space-y-3">
          <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
            What teams are saying
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
            Trusted by high-performing teams
          </h2>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            HR leaders, managers, and employees across fast-growing companies use Promiseforge
            to keep their teams engaged and rewarded.
          </p>
        </div>
        <ScrollReelTestimonials testimonials={TESTIMONIALS} />
      </section>

      {/* ── 10. Final CTA ──────────────────────────────────────── */}
      <section className="relative py-28 px-6 bg-slate-50 overflow-hidden">
        <div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, rgba(59,130,246,0.07) 0%, transparent 70%)' }}
        />
        <div className="relative z-10 max-w-2xl mx-auto text-center flex flex-col items-center gap-6">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-blue-200 bg-blue-50 text-blue-600 text-xs font-semibold tracking-wide uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Start free, no credit card required
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 leading-tight">
            Ready to forge your culture?
          </h2>
          <p className="text-slate-500 text-base sm:text-lg max-w-lg leading-relaxed">
            Join forward-thinking HR teams building recognition that actually sticks. Get your org
            set up and running your first challenge in under an hour.
          </p>
          <div className="flex items-center gap-3 mt-2">
            <Link
              href="/login"
              className="px-7 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-colors shadow-xl shadow-blue-500/20"
            >
              Get Started Free
            </Link>
            <Link
              href="#"
              className="px-7 py-3.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white text-slate-600 hover:text-slate-900 text-sm font-semibold transition-colors"
            >
              Book a Demo
            </Link>
          </div>
        </div>
      </section>

      {/* ── 11. Footer ─────────────────────────────────────────── */}
      <footer className="bg-white border-t border-slate-100 px-8 py-14">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-14">
            <div className="col-span-2 md:col-span-1">
              <div className="font-bold text-lg text-slate-900 mb-2">
                Promise<span className="text-blue-600">forge</span>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed">
                Turn performance into promise. The employee engagement platform built for modern orgs.
              </p>
            </div>

            {[
              { heading: 'Product', links: ['Features', 'How it works', 'Pricing', 'Changelog'] },
              { heading: 'Company', links: ['About', 'Careers', 'Blog', 'Press'] },
              { heading: 'Resources', links: ['Documentation', 'Support', 'Status', 'API'] },
            ].map(({ heading, links }) => (
              <div key={heading}>
                <div className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">
                  {heading}
                </div>
                <ul className="space-y-3">
                  {links.map((link) => (
                    <li key={link}>
                      <Link href="#" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
                        {link}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-100 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-400">
              © {new Date().getFullYear()} Promiseforge. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              {['Privacy Policy', 'Terms of Service', 'Cookie Policy'].map((item) => (
                <Link key={item} href="#" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
                  {item}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}
