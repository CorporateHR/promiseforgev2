'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import { Upload, X, Download, CheckCircle, AlertCircle, Loader2, FileText, List, GitFork } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import OrgChartView from './OrgChartView'
import type { Employee, OrgLevelConfig } from '@/lib/types'

// ─── CSV parser (handles quoted fields + CRLF) ────────────────────────────────
function parseCSV(text: string): string[][] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
  return lines.map(line => {
    const fields: string[] = []
    let cur = ''
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++ } else inQ = !inQ }
      else if (ch === ',' && !inQ) { fields.push(cur.trim()); cur = '' }
      else cur += ch
    }
    fields.push(cur.trim())
    return fields
  })
}

// ─── Types ────────────────────────────────────────────────────────────────────
type ParsedRow = {
  rowNum: number
  employee_id: string
  first_name: string
  last_name: string
  email: string
  team_name: string
  manager_employee_id: string
  errors: string[]
}

type ResolvedEntry = { uuid: string; level: number }

interface ImportResult {
  imported: Employee[]
  failedRows: { row: ParsedRow; reason: string }[]
}

// ─── Build a preview Employee[] from parsed rows + existing employees ─────────
function buildPreviewEmployees(validRows: ParsedRow[], existingEmployees: Employee[]): Employee[] {
  const byEmpId = new Map<string, ResolvedEntry>()
  const byEmail  = new Map<string, ResolvedEntry>()
  for (const e of existingEmployees) {
    const entry: ResolvedEntry = { uuid: e.id, level: e.level }
    if (e.employee_id) byEmpId.set(e.employee_id.toLowerCase(), entry)
    if (e.email)       byEmail.set(e.email.toLowerCase(), entry)
  }

  const result: Employee[] = [...existingEmployees]

  const toEmployee = (row: ParsedRow, level: number, managerId: string | null): Employee => ({
    id: `preview-${row.employee_id}`,
    organization_id: '',
    employee_id: row.employee_id,
    first_name: row.first_name,
    last_name: row.last_name,
    full_name: `${row.first_name} ${row.last_name}`,
    email: row.email || null,
    team_name: row.team_name,
    level,
    manager_id: managerId,
    created_at: '',
    updated_at: '',
  })

  // Root rows first
  for (const row of validRows.filter(r => !r.manager_employee_id)) {
    const emp = toEmployee(row, 0, null)
    result.push(emp)
    byEmpId.set(row.employee_id.toLowerCase(), { uuid: emp.id, level: 0 })
    if (row.email) byEmail.set(row.email.toLowerCase(), { uuid: emp.id, level: 0 })
  }

  // Multi-pass for manager-linked rows
  let pending = validRows.filter(r => !!r.manager_employee_id)
  let madeProgress = true
  while (pending.length > 0 && madeProgress) {
    madeProgress = false
    const next: ParsedRow[] = []
    for (const row of pending) {
      const mgr = byEmpId.get(row.manager_employee_id.toLowerCase())
             ?? byEmail.get(row.manager_employee_id.toLowerCase())
      if (!mgr) { next.push(row); continue }
      const emp = toEmployee(row, mgr.level + 1, mgr.uuid)
      result.push(emp)
      byEmpId.set(row.employee_id.toLowerCase(), { uuid: emp.id, level: emp.level })
      if (row.email) byEmail.set(row.email.toLowerCase(), { uuid: emp.id, level: emp.level })
      madeProgress = true
    }
    pending = next
  }

  return result
}

interface Props {
  employees: Employee[]
  levelConfigs: OrgLevelConfig[]
  orgId: string
  onImported: (newEmployees: Employee[]) => void
  onCancel: () => void
}

// ─── Template — real 62-employee hierarchy from CascadeRewards ───────────────
const HEADERS = ['employee_id', 'first_name', 'last_name', 'email', 'team_name', 'manager_employee_id']

