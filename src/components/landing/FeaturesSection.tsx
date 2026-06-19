'use client'

import { useState } from 'react'
import { Trophy, Coins, ShoppingBag, Building2, Check } from 'lucide-react'

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

// ── Mockup: Challenges ─────────────────────────────────────────
function ChallengesMockup() {
  return (
    <div className="w-full rounded-2xl bg-white border border-slate-200 p-4 space-y-3 shadow-lg shadow-slate-100">
      {[
        { title: 'Q2 Sales Sprint', desc: 'Close 10 deals this month', tokens: 150, status: 'Active', active: true, progress: 75, count: '9/12' },
        { title: 'New Hire Onboarding', desc: 'Complete all training modules', tokens: 200, status: 'Draft', active: false, progress: 20, count: '3/15' },
      ].map((c) => (
        <div key={c.title} className="rounded-xl bg-white border border-slate-200 overflow-hidden shadow-sm">
          <div className={`h-0.5 w-full ${c.active ? 'bg-emerald-400' : 'bg-slate-300'}`} />
          <div className="p-3">
            <div className="flex items-start justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${c.active ? 'bg-emerald-50' : 'bg-slate-100'}`}>
                  <Trophy size={13} className={c.active ? 'text-emerald-600' : 'text-slate-400'} />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-800 leading-tight">{c.title}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{c.desc}</div>
                </div>
              </div>
              <span className={cn(
                'shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full border',
                c.active
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              )}>
                {c.status}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-[10px] text-amber-600">
                <Coins size={9} />
                <span className="font-semibold">{c.tokens} tokens</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-20 h-1 rounded-full bg-slate-200">
                  <div className={cn('h-full rounded-full', c.active ? 'bg-emerald-400' : 'bg-slate-300')} style={{ width: `${c.progress}%` }} />
                </div>
                <span className="text-[9px] text-slate-400">{c.count}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Mockup: Token Economy ──────────────────────────────────────
function TokensMockup() {
  const managers: { name: string; role: string; tokens: number; initial: string; employees: [string, number][] }[] = [
    { name: 'Sarah Chen', role: 'Engineering Mgr', tokens: 3200, initial: 'S', employees: [['Alex K.', 800], ['Maria S.', 600]] },
    { name: 'Marcus Rivera', role: 'Sales Mgr', tokens: 4600, initial: 'M', employees: [] },
  ]
  return (
    <div className="w-full rounded-2xl bg-white border border-slate-200 p-4 space-y-2.5 shadow-lg shadow-slate-100">
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-3">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[11px] text-blue-700 font-semibold">Organization Budget</span>
          <span className="text-[11px] text-blue-600 font-bold">12,000 tokens</span>
        </div>
        <div className="h-1.5 rounded-full bg-blue-100">
          <div className="h-full w-[65%] rounded-full bg-gradient-to-r from-blue-500 to-blue-400" />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-blue-400">7,800 allocated</span>
          <span className="text-[9px] text-blue-400">4,200 remaining</span>
        </div>
      </div>
      {managers.map((mgr) => (
        <div key={mgr.name} className="rounded-xl bg-slate-50 border border-slate-100 p-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-[10px] flex items-center justify-center font-bold">
                {mgr.initial}
              </div>
              <div>
                <div className="text-[11px] text-slate-700 font-medium leading-tight">{mgr.name}</div>
                <div className="text-[9px] text-slate-400">{mgr.role}</div>
              </div>
            </div>
            <span className="text-[11px] text-slate-500 font-semibold">{mgr.tokens.toLocaleString()} tkn</span>
          </div>
          {mgr.employees.length > 0 && (
            <div className="mt-2 pl-8 space-y-1">
              {mgr.employees.map(([name, tkn]) => (
                <div key={name} className="flex justify-between">
                  <span className="text-[9px] text-slate-400">{name}</span>
                  <span className="text-[9px] text-emerald-600 font-medium">{tkn.toLocaleString()} tkn</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Mockup: Marketplace ────────────────────────────────────────
function MarketplaceMockup() {
  return (
    <div className="w-full rounded-2xl bg-white border border-slate-200 p-4 shadow-lg shadow-slate-100">
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        {[
          { name: 'Coffee Card', emoji: '☕', price: 200, pending: false },
          { name: 'Gift Card', emoji: '🎁', price: 500, pending: true },
          { name: 'Extra PTO', emoji: '🏖️', price: 1000, pending: false },
        ].map((item) => (
          <div key={item.name} className="rounded-xl bg-slate-50 border border-slate-100 p-2.5 flex flex-col items-center gap-1.5">
            <div className="text-xl mt-1">{item.emoji}</div>
            <div className="text-[9px] font-semibold text-slate-700 text-center leading-tight">{item.name}</div>
            <div className="flex items-center gap-0.5 text-[9px] text-amber-600 font-bold">
              <Coins size={7} /> {item.price}
            </div>
            {item.pending ? (
              <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                Pending
              </span>
            ) : (
              <div className="text-[8px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                Redeem
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
        <span className="text-[10px] text-slate-400">Your balance</span>
        <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-bold">
          <Coins size={10} /> 1,250 tokens
        </div>
      </div>
    </div>
  )
}

// ── Mockup: Org Management ─────────────────────────────────────
function OrgMockup() {
  const levels = [
    { label: 'L0 — Executive', names: ['Jordan Riley'], color: 'blue' },
    { label: 'L1 — Director', names: ['Alex Chen', 'Maria S.'], color: 'purple' },
    { label: 'L2 — Manager', names: ['Sam K.', 'Priya N.', 'Jamie T.'], color: 'indigo' },
    { label: 'L3 — Individual', names: ['Chris T.', 'Dana R.', 'Felix M.'], color: 'default' },
  ] as const

  const colorMap: Record<typeof levels[number]['color'], string> = {
    blue:    'bg-blue-50 border-blue-200 text-blue-700',
    purple:  'bg-purple-50 border-purple-200 text-purple-700',
    indigo:  'bg-indigo-50 border-indigo-200 text-indigo-700',
    default: 'bg-slate-100 border-slate-200 text-slate-500',
  }

  return (
    <div className="w-full rounded-2xl bg-white border border-slate-200 p-5 shadow-lg shadow-slate-100 space-y-3.5">
      {levels.map((row) => (
        <div key={row.label} className="flex items-center gap-3">
          <div className="shrink-0 w-32 text-right">
            <span className="text-[9px] text-slate-400 font-medium">{row.label}</span>
          </div>
          <div className="w-px h-4 bg-slate-200 shrink-0" />
          <div className="flex gap-1.5 flex-wrap">
            {row.names.map((name) => (
              <div key={name} className={cn('rounded-md px-2 py-1 text-[9px] font-medium border', colorMap[row.color])}>
                {name}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Tab definitions ────────────────────────────────────────────
type TabId = 'challenges' | 'tokens' | 'marketplace' | 'org'

interface FeatureData {
  title: string
  description: string
  bullets: string[]
  Mockup: () => React.JSX.Element
}

const FEATURES: Record<TabId, FeatureData> = {
  challenges: {
    title: 'Performance Challenges',
    description:
      'Create structured goals with multi-tier token rewards. Individual completions earn base tokens; group thresholds unlock bonus payouts for the whole team.',
    bullets: [
      'Multi-tier rewards: individual tokens + group bonus thresholds',
      'Draft → Active → Completed lifecycle control',
      'Manager-scoped or org-wide visibility',
      'Real-time completion tracking per employee',
    ],
    Mockup: ChallengesMockup,
  },
  tokens: {
    title: 'Token Economy',
    description:
      'A cascading budget model that gives every level exactly the right control. Admins allocate to managers; managers distribute to their direct reports.',
    bullets: [
      'Org total → manager pool → employee allocation',
      'Full transaction ledger on every token movement',
      'Per-employee allocation with instant adjustment',
      'Budget utilization visible at every level',
    ],
    Mockup: TokensMockup,
  },
  marketplace: {
    title: 'Reward Marketplace',
    description:
      'Employees spend earned tokens on rewards you actually curate — gift cards, extra PTO, team lunches. Your catalog, your rules, your approval workflow.',
    bullets: [
      'Admin-created catalog with categories & token prices',
      'Employees browse and submit redemption requests',
      'Approval workflow: pending → approved / rejected',
      'Quantity limits prevent over-redemption',
    ],
    Mockup: MarketplaceMockup,
  },
  org: {
    title: 'Org Management',
    description:
      'Define your structure once — hierarchy levels, labels, managers, and reporting lines — and Promiseforge scopes every challenge, budget, and notification automatically.',
    bullets: [
      'Custom hierarchy levels with your own labels (L0–Ln)',
      'Visual org chart with manager relationships',
      'Bulk employee import and CSV upload',
      'Manager ↔ employee relationships fully tracked',
    ],
    Mockup: OrgMockup,
  },
}

const TABS: { id: TabId; label: string; Icon: typeof Trophy }[] = [
  { id: 'challenges', label: 'Challenges', Icon: Trophy },
  { id: 'tokens', label: 'Token Economy', Icon: Coins },
  { id: 'marketplace', label: 'Marketplace', Icon: ShoppingBag },
  { id: 'org', label: 'Org Management', Icon: Building2 },
]

// ── Main export ────────────────────────────────────────────────
export default function FeaturesSection() {
  const [active, setActive] = useState<TabId>('challenges')
  const feature = FEATURES[active]
  const { Mockup } = feature

  return (
    <section className="py-24 px-6 bg-slate-50">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-3">
            Platform features
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
            Everything your org needs, in one place
          </h2>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 border',
                active === id
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300'
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div key={active} className="grid md:grid-cols-2 gap-12 items-center animate-fade-up">
          {/* Left: copy */}
          <div className="space-y-6 order-2 md:order-1">
            <div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">{feature.title}</h3>
              <p className="text-slate-500 leading-relaxed">{feature.description}</p>
            </div>
            <ul className="space-y-3">
              {feature.bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-3 text-sm text-slate-600">
                  <div className="w-5 h-5 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0 mt-0.5">
                    <Check size={11} className="text-blue-600" />
                  </div>
                  {bullet}
                </li>
              ))}
            </ul>
          </div>

          {/* Right: mockup */}
          <div className="relative order-1 md:order-2">
            <div className="absolute inset-0 bg-blue-500/4 rounded-3xl blur-3xl -z-10 scale-90" />
            <Mockup />
          </div>
        </div>
      </div>
    </section>
  )
}
