'use client'

import { useState, useMemo } from 'react'
import { X, ChevronRight, AlertCircle, Loader2, Trophy, Calendar, FileText } from 'lucide-react'
import { createChallenge } from '@/app/actions/challenges'
import type { OrgLevelConfig, TierDraft, ChallengeWithTiers } from '@/lib/types'

// ─── Palette (matches rest of app) ───────────────────────────────────────────
const LEVEL_COLORS = [
  '#1e3a5f', '#3730a3', '#0f766e', '#92400e',
  '#5b21b6', '#1d4ed8', '#0369a1', '#065f46',
]
function levelColor(l: number) { return LEVEL_COLORS[l % LEVEL_COLORS.length] }
function fmt(n: number) { return n.toLocaleString() }

// ─── Step pill ────────────────────────────────────────────────────────────────
function StepPill({ label, state }: { label: string; state: 'active' | 'done' | 'upcoming' }) {
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
      state === 'active'   ? 'bg-[#1e3a5f] text-white' :
      state === 'done'     ? 'bg-indigo-50 text-indigo-600' :
                             'bg-gray-100 text-gray-400'
    }`}>
      {state === 'done' && <span className="text-[10px]">✓</span>}
      {label}
    </div>
  )
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${on ? 'bg-indigo-600' : 'bg-gray-200'}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  )
}

// ─── Total payout computation ─────────────────────────────────────────────────
function computeWorstCase(tiers: TierDraft[], totalEmployees: number): number {
  const base = tiers.find(t => t.is_individual)?.base_tokens ?? 0
  const groupBonus = tiers
    .filter(t => !t.is_individual && t.enabled)
    .reduce((s, t) => s + t.bonus_tokens, 0)
  return totalEmployees * (base + groupBonus)
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  orgId: string
  levelConfigs: OrgLevelConfig[]
  totalEmployees: number
  availableTokens: number
  onCreated: (challenge: ChallengeWithTiers) => void
  onClose: () => void
}

type Step = 'basics' | 'tiers' | 'review'
const STEPS: Step[] = ['basics', 'tiers', 'review']
const STEP_LABELS = { basics: 'Basics', tiers: 'Tiers', review: 'Review' }

export default function CreateChallengeSheet({
  orgId, levelConfigs, totalEmployees, availableTokens, onCreated, onClose,
}: Props) {
  const [step, setStep] = useState<Step>('basics')

  // Basics
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')

  // Tiers — initialised from levelConfigs
  // Group tiers default to 100% threshold and 50 bonus tokens (admin can adjust before saving)
  const [tiers, setTiers] = useState<TierDraft[]>(() => {
    const sorted = [...levelConfigs].sort((a, b) => a.level - b.level)
    const maxLevelValue = sorted[sorted.length - 1]?.level
    return levelConfigs.map(c => ({
      level: c.level,
      label: c.label,
      is_individual: c.level === maxLevelValue,
      enabled: true,
      threshold_pct: c.level === maxLevelValue ? 0 : 100,
      base_tokens: 0,
      bonus_tokens: c.level === maxLevelValue ? 0 : 50,
    }))
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stepIndex = STEPS.indexOf(step)
  const worstCase = computeWorstCase(tiers, totalEmployees)
  const isOverBudget = worstCase > availableTokens
  const afterBalance = availableTokens - worstCase

  function updateTier(level: number, patch: Partial<TierDraft>) {
    setTiers(prev => prev.map(t => t.level === level ? { ...t, ...patch } : t))
  }

  // Validation
  const basicsValid = title.trim().length > 0 && description.trim().length > 0

  function goNext() {
    setError(null)
    if (step === 'basics' && !basicsValid) { setError('Title and description are required'); return }
    const next = STEPS[stepIndex + 1]
    if (next) setStep(next)
  }

  function goBack() {
    const prev = STEPS[stepIndex - 1]
    if (prev) setStep(prev)
  }

  async function handleCreate() {
    if (isOverBudget) return
    setSaving(true)
    setError(null)

    const result = await createChallenge(orgId, {
      title: title.trim(),
      description: description.trim(),
      start_date: startDate || null,
      due_date: dueDate || null,
      tiers,
    })

    setSaving(false)

    if ('error' in result) { setError(result.error); return }

    // Build the ChallengeWithTiers object optimistically for the parent
    const now = new Date().toISOString()
    const created: ChallengeWithTiers = {
      id: result.challengeId,
      organization_id: orgId,
      title: title.trim(),
      description: description.trim(),
      start_date: startDate || null,
      due_date: dueDate || null,
      status: 'draft',
      token_budget: worstCase,
      created_by: null,
      created_at: now,
      updated_at: now,
      tiers: tiers.map((t, i) => ({
        id: `temp-${i}`,
        challenge_id: result.challengeId,
        level: t.level,
        label: t.label,
        is_individual: t.is_individual,
        enabled: t.enabled,
        threshold_pct: t.is_individual ? null : t.threshold_pct,
        base_tokens: t.base_tokens,
        bonus_tokens: t.bonus_tokens,
        created_at: now,
        updated_at: now,
      })),
    }

    onCreated(created)
  }

  const sortedTiers = [...tiers].sort((a, b) => a.level - b.level)

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-gray-50">

      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Trophy size={15} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">New Challenge</p>
              <p className="text-[11px] text-gray-400">Step {stepIndex + 1} of {STEPS.length}</p>
            </div>
          </div>
          {/* Step pills */}
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <StepPill
                  label={STEP_LABELS[s]}
                  state={s === step ? 'active' : i < stepIndex ? 'done' : 'upcoming'}
                />
                {i < STEPS.length - 1 && <ChevronRight size={12} className="text-gray-300" />}
              </div>
            ))}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto py-8">
        <div className="max-w-2xl mx-auto px-6 space-y-0">

        {/* ── BASICS ── */}
        {step === 'basics' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">
                Challenge Name <span className="text-red-500">*</span>
              </label>
              <input
                autoFocus
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Q2 Sales Sprint"
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-300 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-gray-50 focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What is this challenge about? What should employees do to complete it?"
                rows={4}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-300 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-gray-50 focus:bg-white transition-all resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5 flex items-center gap-1">
                  <Calendar size={11} /> Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-gray-50 focus:bg-white transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5 flex items-center gap-1">
                  <Calendar size={11} /> Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  min={startDate || undefined}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-gray-50 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-blue-700">Participants</p>
              <p className="text-xs text-blue-500 mt-0.5">
                All <strong>{totalEmployees}</strong> employees in your organisation will be included automatically.
              </p>
            </div>
          </div>
        )}

        {/* ── TIERS ── */}
        {step === 'tiers' && (
          <div className="space-y-3">
            <div className="bg-gray-50 rounded-xl px-4 py-3 mb-2">
              <p className="text-xs font-semibold text-gray-600">How tiers work</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                When a group hits its threshold, everyone in that group earns the bonus on top of the individual base.
                Bonuses <strong>stack</strong> — all achieved group tiers pay out.
              </p>
            </div>

            {sortedTiers.map(tier => {
              const color = levelColor(tier.level)
              return (
                <div
                  key={tier.level}
                  className={`rounded-2xl border transition-all ${
                    tier.enabled ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'
                  }`}
                >
                  {/* Tier header */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span
                      className="text-[10px] font-black text-white px-2 py-0.5 rounded-md flex-shrink-0"
                      style={{ background: color }}
                    >
                      L{tier.level}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900">{tier.label}</p>
                      <p className="text-[11px] text-gray-400">
                        {tier.is_individual ? 'Individual · base reward for completing' : `Group · bonus when ${tier.threshold_pct}% of group completes`}
                      </p>
                    </div>
                    {!tier.is_individual && (
                      <Toggle on={tier.enabled} onChange={v => updateTier(tier.level, { enabled: v })} />
                    )}
                    {tier.is_individual && (
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">Always on</span>
                    )}
                  </div>

                  {/* Tier inputs */}
                  {tier.enabled && (
                    <div className={`px-4 pb-4 ${tier.is_individual ? '' : 'grid grid-cols-2 gap-3'}`}>
                      {!tier.is_individual && (
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-500 mb-1">Threshold %</label>
                          <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus-within:border-indigo-400 focus-within:bg-white transition-colors">
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={tier.threshold_pct}
                              onChange={e => updateTier(tier.level, { threshold_pct: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
                              className="flex-1 bg-transparent text-sm font-semibold text-gray-800 outline-none text-right tabular-nums"
                            />
                            <span className="text-xs text-gray-400">%</span>
                          </div>
                        </div>
                      )}

                      <div className={tier.is_individual ? 'max-w-[200px]' : ''}>
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                          {tier.is_individual ? 'Base Tokens' : 'Bonus Tokens'}
                        </label>
                        <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus-within:border-indigo-400 focus-within:bg-white transition-colors">
                          <input
                            type="number"
                            min="0"
                            value={tier.is_individual ? tier.base_tokens : tier.bonus_tokens}
                            onChange={e => {
                              const v = Math.max(0, parseInt(e.target.value) || 0)
                              updateTier(tier.level, tier.is_individual ? { base_tokens: v } : { bonus_tokens: v })
                            }}
                            className="flex-1 bg-transparent text-sm font-semibold text-gray-800 outline-none text-right tabular-nums"
                          />
                          <span className="text-xs text-gray-400">tk</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Live worst-case preview */}
            <div className={`rounded-2xl border px-4 py-3 mt-2 ${isOverBudget ? 'border-red-200 bg-red-50' : 'border-indigo-100 bg-indigo-50'}`}>
              <p className="text-xs font-bold text-gray-700 mb-2">Total token cost</p>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-2xl font-black tabular-nums ${isOverBudget ? 'text-red-600' : 'text-indigo-700'}`}>
                  {fmt(worstCase)}
                </span>
                <span className="text-xs text-gray-400">tokens</span>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                {totalEmployees} employees × ({tiers.find(t => t.is_individual)?.base_tokens ?? 0} base
                {tiers.filter(t => !t.is_individual && t.enabled).length > 0 && (
                  ` + ${tiers.filter(t => !t.is_individual && t.enabled).reduce((s, t) => s + t.bonus_tokens, 0)} group bonuses`
                )})
              </p>
              {isOverBudget && (
                <p className="text-xs font-bold text-red-600 mt-1.5 flex items-center gap-1">
                  <AlertCircle size={11} /> Exceeds available budget by {fmt(worstCase - availableTokens)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── REVIEW ── */}
        {step === 'review' && (
          <div className="space-y-4">
            {/* Challenge summary */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Challenge Details</p>
              <div>
                <p className="text-base font-extrabold text-gray-900">{title}</p>
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">{description}</p>
              </div>
              {(startDate || dueDate) && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Calendar size={12} className="text-gray-400" />
                  {startDate && <span>{startDate}</span>}
                  {startDate && dueDate && <span>→</span>}
                  {dueDate && <span>{dueDate}</span>}
                </div>
              )}
              <div className="text-xs text-gray-400">
                <FileText size={11} className="inline mr-1" />
                {totalEmployees} participants (whole organisation)
              </div>
            </div>

            {/* Tier table */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Token Tiers</p>
              </div>
              <div className="divide-y divide-gray-50">
                {sortedTiers.map(tier => (
                  <div key={tier.level} className={`flex items-center gap-3 px-4 py-3 ${!tier.enabled && !tier.is_individual ? 'opacity-40' : ''}`}>
                    <span
                      className="text-[10px] font-black text-white px-1.5 py-0.5 rounded-md flex-shrink-0"
                      style={{ background: levelColor(tier.level) }}
                    >
                      L{tier.level}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800">{tier.label}</p>
                      {!tier.is_individual && tier.enabled && (
                        <p className="text-[11px] text-gray-400">
                          {tier.threshold_pct}% of group must complete
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      {tier.is_individual ? (
                        <span className="text-xs font-bold text-gray-700">{fmt(tier.base_tokens)} base</span>
                      ) : tier.enabled ? (
                        <span className="text-xs font-bold text-indigo-600">+{fmt(tier.bonus_tokens)} bonus</span>
                      ) : (
                        <span className="text-xs text-gray-300">disabled</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Budget breakdown */}
            <div className={`rounded-2xl border p-4 space-y-2 ${isOverBudget ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-gray-50'}`}>
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Token Budget</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total payout</span>
                  <span className="font-bold text-gray-900 tabular-nums">{fmt(worstCase)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Available for challenges</span>
                  <span className="font-bold text-gray-900 tabular-nums">{fmt(availableTokens)}</span>
                </div>
                <div className="border-t border-gray-200 pt-1.5 flex justify-between">
                  <span className={`font-bold ${isOverBudget ? 'text-red-600' : 'text-gray-600'}`}>
                    After this challenge
                  </span>
                  <span className={`font-black tabular-nums ${isOverBudget ? 'text-red-600' : 'text-emerald-600'}`}>
                    {fmt(Math.abs(afterBalance))} {isOverBudget ? 'over' : 'remaining'}
                  </span>
                </div>
              </div>
              {isOverBudget && (
                <p className="text-xs font-semibold text-red-600 flex items-center gap-1 mt-1">
                  <AlertCircle size={11} /> Reduce token values in the Tiers step to create this challenge.
                </p>
              )}
            </div>
          </div>
        )}
        </div>{/* end max-w-2xl */}
      </div>{/* end scrollable */}

      {/* Footer */}
      <div className="flex-shrink-0 bg-white border-t border-gray-100 px-6 py-4">
        <div className="max-w-2xl mx-auto flex gap-3">

          {/* Error inline above buttons */}
          {error && (
            <div className="flex-1 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2.5">
              <AlertCircle size={13} /> {error}
            </div>
          )}

          {!error && (
            <>
              {stepIndex > 0 ? (
                <button
                  onClick={goBack}
                  className="px-6 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
              ) : (
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              )}

              <div className="flex-1" />

              {step !== 'review' ? (
                <button
                  onClick={goNext}
                  disabled={step === 'basics' && !basicsValid}
                  className="px-8 py-2.5 rounded-xl bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              ) : (
                <button
                  onClick={handleCreate}
                  disabled={saving || isOverBudget}
                  className="px-8 py-2.5 rounded-xl bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving
                    ? <><Loader2 size={14} className="animate-spin" /> Creating…</>
                    : <><Trophy size={14} /> Create Challenge</>}
                </button>
              )}
            </>
          )}

          {error && (
            <button
              onClick={() => setError(null)}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