// Leave manager_employee_id blank for root/CEO — they become L0. Everyone else must reference a manager.
const TEMPLATE_ROWS = [
  // L0 — CEO / Root (no manager)
  ['ADM001','Anil','Inamdar','anil.inamdar@acmecorp.com','Executive',''],
  // L1 — Division Managers (report to L0)
  ['DIV001','Sarah','Mitchell','sarah.mitchell@acmecorp.com','Technology Division','ADM001'],
  ['DIV002','Robert','Chen','robert.chen@acmecorp.com','Operations Division','ADM001'],
  // L2 — Department Managers
  ['DEP001','James','Park','james.park@acmecorp.com','Engineering','DIV001'],
  ['DEP002','Lisa','Torres','lisa.torres@acmecorp.com','Product','DIV001'],
  ['DEP003','Angela','Okafor','angela.okafor@acmecorp.com','Marketing','DIV002'],
  ['DEP004','David','Walsh','david.walsh@acmecorp.com','Sales','DIV002'],
  // L3 — Unit Managers
  ['UNT001','Kevin','Sharma','kevin.sharma@acmecorp.com','Eng Unit 1','DEP001'],
  ['UNT002','Priya','Kapoor','priya.kapoor@acmecorp.com','Eng Unit 2','DEP001'],
  ['UNT003','Marco','Silva','marco.silva@acmecorp.com','Product Unit 1','DEP002'],
  ['UNT004','Hannah','Lee','hannah.lee@acmecorp.com','Product Unit 2','DEP002'],
  ['UNT005','Omar','Hassan','omar.hassan@acmecorp.com','Mktg Unit 1','DEP003'],
  ['UNT006','Celine','Dubois','celine.dubois@acmecorp.com','Mktg Unit 2','DEP003'],
  ['UNT007','Tony','Reyes','tony.reyes@acmecorp.com','Sales Unit 1','DEP004'],
  ['UNT008','Mei','Zhang','mei.zhang@acmecorp.com','Sales Unit 2','DEP004'],
  // L4 — Lead Managers
  ['LED001','Ryan','Cooper','ryan.cooper@acmecorp.com','Lead A1','UNT001'],
  ['LED002','Zoe','Grant','zoe.grant@acmecorp.com','Lead A2','UNT001'],
  ['LED003','Miles','Turner','miles.turner@acmecorp.com','Lead B1','UNT002'],
  ['LED004','Nadia','Patel','nadia.patel@acmecorp.com','Lead B2','UNT002'],
  ['LED005','Ethan','Brooks','ethan.brooks@acmecorp.com','Lead C1','UNT003'],
  ['LED006','Sofia','Rivera','sofia.rivera@acmecorp.com','Lead C2','UNT003'],
  ['LED007','Isaac','Chen','isaac.chen@acmecorp.com','Lead D1','UNT004'],
  ['LED008','Layla','Ahmed','layla.ahmed@acmecorp.com','Lead D2','UNT004'],
  ['LED009','Sam','Ford','sam.ford@acmecorp.com','Lead E1','UNT005'],
  ['LED010','Isla','Burns','isla.burns@acmecorp.com','Lead E2','UNT005'],
  ['LED011','Kai','Nakamura','kai.nakamura@acmecorp.com','Lead F1','UNT006'],
  ['LED012','Vera','Santos','vera.santos@acmecorp.com','Lead F2','UNT006'],
  ['LED013','Cole','Morgan','cole.morgan@acmecorp.com','Lead G1','UNT007'],
  ['LED014','Diya','Mehta','diya.mehta@acmecorp.com','Lead G2','UNT007'],
  ['LED015','Liam','Scott','liam.scott@acmecorp.com','Lead H1','UNT008'],
  ['LED016','Anya','Kim','anya.kim@acmecorp.com','Lead H2','UNT008'],
  // L5 — Individual Employees (2 per lead group)
  ['EMP001','Alice','Patel','alice.patel@acmecorp.com','Lead A1','LED001'],
  ['EMP002','Brian','Wong','brian.wong@acmecorp.com','Lead A1','LED001'],
  ['EMP003','Chloe','Davis','chloe.davis@acmecorp.com','Lead A2','LED002'],
  ['EMP004','Diego','Ruiz','diego.ruiz@acmecorp.com','Lead A2','LED002'],
  ['EMP005','Emma','Kim','emma.kim@acmecorp.com','Lead B1','LED003'],
  ['EMP006','Felix','Okafor','felix.okafor@acmecorp.com','Lead B1','LED003'],
  ['EMP007','Grace','Lee','grace.lee@acmecorp.com','Lead B2','LED004'],
  ['EMP008','Henry','Singh','henry.singh@acmecorp.com','Lead B2','LED004'],
  ['EMP009','Imani','Brown','imani.brown@acmecorp.com','Lead C1','LED005'],
  ['EMP010','Jake','Torres','jake.torres@acmecorp.com','Lead C1','LED005'],
  ['EMP011','Kira','Mehta','kira.mehta@acmecorp.com','Lead C2','LED006'],
  ['EMP012','Luca','Rossi','luca.rossi@acmecorp.com','Lead C2','LED006'],
  ['EMP013','Maya','Tanaka','maya.tanaka@acmecorp.com','Lead D1','LED007'],
  ['EMP014','Noah','James','noah.james@acmecorp.com','Lead D1','LED007'],
  ['EMP015','Olivia','Chen','olivia.chen@acmecorp.com','Lead D2','LED008'],
  ['EMP016','Pete','Adeyemi','pete.adeyemi@acmecorp.com','Lead D2','LED008'],
  ['EMP017','Quinn','Park','quinn.park@acmecorp.com','Lead E1','LED009'],
  ['EMP018','Rosa','Santos','rosa.santos@acmecorp.com','Lead E1','LED009'],
  ['EMP019','Sam','Miller','sam.miller@acmecorp.com','Lead E2','LED010'],
  ['EMP020','Tara','Nguyen','tara.nguyen@acmecorp.com','Lead E2','LED010'],
  ['EMP021','Uma','Clark','uma.clark@acmecorp.com','Lead F1','LED011'],
  ['EMP022','Victor','Reyes','victor.reyes@acmecorp.com','Lead F1','LED011'],
  ['EMP023','Wendy','Liu','wendy.liu@acmecorp.com','Lead F2','LED012'],
  ['EMP024','Xavier','Smith','xavier.smith@acmecorp.com','Lead F2','LED012'],
  ['EMP025','Yara','Hassan','yara.hassan@acmecorp.com','Lead G1','LED013'],
  ['EMP026','Zach','Martin','zach.martin@acmecorp.com','Lead G1','LED013'],
  ['EMP027','Aisha','Cole','aisha.cole@acmecorp.com','Lead G2','LED014'],
  ['EMP028','Ben','Wright','ben.wright@acmecorp.com','Lead G2','LED014'],
  ['EMP029','Cara','Scott','cara.scott@acmecorp.com','Lead H1','LED015'],
  ['EMP030','Drew','Powell','drew.powell@acmecorp.com','Lead H1','LED015'],
  ['EMP031','Elan','Brooks','elan.brooks@acmecorp.com','Lead H2','LED016'],
  ['EMP032','Fiona','Walsh','fiona.walsh@acmecorp.com','Lead H2','LED016'],
]

