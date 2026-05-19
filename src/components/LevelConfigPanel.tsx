'use client'

import { useState } from 'react'
import { Plus, Save, Trash2, Tag } from 'lucide-react'
import type { OrgLevelConfig } from '@/lib/types'

interface Props {
  levelConfigs: OrgLevelConfig[]
  employeeCountByLevel: Record<number, number>
  onSave: (configs: { level: number; label: string }[]) => Promise<void>
  onAddLevel: (level: number, label: string) => Promise<void>
  onDeleteLevel: (level: number) => Promise<void>
  saving?: boolean
}

const LEVEL_COLORS = [
  '#1e3a5f', '#3730a3', '#0f766e', '#92400e',
  '#5b21b6', '#1d4ed8', '#0369a1', '#065f46',
]

function levelColor(level: number) {
  return LEVEL_COLORS[level % LEVEL_COLORS.length]
}

export default function LevelConfigPanel({
  levelConfigs,
  employeeCountByLevel,
  onSave,
  onAddLevel,
  onDeleteLevel,
  saving = false,
}: Props) {
  const [drafts, setDrafts] = useState<Record<number, string>>(
    Object.fromEntries(levelConfigs.map(c => [c.level, c.label]))
  )
  const [dirty, setDirty] = useState(false)
  const [addingNew, setAddingNew] = useState(false)
  const [newLabel, setNewLabel] = useState('')

  const maxLevel = Math.max(...levelConfigs.map(c => c.level), 0)

  function handleChange(level: number, value: string) {
    setDrafts(prev => ({ ...prev, [level]: value }))
    setDirty(true)
  }

  async function handleSave() {
    await onSave(
      Object.entries(drafts).map(([level, label]) => ({ level: Number(level), label }))
    )
    setDirty(false)
  }

  async function handleAddLevel() {
    const newLevel = maxLevel + 1
    const label = newLabel.trim() || `L${newLevel}`
    await onAddLevel(newLevel, label)
    setDrafts(prev => ({ ...prev, [newLevel]: label }))
    setNewLabel('')
    setAddingNew(false)
  }

  return (
    <aside className="w-72 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Tag size={15} className="text-indigo-600" />
          <span className="font-bold text-sm text-gray-900">Level Names</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Rename each hierarchy level to match your org structure
        </p>
      </div>

      {/* Level list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {levelConfigs.sort((a, b) => a.level - b.level).map(config => {
          const count = employeeCountByLevel[config.level] ?? 0
          const isL0 = config.level === 0

          return (
            <div key={config.level} className="group">
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
                  style={{ background: levelColor(config.level) }}
                >
                  L{config.level}
                </div>
                <input
                  type="text"
                  value={drafts[config.level] ?? config.label}
                  onChange={e => handleChange(config.level, e.target.value)}
                  disabled={isL0}
                  placeholder={`L${config.level} label`}
                  className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-xs font-semibold focus:outline-none focus:border-indigo-400 focus:bg-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                />
                {!isL0 && count === 0 && (
                  <button
                    onClick={() => onDeleteLevel(config.level)}
                    className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
              <div className="pl-9 text-[10px] text-gray-400">
                {count} {count === 1 ? 'person' : 'people'}
                {isL0 && ' · Tenant Admin (fixed)'}
              </div>
            </div>
          )
        })}

        {/* Add level row */}
        {addingNew ? (
          <div className="flex items-center gap-2 pt-1">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
              style={{ background: levelColor(maxLevel + 1) }}
            >
              L{maxLevel + 1}
            </div>
            <input
              autoFocus
              type="text"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAddLevel()
                if (e.key === 'Escape') { setAddingNew(false); setNewLabel('') }
              }}
              placeholder={`L${maxLevel + 1} name…`}
              className="flex-1 px-2.5 py-1.5 rounded-lg border border-indigo-300 bg-indigo-50 text-xs font-semibold focus:outline-none"
            />
            <button
              onClick={handleAddLevel}
              className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              Add
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAddingNew(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-200 text-gray-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 text-xs font-semibold transition-colors"
          >
            <Plus size={12} /> Add Level
          </button>
        )}
      </div>

      {/* Save bar */}
      {dirty && (
        <div className="px-3 py-3 border-t border-gray-100 bg-indigo-50">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
          >
            <Save size={12} /> {saving ? 'Saving…' : 'Save Level Names'}
          </button>
        </div>
      )}
    </aside>
  )
}
