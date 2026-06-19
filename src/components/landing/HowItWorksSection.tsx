import { Trophy, Coins, Check } from 'lucide-react'

// ── Step 1 mockup: Org Builder ─────────────────────────────────
function OrgMockup() {
  const employees = [
    { name: 'Jordan Riley',  level: 'CEO · L0',              color: 'blue',   indent: 0 },
    { name: 'Alex Chen',     level: 'VP Engineering · L1',   color: 'purple', indent: 1 },
    { name: 'Sam Kowalski',  level: 'Manager · L2',          color: 'indigo', indent: 2 },
    { name: 'Maria Santos',  level: 'VP Operations · L1',    color: 'purple', indent: 1 },
  ] as const

  const colorMap = {
    blue:   { badge: 'bg-blue-100 text-blue-700',   label: 'bg-blue-50 text-blue-700 border-blue-200',   ring: 'border-blue-100 bg-blue-50/50' },
    purple: { badge: 'bg-purple-100 text-purple-700', label: 'bg-purple-50 text-purple-700 border-purple-200', ring: 'border-slate-100 bg-slate-50' },
    indigo: { badge: 'bg-indigo-100 text-indigo-700', label: 'bg-indigo-50 text-indigo-700 border-indigo-200', ring: 'border-slate-100 bg-slate-50' },
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xl shadow-slate-100">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
        <div>
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Organization</p>
          <p className="text-sm font-bold text-slate-900 mt-0.5">Nexus Technologies</p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="text-[10px] text-emerald-700 font-semibold">12 employees</span>
        </div>
      </div>

      <div className="p-4 space-y-2">
        {employees.map((emp, i) => (
          <div key={i} className="flex items-center gap-2" style={{ paddingLeft: `${emp.indent * 18}px` }}>
            {emp.indent > 0 && <div className="w-3 h-px bg-slate-200 shrink-0" />}
            <div className={`flex items-center gap-2.5 flex-1 rounded-xl px-3 py-2 border ${colorMap[emp.color].ring}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${colorMap[emp.color].badge}`}>
                {emp.name[0]}
              </div>
              <p className="text-xs font-semibold text-slate-700 flex-1 truncate">{emp.name}</p>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${colorMap[emp.color].label}`}>
                {emp.level}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 pb-4 flex gap-2">
        <button className="flex-1 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
          + Add Employee
        </button>
        <button className="flex-1 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-xs font-semibold">
          Import CSV
        </button>
      </div>
    </div>
  )
}

// ── Step 2 mockup: Challenge Builder ───────────────────────────
function ChallengeMockup() {
  const tiers = [
    { icon: '👤', label: 'Individual Completion', detail: 'Per employee who finishes',    tokens: '150',  color: 'amber' },
    { icon: '👥', label: 'Group Bonus — 50%',     detail: 'When ≥50% of team completes', tokens: '+100', color: 'blue'  },
    { icon: '🏆', label: 'Group Bonus — 80%',     detail: 'When ≥80% of team completes', tokens: '+250', color: 'purple' },
  ] as const

  const tokenColor = { amber: 'text-amber-600', blue: 'text-blue-600', purple: 'text-purple-600' }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xl shadow-slate-100">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50">
        <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
          <Trophy size={15} className="text-amber-600" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">New Challenge</p>
          <p className="text-sm font-bold text-slate-900">Q2 Sales Sprint</p>
        </div>
        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          Active
        </span>
      </div>

      <div className="p-4 space-y-2">
        <p className="text-[9px] uppercase tracking-widest text-slate-400 font-semibold mb-3">Reward Tiers</p>
        {tiers.map((tier) => (
          <div key={tier.label} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-base shrink-0 select-none">{tier.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-700">{tier.label}</p>
              <p className="text-[9px] text-slate-400 mt-0.5">{tier.detail}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Coins size={9} className="text-amber-500" />
              <span className={`text-sm font-bold ${tokenColor[tier.color]}`}>{tier.tokens}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 pb-4">
        <div className="flex justify-between mb-3 px-1">
          <span className="text-[10px] text-slate-400">Total budget</span>
          <span className="text-[10px] font-semibold text-slate-600">2,000 tokens</span>
        </div>
        <button className="w-full py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold tracking-wide">
          Publish Challenge →
        </button>
      </div>
    </div>
  )
}

// ── Step 3 mockup: Earnings & Marketplace ─────────────────────
function EarningsMockup() {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xl shadow-slate-100">
      {/* Balance header */}
      <div className="px-5 py-5 border-b border-slate-100 bg-gradient-to-br from-emerald-50 via-white to-white">
        <p className="text-[9px] uppercase tracking-widest text-slate-400 font-semibold mb-1">Your Balance</p>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-black text-slate-900">1,250</span>
          <span className="text-sm text-emerald-600 font-bold">tokens</span>
        </div>
        <div className="mt-2.5 flex items-center gap-1.5 text-[10px] text-emerald-600 font-medium">
          <Check size={10} />
          3 challenges completed this month
        </div>
      </div>

      {/* Earnings list */}
      <div className="px-4 pt-4 pb-3">
        <p className="text-[9px] uppercase tracking-widest text-slate-400 font-semibold mb-2">Recent Earnings</p>
        <div className="space-y-0">
          {[
            { name: 'Q2 Sales Sprint',    type: 'Individual',  tokens: '+150' },
            { name: 'Group Bonus (80%)',  type: 'Team Bonus',  tokens: '+250' },
            { name: 'Onboarding Module',  type: 'Individual',  tokens: '+200' },
          ].map((item) => (
            <div key={item.name} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
              <div className="flex items-center gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <div>
                  <p className="text-xs text-slate-700 font-medium">{item.name}</p>
                  <p className="text-[9px] text-slate-400">{item.type}</p>
                </div>
              </div>
              <span className="text-xs font-bold text-emerald-600">{item.tokens}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Marketplace strip */}
      <div className="px-4 pb-4">
        <p className="text-[9px] uppercase tracking-widest text-slate-400 font-semibold mb-2.5">Marketplace</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { emoji: '☕', name: 'Coffee Card', price: 200 },
            { emoji: '🎁', name: 'Gift Card',   price: 500 },
            { emoji: '🏖️', name: 'Extra PTO',   price: 1000 },
          ].map((item) => (
            <div key={item.name} className="rounded-xl bg-slate-50 border border-slate-100 p-2.5 text-center">
              <div className="text-xl mb-1.5 leading-none">{item.emoji}</div>
              <p className="text-[9px] text-slate-500 font-medium leading-tight">{item.name}</p>
              <div className="flex items-center justify-center gap-0.5 mt-1">
                <Coins size={7} className="text-amber-500" />
                <span className="text-[8px] text-amber-600 font-bold">{item.price}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Step definitions ───────────────────────────────────────────
const STEPS = [
  {
    num: '01',
    label: 'Step One',
    accent: 'text-blue-600',
    glow: 'bg-blue-400',
    bg: 'bg-white',
    flip: false,
    title: 'Build Your Organization',
    description:
      'Define your company structure in minutes. Add employees, create hierarchy levels with your own labels, and wire up every manager relationship — everything Promiseforge needs to scope challenges and budgets to exactly the right people, automatically.',
    tags: ['Org hierarchy', 'Custom levels', 'Manager setup', 'CSV import'],
    Mockup: OrgMockup,
  },
  {
    num: '02',
    label: 'Step Two',
    accent: 'text-amber-600',
    glow: 'bg-amber-400',
    bg: 'bg-slate-50',
    flip: true,
    title: 'Launch Performance Challenges',
    description:
      'Managers create goals with multi-tier token rewards. Set an individual completion bonus, then layer on group bonuses that unlock when a percentage of the team finishes — building shared accountability and real team momentum.',
    tags: ['Multi-tier rewards', 'Group bonuses', 'Budget control', 'Status lifecycle'],
    Mockup: ChallengeMockup,
  },
  {
    num: '03',
    label: 'Step Three',
    accent: 'text-emerald-600',
    glow: 'bg-emerald-400',
    bg: 'bg-white',
    flip: false,
    title: 'Employees Earn & Redeem',
    description:
      'Every completion earns tokens. Employees watch their balance grow, see exactly which tiers they unlocked, and spend in a curated marketplace of real rewards — turning everyday performance into something tangible and worth celebrating.',
    tags: ['Token earnings', 'Reward marketplace', 'Redemption flow', 'Approval workflow'],
    Mockup: EarningsMockup,
  },
] as const

// ── Section export ─────────────────────────────────────────────
export default function HowItWorksSection() {
  return (
    <div id="how-it-works">
      {/* Section header */}
      <div className="text-center pt-24 pb-16 px-6 bg-slate-50">
        <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-4">How it works</p>
        <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 leading-tight">
          From setup to recognition
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">
            in hours
          </span>
        </h2>
      </div>

      {/* Alternating steps */}
      {STEPS.map((step) => {
        const { Mockup } = step
        return (
          <div key={step.num} className={`relative overflow-hidden py-20 px-6 ${step.bg}`}>
            {/* Large watermark number */}
            <div
              aria-hidden="true"
              className="absolute pointer-events-none select-none font-black text-slate-100 leading-none"
              style={{
                fontSize: 'clamp(140px, 22vw, 320px)',
                right: step.flip ? 'auto' : '-2%',
                left: step.flip ? '-2%' : 'auto',
                top: '-5%',
              }}
            >
              {step.num}
            </div>

            {/* Accent glow */}
            <div
              aria-hidden="true"
              className={`absolute pointer-events-none rounded-full blur-[160px] opacity-[0.08] ${step.glow}`}
              style={{
                width: '45vw',
                height: '45vw',
                top: '0%',
                right: step.flip ? 'auto' : '0',
                left: step.flip ? '0' : 'auto',
              }}
            />

            {/* Content grid */}
            <div className="relative z-10 max-w-5xl mx-auto grid md:grid-cols-2 gap-12 md:gap-16 items-center">

              {/* Text block */}
              <div className={step.flip ? 'order-2' : 'order-2 md:order-1'}>
                <div className="flex items-center gap-3 mb-7">
                  <span className="text-5xl font-black text-slate-200 tabular-nums leading-none select-none">
                    {step.num}
                  </span>
                  <div className="w-px h-7 bg-slate-200" />
                  <span className={`text-[11px] uppercase tracking-widest font-bold ${step.accent}`}>
                    {step.label}
                  </span>
                </div>

                <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4 leading-tight">
                  {step.title}
                </h3>
                <p className="text-slate-500 text-base leading-relaxed mb-8">
                  {step.description}
                </p>

                <div className="flex flex-wrap gap-2">
                  {step.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 bg-white text-slate-500"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Mockup block */}
              <div className={`relative ${step.flip ? 'order-1' : 'order-1 md:order-2'}`}>
                <div className={`absolute -inset-8 ${step.glow} opacity-[0.04] blur-[60px] rounded-3xl`} />
                <Mockup />
              </div>

            </div>
          </div>
        )
      })}
    </div>
  )
}