function downloadTemplate() {
  const rows = [HEADERS, ...TEMPLATE_ROWS]
  const csv = rows.map(r => r.map(f => f.includes(',') ? `"${f}"` : f).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'employees.csv'; a.click()
  URL.revokeObjectURL(url)
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function EmployeeUploadModal({ employees, levelConfigs, orgId, onImported, onCancel }: Props) {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [previewTab, setPreviewTab] = useState<'table' | 'chart'>('table')

  const previewEmployees = useMemo(() => {
    if (!rows.length) return []
    const validRows = rows.filter(r => r.errors.length === 0)
    return buildPreviewEmployees(validRows, employees)
  }, [rows, employees])

  // ── Parse file ─────────────────────────────────────────────────────
  function processFile(file: File) {
    if (!file.name.endsWith('.csv')) { setParseError('Please upload a .csv file.'); return }
    setParseError(null); setResult(null); setFileName(file.name)
    const reader = new FileReader()
    reader.onload = e => {
      const text = (e.target?.result as string) ?? ''
      const raw = parseCSV(text)
      if (raw.length < 2) { setParseError('File is empty or has no data rows.'); return }

      const header = raw[0].map(h => h.toLowerCase().replace(/\s+/g, '_'))
      const col = (name: string) => header.indexOf(name)

      const iEmpId   = col('employee_id')
      const iFirst   = col('first_name')
      const iLast    = col('last_name')
      const iEmail   = col('email')
      const iTeam    = col('team_name')
      const iMgr     = col('manager_employee_id')

      const missing = [
        iEmpId === -1 && 'employee_id',
        iFirst === -1 && 'first_name',
        iLast  === -1 && 'last_name',
        iTeam  === -1 && 'team_name',
      ].filter(Boolean)
      if (missing.length) { setParseError(`Missing required columns: ${missing.join(', ')}`); return }

      const get = (cols: string[], idx: number) => idx >= 0 ? (cols[idx] ?? '').trim() : ''

      const parsed: ParsedRow[] = raw.slice(1).map((cols, i) => {
        const errs: string[] = []
        const employee_id          = get(cols, iEmpId)
        const first_name           = get(cols, iFirst)
        const last_name            = get(cols, iLast)
        const email                = get(cols, iEmail)
        const team_name            = get(cols, iTeam)
        const manager_employee_id  = get(cols, iMgr)

        if (!employee_id) errs.push('employee_id required')
        if (!first_name)  errs.push('first_name required')
        if (!last_name)   errs.push('last_name required')
        if (!team_name)   errs.push('team_name required')

        return { rowNum: i + 2, employee_id, first_name, last_name, email, team_name, manager_employee_id, errors: errs }
      })

      // Warn about duplicate employee_ids within the CSV
      const empIds = parsed.map(r => r.employee_id).filter(Boolean)
      const dupes = empIds.filter((id, i) => empIds.indexOf(id) !== i)
      if (dupes.length) {
        const dupeSet = new Set(dupes)
        parsed.forEach(r => {
          if (dupeSet.has(r.employee_id)) r.errors.push(`Duplicate employee_id "${r.employee_id}" in this file`)
        })
      }

      setRows(parsed)
    }
    reader.readAsText(file)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (file) processFile(file); e.target.value = ''
  }
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files[0]; if (file) processFile(file)
  }, [])

  // ── Import ─────────────────────────────────────────────────────────
  async function handleImport() {
    const validRows = rows.filter(r => r.errors.length === 0)
    if (!validRows.length) return
    setImporting(true); setProgress(0)

    // Build resolution map: employee_id (lowercase) → { uuid, level }
    // Also index by email for flexibility
    const byEmpId  = new Map<string, ResolvedEntry>()
    const byEmail  = new Map<string, ResolvedEntry>()
    for (const e of employees) {
      const entry: ResolvedEntry = { uuid: e.id, level: e.level }
      if (e.employee_id) byEmpId.set(e.employee_id.toLowerCase(), entry)
      if (e.email)       byEmail.set(e.email.toLowerCase(), entry)
    }

    const resolve = (key: string): ResolvedEntry | null =>
      byEmpId.get(key.toLowerCase()) ?? byEmail.get(key.toLowerCase()) ?? null

    const imported: Employee[] = []
    const failedRows: ImportResult['failedRows'] = []

    const insertRow = async (row: ParsedRow, level: number, managerId: string | null) => {
      const fullName = `${row.first_name} ${row.last_name}`.trim()
      const { data: emp, error } = await supabase
        .from('employees')
        .insert({
          organization_id: orgId,
          employee_id: row.employee_id,
          first_name: row.first_name,
          last_name:  row.last_name,
          full_name:  fullName,
          email:      row.email || null,
          team_name:  row.team_name,
          level,
          manager_id: managerId,
        })
        .select()
        .single()
      return { emp, error }
    }

    // Pass 0: root nodes (empty manager_employee_id) → level 0
    const rootRows = validRows.filter(r => !r.manager_employee_id)
    const managerRows = validRows.filter(r => !!r.manager_employee_id)

    for (const row of rootRows) {
      const { emp, error } = await insertRow(row, 0, null)
      if (error || !emp) {
        failedRows.push({ row, reason: error?.message ?? 'Unknown error' })
      } else {
        imported.push(emp)
        byEmpId.set(emp.employee_id!.toLowerCase(), { uuid: emp.id, level: emp.level })
        if (emp.email) byEmail.set(emp.email.toLowerCase(), { uuid: emp.id, level: emp.level })
      }
      setProgress(Math.round(((imported.length + failedRows.length) / validRows.length) * 100))
    }

    // Multi-pass topological processing for manager-linked rows
    let pending = [...managerRows]
    let madeProgress = true

    while (pending.length > 0 && madeProgress) {
      madeProgress = false
      const nextPending: ParsedRow[] = []

      for (const row of pending) {
        const mgr = resolve(row.manager_employee_id)
        if (!mgr) { nextPending.push(row); continue }

        const { emp, error } = await insertRow(row, mgr.level + 1, mgr.uuid)
        if (error || !emp) {
          failedRows.push({ row, reason: error?.message ?? 'Unknown error' })
        } else {
          imported.push(emp)
          byEmpId.set(emp.employee_id!.toLowerCase(), { uuid: emp.id, level: emp.level })
          if (emp.email) byEmail.set(emp.email.toLowerCase(), { uuid: emp.id, level: emp.level })
          madeProgress = true
        }
        setProgress(Math.round(((imported.length + failedRows.length) / validRows.length) * 100))
      }

      pending = nextPending
    }

    // Any still-pending rows had unresolvable managers
    for (const row of pending) {
      failedRows.push({ row, reason: `Manager "${row.manager_employee_id}" not found. Make sure they exist in the system or earlier in the same CSV.` })
    }

    setResult({ imported, failedRows })
    setImporting(false)
    if (imported.length > 0) onImported(imported)
  }

  const validCount = rows.filter(r => r.errors.length === 0).length
  const errorCount = rows.filter(r => r.errors.length > 0).length
  const hasRows = rows.length > 0
  const getLabel = (l: number) => levelConfigs.find(c => c.level === l)?.label ?? `L${l}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={importing ? undefined : onCancel} />

      <div className={`relative bg-white rounded-2xl shadow-2xl w-full max-h-[90vh] flex flex-col border border-gray-100 overflow-hidden transition-all ${hasRows && !importing && !result && previewTab === 'chart' ? 'max-w-6xl' : 'max-w-3xl'}`}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">Upload Employees via CSV</h2>
            <p className="text-xs text-gray-400 mt-0.5">Bulk import employees — level is auto-derived from manager chain</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={downloadTemplate} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors">
              <Download size={12} /> Download Template
            </button>
            {!importing && (
              <button onClick={onCancel} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-4 space-y-4">

          {/* ── Drop zone ── */}
          {!hasRows && !importing && !result && (
            <>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors
                  ${dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'}`}
              >
                <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-500">
                  <Upload size={22} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-700">Drop your CSV here or <span className="text-indigo-600">browse</span></p>
                  <p className="text-xs text-gray-400 mt-1">Columns: employee_id · first_name · last_name · email · team_name · manager_employee_id</p>
                </div>
              </div>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileInput} />

              {parseError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 flex items-center gap-2">
                  <AlertCircle size={14} className="flex-shrink-0" /> {parseError}
                </div>
              )}

              {/* Column reference */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-600 mb-2.5">CSV Column Reference</p>
                <div className="space-y-1.5 text-xs text-gray-500">
                  {[
                    ['employee_id',         true,  'Unique ID for this employee (e.g. EMP001) — used to reference as manager'],
                    ['first_name',          true,  'First name'],
                    ['last_name',           true,  'Last name'],
                    ['email',               false, 'Work email address'],
                    ['team_name',           true,  'Team or department name'],
                    ['manager_employee_id', true,  'employee_id of the direct manager — level auto-derived as manager level + 1'],
                  ].map(([col, req, desc]) => (
                    <div key={col as string} className="flex items-start gap-2">
                      <span className="font-mono font-semibold text-gray-700 w-44 flex-shrink-0">{col as string}</span>
                      <span className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${req ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-500'}`}>
                        {req ? 'required' : 'optional'}
                      </span>
                      <span>{desc as string}</span>
                    </div>
                  ))}
                </div>
                {employees.some(e => e.level === 0) && (
                  <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                    💡 <strong>Tip:</strong> For employees reporting directly to the Tenant Admin (L0), set <span className="font-mono">manager_employee_id</span> to the admin&apos;s Employee ID.
                    {employees.find(e => e.level === 0)?.employee_id
                      ? <> The current L0 ID is <span className="font-mono font-bold">{employees.find(e => e.level === 0)!.employee_id}</span>.</>
                      : <> The L0 admin has no Employee ID set — edit them first to assign one, or use their email address in <span className="font-mono">manager_employee_id</span>.</>
                    }
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Preview (table or chart) ── */}
          {hasRows && !importing && !result && (
            <div className="space-y-3">
              {/* File info + tab toggle */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-gray-400" />
                  <span className="text-sm font-semibold text-gray-700">{fileName}</span>
                  <span className="text-xs text-gray-400">· {rows.length} row{rows.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-3">
                  {/* View toggle */}
                  <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs">
                    <button
                      onClick={() => setPreviewTab('table')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all ${previewTab === 'table' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      <List size={11} /> Table
                    </button>
                    <button
                      onClick={() => setPreviewTab('chart')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all ${previewTab === 'chart' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      <GitFork size={11} /> Chart Preview
                    </button>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    {validCount > 0 && <span className="flex items-center gap-1 text-green-600 font-semibold"><CheckCircle size={12} /> {validCount} valid</span>}
                    {errorCount > 0 && <span className="flex items-center gap-1 text-red-600 font-semibold"><AlertCircle size={12} /> {errorCount} errors</span>}
                    <button onClick={() => { setRows([]); setFileName(null); setPreviewTab('table') }} className="text-gray-400 hover:text-gray-600 underline">Change file</button>
                  </div>
                </div>
              </div>

              {/* Table view */}
              {previewTab === 'table' && (
                <>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto max-h-64">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                          <tr>
                            {['#', 'employee_id', 'first_name', 'last_name', 'email', 'team_name', 'manager_employee_id', 'status'].map(h => (
                              <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {rows.map(row => (
                            <tr key={row.rowNum} className={row.errors.length > 0 ? 'bg-red-50' : 'bg-white'}>
                              <td className="px-3 py-2 text-gray-400">{row.rowNum}</td>
                              <td className={`px-3 py-2 font-mono ${!row.employee_id ? 'text-red-500' : 'text-gray-600'}`}>{row.employee_id || '(empty)'}</td>
                              <td className={`px-3 py-2 font-semibold ${!row.first_name ? 'text-red-500' : 'text-gray-900'}`}>{row.first_name || '(empty)'}</td>
                              <td className={`px-3 py-2 font-semibold ${!row.last_name ? 'text-red-500' : 'text-gray-900'}`}>{row.last_name || '(empty)'}</td>
                              <td className="px-3 py-2 text-gray-400">{row.email || <span className="text-gray-300">—</span>}</td>
                              <td className={`px-3 py-2 ${!row.team_name ? 'text-red-500' : 'text-gray-500'}`}>{row.team_name || '(empty)'}</td>
                              <td className={`px-3 py-2 font-mono ${!row.manager_employee_id ? 'text-orange-400' : 'text-gray-500'}`}>{row.manager_employee_id || <span className="text-[10px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded font-semibold">root (L0)</span>}</td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {row.errors.length === 0
                                  ? <span className="flex items-center gap-1 text-green-600 font-semibold"><CheckCircle size={11} /> OK</span>
                                  : <span className="text-red-600" title={row.errors.join('; ')}>{row.errors[0]}{row.errors.length > 1 ? ` +${row.errors.length - 1}` : ''}</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {errorCount > 0 && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-lg px-3 py-2">
                      ⚠ {errorCount} row{errorCount !== 1 ? 's have' : ' has'} errors and will be skipped. Fix and re-upload, or proceed with {validCount} valid row{validCount !== 1 ? 's' : ''}.
                    </div>
                  )}
                </>
              )}

              {/* Chart preview */}
              {previewTab === 'chart' && (
                <div className="border border-gray-200 rounded-xl overflow-hidden" style={{ height: '420px' }}>
                  <OrgChartView
                    employees={previewEmployees}
                    levelConfigs={levelConfigs}
                    onEdit={() => {}}
                    readOnly
                  />
                </div>
              )}
            </div>
          )}

          {/* ── Progress ── */}
          {importing && (
            <div className="py-10 flex flex-col items-center gap-4">
              <Loader2 size={32} className="text-indigo-500 animate-spin" />
              <div className="w-full max-w-xs">
                <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                  <span>Importing employees…</span><span>{progress}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </div>
          )}

          {/* ── Result ── */}
          {result && (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-8 py-4">
                <div className="text-center">
                  <div className="text-4xl font-black text-green-600">{result.imported.length}</div>
                  <div className="text-xs text-gray-500 mt-1">Imported</div>
                </div>
                {result.failedRows.length > 0 && (
                  <div className="text-center">
                    <div className="text-4xl font-black text-red-500">{result.failedRows.length}</div>
                    <div className="text-xs text-gray-500 mt-1">Failed</div>
                  </div>
                )}
              </div>

              {result.failedRows.length > 0 && (
                <div className="border border-red-200 rounded-xl overflow-hidden">
                  <div className="bg-red-50 border-b border-red-200 px-3 py-2">
                    <p className="text-xs font-semibold text-red-600">Failed rows</p>
                  </div>
                  <table className="w-full text-xs">
                    <thead className="bg-red-50 border-b border-red-200">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-red-500">Row</th>
                        <th className="px-3 py-2 text-left font-semibold text-red-500">employee_id</th>
                        <th className="px-3 py-2 text-left font-semibold text-red-500">Name</th>
                        <th className="px-3 py-2 text-left font-semibold text-red-500">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-100">
                      {result.failedRows.map(({ row, reason }) => (
                        <tr key={row.rowNum} className="bg-white">
                          <td className="px-3 py-2 text-gray-500">{row.rowNum}</td>
                          <td className="px-3 py-2 font-mono text-gray-600">{row.employee_id}</td>
                          <td className="px-3 py-2 font-semibold text-gray-700">{row.first_name} {row.last_name}</td>
                          <td className="px-3 py-2 text-red-600">{reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
          <p className="text-xs text-gray-400">
            {!hasRows && !result && 'Upload a CSV — level is automatically derived from the manager chain.'}
            {hasRows && !importing && !result && `${validCount} of ${rows.length} rows ready to import`}
            {importing && 'Please wait…'}
            {result && `${result.imported.length} employee${result.imported.length !== 1 ? 's' : ''} added successfully.`}
          </p>
          <div className="flex items-center gap-2">
            {!importing && (
              <button onClick={onCancel} className="px-4 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                {result ? 'Close' : 'Cancel'}
              </button>
            )}
            {hasRows && !importing && !result && (
              <button
                onClick={handleImport}
                disabled={validCount === 0}
                className="px-4 py-2 text-sm font-bold text-white bg-[#1e3a5f] hover:bg-[#162d4a] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                Import {validCount} Employee{validCount !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
