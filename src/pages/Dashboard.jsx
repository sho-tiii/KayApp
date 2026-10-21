import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  LogOut, Plus, Check, Trash2, Sun, Moon, Sparkles, X, Lock, Trophy, GitBranch,
  CalendarDays, BookOpen, BarChart3, Settings, ListOrdered, Home, CloudUpload, Zap,
  ChevronRight, ChevronDown, Upload, KeyRound, FileText, Star, Search,
  PanelLeftClose, PanelLeftOpen, Menu, Archive, RotateCcw, Clock, MoreHorizontal,
  MoreVertical, GripVertical, Circle, Play, Layers, HelpCircle, FileEdit,
  CheckCircle2, RefreshCw, Eye, ArrowRight,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import kayappLogo from '../assets/KAYAPP.png'
import {
  topologicalSort,
  layerOf,
} from '../lib/graph'

/* ================================================================== */
/* Constants & Helpers                                                 */
/* ================================================================== */

const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)
const PRIORITY = { high: 0, normal: 1, low: 2 }

const fmtFullDate = (d) =>
  d ? new Date(`${d}T00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''

const fmtMonthShort = (d) =>
  d ? new Date(`${d}T00:00`).toLocaleDateString('en-US', { month: 'short' }).toUpperCase() : ''

const fmtDayNum = (d) =>
  d ? new Date(`${d}T00:00`).getDate() : ''

const daysFromToday = (dueStr, todayStr) => {
  if (!dueStr) return null
  const a = new Date(`${dueStr}T00:00`)
  const b = new Date(`${todayStr}T00:00`)
  return Math.round((a - b) / (1000 * 60 * 60 * 24))
}

const dueRelativeLabel = (dueStr, todayStr) => {
  const diff = daysFromToday(dueStr, todayStr)
  if (diff === null) return ''
  if (diff < 0) return `Overdue by ${Math.abs(diff)} ${Math.abs(diff) === 1 ? 'day' : 'days'}`
  if (diff === 0) return 'Due today'
  if (diff === 1) return 'Due tomorrow'
  return `Due in ${diff} days`
}

const fmtSize = (b) =>
  b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`

const VALID_VIEWS = ['today', 'library', 'plan', 'progress', 'archive', 'settings']
const ACCEPTED_FILES = '.pdf,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain'

const DEFAULT_STUDY_LISTS = ['To Study', 'In Progress', 'Completed']
const BOARD_TAG_REGEX = /\[BOARD_LIST:([^\]]+)\]/

function isCompletedListName(name) {
  const n = String(name || '').trim().toLowerCase()
  return n === 'completed' || n === 'done' || n === 'finished'
}

function getTaskBoardList(task) {
  const raw = String(task.notes || '')
  const match = raw.match(BOARD_TAG_REGEX)
  if (match && match[1].trim()) return match[1].trim()
  return task.is_done ? 'Completed' : 'To Study'
}

function setTaskBoardListNotes(notes, listName) {
  const clean = String(notes || '').replace(BOARD_TAG_REGEX, '').trim()
  if (!listName) return clean || null
  const tag = `[BOARD_LIST:${listName.trim()}]`
  return clean ? `${clean}\n${tag}` : tag
}

function cleanBoardNotes(notes) {
  return String(notes || '').replace(BOARD_TAG_REGEX, '').trim()
}

const SUBJECT_BADGES = [
  { dot: '#173761', darkDot: '#7FA6D6', light: 'bg-[#E6F0FA] text-[#173761]', dark: 'bg-[#172840] text-sky-200' },
  { dot: '#B78116', darkDot: '#F5B82E', light: 'bg-[#FFF4D6] text-[#8A5F0B]', dark: 'bg-[#2A2212] text-[#F5B82E]' },
  { dot: '#047857', darkDot: '#34D399', light: 'bg-emerald-50 text-emerald-800', dark: 'bg-emerald-950/60 text-emerald-200' },
  { dot: '#6D28D9', darkDot: '#A78BFA', light: 'bg-violet-50 text-violet-800', dark: 'bg-violet-950/60 text-violet-200' },
]

function getSubjectStyle(id, index = 0) {
  if (!id) return SUBJECT_BADGES[0]
  let hash = index
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % SUBJECT_BADGES.length
  }
  return SUBJECT_BADGES[Math.abs(hash) % SUBJECT_BADGES.length]
}

const PRIORITY_BADGE = {
  high: { label: 'High', cls: 'bg-[#FDE8E8] text-[#B91C1C] dark:bg-rose-950/60 dark:text-rose-300' },
  normal: { label: 'Medium', cls: 'bg-[#FFF4D6] text-[#B78116] dark:bg-amber-950/60 dark:text-[#F5B82E]' },
  low: { label: 'Low', cls: 'bg-[#E6F0FA] text-[#1D4ED8] dark:bg-sky-950/60 dark:text-sky-300' },
}

function isValidUploadFile(file) {
  if (!file) return false
  const validMimes = ['application/pdf', 'image/png', 'image/jpeg', 'text/plain']
  if (file.type && validMimes.includes(file.type)) return true
  const ext = (file.name || '').split('.').pop()?.toLowerCase()
  return ['pdf', 'png', 'jpg', 'jpeg', 'txt'].includes(ext)
}

function inferMimeType(file) {
  if (file?.type) return file.type
  const ext = (file?.name || '').split('.').pop()?.toLowerCase()
  const map = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    txt: 'text/plain',
  }
  return map[ext] || 'application/octet-stream'
}

function deriveKeyPoints(title, notesOrAnswer) {
  const raw = String(notesOrAnswer || '').replace(/^Source:[^\n]+\n?/i, '').trim()
  if (raw) {
    const parts = raw
      .split(/[.;•\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 6)
    if (parts.length > 0) return parts.slice(0, 4)
  }
  const cleanTitle = String(title || '').replace(/^(review|study|memorize|understand|read|learn)\s+/i, '').trim()
  return [
    `Define the main purpose and function of ${cleanTitle}`,
    `Identify the key components or steps of ${cleanTitle}`,
  ]
}

function buildPlausibleDistractors(currentAnswer, allAnswers) {
  const others = allAnswers
    .map((a) => String(a || '').trim())
    .filter((a) => a && a.toLowerCase() !== String(currentAnswer || '').trim().toLowerCase())
  const unique = Array.from(new Set(others))
  const fallbacks = [
    'Handles only physical cabling and voltage levels without routing',
    'Applies only to static offline archives rather than active sessions',
    'Bypasses prerequisite checks and executes in arbitrary order',
  ]
  while (unique.length < 3) {
    unique.push(fallbacks[unique.length])
  }
  return unique.slice(0, 3)
}

function shuffleArray(items) {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = arr[i]
    arr[i] = arr[j]
    arr[j] = tmp
  }
  return arr
}

function computeNextReview(card, rating, todayStr) {
  const curInterval = Number(card.interval_days) || 0
  const curEase = Number(card.ease_factor) || 2.5
  const curReps = Number(card.reps) || 0

  let nextInterval = 0
  let nextEase = curEase
  let nextReps = curReps
  let mastered = false

  if (rating === 'again') {
    nextInterval = 0
    nextEase = Math.max(1.3, curEase - 0.2)
    nextReps = 0
    mastered = false
  } else if (rating === 'hard') {
    nextInterval = curInterval === 0 ? 1 : Math.max(1, Math.round(curInterval * 1.2))
    nextEase = Math.max(1.3, curEase - 0.15)
    nextReps = curReps + 1
    mastered = nextInterval >= 3
  } else if (rating === 'good') {
    nextInterval = curInterval === 0 ? 2 : Math.max(2, Math.round(curInterval * curEase))
    nextReps = curReps + 1
    mastered = true
  } else if (rating === 'easy') {
    nextInterval = curInterval === 0 ? 4 : Math.max(4, Math.round(curInterval * curEase * 1.3))
    nextEase = curEase + 0.15
    nextReps = curReps + 1
    mastered = true
  }

  const nextDate = new Date(`${todayStr}T00:00`)
  nextDate.setDate(nextDate.getDate() + nextInterval)

  return {
    due_date: ymd(nextDate),
    interval_days: nextInterval,
    ease_factor: Number(nextEase.toFixed(2)),
    reps: nextReps,
    last_rating: rating,
    is_mastered: mastered,
  }
}

const navItems = [
  { key: 'today', label: 'Today', mobileLabel: 'Today', icon: Home },
  { key: 'library', label: 'Library', mobileLabel: 'Library', icon: BookOpen },
  { key: 'plan', label: 'Plan', mobileLabel: 'Plan', icon: CalendarDays },
  { key: 'progress', label: 'Progress', mobileLabel: 'Progress', icon: BarChart3 },
  { key: 'archive', label: 'Archive', mobileLabel: 'Archive', icon: Archive },
]

/* ================================================================== */
/* Small UI Components                                                 */
/* ================================================================== */

function Bar({ value, label, track }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className={`h-2.5 overflow-hidden rounded-full ${track}`}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-[#E6A51C] to-[#F5B82E] transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

function HeroBookIllustration() {
  return (
    <div aria-hidden="true" className="relative hidden h-36 w-48 shrink-0 select-none lg:flex lg:items-center lg:justify-center">
      <svg viewBox="0 0 220 160" className="h-full w-full overflow-visible">
        <path d="M185 18 L188 26 L196 29 L188 32 L185 40 L182 32 L174 29 L182 26 Z" fill="#F5B82E" />
        <path d="M35 125 L37 130 L42 132 L37 134 L35 139 L33 134 L28 132 L33 130 Z" fill="#F5B82E" opacity="0.75" />
        <circle cx="150" cy="22" r="2" fill="#F5B82E" opacity="0.6" />
        <circle cx="202" cy="70" r="2.5" fill="#F5B82E" opacity="0.5" />

        <g transform="translate(25, 34)">
          <path d="M15 62 L85 28 L155 62 L85 96 Z" fill="#1D3F6E" stroke="#5B7FA8" strokeWidth="1.6" />
          <path d="M15 62 L15 78 L85 112 L155 78 L155 62" fill="#132C4E" stroke="#5B7FA8" strokeWidth="1.6" />
          <path d="M18 70 L85 103 L152 70" fill="none" stroke="#7FA6D6" strokeWidth="1.2" opacity="0.55" />
          <path d="M42 44 L85 24 L128 44 L85 64 Z" fill="#102644" stroke="#8FB2DE" strokeWidth="1.6" />
          <path d="M62 54 L62 68 C62 74, 108 74, 108 68 L108 54" fill="#173761" stroke="#8FB2DE" strokeWidth="1.5" />
          <ellipse cx="85" cy="44" rx="5" ry="2.8" fill="#F5B82E" />
          <path d="M85 44 Q102 50 112 64" fill="none" stroke="#F5B82E" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="112" cy="65" r="3" fill="#F5B82E" />
        </g>
      </svg>
    </div>
  )
}

function Modal({ isOpen, onClose, title, children, darkMode, maxWidth = 'max-w-lg' }) {
  useEffect(() => {
    if (!isOpen) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#0B1525]/60 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-heading"
        className={`w-full ${maxWidth} rounded-2xl border p-6 shadow-xl ${
          darkMode ? 'border-[#2A3B51] bg-[#111F33] text-slate-100' : 'border-[#E7E9E5] bg-white text-[#173761]'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="modal-heading" className="text-lg font-bold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-500/10 hover:text-current focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E]"
          >
            <X size={18} />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}

function ToastRegion({ toasts, onDismiss, darkMode }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-20 right-4 z-[95] flex w-full max-w-sm flex-col gap-2 md:bottom-6 md:right-6"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.type === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-semibold shadow-lg ${
            toast.type === 'error'
              ? darkMode
                ? 'border-red-500/40 bg-[#2A121B] text-red-200'
                : 'border-red-200 bg-red-50 text-red-800'
              : darkMode
              ? 'border-[#2A3B51] bg-[#111F33] text-slate-100'
              : 'border-[#E7E9E5] bg-white text-[#173761]'
          }`}
        >
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss notification"
            className="rounded p-1 opacity-70 hover:opacity-100"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

/* ================================================================== */
/* Optional Skill Tree Map                                             */
/* ================================================================== */

const MW = 184
const MH = 60
const MGX = 72
const MGY = 20
const MPAD = 20

function TopicSkillMap({ topics, edges, layer, status, minutes, darkMode, onPickTopic }) {
  const cols = {}
  topics.forEach((t) => {
    const l = layer.get(t.id) || 0
    if (!cols[l]) cols[l] = []
    cols[l].push(t)
  })
  const maxCol = Math.max(0, ...Object.keys(cols).map(Number))
  const maxRows = Math.max(1, ...Object.values(cols).map((c) => c.length))
  const width = MPAD * 2 + (maxCol + 1) * MW + maxCol * MGX
  const height = MPAD * 2 + maxRows * MH + (maxRows - 1) * MGY

  const pos = {}
  Object.entries(cols).forEach(([l, list]) => {
    const colH = list.length * MH + (list.length - 1) * MGY
    const top = MPAD + (height - MPAD * 2 - colH) / 2
    list.forEach((t, i) => {
      pos[t.id] = { x: MPAD + Number(l) * (MW + MGX), y: top + i * (MH + MGY) }
    })
  })

  const tone = {
    done: 'border-[#E6A51C] bg-[#F5B82E] text-[#173761]',
    ready: 'border-[#F5B82E] bg-[#173761] text-white',
    locked: darkMode
      ? 'border-dashed border-[#2A3B51] bg-[#0B1525] text-slate-400'
      : 'border-dashed border-slate-300 bg-[#FAFAF7] text-slate-500',
  }
  const labels = { done: 'Done', ready: 'Open', locked: 'Locked' }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="relative mx-auto" style={{ width, height }}>
        <svg className="absolute inset-0" width={width} height={height} aria-hidden="true">
          {edges.map((e) => {
            const a = pos[e.from]
            const b = pos[e.to]
            if (!a || !b) return null
            const x1 = a.x + MW
            const y1 = a.y + MH / 2
            const x2 = b.x
            const y2 = b.y + MH / 2
            const mx = (x1 + x2) / 2
            return (
              <path
                key={`${e.from}-${e.to}`}
                d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                fill="none"
                strokeLinecap="round"
                strokeWidth={2}
                stroke={darkMode ? '#2A3B51' : '#D5DAE1'}
              />
            )
          })}
        </svg>

        {topics.map((t) => {
          const s = status[t.id]
          const p = pos[t.id]
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onPickTopic(t.id)}
              style={{ left: p.x, top: p.y, width: MW, height: MH }}
              className={`absolute flex items-center gap-2.5 rounded-xl border-2 px-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] ${tone[s]}`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                  s === 'done'
                    ? 'bg-[#173761] text-[#F5B82E]'
                    : s === 'ready'
                    ? 'bg-[#F5B82E] text-[#173761]'
                    : darkMode
                    ? 'bg-[#172840] text-slate-400'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {s === 'done' ? <Check size={14} strokeWidth={3} /> : s === 'ready' ? <Sparkles size={14} /> : <Lock size={13} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold">{t.title}</span>
                <span className="block text-xs opacity-80">
                  {labels[s]} · {minutes[t.id]}m
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ================================================================== */
/* 3-Step Upload Reviewer Wizard Modal                                 */
/* ================================================================== */

function UploadReviewerWizard({
  isOpen,
  onClose,
  subjects,
  defaultSubjectId,
  defaultBoardList,
  session,
  darkMode,
  onDeckSaved,
  onStartStudyingDeck,
  pushToast,
}) {
  const [step, setStep] = useState(1)
  const [file, setFile] = useState(null)
  const [subjectId, setSubjectId] = useState(defaultSubjectId || '')
  const [deckTitle, setDeckTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [stageText, setStageText] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [draftCards, setDraftCards] = useState([])
  const [draftProposals, setDraftProposals] = useState([])
  const [importProposals, setImportProposals] = useState(true)
  const [savedDeck, setSavedDeck] = useState(null)
  const [savedCards, setSavedCards] = useState([])

  useEffect(() => {
    if (isOpen) {
      setStep(1)
      setFile(null)
      setSubjectId(defaultSubjectId || subjects[0]?.id || '')
      setDeckTitle('')
      setBusy(false)
      setStageText('')
      setUploadError('')
      setDraftCards([])
      setDraftProposals([])
      setImportProposals(true)
      setSavedDeck(null)
      setSavedCards([])
    }
  }, [isOpen, defaultSubjectId, subjects])

  if (!isOpen) return null

  const surface = darkMode ? 'bg-[#111F33] border-[#2A3B51] text-slate-100' : 'bg-white border-[#E7E9E5] text-[#173761]'
  const panel = darkMode ? 'bg-[#0B1525] border-[#2A3B51]' : 'bg-[#FAFAF7] border-[#E7E9E5]'
  const input = darkMode
    ? 'bg-[#0B1525] border-[#2A3B51] text-white focus:border-[#F5B82E]'
    : 'bg-[#FAFAF7] border-[#E7E9E5] text-[#173761] focus:border-[#173761]'
  const muted = darkMode ? 'text-slate-300' : 'text-slate-600'

  const handleAnalyzeFile = async (e) => {
    e.preventDefault()
    setUploadError('')
    if (!file) return setUploadError('Choose a reviewer file first.')
    if (!isValidUploadFile(file)) return setUploadError('Supported formats: PDF, PNG, JPG, and TXT.')
    if (file.size > 10 * 1024 * 1024) return setUploadError('Please choose a file smaller than 10 MB.')

    setBusy(true)
    setStageText('Uploading reviewer…')
    const resolvedMime = inferMimeType(file)
    const cleanDeckName = deckTitle.trim() || file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')

    let uploadedPath = ''
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      uploadedPath = `${session.user.id}/${crypto.randomUUID()}-${safeName}`
      const { error: storageErr } = await supabase.storage
        .from('study-uploads')
        .upload(uploadedPath, file, { contentType: resolvedMime, upsert: false })
      if (storageErr) throw storageErr

      setStageText('AI is generating questions, answers, and distractors…')
      const { data, error: fnError } = await supabase.functions.invoke('organize-study-upload', {
        body: { storagePath: uploadedPath, fileName: file.name, fileType: 'reviewer', mimeType: resolvedMime },
      })

      if (fnError) {
        let errMsg = fnError.message || 'Could not analyze this file.'
        try {
          const ctxBody = await fnError.context?.json?.()
          if (ctxBody?.error) errMsg = ctxBody.error
        } catch {
          // ignore
        }
        throw new Error(errMsg)
      }

      if (data?.error) {
        throw new Error(data.error)
      }

      const aiCards = Array.isArray(data?.cards) ? data.cards : []
      const aiProposals = Array.isArray(data?.proposals) ? data.proposals : []
      let generatedCards = []

      if (aiCards.length > 0) {
        const allAnswers = aiCards.map((c) => String(c.answer || '').trim())
        generatedCards = aiCards.map((c, idx) => ({
          tempId: `card-${idx}`,
          include: true,
          prompt: String(c.prompt || '').trim(),
          answer: String(c.answer || '').trim(),
          keyPointsText: Array.isArray(c.key_points) && c.key_points.length > 0
            ? c.key_points.join(' | ')
            : deriveKeyPoints(c.answer, c.prompt).join(' | '),
          distractors: Array.isArray(c.distractors) && c.distractors.length >= 3
            ? c.distractors.slice(0, 3)
            : buildPlausibleDistractors(c.answer, allAnswers),
        }))
      } else if (aiProposals.length > 0) {
        const allAnswers = aiProposals.map((p) => String(p.title || '').replace(/^(review|study|memorize)\s+/i, '').trim())
        generatedCards = aiProposals
          .map((p, idx) => {
            const rawTitle = String(p.title || '').trim()
            const rawNotes = String(p.notes || '').trim()
            const coreAnswer = rawTitle.replace(/^(review|study|memorize|understand|learn)\s+/i, '').trim() || rawTitle
            const questionPrompt = rawNotes
              ? `What concept from your reviewer is described here: "${rawNotes.slice(0, 140)}"?`
              : `Explain or identify the key concept: "${coreAnswer}"`
            const keyPoints = deriveKeyPoints(coreAnswer, rawNotes || p.source)
            const distractors = buildPlausibleDistractors(coreAnswer, allAnswers)

            return {
              tempId: `card-${idx}`,
              include: true,
              prompt: questionPrompt,
              answer: coreAnswer,
              keyPointsText: keyPoints.join(' | '),
              distractors,
            }
          })
          .filter((c) => c.answer)
      }

      if (generatedCards.length === 0) {
        throw new Error('No study questions could be extracted from this file. Try a clearer document or create cards manually below.')
      }

      const datedProposals = aiProposals.filter((p) => p.title && p.due_date)
      setDraftProposals(datedProposals)
      setDeckTitle(cleanDeckName)
      setDraftCards(generatedCards)
      setStep(2)
    } catch (err) {
      console.error('Upload reviewer error:', err)
      if (uploadedPath) {
        supabase.storage.from('study-uploads').remove([uploadedPath]).catch(() => {})
      }
      const message = err instanceof Error ? err.message : 'Could not analyze this reviewer file.'
      setUploadError(message)
      pushToast(message, 'error')
    } finally {
      setBusy(false)
      setStageText('')
    }
  }

  const startManualDeck = () => {
    const cleanDeckName = deckTitle.trim() || (file ? file.name.replace(/\.[^.]+$/, '') : 'Custom Study Deck')
    setDeckTitle(cleanDeckName)
    setUploadError('')
    setDraftCards([
      {
        tempId: `manual-${Date.now()}`,
        include: true,
        prompt: '',
        answer: '',
        keyPointsText: '',
        distractors: ['Option B', 'Option C', 'Option D'],
      },
    ])
    setStep(2)
  }

  const handleSaveDeck = async () => {
    const chosen = draftCards.filter((c) => c.include && c.prompt.trim() && c.answer.trim())
    if (!chosen.length) return pushToast('Include at least one card with both a question and answer.', 'error')

    setBusy(true)
    const finalTitle = deckTitle.trim() || 'Study Deck'
    const todayStr = ymd(new Date())

    try {
      const { data: deckRow, error: deckErr } = await supabase
        .from('decks')
        .insert([
          {
            user_id: session.user.id,
            subject_id: subjectId || null,
            title: finalTitle,
            reviewer_name: file?.name || null,
          },
        ])
        .select()
        .single()

      if (deckErr) throw deckErr

      const cardsPayload = chosen.map((c) => ({
        user_id: session.user.id,
        deck_id: deckRow.id,
        prompt: c.prompt.trim(),
        answer: c.answer.trim(),
        key_points: c.keyPointsText
          .split('|')
          .map((s) => s.trim())
          .filter(Boolean),
        distractors: c.distractors,
        due_date: todayStr,
        interval_days: 0,
        ease_factor: 2.5,
        reps: 0,
        is_mastered: false,
      }))

      const { data: insertedCards, error: cardsErr } = await supabase
        .from('cards')
        .insert(cardsPayload)
        .select()

      if (cardsErr) throw cardsErr

      let createdTopic = null
      if (subjectId) {
        const estMinutes = Math.max(15, chosen.length * 3)
        const { data: topicData } = await supabase
          .from('topics')
          .insert([
            {
              user_id: session.user.id,
              subject_id: subjectId,
              title: finalTitle,
              study_minutes: estMinutes,
              is_mastered: false,
            },
          ])
          .select()
          .single()
        if (topicData) createdTopic = topicData
      }

      let createdTasks = []
      if (importProposals && draftProposals.length > 0) {
        const taskPayload = draftProposals.map((p) => ({
          user_id: session.user.id,
          subject_id: subjectId || null,
          title: String(p.title).trim(),
          due_date: p.due_date || null,
          due_time: p.due_date && p.due_time ? p.due_time : null,
          priority: ['high', 'normal', 'low'].includes(p.priority) ? p.priority : 'normal',
          notes: setTaskBoardListNotes(p.notes || '', defaultBoardList || 'To Study'),
          is_done: false,
        }))
        const { data: tData } = await supabase.from('tasks').insert(taskPayload).select()
        if (tData) createdTasks = tData
      }

      setSavedDeck(deckRow)
      setSavedCards(insertedCards || [])
      onDeckSaved(deckRow, insertedCards || [], createdTopic, createdTasks)
      setStep(3)
      pushToast(`Saved deck "${finalTitle}" with ${insertedCards?.length || chosen.length} cards.`, 'success')
    } catch (err) {
      console.error('Error saving deck to database:', err)
      pushToast('Could not save deck. Make sure the decks & cards SQL script has been run in Supabase.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[92] flex items-center justify-center bg-[#0B1525]/70 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-wizard-title"
        className={`flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border shadow-2xl ${surface}`}
      >
        <div className={`flex items-center justify-between border-b px-6 py-4 ${darkMode ? 'border-[#2A3B51]' : 'border-[#E7E9E5]'}`}>
          <div>
            <h2 id="upload-wizard-title" className="text-lg font-bold">
              Upload Reviewer
            </h2>
            <p className={`text-xs ${muted}`}>
              Turn your reviewer or notes into an interactive Deck of Cards.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close wizard"
            className={`rounded-lg p-1.5 ${muted} hover:bg-slate-500/10`}
          >
            <X size={18} />
          </button>
        </div>

        <ol className={`grid grid-cols-3 border-b px-6 py-3 text-xs font-semibold ${darkMode ? 'border-[#2A3B51] bg-[#0B1525]/40' : 'border-[#E7E9E5] bg-[#FAFAF7]'}`}>
          {[
            [1, '1. Choose Reviewer'],
            [2, '2. Review Cards'],
            [3, '3. Start Studying'],
          ].map(([num, label]) => (
            <li key={num} className={`flex items-center gap-2 ${step === num ? 'font-bold text-[#B78116] dark:text-[#F5B82E]' : muted}`}>
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                  step >= num ? 'bg-[#173761] text-[#F5B82E]' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {step > num ? <Check size={12} strokeWidth={3} /> : num}
              </span>
              <span>{label}</span>
            </li>
          ))}
        </ol>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <form id="wizard-step1-form" onSubmit={handleAnalyzeFile} className="space-y-4">
              <label
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${panel} hover:border-[#F5B82E]`}
              >
                <input
                  type="file"
                  accept={ACCEPTED_FILES}
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null
                    setFile(f)
                    setUploadError('')
                    if (f && !deckTitle) {
                      setDeckTitle(f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '))
                    }
                  }}
                  className="sr-only"
                />
                {file ? (
                  <>
                    <FileText size={30} className="text-[#B78116] dark:text-[#F5B82E]" />
                    <span className="text-sm font-bold">{file.name}</span>
                    <span className={`text-xs ${muted}`}>{fmtSize(file.size)} · Click to replace file</span>
                  </>
                ) : (
                  <>
                    <Upload size={30} className="text-[#B78116] dark:text-[#F5B82E]" />
                    <span className="text-sm font-bold">Select your reviewer file (PDF, PNG, JPG, or TXT)</span>
                    <span className={`text-xs ${muted}`}>Up to 10 MB · AI will extract questions and answers into a Deck</span>
                  </>
                )}
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold">
                  Deck name
                  <input
                    type="text"
                    value={deckTitle}
                    onChange={(e) => setDeckTitle(e.target.value)}
                    placeholder="e.g. Networking Reviewer"
                    className={`mt-1 h-10 w-full rounded-lg border px-3 text-sm ${input}`}
                  />
                </label>

                <label className="block text-xs font-semibold">
                  Subject
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className={`mt-1 h-10 w-full rounded-lg border px-3 text-sm ${input}`}
                  >
                    <option value="">General / No subject</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {uploadError && (
                <div role="alert" className="rounded-xl border border-red-400/40 bg-red-500/10 p-3.5 text-xs font-semibold text-red-500">
                  <p>{uploadError}</p>
                  <button
                    type="button"
                    onClick={startManualDeck}
                    className="mt-2 underline text-[#173761] dark:text-[#F5B82E]"
                  >
                    Or create cards manually without AI →
                  </button>
                </div>
              )}

              {busy && (
                <div className={`flex items-center gap-3 rounded-xl border p-4 text-xs font-semibold ${panel}`}>
                  <RefreshCw size={16} className="animate-spin text-[#F5B82E]" />
                  <span>{stageText || 'Processing reviewer…'}</span>
                </div>
              )}
            </form>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {draftProposals.length > 0 && (
                <div className={`rounded-xl border p-3.5 ${panel}`}>
                  <label className="flex items-start gap-2.5 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={importProposals}
                      onChange={(e) => setImportProposals(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-[#173761]"
                    />
                    <span>
                      Also add <strong>{draftProposals.length} detected deadline(s)</strong> from this document to your Study Plan
                    </span>
                  </label>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold">
                    Review &amp; edit cards for &ldquo;{deckTitle}&rdquo; ({draftCards.filter((c) => c.include).length} cards)
                  </h3>
                  <p className={`text-xs ${muted}`}>
                    Uncheck any card you want to exclude before saving your deck.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setDraftCards((prev) => [
                      ...prev,
                      {
                        tempId: `custom-${Date.now()}`,
                        include: true,
                        prompt: '',
                        answer: '',
                        keyPointsText: '',
                        distractors: ['Alternative option A', 'Alternative option B', 'Alternative option C'],
                      },
                    ])
                  }
                  className="inline-flex h-9 items-center gap-1 rounded-lg border px-3 text-xs font-semibold"
                >
                  <Plus size={14} /> Add card
                </button>
              </div>

              <div className="space-y-3">
                {draftCards.map((c, idx) => (
                  <div key={c.tempId} className={`rounded-xl border p-4 ${panel}`}>
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-xs font-bold">
                        <input
                          type="checkbox"
                          checked={c.include}
                          onChange={(e) =>
                            setDraftCards((old) =>
                              old.map((item, i) => (i === idx ? { ...item, include: e.target.checked } : item)),
                            )
                          }
                          className="h-4 w-4 accent-[#173761]"
                        />
                        Include Card #{idx + 1}
                      </label>
                    </div>

                    <div className="mt-3 grid gap-3">
                      <label className="block text-xs font-semibold">
                        Question / Prompt
                        <input
                          type="text"
                          value={c.prompt}
                          onChange={(e) =>
                            setDraftCards((old) =>
                              old.map((item, i) => (i === idx ? { ...item, prompt: e.target.value } : item)),
                            )
                          }
                          className={`mt-1 h-9 w-full rounded-lg border px-3 text-sm ${input}`}
                        />
                      </label>
                      <label className="block text-xs font-semibold">
                        Answer (Term or Concept)
                        <input
                          type="text"
                          value={c.answer}
                          onChange={(e) =>
                            setDraftCards((old) =>
                              old.map((item, i) => (i === idx ? { ...item, answer: e.target.value } : item)),
                            )
                          }
                          className={`mt-1 h-9 w-full rounded-lg border px-3 text-sm ${input}`}
                        />
                      </label>
                      <label className="block text-xs font-semibold">
                        Key points for Blurting check (separate with |)
                        <input
                          type="text"
                          value={c.keyPointsText}
                          onChange={(e) =>
                            setDraftCards((old) =>
                              old.map((item, i) => (i === idx ? { ...item, keyPointsText: e.target.value } : item)),
                            )
                          }
                          className={`mt-1 h-9 w-full rounded-lg border px-3 text-xs ${input}`}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="py-8 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF4D6] text-[#8A5F0B]">
                <CheckCircle2 size={28} />
              </span>
              <h3 className="mt-4 text-xl font-bold">Deck saved and ready!</h3>
              <p className={`mx-auto mt-1 max-w-md text-sm ${muted}`}>
                <strong>{savedDeck?.title}</strong> now has <strong>{savedCards.length} cards</strong> scheduled for spaced repetition.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose()
                  if (savedDeck) onStartStudyingDeck(savedDeck, savedCards, true)
                }}
                className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-[#173761] px-6 text-sm font-semibold text-white transition hover:bg-[#244B7D]"
              >
                <Play size={16} fill="currentColor" className="text-[#F5B82E]" />
                Start studying now
              </button>
            </div>
          )}
        </div>

        <div className={`flex items-center justify-between border-t px-6 py-4 ${darkMode ? 'border-[#2A3B51]' : 'border-[#E7E9E5]'}`}>
          {step === 1 && (
            <>
              <button type="button" onClick={onClose} className={`h-10 rounded-lg border px-4 text-xs font-semibold ${panel}`}>
                Cancel
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={startManualDeck}
                  className={`h-10 rounded-lg border px-3.5 text-xs font-semibold ${panel}`}
                >
                  Create manually
                </button>
                <button
                  type="submit"
                  form="wizard-step1-form"
                  disabled={busy || !file}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#173761] px-5 text-sm font-semibold text-white disabled:opacity-40"
                >
                  <Sparkles size={15} className="text-[#F5B82E]" />
                  {busy ? 'Generating cards…' : 'Generate Cards →'}
                </button>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                className={`h-10 rounded-lg border px-4 text-xs font-semibold ${panel}`}
              >
                ← Back
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleSaveDeck}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#173761] px-5 text-sm font-semibold text-white disabled:opacity-40"
              >
                <Check size={16} />
                {busy ? 'Saving…' : 'Save Deck'}
              </button>
            </>
          )}
          {step === 3 && (
            <button type="button" onClick={onClose} className={`ml-auto h-10 rounded-lg border px-4 text-xs font-semibold ${panel}`}>
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ================================================================== */
/* Interactive Study Engine Modal                                      */
/* ================================================================== */

function DeckStudyModal({ deck, cards, subjectName, darkMode, todayStr, onClose, onSessionComplete }) {
  const [mode, setMode] = useState('flashcards')
  const [workingCards, setWorkingCards] = useState(() => (Array.isArray(cards) ? cards : []))
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [typedGuess, setTypedGuess] = useState('')
  const [ratingsByCard, setRatingsByCard] = useState({})
  const [diagnosticsByCard, setDiagnosticsByCard] = useState({})
  const [quizChoice, setQuizChoice] = useState(null)
  const [quizChecked, setQuizChecked] = useState(false)
  const [blurtInput, setBlurtInput] = useState('')
  const [blurtEvaluated, setBlurtEvaluated] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [saving, setSaving] = useState(false)

  const safeCards = workingCards.length > 0 ? workingCards : []
  const activeCard = safeCards[index] || safeCards[0] || { id: 'empty', prompt: '', answer: '', key_points: [], distractors: [] }

  const keyPoints = useMemo(() => {
    if (Array.isArray(activeCard.key_points) && activeCard.key_points.length > 0) {
      return activeCard.key_points
    }
    return deriveKeyPoints(activeCard.answer, activeCard.prompt)
  }, [activeCard])

  const shuffledMap = useMemo(() => {
    const map = {}
    safeCards.forEach((c) => {
      const distractors = Array.isArray(c.distractors) && c.distractors.length > 0
        ? c.distractors.slice(0, 3)
        : buildPlausibleDistractors(
            c.answer,
            safeCards.map((item) => item.answer),
          )
      const rawChoices = [
        { text: c.answer, isCorrect: true },
        ...distractors.map((d) => ({ text: d, isCorrect: false })),
      ]
      const mixed = shuffleArray(rawChoices)
      map[c.id] = {
        options: mixed.map((m) => m.text),
        correctIndex: mixed.findIndex((m) => m.isCorrect),
      }
    })
    return map
  }, [safeCards])

  const activeMcq = shuffledMap[activeCard.id] || { options: [activeCard.answer], correctIndex: 0 }
  const quizOptions = activeMcq.options
  const correctIndex = activeMcq.correctIndex

  const pointResults = useMemo(() => {
    const lower = blurtInput.toLowerCase()
    return keyPoints.map((kp) => {
      const significantWords = kp
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length >= 4)
      const hitCount = significantWords.filter((w) => lower.includes(w)).length
      const covered = significantWords.length === 0 ? lower.length >= 15 : hitCount >= Math.max(1, Math.ceil(significantWords.length * 0.4))
      return { kp, covered }
    })
  }, [blurtInput, keyPoints])

  if (!deck || safeCards.length === 0) return null

  const resetCardStep = (nextIdx) => {
    setIndex(nextIdx)
    setRevealed(false)
    setTypedGuess('')
    setQuizChoice(null)
    setQuizChecked(false)
    setBlurtInput('')
    setBlurtEvaluated(false)
  }

  const recordCardOutcome = (cardObj, rating, detailText) => {
    const nextRatings = { ...ratingsByCard, [cardObj.id]: rating }
    const nextDiag = {
      ...diagnosticsByCard,
      [cardObj.id]: {
        card: cardObj,
        rating,
        strong: rating === 'good' || rating === 'easy',
        detail: detailText,
      },
    }
    setRatingsByCard(nextRatings)
    setDiagnosticsByCard(nextDiag)

    if (index < safeCards.length - 1) {
      resetCardStep(index + 1)
    } else {
      setShowSummary(true)
    }
  }

  const xpPerCard = mode === 'blurting' ? 10 : mode === 'quiz' ? 8 : 5
  const strongCards = Object.values(diagnosticsByCard).filter((d) => d.strong)
  const weakCards = Object.values(diagnosticsByCard).filter((d) => !d.strong)
  const accuracyPct = safeCards.length ? Math.round((strongCards.length / safeCards.length) * 100) : 0
  const earnedXp = Math.max(10, strongCards.length * xpPerCard + weakCards.length * 2)

  const handleRetryWeakCards = () => {
    const weakList = weakCards.map((w) => w.card)
    if (!weakList.length) return
    setWorkingCards(weakList)
    setRatingsByCard({})
    setDiagnosticsByCard({})
    setShowSummary(false)
    resetCardStep(0)
  }

  const handleSaveAndFinish = async () => {
    setSaving(true)
    try {
      await onSessionComplete(deck, safeCards, ratingsByCard, mode, earnedXp, todayStr)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const surface = darkMode ? 'bg-[#111F33] border-[#2A3B51] text-slate-100' : 'bg-white border-[#E7E9E5] text-[#173761]'
  const panel = darkMode ? 'bg-[#0B1525] border-[#2A3B51]' : 'bg-[#FAFAF7] border-[#E7E9E5]'
  const input = darkMode
    ? 'bg-[#0B1525] border-[#2A3B51] text-white focus:border-[#F5B82E]'
    : 'bg-white border-[#E7E9E5] text-[#173761] focus:border-[#173761]'
  const muted = darkMode ? 'text-slate-300' : 'text-slate-600'

  return (
    <div className="fixed inset-0 z-[92] flex items-center justify-center bg-[#0B1525]/70 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="study-modal-heading"
        className={`flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border shadow-2xl ${surface}`}
      >
        <div className={`flex items-start justify-between gap-4 border-b px-6 py-4 ${darkMode ? 'border-[#2A3B51]' : 'border-[#E7E9E5]'}`}>
          <div>
            <p className={`text-xs font-semibold ${muted}`}>
              {subjectName || 'Study Deck'} ·{' '}
              {showSummary ? 'Session Diagnostic Summary' : `Card ${index + 1} of ${safeCards.length}`}
            </p>
            <h2 id="study-modal-heading" className="mt-0.5 text-lg font-bold">
              {deck.title}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close study session" className={`rounded-lg p-1.5 ${muted}`}>
            <X size={18} />
          </button>
        </div>

        {!showSummary && (
          <div className={`grid grid-cols-3 gap-2 border-b px-6 py-3 ${darkMode ? 'border-[#2A3B51] bg-[#0B1525]/40' : 'border-[#E7E9E5] bg-[#FAFAF7]'}`}>
            {[
              { key: 'flashcards', label: 'Flashcards (+5 pts)', icon: Layers },
              { key: 'quiz', label: 'Multiple Choice (+8 pts)', icon: HelpCircle },
              { key: 'blurting', label: 'Blurting (+10 pts)', icon: FileEdit },
            ].map((m) => {
              const Icon = m.icon
              const active = mode === m.key
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => {
                    setMode(m.key)
                    setRatingsByCard({})
                    setDiagnosticsByCard({})
                    resetCardStep(0)
                  }}
                  className={`flex items-center justify-center gap-2 rounded-lg border py-2 text-xs font-bold transition ${
                    active ? 'border-[#173761] bg-[#173761] text-white' : `${surface} hover:border-[#F5B82E]`
                  }`}
                >
                  <Icon size={14} className={active ? 'text-[#F5B82E]' : 'text-[#B78116]'} />
                  <span>{m.label}</span>
                </button>
              )
            })}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {showSummary ? (
            <div className="space-y-5">
              <div className="rounded-xl bg-[#173761] p-5 text-white">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F5B82E] px-3 py-0.5 text-xs font-bold text-[#173761]">
                      <Trophy size={13} /> +{earnedXp} XP Points Earned
                    </span>
                    <h3 className="mt-2 text-xl font-bold">
                      {accuracyPct >= 80
                        ? 'Great recall!'
                        : accuracyPct >= 50
                        ? 'Good progress — review your weak spots below.'
                        : 'Keep practicing — focus on the cards you missed.'}
                    </h3>
                    <p className="mt-0.5 text-xs text-white/80">
                      You got {strongCards.length} out of {safeCards.length} cards strong ({accuracyPct}% accuracy).
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-extrabold text-[#F5B82E]">{accuracyPct}%</span>
                    <span className="block text-xs text-white/75">Recall Score</span>
                  </div>
                </div>
              </div>

              <div className={`rounded-xl border p-4 ${panel}`}>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-red-500">
                    Needs Review / Where You Lacked ({weakCards.length})
                  </h4>
                  {weakCards.length > 0 && (
                    <button
                      type="button"
                      onClick={handleRetryWeakCards}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#173761] px-3 text-xs font-bold text-white"
                    >
                      <RotateCcw size={13} className="text-[#F5B82E]" /> Retry {weakCards.length} Weak Card(s)
                    </button>
                  )}
                </div>

                {weakCards.length === 0 ? (
                  <p className={`mt-2 text-xs ${muted}`}>
                    Zero weak spots in this round! All cards were answered accurately and scheduled for future spaced repetition.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2.5">
                    {weakCards.map(({ card, detail }) => (
                      <li key={card.id} className={`rounded-lg border p-3 text-xs ${surface}`}>
                        <p className="font-bold">{card.prompt}</p>
                        <p className="mt-1 text-[#B78116] dark:text-[#F5B82E]">
                          <strong>Correct Answer:</strong> {card.answer}
                        </p>
                        {detail && <p className={`mt-1 ${muted}`}>{detail}</p>}
                        <p className={`mt-1 text-[11px] font-semibold ${muted}`}>
                          Spaced Repetition: Scheduled again for immediate review today/tomorrow.
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {strongCards.length > 0 && (
                <div className={`rounded-xl border p-4 ${panel}`}>
                  <h4 className="text-sm font-bold text-[#B78116] dark:text-[#F5B82E]">
                    Strong / Mastered Concepts ({strongCards.length})
                  </h4>
                  <ul className="mt-2.5 space-y-1.5 text-xs">
                    {strongCards.map(({ card, rating }) => (
                      <li key={card.id} className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold">✓ {card.answer}</span>
                        <span className={muted}>
                          Next review in {rating === 'easy' ? '4+ days' : '2+ days'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <>
              {mode === 'flashcards' && (
                <div className="space-y-4">
                  <div className={`rounded-xl border p-5 ${panel}`}>
                    <p className="text-xs font-bold uppercase tracking-wider text-[#B78116] dark:text-[#F5B82E]">
                      Question
                    </p>
                    <p className="mt-2 text-base font-semibold leading-relaxed">{activeCard.prompt}</p>

                    <div className="mt-4">
                      <label className="block text-xs font-semibold">
                        Type your answer first to test active recall (optional)
                        <input
                          type="text"
                          value={typedGuess}
                          onChange={(e) => setTypedGuess(e.target.value)}
                          placeholder="Type what you remember…"
                          className={`mt-1 h-10 w-full rounded-lg border px-3 text-sm ${input}`}
                        />
                      </label>
                    </div>

                    {!revealed ? (
                      <button
                        type="button"
                        onClick={() => setRevealed(true)}
                        className="mt-4 h-10 w-full rounded-lg bg-[#173761] text-xs font-bold text-white transition hover:bg-[#244B7D]"
                      >
                        Reveal Answer &amp; Grade Recall
                      </button>
                    ) : (
                      <div className={`mt-4 rounded-xl border p-4 ${surface}`}>
                        <p className="text-xs font-bold uppercase tracking-wider text-[#B78116] dark:text-[#F5B82E]">
                          Correct Answer
                        </p>
                        <p className="mt-1 text-base font-bold">{activeCard.answer}</p>
                        {typedGuess.trim() && (
                          <p className={`mt-1 text-xs ${muted}`}>
                            Your typed answer: <strong>{typedGuess}</strong>
                          </p>
                        )}
                        {keyPoints.length > 0 && (
                          <ul className={`mt-2 list-disc space-y-1 pl-4 text-xs ${muted}`}>
                            {keyPoints.map((kp, i) => (
                              <li key={i}>{kp}</li>
                            ))}
                          </ul>
                        )}

                        <div className="mt-4 border-t pt-3 border-slate-200/60 dark:border-[#2A3B51]">
                          <p className={`mb-2 text-xs font-semibold ${muted}`}>
                            How well did you recall this? (Spaced Repetition schedules when this card returns):
                          </p>
                          <div className="grid grid-cols-4 gap-2">
                            {[
                              { key: 'again', label: 'Again', sub: 'Repeat today', note: 'Forgot concept — needs immediate review', style: 'border-slate-300 bg-[#FAFAF7] text-[#173761] dark:border-[#2A3B51] dark:bg-[#0B1525] dark:text-slate-200' },
                              { key: 'hard', label: 'Hard', sub: 'In 1 day', note: 'Partially recalled with difficulty', style: 'border-[#EBDDB0] bg-[#FFF8E3] text-[#8A5F0B]' },
                              { key: 'good', label: 'Good', sub: 'In 2+ days', note: 'Recalled accurately', style: 'border-[#173761] bg-[#173761] text-white' },
                              { key: 'easy', label: 'Easy', sub: 'In 4+ days', note: 'Mastered effortlessly', style: 'border-[#E6A51C] bg-[#F5B82E] text-[#173761]' },
                            ].map((btn) => (
                              <button
                                key={btn.key}
                                type="button"
                                onClick={() => recordCardOutcome(activeCard, btn.key, btn.note)}
                                className={`flex flex-col items-center rounded-lg border py-2 text-xs font-bold transition ${btn.style}`}
                              >
                                <span>{btn.label}</span>
                                <span className="text-xs font-normal opacity-80">{btn.sub}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {mode === 'quiz' && (
                <div className={`rounded-xl border p-5 ${panel}`}>
                  <p className="text-sm font-bold leading-relaxed">{activeCard.prompt}</p>
                  <div className="mt-4 space-y-2">
                    {quizOptions.map((opt, idx) => {
                      const isCorrect = idx === correctIndex
                      const isSelected = quizChoice === idx
                      let optStyle = surface
                      if (quizChecked) {
                        if (isCorrect) optStyle = 'border-[#E6A51C] bg-[#FFF8E3] text-[#173761]'
                        else if (isSelected) optStyle = 'border-red-400 bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-200'
                      } else if (isSelected) {
                        optStyle = 'border-[#173761] ring-2 ring-[#F5B82E]'
                      }
                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={quizChecked}
                          onClick={() => setQuizChoice(idx)}
                          className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-xs font-semibold transition ${optStyle}`}
                        >
                          <span>
                            <strong className="mr-2">{String.fromCharCode(65 + idx)}.</strong>
                            {opt}
                          </span>
                          {quizChecked && isCorrect && <span className="text-xs font-bold text-[#8A5F0B]">Correct</span>}
                        </button>
                      )
                    })}
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    {!quizChecked ? (
                      <button
                        type="button"
                        disabled={quizChoice === null}
                        onClick={() => setQuizChecked(true)}
                        className="h-9 rounded-lg bg-[#173761] px-4 text-xs font-bold text-white disabled:opacity-40"
                      >
                        Check Answer
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          const gotIt = quizChoice === correctIndex
                          recordCardOutcome(
                            activeCard,
                            gotIt ? 'good' : 'again',
                            gotIt
                              ? 'Answered correctly in Multiple Choice'
                              : `You chose "${quizOptions[quizChoice]}" instead of "${activeCard.answer}".`,
                          )
                        }}
                        className="h-9 rounded-lg bg-[#173761] px-4 text-xs font-bold text-white"
                      >
                        {index < safeCards.length - 1 ? 'Next Question →' : 'See Diagnostic Results →'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {mode === 'blurting' && (
                <div className={`rounded-xl border p-5 ${panel}`}>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#B78116] dark:text-[#F5B82E]">
                    Concept to Explain
                  </p>
                  <p className="mt-1 text-base font-bold">{activeCard.answer}</p>
                  <p className={`mt-1 text-xs ${muted}`}>{activeCard.prompt}</p>

                  <label className="mt-4 block text-xs font-semibold">
                    Explain this concept in your own words:
                    <textarea
                      rows={4}
                      value={blurtInput}
                      onChange={(e) => setBlurtInput(e.target.value)}
                      placeholder="Write the definition, how it works, and key details you remember…"
                      className={`mt-1.5 w-full rounded-lg border p-3 text-sm font-normal ${input}`}
                    />
                  </label>

                  {!blurtEvaluated ? (
                    <button
                      type="button"
                      disabled={blurtInput.trim().length < 10}
                      onClick={() => setBlurtEvaluated(true)}
                      className="mt-3 h-9 rounded-lg bg-[#173761] px-4 text-xs font-bold text-white disabled:opacity-40"
                    >
                      Check Explanation Against Key Points
                    </button>
                  ) : (
                    <div className={`mt-4 rounded-xl border p-4 ${surface}`}>
                      <p className="text-xs font-bold">Key Points Check:</p>
                      <ul className="mt-2 space-y-2 text-xs">
                        {pointResults.map((item, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span
                              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                item.covered ? 'bg-[#F5B82E] text-[#173761]' : 'bg-red-500/20 text-red-500'
                              }`}
                            >
                              {item.covered ? '✓' : '!'}
                            </span>
                            <span className={item.covered ? 'font-semibold' : muted}>
                              {item.kp} {!item.covered && <em className="text-red-400">(Missed in your explanation)</em>}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        onClick={() => {
                          const coveredCount = pointResults.filter((r) => r.covered).length
                          const missedList = pointResults.filter((r) => !r.covered).map((r) => r.kp)
                          const rating = coveredCount === pointResults.length ? 'good' : coveredCount > 0 ? 'hard' : 'again'
                          recordCardOutcome(
                            activeCard,
                            rating,
                            missedList.length
                              ? `Missed key point(s): ${missedList.join('; ')}`
                              : 'Covered all key points',
                          )
                        }}
                        className="mt-4 h-9 rounded-lg bg-[#173761] px-4 text-xs font-bold text-white"
                      >
                        {index < safeCards.length - 1 ? 'Next Card →' : 'See Diagnostic Results →'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className={`flex items-center justify-between border-t px-6 py-4 ${darkMode ? 'border-[#2A3B51]' : 'border-[#E7E9E5]'}`}>
          {!showSummary ? (
            <>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => resetCardStep(index - 1)}
                  className={`h-9 rounded-lg border px-3 text-xs font-semibold disabled:opacity-40 ${panel}`}
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setShowSummary(true)}
                  className={`h-9 rounded-lg border px-3 text-xs font-semibold ${panel}`}
                >
                  End Early &amp; View Results
                </button>
              </div>
              <span className={`text-xs font-semibold ${muted}`}>
                Answered: {Object.keys(ratingsByCard).length}/{safeCards.length}
              </span>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className={`h-10 rounded-lg border px-4 text-xs font-semibold ${panel}`}
              >
                Close without saving
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveAndFinish}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#173761] px-5 text-xs font-bold text-white transition hover:bg-[#244B7D] disabled:opacity-40"
              >
                <Check size={15} />
                {saving ? 'Saving…' : `Save Progress & Claim +${earnedXp} XP`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ================================================================== */
/* Main Dashboard Component                                            */
/* ================================================================== */

export default function Dashboard({ session, darkMode, onToggleTheme }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const rawView = searchParams.get('view')
  const initialView = VALID_VIEWS.includes(rawView) ? rawView : 'today'

  const today = ymd(new Date())

  const [view, setView] = useState(initialView)
  const [navCollapsed, setNavCollapsed] = useState(() => {
    try { return localStorage.getItem('kd-nav-collapsed') === '1' } catch { return false }
  })
  const [mobileNav, setMobileNav] = useState(false)
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false)
  const [uploadWizardOpen, setUploadWizardOpen] = useState(false)
  const [activeStudySession, setActiveStudySession] = useState(null)
  const [showSkillMap, setShowSkillMap] = useState(false)

  // Archive sets (When a list or item is archived, it disappears from the active view!)
  const [archivedDeckIds, setArchivedDeckIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('kayapp-archived-decks') || '[]') } catch { return [] }
  })
  const [archivedTaskIds, setArchivedTaskIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('kayapp-archived-tasks') || '[]') } catch { return [] }
  })
  const [archivedSubjectIds, setArchivedSubjectIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('kayapp-archived-subjects') || '[]') } catch { return [] }
  })
  const [archivedTopicIds, setArchivedTopicIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('kayapp-archived-topics') || '[]') } catch { return [] }
  })
  const [archivedListNames, setArchivedListNames] = useState(() => {
    try { return JSON.parse(localStorage.getItem('kayapp-archived-lists') || '[]') } catch { return [] }
  })

  // Study Workspace Lists (Defaults to To Study, In Progress, Completed matching mockup, fully customizable)
  const [customBoardLists, setCustomBoardLists] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('kayapp-board-lists') || 'null')
      return Array.isArray(saved) && saved.length > 0 ? saved : DEFAULT_STUDY_LISTS
    } catch {
      return DEFAULT_STUDY_LISTS
    }
  })

  const [createListModalOpen, setCreateListModalOpen] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [renamingList, setRenamingList] = useState('')
  const [renameListValue, setRenameListValue] = useState('')
  const [openListMenu, setOpenListMenu] = useState('')
  const [openTaskMenuId, setOpenTaskMenuId] = useState('')
  const [mobileActiveList, setMobileActiveList] = useState('all')

  // Study Plan Filter Bar State (Matching `image_be3a98.jpg`)
  const [planFilterSubject, setPlanFilterSubject] = useState('all')
  const [planSortDue, setPlanSortDue] = useState('due_asc')
  const [planSearch, setPlanSearch] = useState('')

  // Permanent delete confirmation modal (ONLY used inside Archive!)
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState(null)

  // Study Plan Task Creation State
  const [draggingTaskId, setDraggingTaskId] = useState(null)
  const [addingInList, setAddingInList] = useState('')
  const [viewingCard, setViewingCard] = useState(null)
  const [columnCardForm, setColumnCardForm] = useState({
    title: '',
    subject_id: '',
    due_date: '',
    priority: 'normal',
    notes: '',
  })

  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState([])
  const [subjects, setSubjects] = useState([])
  const [topics, setTopics] = useState([])
  const [prereqs, setPrereqs] = useState([])
  const [decks, setDecks] = useState([])
  const [cards, setCards] = useState([])
  const [decksTableReady, setDecksTableReady] = useState(true)

  const [subjectId, setSubjectId] = useState('')
  const [newSubjectName, setNewSubjectName] = useState('')
  const [newTopicTitle, setNewTopicTitle] = useState('')
  const [newTopicMinutes, setNewTopicMinutes] = useState('30')
  const [newTopicPrereqId, setNewTopicPrereqId] = useState('')

  const [passwordForm, setPasswordForm] = useState({ password: '', confirm: '' })
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [toasts, setToasts] = useState([])

  const avatarMenuRef = useRef(null)
  const subjectInputRef = useRef(null)
  const topicInputRef = useRef(null)
  const studyOrderRef = useRef(null)

  const pushToast = useCallback((message, type = 'info') => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id))
    }, 5000)
  }, [])

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((item) => item.id !== id))
  }, [])

  /* ---------- Archive Helpers ---------- */
  const toggleArchiveDeck = (deckId) => {
    setArchivedDeckIds((prev) => {
      const exists = prev.includes(deckId)
      const next = exists ? prev.filter((id) => id !== deckId) : [...prev, deckId]
      try { localStorage.setItem('kayapp-archived-decks', JSON.stringify(next)) } catch { /* ignore */ }
      pushToast(exists ? 'Deck restored to Library.' : 'Deck moved to Archive.', 'info')
      return next
    })
  }

  const toggleArchiveTask = (taskId) => {
    setOpenTaskMenuId('')
    setArchivedTaskIds((prev) => {
      const exists = prev.includes(taskId)
      const next = exists ? prev.filter((id) => id !== taskId) : [...prev, taskId]
      try { localStorage.setItem('kayapp-archived-tasks', JSON.stringify(next)) } catch { /* ignore */ }
      pushToast(exists ? 'Task restored to Study Plan.' : 'Task moved to Archive.', 'info')
      return next
    })
  }

  const toggleArchiveSubject = (subId) => {
    setArchivedSubjectIds((prev) => {
      const exists = prev.includes(subId)
      const next = exists ? prev.filter((id) => id !== subId) : [...prev, subId]
      try { localStorage.setItem('kayapp-archived-subjects', JSON.stringify(next)) } catch { /* ignore */ }
      pushToast(exists ? 'Subject restored to Library.' : 'Subject moved to Archive.', 'info')
      return next
    })
  }

  const toggleArchiveTopic = (topId) => {
    setArchivedTopicIds((prev) => {
      const exists = prev.includes(topId)
      const next = exists ? prev.filter((id) => id !== topId) : [...prev, topId]
      try { localStorage.setItem('kayapp-archived-topics', JSON.stringify(next)) } catch { /* ignore */ }
      pushToast(exists ? 'Topic restored to Study Path.' : 'Topic moved to Archive.', 'info')
      return next
    })
  }

  // Archiving a list completely hides the list AND archives its tasks so it truly disappears from the board!
  const toggleArchiveBoardList = (listName) => {
    setOpenListMenu('')
    const isCurrentlyArchived = archivedListNames.includes(listName)

    if (!isCurrentlyArchived) {
      const nextLists = [...archivedListNames, listName]
      setArchivedListNames(nextLists)
      try { localStorage.setItem('kayapp-archived-lists', JSON.stringify(nextLists)) } catch { /* ignore */ }

      // Also archive tasks belonging to this list so they don't leak into other columns
      const taskIdsInList = tasks
        .filter((tk) => getTaskBoardList(tk) === listName)
        .map((tk) => tk.id)

      if (taskIdsInList.length > 0) {
        setArchivedTaskIds((prev) => {
          const merged = Array.from(new Set([...prev, ...taskIdsInList]))
          try { localStorage.setItem('kayapp-archived-tasks', JSON.stringify(merged)) } catch { /* ignore */ }
          return merged
        })
      }
      if (mobileActiveList === listName) setMobileActiveList('all')
      pushToast(`Archived list "${listName}". You can restore it anytime from Archive.`, 'info')
    } else {
      const nextLists = archivedListNames.filter((n) => n !== listName)
      setArchivedListNames(nextLists)
      try { localStorage.setItem('kayapp-archived-lists', JSON.stringify(nextLists)) } catch { /* ignore */ }

      // Restore tasks belonging to this list
      const taskIdsInList = new Set(
        tasks.filter((tk) => getTaskBoardList(tk) === listName).map((tk) => tk.id),
      )
      if (taskIdsInList.size > 0) {
        setArchivedTaskIds((prev) => {
          const filtered = prev.filter((id) => !taskIdsInList.has(id))
          try { localStorage.setItem('kayapp-archived-tasks', JSON.stringify(filtered)) } catch { /* ignore */ }
          return filtered
        })
      }
      pushToast(`Restored list "${listName}" to Study Plan.`, 'success')
    }
  }

  const handleConfirmPermanentDelete = async () => {
    if (!permanentDeleteTarget) return
    const { type, item } = permanentDeleteTarget
    setPermanentDeleteTarget(null)

    try {
      if (type === 'deck') {
        setDecks((prev) => prev.filter((d) => d.id !== item.id))
        setCards((prev) => prev.filter((c) => c.deck_id !== item.id))
        setArchivedDeckIds((prev) => prev.filter((id) => id !== item.id))
        await supabase.from('decks').delete().eq('id', item.id)
        pushToast(`Permanently deleted deck "${item.title}".`, 'info')
      } else if (type === 'task') {
        setTasks((prev) => prev.filter((tk) => tk.id !== item.id))
        setArchivedTaskIds((prev) => prev.filter((id) => id !== item.id))
        await supabase.from('tasks').delete().eq('id', item.id)
        pushToast(`Permanently deleted task "${item.title}".`, 'info')
      } else if (type === 'subject') {
        setSubjects((prev) => prev.filter((s) => s.id !== item.id))
        setTopics((prev) => prev.filter((tp) => tp.subject_id !== item.id))
        setArchivedSubjectIds((prev) => prev.filter((id) => id !== item.id))
        await supabase.from('subjects').delete().eq('id', item.id)
        pushToast(`Permanently deleted subject "${item.name}".`, 'info')
      } else if (type === 'topic') {
        setTopics((prev) => prev.filter((tp) => tp.id !== item.id))
        setPrereqs((prev) => prev.filter((p) => p.topic_id !== item.id && p.prerequisite_id !== item.id))
        setArchivedTopicIds((prev) => prev.filter((id) => id !== item.id))
        await supabase.from('topics').delete().eq('id', item.id)
        pushToast(`Permanently deleted topic "${item.title}".`, 'info')
      } else if (type === 'list') {
        const listName = item.name
        const tasksInList = tasks.filter((tk) => getTaskBoardList(tk) === listName)
        for (const tk of tasksInList) {
          await supabase.from('tasks').delete().eq('id', tk.id)
        }
        setTasks((prev) => prev.filter((tk) => getTaskBoardList(tk) !== listName))
        setCustomBoardLists((prev) => {
          const next = prev.filter((n) => n !== listName)
          try { localStorage.setItem('kayapp-board-lists', JSON.stringify(next)) } catch { /* ignore */ }
          return next
        })
        setArchivedListNames((prev) => {
          const next = prev.filter((n) => n !== listName)
          try { localStorage.setItem('kayapp-archived-lists', JSON.stringify(next)) } catch { /* ignore */ }
          return next
        })
        pushToast(`Permanently deleted list "${listName}".`, 'info')
      }
    } catch (err) {
      console.error('Permanent delete error:', err)
      pushToast('Could not delete item permanently.', 'error')
    }
  }

  const goTo = useCallback(
    (nextKey) => {
      if (!VALID_VIEWS.includes(nextKey)) return
      setView(nextKey)
      setSearchParams(
        (cur) => {
          const next = new URLSearchParams(cur)
          next.set('view', nextKey)
          return next
        },
        { replace: true },
      )
      setMobileNav(false)
      setAvatarMenuOpen(false)
    },
    [setSearchParams],
  )

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target)) {
        setAvatarMenuOpen(false)
      }
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [tRes, sRes, tpRes, pRes, dRes, cRes] = await Promise.all([
        supabase.from('tasks').select('*').order('created_at', { ascending: false }),
        supabase.from('subjects').select('*').order('created_at', { ascending: false }),
        supabase.from('topics').select('*').order('created_at', { ascending: false }),
        supabase.from('topic_prerequisites').select('*').order('created_at', { ascending: false }),
        supabase.from('decks').select('*').order('created_at', { ascending: false }),
        supabase.from('cards').select('*').order('created_at', { ascending: true }),
      ])

      setTasks(tRes.data || [])
      setSubjects(sRes.data || [])
      setTopics(tpRes.data || [])
      setPrereqs(pRes.data || [])

      if (dRes.error || cRes.error) {
        setDecksTableReady(false)
      } else {
        setDecksTableReady(true)
        setDecks(dRes.data || [])
        setCards(cRes.data || [])
      }

      if (sRes.data?.length > 0) {
        setSubjectId((cur) => cur || sRes.data[0].id)
      }
    } catch (err) {
      console.error('Error loading workspace:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (session) loadAll()
  }, [session, loadAll])

  const email = session?.user?.email || ''
  const meta = session?.user?.user_metadata || {}
  const fullName = (
    meta.full_name ||
    meta.name ||
    meta.display_name ||
    [meta.first_name, meta.last_name].filter(Boolean).join(' ')
  ).trim()
  const firstName = fullName.split(' ')[0]
  const initial = (fullName || email).charAt(0) || '?'

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  /* ---------- Active vs Archived Filtering ---------- */
  const activeSubjects = useMemo(
    () => subjects.filter((s) => !archivedSubjectIds.includes(s.id)),
    [subjects, archivedSubjectIds],
  )
  const archivedSubjects = useMemo(
    () => subjects.filter((s) => archivedSubjectIds.includes(s.id)),
    [subjects, archivedSubjectIds],
  )

  useEffect(() => {
    if (activeSubjects.length > 0 && !activeSubjects.some((s) => s.id === subjectId)) {
      setSubjectId(activeSubjects[0].id)
    }
  }, [activeSubjects, subjectId])

  const activeDecks = useMemo(
    () => decks.filter((d) => !archivedDeckIds.includes(d.id) && !archivedSubjectIds.includes(d.subject_id)),
    [decks, archivedDeckIds, archivedSubjectIds],
  )
  const archivedDecks = useMemo(
    () => decks.filter((d) => archivedDeckIds.includes(d.id)),
    [decks, archivedDeckIds],
  )

  // Exclude tasks that are archived OR belong to an archived list!
  const activeTasks = useMemo(
    () =>
      tasks.filter(
        (tk) =>
          !archivedTaskIds.includes(tk.id) &&
          !archivedListNames.includes(getTaskBoardList(tk)),
      ),
    [tasks, archivedTaskIds, archivedListNames],
  )
  const archivedTasks = useMemo(
    () => tasks.filter((tk) => archivedTaskIds.includes(tk.id)),
    [tasks, archivedTaskIds],
  )

  const visibleTopics = useMemo(
    () => topics.filter((tp) => !archivedTopicIds.includes(tp.id)),
    [topics, archivedTopicIds],
  )
  const archivedTopicsList = useMemo(
    () => topics.filter((tp) => archivedTopicIds.includes(tp.id)),
    [topics, archivedTopicIds],
  )

  // Active Board Lists (Excludes any archived list names!)
  const allBoardLists = useMemo(() => {
    const discovered = []
    activeTasks.forEach((tk) => {
      const lName = getTaskBoardList(tk)
      if (lName && !customBoardLists.includes(lName) && !discovered.includes(lName)) {
        discovered.push(lName)
      }
    })
    const combined = [...customBoardLists, ...discovered]
    return combined.filter((name) => !archivedListNames.includes(name))
  }, [customBoardLists, activeTasks, archivedListNames])

  const subjectStyles = useMemo(() => {
    const map = {}
    subjects.forEach((s, idx) => {
      map[s.id] = getSubjectStyle(s.id, idx)
    })
    return map
  }, [subjects])

  const cardsByDeck = useMemo(() => {
    const map = {}
    cards.forEach((c) => {
      ;(map[c.deck_id] ||= []).push(c)
    })
    return map
  }, [cards])

  const activeCards = useMemo(
    () => activeDecks.flatMap((d) => cardsByDeck[d.id] || []),
    [activeDecks, cardsByDeck],
  )

  const dueCardsToday = useMemo(
    () => activeCards.filter((c) => !c.due_date || c.due_date <= today),
    [activeCards, today],
  )

  const masteredCardsCount = useMemo(
    () => cards.filter((c) => c.is_mastered).length,
    [cards],
  )

  const nextStudyDeck = useMemo(() => {
    if (activeDecks.length === 0) return null
    const withDue = activeDecks.find((d) => (cardsByDeck[d.id] || []).some((c) => !c.due_date || c.due_date <= today))
    return withDue || activeDecks[0]
  }, [activeDecks, cardsByDeck, today])

  const sortTasks = useCallback(
    (list) =>
      [...list].sort(
        (a, b) =>
          (a.due_date || '9999').localeCompare(b.due_date || '9999') ||
          PRIORITY[a.priority || 'normal'] - PRIORITY[b.priority || 'normal'],
      ),
    [],
  )

  const todaysDeadlines = useMemo(
    () => sortTasks(activeTasks.filter((x) => x.due_date === today)),
    [activeTasks, today, sortTasks],
  )
  const overdueDeadlines = useMemo(
    () => sortTasks(activeTasks.filter((x) => !x.is_done && x.due_date && x.due_date < today)),
    [activeTasks, today, sortTasks],
  )

  /* ---------- Real Database Study Path Topics ---------- */
  const topicsById = useMemo(() => Object.fromEntries(visibleTopics.map((x) => [x.id, x])), [visibleTopics])
  const activeTopics = useMemo(
    () => visibleTopics.filter((x) => x.subject_id === subjectId),
    [visibleTopics, subjectId],
  )
  const ids = useMemo(() => activeTopics.map((x) => x.id), [activeTopics])
  const idSet = useMemo(() => new Set(ids), [ids])
  const pick = useCallback((v) => (idSet.has(v) ? v : ''), [idSet])

  const edges = useMemo(
    () =>
      prereqs
        .filter((p) => idSet.has(p.topic_id) && idSet.has(p.prerequisite_id))
        .map((p) => ({ from: p.prerequisite_id, to: p.topic_id })),
    [prereqs, idSet],
  )

  const minutes = useMemo(() => Object.fromEntries(visibleTopics.map((x) => [x.id, x.study_minutes ?? 30])), [visibleTopics])
  const titleOf = useCallback((id) => topicsById[id]?.title ?? '', [topicsById])

  const needsOf = useMemo(() => {
    const map = new Map(ids.map((id) => [id, []]))
    edges.forEach((e) => map.get(e.to)?.push(e.from))
    return map
  }, [ids, edges])

  const status = useMemo(
    () =>
      Object.fromEntries(
        activeTopics.map((x) => [
          x.id,
          x.is_mastered ? 'done' : needsOf.get(x.id)?.every((p) => topicsById[p]?.is_mastered) ? 'ready' : 'locked',
        ]),
      ),
    [activeTopics, needsOf, topicsById],
  )

  const layer = useMemo(() => layerOf(ids, edges), [ids, edges])
  const sorted = useMemo(() => topologicalSort(ids, edges), [ids, edges])
  const masteredTopicsCount = useMemo(() => visibleTopics.filter((x) => x.is_mastered).length, [visibleTopics])

  // Points / XP calculation
  const deckXpTotal = useMemo(() => decks.reduce((s, d) => s + (Number(d.xp_awarded) || 0), 0), [decks])
  const tasksDoneCount = useMemo(() => tasks.filter((x) => x.is_done).length, [tasks])
  const xp = deckXpTotal + masteredTopicsCount * 25 + tasksDoneCount * 5
  const level = Math.floor(xp / 100) + 1

  const t = {
    bg: darkMode ? 'bg-[#0B1525] text-slate-100' : 'bg-[#FAFAF7] text-[#173761]',
    sidebar: darkMode ? 'border-[#2A3B51] bg-[#101D30]' : 'border-[#ECECE6] bg-[#FBF9F3]',
    header: darkMode ? 'border-[#2A3B51] bg-[#0B1525]/90' : 'border-[#ECECE6] bg-[#FAFAF7]/90',
    card: darkMode
      ? 'bg-[#111F33] border-[#2A3B51] shadow-sm'
      : 'bg-white border-[#ECECE6] shadow-[0_10px_30px_-18px_rgba(23,55,97,0.10)]',
    panel: darkMode ? 'border-[#2A3B51] bg-[#0B1525]' : 'border-[#ECECE6] bg-[#FAFAF7]',
    divider: darkMode ? 'border-[#2A3B51]' : 'border-[#ECECE6]',
    row: darkMode
      ? 'border-[#2A3B51] bg-[#0B1525] hover:border-[#D6B75E]'
      : 'border-[#ECECE6] bg-[#FAFAF7] hover:border-[#D6B75E]',
    input: darkMode
      ? 'bg-[#0B1525] border-[#2A3B51] text-white focus:border-[#F5B82E]'
      : 'bg-[#FAFAF7] border-[#E7E9E5] text-[#173761] focus:border-[#173761]',
    muted: darkMode ? 'text-slate-300' : 'text-slate-500',
    danger: darkMode ? 'text-red-400' : 'text-red-600',
    gold: darkMode ? 'text-[#F5B82E]' : 'text-[#B78116]',
    track: darkMode ? 'bg-[#0B1525]' : 'bg-[#E9EDF2]',
    ghost: darkMode ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-[#173761]',
    btn: 'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#173761] px-4 text-sm font-semibold text-white transition hover:bg-[#244B7D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] disabled:opacity-50',
    btnSecondary: `inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] ${
      darkMode ? 'border-[#2A3B51] bg-[#0B1525] text-slate-200 hover:border-[#D6B75E]' : 'border-[#E7E9E5] bg-[#FAFAF7] text-[#173761] hover:border-[#D6B75E]'
    }`,
    archiveBtn: 'rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-amber-500/10 hover:text-[#B78116] dark:hover:text-[#F5B82E] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E]',
  }
  const field = `h-10 w-full rounded-lg border px-3 text-sm transition focus:outline-none focus:ring-1 focus:ring-[#F5B82E] ${t.input}`

  const handleDeckSaved = (newDeck, newCards, createdTopic, createdTasks) => {
    setDecks((prev) => [newDeck, ...prev])
    setCards((prev) => [...prev, ...newCards])
    if (createdTopic) setTopics((prev) => [createdTopic, ...prev])
    if (createdTasks?.length) setTasks((prev) => [...createdTasks, ...prev])
  }

  const startStudyingDeck = (deck, deckCardsList, forceAll = false) => {
    const list = deckCardsList || cardsByDeck[deck.id] || []
    if (!list.length) {
      return pushToast('This deck has no cards yet.', 'error')
    }
    const dueOnly = list.filter((c) => !c.due_date || c.due_date <= today)
    const sessionList = !forceAll && dueOnly.length > 0 ? dueOnly : list
    setActiveStudySession({ deck, cards: sessionList })
  }

  const handleSessionComplete = async (deck, sessionCards, ratingsMap, methodKey, earnedXp, todayStr) => {
    const updatePromises = sessionCards.map(async (c) => {
      const rating = ratingsMap[c.id] || 'good'
      const patch = computeNextReview(c, rating, todayStr)
      const { data, error } = await supabase
        .from('cards')
        .update(patch)
        .eq('id', c.id)
        .select()
        .single()
      return !error && data ? data : { ...c, ...patch }
    })

    const updatedCards = await Promise.all(updatePromises)

    const nextXp = (Number(deck.xp_awarded) || 0) + earnedXp
    await supabase
      .from('decks')
      .update({
        study_method: methodKey,
        xp_awarded: nextXp,
        last_studied_at: new Date().toISOString(),
      })
      .eq('id', deck.id)

    const updatedMap = new Map(updatedCards.map((c) => [c.id, c]))
    const nextAllCards = cards.map((c) => updatedMap.get(c.id) || c)
    setCards(nextAllCards)
    setDecks((prev) =>
      prev.map((d) =>
        d.id === deck.id
          ? { ...d, study_method: methodKey, xp_awarded: nextXp, last_studied_at: new Date().toISOString() }
          : d,
      ),
    )

    const thisDeckCards = nextAllCards.filter((c) => c.deck_id === deck.id)
    if (thisDeckCards.length > 0 && thisDeckCards.every((c) => c.is_mastered)) {
      const matchingTopic = topics.find(
        (tp) => tp.subject_id === deck.subject_id && tp.title.toLowerCase() === deck.title.toLowerCase(),
      )
      if (matchingTopic && !matchingTopic.is_mastered) {
        await supabase.from('topics').update({ is_mastered: true }).eq('id', matchingTopic.id)
        setTopics((prev) => prev.map((tp) => (tp.id === matchingTopic.id ? { ...tp, is_mastered: true } : tp)))
      }
    }

    pushToast(`Saved session! You earned +${earnedXp} XP points.`, 'success')
  }

  /* ---------- Study Plan Workspace List & Task Actions ---------- */
  const handleCreateBoardList = (e) => {
    e.preventDefault()
    const clean = newListName.trim()
    if (!clean) return
    if (allBoardLists.some((l) => l.toLowerCase() === clean.toLowerCase())) {
      return pushToast('A list with that name already exists.', 'error')
    }
    setCustomBoardLists((prev) => {
      const next = [...prev, clean]
      try { localStorage.setItem('kayapp-board-lists', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
    // If it was previously archived, unarchive it
    if (archivedListNames.includes(clean)) {
      setArchivedListNames((prev) => {
        const next = prev.filter((n) => n !== clean)
        try { localStorage.setItem('kayapp-archived-lists', JSON.stringify(next)) } catch { /* ignore */ }
        return next
      })
    }
    setNewListName('')
    setCreateListModalOpen(false)
    setMobileActiveList(clean)
    pushToast(`Created list "${clean}".`, 'success')
  }

  const handleRenameBoardList = async (oldName) => {
    const clean = renameListValue.trim()
    setRenamingList('')
    if (!clean || clean === oldName) return
    setCustomBoardLists((prev) => {
      const next = prev.map((n) => (n === oldName ? clean : n))
      if (!next.includes(clean)) next.push(clean)
      try { localStorage.setItem('kayapp-board-lists', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
    const affected = tasks.filter((tk) => getTaskBoardList(tk) === oldName)
    for (const tk of affected) {
      const updatedNotes = setTaskBoardListNotes(tk.notes, clean)
      await supabase.from('tasks').update({ notes: updatedNotes }).eq('id', tk.id)
    }
    setTasks((prev) =>
      prev.map((tk) =>
        getTaskBoardList(tk) === oldName ? { ...tk, notes: setTaskBoardListNotes(tk.notes, clean) } : tk,
      ),
    )
    if (mobileActiveList === oldName) setMobileActiveList(clean)
    pushToast(`Renamed list to "${clean}".`, 'success')
  }

  const moveTaskToBoardList = async (task, targetListName) => {
    setOpenTaskMenuId('')
    const markDone = isCompletedListName(targetListName)
    const updatedNotes = setTaskBoardListNotes(task.notes, targetListName)
    setTasks((prev) =>
      prev.map((x) => (x.id === task.id ? { ...x, is_done: markDone, notes: updatedNotes } : x)),
    )
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ is_done: markDone, notes: updatedNotes })
        .eq('id', task.id)
      if (error) throw error
      if (markDone && !task.is_done) {
        pushToast(`Completed "${task.title}"! +5 XP points.`, 'success')
      }
    } catch (err) {
      setTasks((prev) => prev.map((x) => (x.id === task.id ? task : x)))
      pushToast('Could not move task.', 'error')
    }
  }

  const handleAddBoardCard = async (e, listName) => {
    e.preventDefault()
    if (!columnCardForm.title.trim()) return
    const markDone = isCompletedListName(listName)
    const payload = {
      user_id: session.user.id,
      title: columnCardForm.title.trim(),
      subject_id: columnCardForm.subject_id || null,
      due_date: columnCardForm.due_date || null,
      priority: columnCardForm.priority || 'normal',
      notes: setTaskBoardListNotes(columnCardForm.notes || '', listName),
      is_done: markDone,
    }
    try {
      const { data, error } = await supabase.from('tasks').insert([payload]).select()
      if (error) throw error
      setTasks((prev) => [data[0], ...prev])
      setColumnCardForm({ title: '', subject_id: '', due_date: '', priority: 'normal', notes: '' })
      setAddingInList('')
      pushToast(`Added task to "${listName}".`, 'success')
    } catch (err) {
      pushToast('Could not add task to list.', 'error')
    }
  }

  const toggleTask = async (task) => {
    const nextDone = !task.is_done
    const currentList = getTaskBoardList(task)
    let targetList = currentList
    if (nextDone && allBoardLists.includes('Completed')) {
      targetList = 'Completed'
    } else if (!nextDone && isCompletedListName(currentList) && allBoardLists.length > 0) {
      targetList = allBoardLists.find((l) => !isCompletedListName(l)) || allBoardLists[0]
    }
    const updatedNotes = setTaskBoardListNotes(task.notes, targetList)

    setTasks((prev) =>
      prev.map((x) => (x.id === task.id ? { ...x, is_done: nextDone, notes: updatedNotes } : x)),
    )
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ is_done: nextDone, notes: updatedNotes })
        .eq('id', task.id)
      if (error) throw error
      if (nextDone) pushToast('Task completed! +5 XP points.', 'success')
    } catch (err) {
      setTasks((prev) => prev.map((x) => (x.id === task.id ? task : x)))
    }
  }

  const addSubject = async (e) => {
    e.preventDefault()
    if (!newSubjectName.trim()) return
    try {
      const { data, error } = await supabase
        .from('subjects')
        .insert([{ name: newSubjectName.trim(), user_id: session.user.id }])
        .select()
      if (error) throw error
      setSubjects((prev) => [data[0], ...prev])
      setNewSubjectName('')
      setSubjectId(data[0].id)
      pushToast(`Added subject "${data[0].name}".`, 'success')
    } catch (err) {
      pushToast('Could not add subject.', 'error')
    }
  }

  const addTopic = async (e) => {
    e.preventDefault()
    if (!newTopicTitle.trim() || !subjectId) return
    const mins = Math.max(5, Number.parseInt(newTopicMinutes, 10) || 30)
    const prereqTarget = pick(newTopicPrereqId)
    try {
      const { data, error } = await supabase
        .from('topics')
        .insert([{ title: newTopicTitle.trim(), subject_id: subjectId, user_id: session.user.id, study_minutes: mins }])
        .select()
      if (error) throw error
      const created = data[0]
      setTopics((prev) => [created, ...prev])

      if (prereqTarget) {
        const { data: pData } = await supabase
          .from('topic_prerequisites')
          .insert([{ topic_id: created.id, prerequisite_id: prereqTarget, user_id: session.user.id }])
          .select()
        if (pData?.[0]) setPrereqs((prev) => [pData[0], ...prev])
      }
      setNewTopicTitle('')
      setNewTopicMinutes('30')
      setNewTopicPrereqId('')
      pushToast(`Topic "${created.title}" added to ${subjects.find((s) => s.id === subjectId)?.name || 'subject'}.`, 'success')
    } catch (err) {
      pushToast('Could not add topic.', 'error')
    }
  }

  const toggleTopicMastered = async (id) => {
    const tp = topicsById[id]
    if (!tp) return
    if (!tp.is_mastered && status[id] === 'locked') {
      const missing = (needsOf.get(id) || []).filter((p) => !topicsById[p]?.is_mastered).map(titleOf)
      return pushToast(`Finish ${missing.join(', ')} first to unlock "${tp.title}".`, 'error')
    }
    const nextVal = !tp.is_mastered
    setTopics((prev) => prev.map((x) => (x.id === id ? { ...x, is_mastered: nextVal } : x)))
    await supabase.from('topics').update({ is_mastered: nextVal }).eq('id', id)
    if (nextVal) pushToast(`Mastered "${tp.title}"! +25 XP points.`, 'success')
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const renderSubjectBadge = (subId) => {
    const sub = subjects.find((s) => s.id === subId)
    if (!sub) return null
    const st = subjectStyles[sub.id] || SUBJECT_BADGES[0]
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-bold ${
          darkMode ? st.dark : st.light
        }`}
      >
        {sub.name}
      </span>
    )
  }

  const renderTaskRow = (task) => {
    const overdue = !task.is_done && task.due_date && task.due_date < today
    const listName = getTaskBoardList(task)
    return (
      <li key={task.id} className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 transition ${t.row}`}>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={() => toggleTask(task)}
            aria-label={task.is_done ? `Mark "${task.title}" as undone` : `Mark "${task.title}" as done`}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
              task.is_done
                ? 'border-[#173761] bg-[#173761] text-[#F5B82E]'
                : darkMode
                ? 'border-slate-500 bg-transparent'
                : 'border-slate-300 bg-white'
            }`}
          >
            {task.is_done && <Check size={13} strokeWidth={3} />}
          </button>
          <div className="min-w-0 flex-1">
            <p className={`truncate text-sm font-semibold ${task.is_done ? `${t.muted} line-through` : ''}`}>
              {task.title}
            </p>
            <div className={`mt-1 flex flex-wrap items-center gap-2 text-xs ${t.muted}`}>
              {renderSubjectBadge(task.subject_id)}
              {listName && <span className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-bold dark:bg-white/10">{listName}</span>}
              {task.due_date && <span>{task.due_date === today ? 'Today' : fmtFullDate(task.due_date)}</span>}
              {overdue && <span className={`font-semibold ${t.danger}`}>Overdue</span>}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => toggleArchiveTask(task.id)}
          title="Move to Archive"
          aria-label={`Archive ${task.title}`}
          className={t.archiveBtn}
        >
          <Archive size={15} />
        </button>
      </li>
    )
  }

  /* ================================================================ */
  /* VIEW 1: TODAY                                                     */
  /* ================================================================ */

  const renderTodayView = () => {
    const hasDecks = activeDecks.length > 0
    const nextDeckCards = nextStudyDeck ? cardsByDeck[nextStudyDeck.id] || [] : []
    const nextDeckDueCount = nextDeckCards.filter((c) => !c.due_date || c.due_date <= today).length
    const currentSubject = activeSubjects.find((s) => s.id === subjectId)

    const realJourneyNodes = sorted.order.map((id) => ({
      id,
      title: titleOf(id),
      state: status[id] || 'ready',
      mins: minutes[id] ?? 30,
    }))

    return (
      <div className="space-y-6">
        {!decksTableReady && (
          <div className="rounded-xl border border-[#EBDDB0] bg-[#FFF8E3] p-4 text-xs font-semibold text-[#8A5F0B]">
            Database upgrade required: Run the new <code>decks</code> and <code>cards</code> SQL script in your Supabase SQL Editor so your uploaded reviewers and spaced repetition cards can be saved.
          </div>
        )}

        {/* 1. Hero Banner */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#173761] via-[#1B3F6E] to-[#132C4E] p-6 text-white shadow-[0_20px_50px_-24px_rgba(23,55,97,0.75)] sm:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-16 -right-16 h-64 w-64 rounded-full bg-[#F5B82E]/25 blur-3xl"
          />

          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#F5B82E]">
                <CalendarDays size={14} aria-hidden="true" />
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              <h2 className="mt-2 font-serif text-3xl font-bold tracking-tight sm:text-4xl">
                {greeting}
                {firstName ? `, ${firstName}` : ''}.
              </h2>
              <p className="mt-1 text-sm text-white/80">
                Small steps today, big progress tomorrow.
              </p>
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-bold text-[#F5B82E] backdrop-blur-xs">
              <Trophy size={13} /> Level {level} · {xp} XP pts
            </span>
          </div>

          <div className="relative mt-6 flex flex-col justify-between gap-6 rounded-2xl border border-white/15 bg-white/[0.06] p-5 backdrop-blur-xs lg:flex-row lg:items-center">
            <div className="flex items-start gap-4">
              <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/90 sm:flex">
                <CloudUpload size={22} />
              </span>

              {!hasDecks ? (
                <div>
                  <h3 className="text-base font-bold sm:text-lg">
                    Start by uploading your first reviewer
                  </h3>
                  <p className="mt-1 max-w-xl text-xs leading-relaxed text-white/75 sm:text-sm">
                    Upload a PDF, image, or text reviewer. KayApp will turn it into a Deck of Cards for Flashcards, Multiple Choice, and Blurting.
                  </p>
                  <button
                    type="button"
                    onClick={() => setUploadWizardOpen(true)}
                    className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-[#F5B82E] px-5 text-xs font-bold text-[#173761] shadow-sm transition hover:bg-[#FFD878]"
                  >
                    <Upload size={15} /> Upload reviewer
                  </button>
                </div>
              ) : (
                <div>
                  <span className="inline-block rounded-full bg-[#F5B82E] px-2.5 py-0.5 text-[11px] font-bold text-[#173761]">
                    {dueCardsToday.length > 0
                      ? `${dueCardsToday.length} cards due for review today`
                      : 'All caught up for today'}
                  </span>
                  <h3 className="mt-1.5 text-lg font-bold">{nextStudyDeck.title}</h3>
                  <p className="mt-0.5 text-xs text-white/75">
                    {nextDeckCards.length} total cards · {nextDeckDueCount} due now · +{nextStudyDeck.xp_awarded || 0} pts earned
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={() => startStudyingDeck(nextStudyDeck, nextDeckCards, nextDeckDueCount === 0)}
                      className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#F5B82E] px-5 text-xs font-bold text-[#173761] shadow-sm transition hover:bg-[#FFD878]"
                    >
                      <Play size={14} fill="currentColor" />
                      {nextDeckDueCount > 0 ? `Study ${nextDeckDueCount} due` : 'Practice all'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadWizardOpen(true)}
                      className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/25 px-4 text-xs font-semibold text-white transition hover:bg-white/10"
                    >
                      <Upload size={14} /> Upload reviewer
                    </button>
                  </div>
                </div>
              )}
            </div>

            <HeroBookIllustration />
          </div>
        </section>

        {/* 2. Middle Row: Decks to Review & Today's Deadlines */}
        <div className="grid gap-6 md:grid-cols-2">
          <section className={`relative flex flex-col justify-between overflow-hidden rounded-3xl border p-6 ${t.card}`}>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-8 -right-8 h-36 w-36 rounded-full bg-gradient-to-tl from-[#F5B82E]/25 via-[#F5B82E]/10 to-transparent blur-xl"
            />
            <div className="relative flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FFF4D6] text-[#B78116]">
                  <BookOpen size={21} strokeWidth={1.9} />
                </span>
                <div>
                  <h3 className="text-base font-bold">Decks to Review ({activeDecks.length})</h3>
                  <p className={`mt-0.5 text-xs leading-relaxed ${t.muted}`}>
                    Cards return automatically based on your recall rating.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => goTo('library')}
                className={`shrink-0 text-xs font-bold hover:underline ${t.gold}`}
              >
                Open Library →
              </button>
            </div>

            <div className="relative mt-5">
              {activeDecks.length === 0 ? (
                <p className={`text-xs ${t.muted}`}>
                  No active decks. Upload a reviewer above to create your first deck.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {activeDecks.slice(0, 3).map((d) => {
                    const dCards = cardsByDeck[d.id] || []
                    const dueCount = dCards.filter((c) => !c.due_date || c.due_date <= today).length
                    return (
                      <li key={d.id} className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${t.row}`}>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">{d.title}</p>
                          <div className={`mt-1 flex flex-wrap items-center gap-2 text-xs ${t.muted}`}>
                            {renderSubjectBadge(d.subject_id)}
                            <span>{dCards.length} cards</span>
                            {dueCount > 0 ? (
                              <span className={`font-bold ${t.gold}`}>{dueCount} due today</span>
                            ) : (
                              <span>Reviewed (+{d.xp_awarded || 0} pts)</span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => startStudyingDeck(d, dCards, dueCount === 0)}
                          className={t.btn}
                        >
                          {dueCount > 0 ? `Study (${dueCount})` : 'Practice'}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </section>

          <section className={`relative flex flex-col justify-between overflow-hidden rounded-3xl border p-6 ${t.card}`}>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-8 -right-8 h-36 w-36 rounded-full bg-gradient-to-tl from-rose-400/20 via-rose-300/10 to-transparent blur-xl"
            />
            <div className="relative flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-100/80 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300">
                  <CalendarDays size={21} strokeWidth={1.9} />
                </span>
                <div>
                  <h3 className="text-base font-bold">Today&apos;s Deadlines ({todaysDeadlines.length})</h3>
                  <p className={`mt-0.5 text-xs leading-relaxed ${t.muted}`}>
                    Scheduled tasks and study plan sessions for today.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => goTo('plan')}
                className={`shrink-0 text-xs font-bold hover:underline ${t.gold}`}
              >
                Open Plan →
              </button>
            </div>

            <div className="relative mt-5">
              {overdueDeadlines.length > 0 && (
                <p className={`mb-2 text-xs font-semibold ${t.danger}`}>
                  {overdueDeadlines.length} overdue {overdueDeadlines.length === 1 ? 'task' : 'tasks'} need attention.
                </p>
              )}

              {todaysDeadlines.length === 0 && overdueDeadlines.length === 0 ? (
                <p className={`text-xs ${t.muted}`}>
                  No tasks or deadlines scheduled for today.
                </p>
              ) : (
                <ul className="space-y-2">
                  {[...overdueDeadlines.slice(0, 2), ...todaysDeadlines.slice(0, 3)].map((tk) => renderTaskRow(tk))}
                </ul>
              )}
            </div>
          </section>
        </div>

        {/* 3. Bottom Row: Real Database Study Path + Quick Actions */}
        <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
          <section className={`flex flex-col justify-between rounded-3xl border p-6 sm:p-7 ${t.card}`}>
            <div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${t.gold}`}>
                    <Sparkles size={13} /> Your Study Path {currentSubject ? `· ${currentSubject.name}` : ''}
                  </p>
                  <h3 className="mt-1.5 font-serif text-xl font-bold sm:text-2xl">
                    Continue your learning journey
                  </h3>
                  <p className={`mt-1 text-xs ${t.muted}`}>
                    Follow your personalized path and unlock new topics based on prerequisites.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    goTo('library')
                    setShowSkillMap(true)
                    setTimeout(() => studyOrderRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
                  }}
                  className={`shrink-0 text-xs font-bold hover:underline ${t.gold}`}
                >
                  View Path →
                </button>
              </div>

              {activeSubjects.length > 1 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {activeSubjects.map((sub) => {
                    const on = sub.id === subjectId
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => setSubjectId(sub.id)}
                        className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                          on ? 'border-[#173761] bg-[#173761] text-white' : `${t.panel} ${t.muted}`
                        }`}
                      >
                        {sub.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {activeSubjects.length === 0 ? (
              <div className={`mt-6 rounded-2xl border border-dashed p-6 text-center ${t.panel}`}>
                <p className="text-sm font-bold">No subjects added yet</p>
                <p className={`mt-1 text-xs ${t.muted}`}>
                  Create your first subject in the Library to build your learning path.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    goTo('library')
                    setTimeout(() => subjectInputRef.current?.focus(), 80)
                  }}
                  className={`mt-3 ${t.btn}`}
                >
                  <Plus size={15} /> Add Subject in Library
                </button>
              </div>
            ) : realJourneyNodes.length === 0 ? (
              <div className={`mt-6 rounded-2xl border border-dashed p-6 text-center ${t.panel}`}>
                <p className="text-sm font-bold">
                  No topics in {currentSubject?.name || 'this subject'} yet
                </p>
                <p className={`mt-1 text-xs ${t.muted}`}>
                  Add topics or upload a reviewer for {currentSubject?.name} so your prerequisite path appears here.
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      goTo('library')
                      setTimeout(() => topicInputRef.current?.focus(), 80)
                    }}
                    className={t.btn}
                  >
                    <Plus size={15} /> Add Topics to {currentSubject?.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadWizardOpen(true)}
                    className={t.btnSecondary}
                  >
                    <Upload size={14} /> Upload Reviewer
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-7 overflow-x-auto pb-2 pt-2">
                <div className="flex min-w-max items-start gap-2 px-1">
                  {realJourneyNodes.map((node, i) => {
                    const isDone = node.state === 'done'
                    const isReady = node.state === 'ready'
                    return (
                      <div key={node.id} className="flex items-center">
                        <button
                          type="button"
                          onClick={() => toggleTopicMastered(node.id)}
                          title={`${node.title} (${node.mins}m) — Click to toggle mastered`}
                          className="group flex w-24 flex-col items-center text-center focus:outline-none"
                        >
                          <span
                            className={`flex h-12 w-12 items-center justify-center rounded-full transition duration-200 group-hover:-translate-y-0.5 ${
                              isDone
                                ? 'bg-[#F5B82E] text-white shadow-[0_6px_16px_-4px_rgba(245,184,46,0.75)]'
                                : isReady
                                ? 'bg-[#2B5B9E] text-white ring-4 ring-[#2B5B9E]/20 shadow-[0_8px_18px_-4px_rgba(23,55,97,0.55)]'
                                : darkMode
                                ? 'border border-[#2A3B51] bg-[#0B1525] text-slate-500'
                                : 'border border-slate-200 bg-[#EEF0F4] text-slate-400'
                            }`}
                          >
                            {isDone ? (
                              <Check size={18} strokeWidth={3} />
                            ) : isReady ? (
                              <Check size={18} strokeWidth={2.5} />
                            ) : (
                              <Lock size={15} />
                            )}
                          </span>
                          <span className="mt-3 w-full truncate px-1 text-xs font-bold">
                            {node.title}
                          </span>
                          <span
                            className={`mt-0.5 text-[11px] font-semibold ${
                              isDone
                                ? t.gold
                                : isReady
                                ? 'text-[#2B5B9E] dark:text-[#7FA6D6]'
                                : t.muted
                            }`}
                          >
                            {isDone ? 'Done' : isReady ? 'Open' : 'Locked'}
                          </span>
                        </button>

                        {i < realJourneyNodes.length - 1 && (
                          <div aria-hidden="true" className="-mt-8 px-2">
                            <span className="text-xs font-bold text-slate-300 dark:text-slate-600">→</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </section>

          <section className={`flex flex-col justify-between rounded-3xl border p-6 sm:p-7 ${t.card}`}>
            <div>
              <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-rose-500">
                <Zap size={13} /> Quick Actions
              </p>
              <h3 className="mt-1.5 font-serif text-xl font-bold sm:text-2xl">Get started</h3>
              <p className={`mt-1 text-xs ${t.muted}`}>
                Jump into your study plan and stay on track.
              </p>
            </div>

            <div className="mt-5 space-y-2.5">
              {[
                {
                  label: 'Study Planner',
                  desc: 'Organize your study sessions, tasks, and deadlines.',
                  icon: BookOpen,
                  onClick: () => goTo('plan'),
                },
                {
                  label: 'Subject Tracker',
                  desc: 'Keep track of your subjects, topics, and progress.',
                  icon: ListOrdered,
                  onClick: () => {
                    goTo('library')
                    setShowSkillMap(false)
                    setTimeout(() => subjectInputRef.current?.focus(), 80)
                  },
                },
                {
                  label: 'Learning Paths',
                  desc: 'Discover which topics to study first based on prerequisites.',
                  icon: GitBranch,
                  onClick: () => {
                    goTo('library')
                    setShowSkillMap(true)
                    setTimeout(() => studyOrderRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
                  },
                },
              ].map((act) => {
                const Icon = act.icon
                return (
                  <button
                    key={act.label}
                    type="button"
                    onClick={act.onClick}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition ${t.row}`}
                  >
                    <div className="flex min-w-0 items-center gap-3.5">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${t.panel}`}>
                        <Icon size={17} className={t.gold} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold">{act.label}</p>
                        <p className={`truncate text-[11px] ${t.muted}`}>{act.desc}</p>
                      </div>
                    </div>
                    <ChevronRight size={15} className={`shrink-0 ${t.muted}`} />
                  </button>
                )
              })}
            </div>
          </section>
        </div>

        <p className={`pt-2 text-center text-xs italic ${t.muted}`}>
          Kaya mo ’yan. May plano ka na.
        </p>
      </div>
    )
  }

  /* ================================================================ */
  /* VIEW 2: LIBRARY                                                   */
  /* ================================================================ */

  const renderLibraryView = () => {
    const currentSub = activeSubjects.find((s) => s.id === subjectId)
    const subjectDecks = activeDecks.filter((d) => !subjectId || d.subject_id === subjectId)

    return (
      <div className="space-y-6">
        <section className={`rounded-2xl border p-5 ${t.card}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold">Subjects</h2>
              <p className={`text-xs ${t.muted}`}>
                Select a subject to view its Reviewer Decks and Topic Study Order. Click the archive icon to move a subject to Archive.
              </p>
            </div>
            <button type="button" onClick={() => setUploadWizardOpen(true)} className={t.btn}>
              <Upload size={16} /> Upload reviewer
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {activeSubjects.map((sub) => {
              const on = subjectId === sub.id
              const st = subjectStyles[sub.id] || SUBJECT_BADGES[0]
              return (
                <span
                  key={sub.id}
                  className={`inline-flex items-center rounded-full border text-xs font-semibold transition ${
                    on
                      ? 'border-[#173761] bg-[#173761] text-white'
                      : darkMode
                      ? st.dark
                      : st.light
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSubjectId(sub.id)}
                    className="flex h-9 items-center gap-2 pl-3.5 pr-2"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: on ? '#F5B82E' : darkMode ? st.darkDot : st.dot }}
                    />
                    {sub.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleArchiveSubject(sub.id)}
                    title={`Archive ${sub.name}`}
                    aria-label={`Archive ${sub.name}`}
                    className="mr-1 rounded-full p-1.5 opacity-70 hover:opacity-100"
                  >
                    <Archive size={13} />
                  </button>
                </span>
              )
            })}

            <form onSubmit={addSubject} className="inline-flex items-center gap-2">
              <input
                ref={subjectInputRef}
                type="text"
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                placeholder="New subject…"
                className={`h-9 w-40 rounded-full border px-3.5 text-xs ${t.input}`}
              />
              <button
                type="submit"
                disabled={!newSubjectName.trim()}
                className="flex h-9 items-center gap-1 rounded-full bg-[#173761] px-3.5 text-xs font-semibold text-white disabled:opacity-40"
              >
                <Plus size={14} /> Add
              </button>
            </form>
          </div>
        </section>

        <section className={`rounded-2xl border p-5 ${t.card}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold">
                Decks {currentSub ? `in ${currentSub.name}` : ''} ({subjectDecks.length})
              </h3>
              <p className={`text-xs ${t.muted}`}>
                Spaced repetition: Cards you rate <em>Again</em> or <em>Hard</em> come back sooner; <em>Good</em> and <em>Easy</em> cards return after several days.
              </p>
            </div>
          </div>

          {subjectDecks.length === 0 ? (
            <div className={`mt-4 rounded-xl border border-dashed p-8 text-center ${t.panel}`}>
              <p className={`text-sm ${t.muted}`}>No active decks in {currentSub?.name || 'this subject'} yet.</p>
              <button type="button" onClick={() => setUploadWizardOpen(true)} className={`mt-3 ${t.btn}`}>
                <Upload size={15} /> Upload reviewer
              </button>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {subjectDecks.map((d) => {
                const dCards = cardsByDeck[d.id] || []
                const dueCount = dCards.filter((c) => !c.due_date || c.due_date <= today).length
                const masteredCount = dCards.filter((c) => c.is_mastered).length
                return (
                  <div key={d.id} className={`flex flex-col justify-between rounded-xl border p-4 ${t.row}`}>
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-bold">{d.title}</h4>
                          <span className={`text-xs font-semibold ${t.gold}`}>
                            +{d.xp_awarded || 0} XP pts earned
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleArchiveDeck(d.id)}
                          title="Move deck to Archive"
                          aria-label={`Archive deck ${d.title}`}
                          className={t.archiveBtn}
                        >
                          <Archive size={15} />
                        </button>
                      </div>
                      <p className={`mt-1 text-xs ${t.muted}`}>
                        {dCards.length} cards · {masteredCount} remembered
                        {dueCount > 0 ? ` · ${dueCount} due today` : ' · All caught up'}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-2">
                      <div className="flex-1">
                        <Bar value={pct(masteredCount, dCards.length)} label="Deck mastery" track={t.track} />
                      </div>
                      {dueCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => startStudyingDeck(d, dCards, false)}
                          className={t.btn}
                        >
                          <Play size={14} fill="currentColor" className="text-[#F5B82E]" /> Study ({dueCount})
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startStudyingDeck(d, dCards, true)}
                          className={t.btnSecondary}
                        >
                          Practice all
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {subjectId && (
          <section ref={studyOrderRef} className={`rounded-2xl border p-5 ${t.card}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold">
                  Study Order &amp; Topics {currentSub ? `for ${currentSub.name}` : ''}
                </h3>
                <p className={`text-xs ${t.muted}`}>
                  Topics added here appear directly in your Dashboard Study Path.
                </p>
              </div>
              {activeTopics.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowSkillMap((m) => !m)}
                  className={t.btnSecondary}
                >
                  {showSkillMap ? <ListOrdered size={15} /> : <GitBranch size={15} />}
                  {showSkillMap ? 'View as list' : 'View as map'}
                </button>
              )}
            </div>

            <form onSubmit={addTopic} className="mt-4 grid gap-3 sm:grid-cols-[1.4fr_110px_1fr_auto] sm:items-end">
              <label className="block text-xs font-semibold">
                Topic title
                <input
                  ref={topicInputRef}
                  type="text"
                  value={newTopicTitle}
                  onChange={(e) => setNewTopicTitle(e.target.value)}
                  placeholder="e.g. Subnetting, Routing Protocols…"
                  className={`mt-1 ${field}`}
                />
              </label>
              <label className="block text-xs font-semibold">
                Minutes
                <input
                  type="number"
                  min="5"
                  max="600"
                  value={newTopicMinutes}
                  onChange={(e) => setNewTopicMinutes(e.target.value)}
                  className={`mt-1 ${field}`}
                />
              </label>
              <label className="block text-xs font-semibold">
                Prerequisite (optional)
                <select
                  value={newTopicPrereqId}
                  onChange={(e) => setNewTopicPrereqId(e.target.value)}
                  className={`mt-1 ${field}`}
                >
                  <option value="">None (Unlocked immediately)</option>
                  {activeTopics.map((tp) => (
                    <option key={tp.id} value={tp.id}>
                      {tp.title}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" disabled={!newTopicTitle.trim()} className={t.btn}>
                <Plus size={16} /> Add Topic
              </button>
            </form>

            {activeTopics.length === 0 ? (
              <p className={`mt-6 text-center text-sm ${t.muted}`}>No topics added for {currentSub?.name} yet.</p>
            ) : showSkillMap ? (
              <div className={`mt-4 rounded-xl border p-4 ${t.panel}`}>
                <TopicSkillMap
                  topics={activeTopics}
                  edges={edges}
                  layer={layer}
                  status={status}
                  minutes={minutes}
                  darkMode={darkMode}
                  onPickTopic={toggleTopicMastered}
                />
              </div>
            ) : (
              <ol className="mt-4 space-y-2">
                {sorted.order.map((id, idx) => {
                  const tp = topicsById[id]
                  if (!tp) return null
                  const s = status[id]
                  const needs = needsOf.get(id) || []
                  return (
                    <li key={id} className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 ${t.row}`}>
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <button
                          type="button"
                          onClick={() => toggleTopicMastered(id)}
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            s === 'done'
                              ? 'bg-[#F5B82E] text-[#173761]'
                              : s === 'ready'
                              ? 'bg-[#173761] text-white'
                              : 'bg-slate-200 text-slate-500 dark:bg-slate-800'
                          }`}
                        >
                          {s === 'done' ? <Check size={13} strokeWidth={3} /> : s === 'locked' ? <Lock size={12} /> : idx + 1}
                        </button>
                        <div className="min-w-0">
                          <span className={`text-sm font-bold ${s === 'done' ? `${t.muted} line-through` : ''}`}>
                            {tp.title}
                          </span>
                          <span className="ml-2 rounded bg-[#FFF4D6] px-2 py-0.5 text-xs font-semibold text-[#8A5F0B]">
                            {tp.study_minutes ?? 30} min
                          </span>
                          {needs.length > 0 && (
                            <p className={`text-xs ${t.muted}`}>Requires first: {needs.map(titleOf).join(', ')}</p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleArchiveTopic(id)}
                        title={`Archive ${tp.title}`}
                        aria-label={`Archive ${tp.title}`}
                        className={t.archiveBtn}
                      >
                        <Archive size={15} />
                      </button>
                    </li>
                  )
                })}
              </ol>
            )}
          </section>
        )}
      </div>
    )
  }

  /* ================================================================ */
  /* VIEW 3: PLAN (Exact Match to `image_be3a98.jpg` Study Workspace!) */
  /* ================================================================ */

  const renderPlanView = () => {
    // Filter active tasks by subject, due date sort, and search query
    const filteredPlanTasks = activeTasks
      .filter((tk) => {
        if (planFilterSubject !== 'all' && tk.subject_id !== planFilterSubject) return false
        if (planSearch.trim()) {
          const q = planSearch.trim().toLowerCase()
          const subName = subjects.find((s) => s.id === tk.subject_id)?.name?.toLowerCase() || ''
          if (!tk.title.toLowerCase().includes(q) && !subName.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => {
        if (planSortDue === 'priority') {
          return PRIORITY[a.priority || 'normal'] - PRIORITY[b.priority || 'normal']
        }
        if (planSortDue === 'due_desc') {
          return (b.due_date || '').localeCompare(a.due_date || '')
        }
        return (a.due_date || '9999').localeCompare(b.due_date || '9999')
      })

    // Group filtered tasks by active list name
    const tasksByList = {}
    allBoardLists.forEach((lName) => {
      tasksByList[lName] = []
    })

    filteredPlanTasks.forEach((tk) => {
      const lName = getTaskBoardList(tk)
      if (tasksByList[lName] !== undefined) {
        tasksByList[lName].push(tk)
      } else if (allBoardLists.length > 0) {
        tasksByList[allBoardLists[0]].push(tk)
      }
    })

    // Upcoming deadlines column (tasks with a due_date that are not completed)
    const upcomingDeadlineList = filteredPlanTasks
      .filter((tk) => tk.due_date && !tk.is_done && !isCompletedListName(getTaskBoardList(tk)))
      .sort((a, b) => a.due_date.localeCompare(b.due_date))

    // Helper for list header icon matching `image_be3a98.jpg`
    const renderListHeaderIcon = (listName) => {
      const lower = listName.toLowerCase()
      if (isCompletedListName(lower)) {
        return (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check size={14} strokeWidth={3} />
          </span>
        )
      }
      if (lower.includes('progress') || lower.includes('doing') || lower.includes('active')) {
        return (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F5B82E] text-[#173761]">
            <Play size={11} fill="currentColor" className="ml-0.5" />
          </span>
        )
      }
      return (
        <span className="h-5 w-5 shrink-0 rounded-full border-2 border-[#173761] dark:border-slate-300" />
      )
    }

    return (
      <div className="space-y-5">
        {/* 1. Hero Banner: "Your study workspace" + "+ Create a list" button */}
        <section
          className={`relative overflow-hidden rounded-3xl border px-6 py-6 sm:px-8 ${
            darkMode
              ? 'border-[#2A3B51] bg-gradient-to-r from-[#111F33] via-[#162740] to-[#1F2937]'
              : 'border-[#EDE8D8] bg-gradient-to-r from-[#F9F6EE] via-[#FBF8F1] to-[#F5EBD1]'
          }`}
        >
          {/* Decorative soft warm leaf/wave silhouette on the right */}
          <svg
            aria-hidden="true"
            viewBox="0 0 400 140"
            preserveAspectRatio="none"
            className="pointer-events-none absolute right-0 top-0 h-full w-80 opacity-45"
          >
            <path
              d="M140,140 C210,70 290,30 400,15 L400,140 Z"
              fill={darkMode ? 'rgba(245, 184, 46, 0.12)' : '#EAD9B0'}
            />
            <path
              d="M230,140 C275,90 330,65 400,55 L400,140 Z"
              fill={darkMode ? 'rgba(245, 184, 46, 0.18)' : '#E2C98D'}
            />
          </svg>

          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border shadow-2xs ${
                  darkMode ? 'border-white/10 bg-[#172840] text-[#F5B82E]' : 'border-[#E7E4DA] bg-white text-[#173761]'
                }`}
              >
                <CalendarDays size={24} strokeWidth={1.8} />
              </span>
              <div>
                <h2 className="font-serif text-2xl font-bold tracking-tight sm:text-3xl">
                  Your study workspace
                </h2>
                <p className={`mt-0.5 text-xs sm:text-sm ${t.muted}`}>
                  Break your study goals into manageable steps.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setNewListName('')
                setCreateListModalOpen(true)
              }}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-[#F5C451] to-[#F5B82E] px-5 text-xs font-extrabold text-[#173761] shadow-sm transition hover:from-[#FFD878] hover:to-[#F5B82E]"
            >
              <Plus size={16} strokeWidth={2.5} /> Create a list
            </button>
          </div>
        </section>

        {/* 2. Filter & Search Bar (`All subjects`, `Due date`, `Search tasks...`) */}
        <section className={`rounded-2xl border p-3 ${t.card}`}>
          <div className="grid gap-2.5 sm:grid-cols-[170px_160px_1fr]">
            <select
              aria-label="Filter by subject"
              value={planFilterSubject}
              onChange={(e) => setPlanFilterSubject(e.target.value)}
              className={`h-10 rounded-xl border px-3 text-xs font-semibold ${t.input}`}
            >
              <option value="all">All subjects</option>
              {activeSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Sort by due date or priority"
              value={planSortDue}
              onChange={(e) => setPlanSortDue(e.target.value)}
              className={`h-10 rounded-xl border px-3 text-xs font-semibold ${t.input}`}
            >
              <option value="due_asc">Due date</option>
              <option value="priority">Priority (High first)</option>
              <option value="due_desc">Latest due date</option>
            </select>

            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                value={planSearch}
                onChange={(e) => setPlanSearch(e.target.value)}
                placeholder="Search tasks..."
                aria-label="Search tasks"
                className={`h-10 w-full rounded-xl border pl-9 pr-3 text-xs ${t.input}`}
              />
            </div>
          </div>
        </section>

        {/* Mobile Quick List Switcher Pills (Great Phone UX!) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileActiveList('all')}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
              mobileActiveList === 'all'
                ? 'border-[#173761] bg-[#173761] text-white'
                : `${t.card} ${t.muted}`
            }`}
          >
            All Lists ({allBoardLists.length})
          </button>
          {allBoardLists.map((lName) => (
            <button
              key={lName}
              type="button"
              onClick={() => setMobileActiveList(lName)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
                mobileActiveList === lName
                  ? 'border-[#F5B82E] bg-[#F5B82E] text-[#173761]'
                  : `${t.card} ${t.muted}`
              }`}
            >
              {lName} ({(tasksByList[lName] || []).length})
            </button>
          ))}
          <button
            type="button"
            onClick={() => setMobileActiveList('__deadlines__')}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
              mobileActiveList === '__deadlines__'
                ? 'border-[#173761] bg-[#173761] text-white'
                : `${t.card} ${t.muted}`
            }`}
          >
            Deadlines ({upcomingDeadlineList.length})
          </button>
        </div>

        {/* 3. Main Columns Grid: User Study Lists + Upcoming Deadlines Column */}
        {allBoardLists.length === 0 ? (
          <section className={`rounded-3xl border border-dashed p-10 text-center ${t.card}`}>
            <p className="text-base font-bold">No active study lists</p>
            <p className={`mt-1 text-xs ${t.muted}`}>
              Create a list above or restore your archived lists from the Archive tab.
            </p>
            <button
              type="button"
              onClick={() => setCreateListModalOpen(true)}
              className={`mt-4 ${t.btn}`}
            >
              <Plus size={16} /> Create your first list
            </button>
          </section>
        ) : (
          <div className="flex snap-x snap-mandatory items-start gap-4 overflow-x-auto pb-4 pt-1">
            {allBoardLists.map((listName) => {
              if (mobileActiveList !== 'all' && mobileActiveList !== listName) {
                return null
              }
              const listTasks = tasksByList[listName] || []
              const isCompletedCol = isCompletedListName(listName)
              const isAddingHere = addingInList === listName
              const isRenamingHere = renamingList === listName
              const menuOpenHere = openListMenu === listName

              return (
                <section
                  key={listName}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (!draggingTaskId) return
                    const draggedTask = activeTasks.find((tk) => tk.id === draggingTaskId)
                    if (draggedTask) {
                      moveTaskToBoardList(draggedTask, listName)
                    }
                    setDraggingTaskId(null)
                  }}
                  className={`flex max-h-[640px] w-[88vw] shrink-0 snap-center flex-col rounded-2xl border p-4 sm:w-[295px] ${t.card}`}
                >
                  {/* Column Header */}
                  <div className="relative flex shrink-0 items-center justify-between gap-2 pb-3.5">
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      {renderListHeaderIcon(listName)}

                      {isRenamingHere ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault()
                            handleRenameBoardList(listName)
                          }}
                          className="flex-1"
                        >
                          <input
                            type="text"
                            autoFocus
                            value={renameListValue}
                            onChange={(e) => setRenameListValue(e.target.value)}
                            onBlur={() => handleRenameBoardList(listName)}
                            className={`h-7 w-full rounded border px-2 text-xs font-bold ${t.input}`}
                          />
                        </form>
                      ) : (
                        <h3 className="truncate text-sm font-bold">{listName}</h3>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <span
                        className={`flex h-5 min-w-[1.35rem] items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${
                          darkMode ? 'bg-white/10 text-slate-300' : 'bg-[#F1F2EE] text-slate-600'
                        }`}
                      >
                        {listTasks.length}
                      </span>

                      <button
                        type="button"
                        onClick={() => setOpenListMenu(menuOpenHere ? '' : listName)}
                        aria-label={`Options for ${listName}`}
                        className={`rounded-lg p-1 ${t.ghost} hover:bg-slate-500/10`}
                      >
                        <MoreHorizontal size={16} />
                      </button>
                    </div>

                    {/* List Dropdown Menu (Rename or Archive List -> Disappears!) */}
                    {menuOpenHere && (
                      <div
                        className={`absolute right-0 top-9 z-30 w-44 rounded-xl border p-1.5 shadow-xl ${t.card}`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setOpenListMenu('')
                            setRenamingList(listName)
                            setRenameListValue(listName)
                          }}
                          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold ${t.ghost} hover:bg-slate-500/10`}
                        >
                          Rename list
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleArchiveBoardList(listName)}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-amber-600 hover:bg-amber-500/10 dark:text-[#F5B82E]"
                        >
                          <Archive size={14} /> Archive list
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Internal Scrollable Task Cards Container */}
                  <div
                    className="kd-scroll min-h-[60px] flex-1 space-y-2.5 overflow-y-auto pr-1"
                    style={{
                      scrollbarWidth: 'thin',
                      scrollbarColor: darkMode ? '#334155 transparent' : '#CBD5E1 transparent',
                    }}
                  >
                    {listTasks.length === 0 ? (
                      <div className={`rounded-xl border border-dashed py-8 text-center text-xs ${t.panel} ${t.muted}`}>
                        No tasks in {listName}.
                      </div>
                    ) : (
                      listTasks.map((tk) => {
                        const isDoneCard = tk.is_done || isCompletedCol
                        const prio = PRIORITY_BADGE[tk.priority || 'normal'] || PRIORITY_BADGE.normal
                        const taskMenuOpen = openTaskMenuId === tk.id

                        return (
                          <article
                            key={tk.id}
                            draggable
                            onDragStart={() => setDraggingTaskId(tk.id)}
                            onDragEnd={() => setDraggingTaskId(null)}
                            className={`group relative cursor-grab rounded-xl border p-3.5 transition active:cursor-grabbing ${
                              isDoneCard
                                ? darkMode
                                  ? 'border-emerald-500/30 bg-emerald-950/20'
                                  : 'border-[#D8EFE2] bg-[#F2FBF6]'
                                : darkMode
                                ? 'border-[#2A3B51] bg-[#0B1525] hover:border-[#F5B82E]'
                                : 'border-[#ECECE6] bg-[#FCFBF8] hover:border-[#D6B75E]'
                            }`}
                          >
                            {/* Top Row: Left Grip/Check + Badges + Right 3-Dot Menu */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {isDoneCard ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleTask(tk)}
                                    title="Mark as incomplete"
                                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"
                                  >
                                    <Check size={12} strokeWidth={3} />
                                  </button>
                                ) : (
                                  <GripVertical
                                    size={14}
                                    className="shrink-0 text-slate-300 dark:text-slate-600"
                                  />
                                )}

                                {renderSubjectBadge(tk.subject_id)}

                                {!isDoneCard && (
                                  <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${prio.cls}`}>
                                    {prio.label}
                                  </span>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => setOpenTaskMenuId(taskMenuOpen ? '' : tk.id)}
                                aria-label={`Task options for ${tk.title}`}
                                className="rounded p-1 text-slate-400 hover:bg-slate-500/10 hover:text-current"
                              >
                                <MoreVertical size={14} />
                              </button>
                            </div>

                            {/* Task Dropdown Menu (Move to list, Complete, Archive) */}
                            {taskMenuOpen && (
                              <div
                                className={`absolute right-2 top-9 z-30 w-44 rounded-xl border p-1.5 shadow-xl ${t.card}`}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenTaskMenuId('')
                                    toggleTask(tk)
                                  }}
                                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold ${t.ghost} hover:bg-slate-500/10`}
                                >
                                  <Check size={13} />
                                  {tk.is_done ? 'Mark incomplete' : 'Mark completed'}
                                </button>

                                {allBoardLists
                                  .filter((l) => l !== listName)
                                  .map((targetL) => (
                                    <button
                                      key={targetL}
                                      type="button"
                                      onClick={() => moveTaskToBoardList(tk, targetL)}
                                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold ${t.ghost} hover:bg-slate-500/10`}
                                    >
                                      Move to {targetL}
                                    </button>
                                  ))}

                                <button
                                  type="button"
                                  onClick={() => toggleArchiveTask(tk.id)}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-amber-600 hover:bg-amber-500/10 dark:text-[#F5B82E]"
                                >
                                  <Archive size={13} /> Archive task
                                </button>
                              </div>
                            )}

                            {/* Task Title */}
                            <p
                              onClick={() => setViewingCard(tk)}
                              className={`mt-2 cursor-pointer text-xs font-bold leading-relaxed ${
                                isDoneCard ? `${t.muted} line-through` : ''
                              }`}
                            >
                              {tk.title}
                            </p>

                            {/* Due Date Line */}
                            {tk.due_date && (
                              <p className={`mt-2.5 flex items-center gap-1.5 text-[11px] ${t.muted}`}>
                                <CalendarDays size={12} className="shrink-0 opacity-75" />
                                <span>{fmtFullDate(tk.due_date)}</span>
                              </p>
                            )}
                          </article>
                        )
                      })
                    )}
                  </div>

                  {/* Pinned Bottom "+ Add a task" Button */}
                  {isAddingHere ? (
                    <form
                      onSubmit={(e) => handleAddBoardCard(e, listName)}
                      className={`mt-3 shrink-0 space-y-2 rounded-xl border p-3 ${t.panel}`}
                    >
                      <input
                        type="text"
                        autoFocus
                        value={columnCardForm.title}
                        onChange={(e) => setColumnCardForm((f) => ({ ...f, title: e.target.value }))}
                        placeholder="Task title…"
                        className={`h-8 w-full rounded-lg border px-2.5 text-xs ${t.input}`}
                      />
                      <div className="grid grid-cols-2 gap-1.5">
                        <select
                          value={columnCardForm.subject_id}
                          onChange={(e) => setColumnCardForm((f) => ({ ...f, subject_id: e.target.value }))}
                          className={`h-8 rounded-lg border px-2 text-[11px] ${t.input}`}
                        >
                          <option value="">Subject…</option>
                          {activeSubjects.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={columnCardForm.priority}
                          onChange={(e) => setColumnCardForm((f) => ({ ...f, priority: e.target.value }))}
                          className={`h-8 rounded-lg border px-2 text-[11px] ${t.input}`}
                        >
                          <option value="high">High</option>
                          <option value="normal">Medium</option>
                          <option value="low">Low</option>
                        </select>
                      </div>
                      <input
                        type="date"
                        value={columnCardForm.due_date}
                        onChange={(e) => setColumnCardForm((f) => ({ ...f, due_date: e.target.value }))}
                        className={`h-8 w-full rounded-lg border px-2 text-[11px] ${t.input}`}
                      />
                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          type="submit"
                          disabled={!columnCardForm.title.trim()}
                          className="h-8 flex-1 rounded-lg bg-[#173761] px-3 text-xs font-bold text-white disabled:opacity-40"
                        >
                          Add task
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddingInList('')}
                          className={`h-8 rounded-lg border px-2.5 text-xs font-semibold ${t.card}`}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setAddingInList(listName)
                        setColumnCardForm({
                          title: '',
                          subject_id: subjectId || activeSubjects[0]?.id || '',
                          due_date: today,
                          priority: 'normal',
                          notes: '',
                        })
                      }}
                      className={`mt-3 flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-xl border text-xs font-bold transition ${t.panel} ${t.gold} hover:border-[#F5B82E]`}
                    >
                      <Plus size={14} /> Add a task
                    </button>
                  )}
                </section>
              )
            })}

            {/* Right-Side "Upcoming deadlines" Panel (Matches `image_be3a98.jpg`) */}
            {(mobileActiveList === 'all' || mobileActiveList === '__deadlines__') && (
              <aside
                aria-label="Upcoming deadlines"
                className={`flex max-h-[640px] w-[88vw] shrink-0 snap-center flex-col rounded-2xl border p-4 sm:w-[280px] ${t.card}`}
              >
                <div className="flex items-center gap-2 pb-3.5">
                  <CalendarDays size={17} className={t.gold} />
                  <h3 className="text-sm font-bold">Upcoming deadlines</h3>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                  {upcomingDeadlineList.length === 0 ? (
                    <p className={`py-6 text-center text-xs ${t.muted}`}>
                      No upcoming deadlines scheduled.
                    </p>
                  ) : (
                    upcomingDeadlineList.slice(0, 6).map((tk) => {
                      const sub = subjects.find((s) => s.id === tk.subject_id)
                      const prio = PRIORITY_BADGE[tk.priority || 'normal'] || PRIORITY_BADGE.normal
                      return (
                        <div
                          key={tk.id}
                          onClick={() => setViewingCard(tk)}
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${t.row}`}
                        >
                          <div
                            className={`flex h-12 w-11 shrink-0 flex-col items-center justify-center rounded-xl border text-center ${t.panel}`}
                          >
                            <span className={`text-[9px] font-extrabold uppercase ${t.muted}`}>
                              {fmtMonthShort(tk.due_date)}
                            </span>
                            <span className="text-base font-extrabold leading-tight">
                              {fmtDayNum(tk.due_date)}
                            </span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-bold">{tk.title}</p>
                            {sub && (
                              <p className={`mt-0.5 text-[11px] font-semibold ${t.muted}`}>
                                {sub.name}
                              </p>
                            )}
                            <span className={`mt-1.5 inline-block rounded px-2 py-0.5 text-[10px] font-bold ${prio.cls}`}>
                              {prio.label}
                            </span>
                            <p className={`mt-1.5 flex items-center gap-1 text-[11px] ${t.muted}`}>
                              <Clock size={11} />
                              <span>{dueRelativeLabel(tk.due_date, today)}</span>
                            </p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setPlanSortDue('due_asc')}
                  className={`mt-3 pt-2 text-left text-xs font-bold hover:underline ${t.gold}`}
                >
                  View all deadlines →
                </button>
              </aside>
            )}
          </div>
        )}
      </div>
    )
  }

  /* ================================================================ */
  /* VIEW 4: PROGRESS                                                  */
  /* ================================================================ */

  const renderProgressView = () => (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="rounded-2xl bg-[#173761] p-6 text-white shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F5B82E] text-[#173761]">
              <Trophy size={24} />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#F5B82E]">Student Level &amp; Points</p>
              <h2 className="text-2xl font-bold">Level {level} · {xp} Total XP Points</h2>
            </div>
          </div>
          <span className="rounded-full bg-white/10 px-3.5 py-1 text-xs font-bold text-[#F5B82E]">
            {xp % 100}/100 XP to Level {level + 1}
          </span>
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-[#F5B82E] transition-all duration-500" style={{ width: `${xp % 100}%` }} />
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <section className={`rounded-2xl border p-5 ${t.card}`}>
          <p className={`text-xs font-semibold ${t.muted}`}>Cards Remembered</p>
          <p className="mt-1 text-2xl font-bold">
            {masteredCardsCount}/{cards.length}
          </p>
          <div className="mt-3">
            <Bar value={pct(masteredCardsCount, cards.length)} label="Cards remembered" track={t.track} />
          </div>
        </section>

        <section className={`rounded-2xl border p-5 ${t.card}`}>
          <p className={`text-xs font-semibold ${t.muted}`}>Topics Mastered</p>
          <p className="mt-1 text-2xl font-bold">
            {masteredTopicsCount}/{visibleTopics.length}
          </p>
          <div className="mt-3">
            <Bar value={pct(masteredTopicsCount, visibleTopics.length)} label="Topics mastered" track={t.track} />
          </div>
        </section>

        <section className={`rounded-2xl border p-5 ${t.card}`}>
          <p className={`text-xs font-semibold ${t.muted}`}>Study Tasks Done</p>
          <p className="mt-1 text-2xl font-bold">
            {tasksDoneCount}/{tasks.length}
          </p>
          <div className="mt-3">
            <Bar value={pct(tasksDoneCount, tasks.length)} label="Tasks done" track={t.track} />
          </div>
        </section>
      </div>

      <section className={`rounded-2xl border p-6 ${t.card}`}>
        <h3 className="text-base font-bold">Mastery &amp; Points by Subject</h3>
        {activeSubjects.length === 0 ? (
          <p className={`mt-3 text-sm ${t.muted}`}>No subjects added yet.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {activeSubjects.map((sub) => {
              const subDecks = decks.filter((d) => d.subject_id === sub.id)
              const subCards = subDecks.flatMap((d) => cardsByDeck[d.id] || [])
              const remCards = subCards.filter((c) => c.is_mastered).length
              const subPts = subDecks.reduce((s, d) => s + (Number(d.xp_awarded) || 0), 0)
              return (
                <li key={sub.id}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-bold">{sub.name}</span>
                    <span className={`text-xs ${t.muted}`}>
                      {remCards}/{subCards.length} cards remembered · +{subPts} pts
                    </span>
                  </div>
                  <div className="mt-2">
                    <Bar
                      value={pct(remCards, subCards.length)}
                      label={`${sub.name} mastery`}
                      track={t.track}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )

  /* ================================================================ */
  /* VIEW 5: ARCHIVE (The ONLY Place Where Permanent Delete Exists)    */
  /* ================================================================ */

  const renderArchiveView = () => (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="rounded-2xl border border-[#EBDDB0] bg-[#FFF8E3] px-5 py-3.5 text-xs font-semibold text-[#8A5F0B]">
        Safety Vault: Lists, tasks, decks, and subjects archived from your workspace are stored here. Restore them anytime or delete them permanently.
      </div>

      {/* 1. Archived Study Lists */}
      <section className={`rounded-2xl border p-6 ${t.card}`}>
        <h2 className="text-base font-bold">Archived Study Lists ({archivedListNames.length})</h2>
        {archivedListNames.length === 0 ? (
          <p className={`mt-3 text-xs ${t.muted}`}>No archived study lists.</p>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {archivedListNames.map((lName) => {
              const countInList = tasks.filter((tk) => getTaskBoardList(tk) === lName).length
              return (
                <li key={lName} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 ${t.row}`}>
                  <div>
                    <span className="rounded bg-[#173761] px-2 py-0.5 text-[10px] font-bold uppercase text-[#F5B82E]">
                      Study List
                    </span>
                    <p className="mt-1 text-sm font-bold">{lName}</p>
                    <p className={`text-xs ${t.muted}`}>{countInList} task(s) inside</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleArchiveBoardList(lName)}
                      className={t.btnSecondary}
                    >
                      <RotateCcw size={14} /> Restore list
                    </button>
                    <button
                      type="button"
                      onClick={() => setPermanentDeleteTarget({ type: 'list', item: { name: lName } })}
                      className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3.5 text-xs font-bold text-red-600 transition hover:bg-red-100 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-300"
                    >
                      <Trash2 size={14} /> Delete permanently
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* 2. Archived Tasks */}
      <section className={`rounded-2xl border p-6 ${t.card}`}>
        <h2 className="text-base font-bold">Archived Tasks ({archivedTasks.length})</h2>
        {archivedTasks.length === 0 ? (
          <p className={`mt-3 text-xs ${t.muted}`}>No archived tasks.</p>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {archivedTasks.map((tk) => (
              <li key={tk.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 ${t.row}`}>
                <div>
                  <p className="text-sm font-bold">{tk.title}</p>
                  <p className={`text-xs ${t.muted}`}>
                    List: {getTaskBoardList(tk)} {tk.due_date ? `· Due ${fmtFullDate(tk.due_date)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleArchiveTask(tk.id)}
                    className={t.btnSecondary}
                  >
                    <RotateCcw size={14} /> Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => setPermanentDeleteTarget({ type: 'task', item: tk })}
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3.5 text-xs font-bold text-red-600 transition hover:bg-red-100 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-300"
                  >
                    <Trash2 size={14} /> Delete permanently
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 3. Archived Decks */}
      <section className={`rounded-2xl border p-6 ${t.card}`}>
        <h2 className="text-base font-bold">Archived Decks ({archivedDecks.length})</h2>
        {archivedDecks.length === 0 ? (
          <p className={`mt-3 text-xs ${t.muted}`}>No archived decks.</p>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {archivedDecks.map((d) => {
              const dCards = cardsByDeck[d.id] || []
              return (
                <li key={d.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 ${t.row}`}>
                  <div>
                    <p className="text-sm font-bold">{d.title}</p>
                    <p className={`text-xs ${t.muted}`}>
                      {dCards.length} cards · +{d.xp_awarded || 0} pts earned
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleArchiveDeck(d.id)}
                      className={t.btnSecondary}
                    >
                      <RotateCcw size={14} /> Restore
                    </button>
                    <button
                      type="button"
                      onClick={() => setPermanentDeleteTarget({ type: 'deck', item: d })}
                      className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3.5 text-xs font-bold text-red-600 transition hover:bg-red-100 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-300"
                    >
                      <Trash2 size={14} /> Delete permanently
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* 4. Archived Subjects & Topics */}
      <section className={`rounded-2xl border p-6 ${t.card}`}>
        <h2 className="text-base font-bold">
          Archived Subjects ({archivedSubjects.length}) &amp; Topics ({archivedTopicsList.length})
        </h2>
        {archivedSubjects.length === 0 && archivedTopicsList.length === 0 ? (
          <p className={`mt-3 text-xs ${t.muted}`}>No archived subjects or topics.</p>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {archivedSubjects.map((sub) => (
              <li key={sub.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 ${t.row}`}>
                <div>
                  <span className="rounded bg-[#173761] px-2 py-0.5 text-[10px] font-bold uppercase text-[#F5B82E]">Subject</span>
                  <p className="mt-1 text-sm font-bold">{sub.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleArchiveSubject(sub.id)}
                    className={t.btnSecondary}
                  >
                    <RotateCcw size={14} /> Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => setPermanentDeleteTarget({ type: 'subject', item: sub })}
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3.5 text-xs font-bold text-red-600 transition hover:bg-red-100 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-300"
                  >
                    <Trash2 size={14} /> Delete permanently
                  </button>
                </div>
              </li>
            ))}
            {archivedTopicsList.map((tp) => (
              <li key={tp.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 ${t.row}`}>
                <div>
                  <span className="rounded bg-[#FFF4D6] px-2 py-0.5 text-[10px] font-bold uppercase text-[#8A5F0B]">Topic</span>
                  <p className="mt-1 text-sm font-bold">{tp.title}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleArchiveTopic(tp.id)}
                    className={t.btnSecondary}
                  >
                    <RotateCcw size={14} /> Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => setPermanentDeleteTarget({ type: 'topic', item: tp })}
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3.5 text-xs font-bold text-red-600 transition hover:bg-red-100 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-300"
                  >
                    <Trash2 size={14} /> Delete permanently
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )

  /* ================================================================ */
  /* VIEW 6: SETTINGS                                                  */
  /* ================================================================ */

  const renderSettingsView = () => (
    <div className="mx-auto max-w-2xl space-y-6">
      <section className={`rounded-2xl border p-6 ${t.card}`}>
        <h2 className="text-base font-bold">Profile</h2>
        <div className="mt-4 flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F5B82E] text-lg font-bold uppercase text-[#173761]">
            {initial}
          </span>
          <div>
            <p className="font-bold">{fullName || 'Student'}</p>
            <p className={`text-sm ${t.muted}`}>{email}</p>
          </div>
        </div>
      </section>

      <section className={`rounded-2xl border p-6 ${t.card}`}>
        <h2 className="flex items-center gap-2 text-base font-bold">
          <KeyRound size={17} className={t.gold} /> Change Password
        </h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (passwordForm.password.length < 8) return pushToast('Use at least 8 characters.', 'error')
            if (passwordForm.password !== passwordForm.confirm) return pushToast('Passwords do not match.', 'error')
            setPasswordBusy(true)
            try {
              const { error } = await supabase.auth.updateUser({ password: passwordForm.password })
              if (error) throw error
              setPasswordForm({ password: '', confirm: '' })
              pushToast('Password updated.', 'success')
            } catch (err) {
              pushToast(err.message || 'Could not update password.', 'error')
            } finally {
              setPasswordBusy(false)
            }
          }}
          className="mt-4 space-y-3"
        >
          <label className="block text-xs font-semibold">
            New password
            <input
              type="password"
              required
              minLength={8}
              value={passwordForm.password}
              onChange={(e) => setPasswordForm((v) => ({ ...v, password: e.target.value }))}
              className={`mt-1 ${field}`}
            />
          </label>
          <label className="block text-xs font-semibold">
            Confirm new password
            <input
              type="password"
              required
              minLength={8}
              value={passwordForm.confirm}
              onChange={(e) => setPasswordForm((v) => ({ ...v, confirm: e.target.value }))}
              className={`mt-1 ${field}`}
            />
          </label>
          <button type="submit" disabled={passwordBusy} className={t.btn}>
            {passwordBusy ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </section>
    </div>
  )

  /* ================================================================ */
  /* App Shell                                                         */
  /* ================================================================ */

  const pageMeta = {
    today: { title: 'Today', sub: 'Your active study decks and due cards.' },
    library: { title: 'Library', sub: 'Your subjects, reviewer decks, and study order.' },
    plan: { title: 'Study Plan', sub: 'Organize your tasks, sessions, and upcoming deadlines.' },
    progress: { title: 'Progress', sub: 'Cards remembered, XP points, and subject mastery.' },
    archive: { title: 'Archive', sub: 'Restore archived lists and items or delete them permanently.' },
    settings: { title: 'Account Settings', sub: 'Manage your profile and password.' },
  }[view] || { title: 'Today', sub: '' }

  const archiveBadgeCount =
    archivedDecks.length +
    archivedTasks.length +
    archivedSubjects.length +
    archivedTopicsList.length +
    archivedListNames.length

  return (
    <div className={`min-h-screen pb-16 md:pb-0 ${t.bg}`}>
      <ToastRegion toasts={toasts} onDismiss={dismissToast} darkMode={darkMode} />

      <UploadReviewerWizard
        isOpen={uploadWizardOpen}
        onClose={() => setUploadWizardOpen(false)}
        subjects={activeSubjects}
        defaultSubjectId={subjectId}
        defaultBoardList={allBoardLists[0] || 'To Study'}
        session={session}
        darkMode={darkMode}
        onDeckSaved={handleDeckSaved}
        onStartStudyingDeck={(deck, deckCards, forceAll) => startStudyingDeck(deck, deckCards, forceAll)}
        pushToast={pushToast}
      />

      {activeStudySession && (
        <DeckStudyModal
          deck={activeStudySession.deck}
          cards={activeStudySession.cards}
          subjectName={subjects.find((s) => s.id === activeStudySession.deck.subject_id)?.name}
          darkMode={darkMode}
          todayStr={today}
          onClose={() => setActiveStudySession(null)}
          onSessionComplete={handleSessionComplete}
        />
      )}

      {/* "+ Create a list" Modal */}
      <Modal
        isOpen={createListModalOpen}
        onClose={() => setCreateListModalOpen(false)}
        title="Create a new study list"
        darkMode={darkMode}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateBoardList} className="space-y-4">
          <label className="block text-xs font-semibold">
            List name
            <input
              type="text"
              autoFocus
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="e.g. To Study, Lab Exercises, Exam Review…"
              className={`mt-1.5 ${field}`}
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateListModalOpen(false)}
              className={t.btnSecondary}
            >
              Cancel
            </button>
            <button type="submit" disabled={!newListName.trim()} className={t.btn}>
              Create list
            </button>
          </div>
        </form>
      </Modal>

      {/* Task Details Modal */}
      <Modal
        isOpen={Boolean(viewingCard)}
        onClose={() => setViewingCard(null)}
        title={viewingCard?.title || 'Task Details'}
        darkMode={darkMode}
      >
        {viewingCard && (
          <div className="space-y-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              {renderSubjectBadge(viewingCard.subject_id)}
              {getTaskBoardList(viewingCard) && (
                <span className={`rounded border px-2 py-0.5 font-bold ${t.panel}`}>
                  List: {getTaskBoardList(viewingCard)}
                </span>
              )}
              {viewingCard.due_date && (
                <span className={`rounded border px-2 py-0.5 font-semibold ${t.panel}`}>
                  Due: {fmtFullDate(viewingCard.due_date)}
                </span>
              )}
            </div>
            <p className={`whitespace-pre-wrap leading-relaxed ${t.muted}`}>
              {cleanBoardNotes(viewingCard.notes) || 'No additional notes for this task.'}
            </p>
            <div className="flex justify-between gap-2 pt-3">
              <button
                type="button"
                onClick={() => {
                  toggleArchiveTask(viewingCard.id)
                  setViewingCard(null)
                }}
                className={t.btnSecondary}
              >
                <Archive size={14} /> Archive task
              </button>
              <button
                type="button"
                onClick={() => {
                  toggleTask(viewingCard)
                  setViewingCard(null)
                }}
                className={t.btn}
              >
                {viewingCard.is_done ? 'Mark Incomplete' : 'Mark Completed (+5 XP)'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Permanent Delete Confirmation Modal (Only triggered inside Archive) */}
      <Modal
        isOpen={Boolean(permanentDeleteTarget)}
        onClose={() => setPermanentDeleteTarget(null)}
        title={`Permanently delete "${permanentDeleteTarget?.item?.title || permanentDeleteTarget?.item?.name || ''}"?`}
        darkMode={darkMode}
      >
        <p className={`text-sm ${t.muted}`}>
          This will permanently delete this item from your account and cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={() => setPermanentDeleteTarget(null)} className={t.btnSecondary}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmPermanentDelete}
            className="h-10 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700"
          >
            Delete permanently
          </button>
        </div>
      </Modal>

      {mobileNav && (
        <div onClick={() => setMobileNav(false)} className="fixed inset-0 z-40 bg-black/50 md:hidden" aria-hidden="true" />
      )}

      {/* Left Sidebar with Decorative Warm Wave Curves at the Bottom */}
      <aside
        aria-label="Main navigation"
        className={`fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden border-r transition-all duration-200 md:translate-x-0 ${
          t.sidebar
        } ${navCollapsed ? 'md:w-18' : 'md:w-64'} ${
          mobileNav ? 'w-64 translate-x-0' : '-translate-x-full'
        }`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 260 320"
          preserveAspectRatio="none"
          className="pointer-events-none absolute bottom-0 left-0 h-72 w-full"
        >
          <path
            d="M0,190 C90,150 175,90 260,25 L260,320 L0,320 Z"
            fill={darkMode ? 'rgba(245, 184, 46, 0.05)' : '#F5EFE0'}
          />
          <path
            d="M75,320 C115,215 190,145 260,120 L260,320 Z"
            fill={darkMode ? 'rgba(245, 184, 46, 0.09)' : '#EFE4C8'}
          />
        </svg>

        <div className="relative z-10 px-5 pb-3 pt-5">
          {!navCollapsed ? (
            <div>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => goTo('today')}
                  className="flex items-center gap-2.5 text-left focus:outline-none"
                >
                  <img src={kayappLogo} alt="" className="h-9 w-9 object-contain" />
                  <span className="text-xl font-extrabold tracking-tight">
                    <span className={darkMode ? 'text-white' : 'text-[#173761]'}>KAY</span>
                    <span className="text-[#E6A51C]">APP</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = !navCollapsed
                    setNavCollapsed(next)
                    try { localStorage.setItem('kd-nav-collapsed', next ? '1' : '0') } catch { /* ignore */ }
                  }}
                  aria-label="Collapse sidebar"
                  className={`hidden h-7 w-7 items-center justify-center rounded-lg md:flex ${t.ghost}`}
                >
                  <PanelLeftClose size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setMobileNav(false)}
                  aria-label="Close menu"
                  className={`flex h-7 w-7 items-center justify-center rounded-lg md:hidden ${t.ghost}`}
                >
                  <X size={17} />
                </button>
              </div>
              <p className={`mt-1 text-[11px] italic ${t.muted}`}>
                Kaya mo ’yan. May plano ka na.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => goTo('today')}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#173761] text-sm font-extrabold text-[#F5B82E]"
                title="KayApp"
              >
                K
              </button>
              <button
                type="button"
                onClick={() => {
                  setNavCollapsed(false)
                  try { localStorage.setItem('kd-nav-collapsed', '0') } catch { /* ignore */ }
                }}
                aria-label="Expand sidebar"
                className={`hidden h-7 w-7 items-center justify-center rounded-lg md:flex ${t.ghost}`}
              >
                <PanelLeftOpen size={15} />
              </button>
            </div>
          )}
        </div>

        <div className="relative z-10 flex-1 space-y-6 overflow-y-auto px-3 py-3">
          <nav className="space-y-1.5">
            {navItems.map((n) => {
              const Icon = n.icon
              const on = view === n.key
              const badge = n.key === 'archive' ? archiveBadgeCount : 0
              return (
                <button
                  key={n.key}
                  type="button"
                  onClick={() => goTo(n.key)}
                  aria-current={on ? 'page' : undefined}
                  title={navCollapsed ? n.label : undefined}
                  className={`flex h-11 w-full items-center gap-3 rounded-2xl px-4 text-sm font-semibold transition ${
                    navCollapsed ? 'md:justify-center md:px-0' : ''
                  } ${
                    on
                      ? 'bg-gradient-to-r from-[#F6CC66] to-[#F5B82E] font-bold text-[#173761] shadow-[0_6px_16px_-6px_rgba(245,184,46,0.75)]'
                      : darkMode
                      ? 'text-slate-300 hover:bg-white/5 hover:text-white'
                      : 'text-[#173761]/80 hover:bg-black/5 hover:text-[#173761]'
                  }`}
                >
                  <Icon size={18} strokeWidth={2} />
                  {!navCollapsed && (
                    <>
                      <span className="truncate">{n.label}</span>
                      {badge > 0 && (
                        <span
                          className={`ml-auto flex h-5 min-w-[1.35rem] items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${
                            on
                              ? 'bg-[#173761] text-[#F5B82E]'
                              : darkMode
                              ? 'bg-white/10 text-slate-300'
                              : 'bg-[#E5E7EB] text-[#173761]'
                          }`}
                        >
                          {badge}
                        </span>
                      )}
                    </>
                  )}
                </button>
              )
            })}
          </nav>

          {!navCollapsed && (
            <div className="pt-2">
              <div className="flex items-center justify-between px-3 pb-2">
                <p className={`text-[11px] font-bold uppercase tracking-wider ${t.muted}`}>
                  Your Subjects
                </p>
                <button
                  type="button"
                  onClick={() => {
                    goTo('library')
                    setTimeout(() => subjectInputRef.current?.focus(), 80)
                  }}
                  className={`text-xs font-bold ${t.gold} hover:underline`}
                >
                  + Add
                </button>
              </div>
              {activeSubjects.length === 0 ? (
                <p className={`px-3 py-1 text-xs ${t.muted}`}>No subjects yet.</p>
              ) : (
                <ul className="space-y-1">
                  {activeSubjects.map((sub) => {
                    const st = subjectStyles[sub.id] || SUBJECT_BADGES[0]
                    const isSelected = subjectId === sub.id && view === 'library'
                    return (
                      <li key={sub.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSubjectId(sub.id)
                            goTo('library')
                          }}
                          className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold transition ${
                            isSelected
                              ? darkMode
                                ? 'bg-white/10 text-white'
                                : 'bg-white/90 text-[#173761] shadow-2xs'
                              : `${t.ghost} hover:bg-black/5`
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-2.5">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: darkMode ? st.darkDot : st.dot }}
                            />
                            <span className="truncate font-bold">{sub.name}</span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="relative z-10 p-3.5">
          {!navCollapsed ? (
            <div className={`rounded-2xl border p-4 shadow-sm ${t.card}`}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold">
                  <Trophy size={14} className={t.gold} /> Level {level}
                </span>
                <span className={`text-xs font-bold ${t.gold}`}>{xp} XP pts</span>
              </div>
              <div className="mt-2.5">
                <Bar value={xp % 100} label="Level XP progress" track={t.track} />
              </div>
              <div className={`mt-2 flex items-center justify-between text-[11px] ${t.muted}`}>
                <span>{masteredCardsCount} cards mastered</span>
                <span>{100 - (xp % 100)} pts to Lv.{level + 1}</span>
              </div>
            </div>
          ) : (
            <div title={`Level ${level} · ${xp} XP pts`} className="flex justify-center">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#173761] text-xs font-bold text-[#F5B82E]">
                L{level}
              </span>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`transition-[padding] duration-200 ${navCollapsed ? 'md:pl-18' : 'md:pl-64'}`}>
        <header className={`sticky top-0 z-30 flex h-16 items-center justify-between border-b px-4 backdrop-blur sm:px-8 ${t.header}`}>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNav(true)}
              aria-label="Open menu"
              className={`flex h-10 w-10 items-center justify-center rounded-lg border md:hidden ${t.panel}`}
            >
              <Menu size={19} />
            </button>
            <div>
              <h1 className="text-base font-bold sm:text-lg">{pageMeta.title}</h1>
              <p className={`hidden text-xs sm:block ${t.muted}`}>{pageMeta.sub}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => goTo('progress')}
              className={`hidden items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold shadow-2xs sm:inline-flex ${t.card}`}
            >
              <Trophy size={13} className={t.gold} />
              <span>{xp} pts</span>
              <span className={`text-[11px] font-medium ${t.muted}`}>· Lv.{level}</span>
            </button>

            <div ref={avatarMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setAvatarMenuOpen((o) => !o)}
                aria-expanded={avatarMenuOpen}
                aria-label="Account menu"
                className={`flex items-center gap-2 rounded-full border p-1 pr-3 text-xs font-semibold shadow-2xs transition ${t.card}`}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F5B82E] text-xs font-bold uppercase text-[#173761]">
                  {initial}
                </span>
                <span className="hidden max-w-[140px] truncate sm:inline">{fullName || email}</span>
                <ChevronDown size={14} className={t.muted} />
              </button>

              {avatarMenuOpen && (
                <div
                  role="menu"
                  className={`absolute right-0 mt-2 w-56 rounded-xl border p-1.5 shadow-xl ${t.card}`}
                >
                  <div className={`border-b px-3 py-2 ${t.divider}`}>
                    <p className="truncate text-xs font-bold">{fullName || 'Student'}</p>
                    <p className={`truncate text-xs ${t.muted}`}>{email}</p>
                  </div>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => goTo('settings')}
                    className={`mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-semibold ${t.ghost} hover:bg-slate-500/10`}
                  >
                    <Settings size={15} /> Settings
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onToggleTheme()
                      setAvatarMenuOpen(false)
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-semibold ${t.ghost} hover:bg-slate-500/10`}
                  >
                    {darkMode ? <Sun size={15} /> : <Moon size={15} />}
                    {darkMode ? 'Switch to Light mode' : 'Switch to Dark mode'}
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-semibold text-red-500 hover:bg-red-500/10"
                  >
                    <LogOut size={15} /> Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className={`mx-auto px-4 py-6 sm:px-8 sm:py-8 ${view === 'plan' ? 'max-w-[1440px]' : 'max-w-6xl'}`}>
          {loading ? (
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className={`h-28 animate-pulse rounded-2xl ${darkMode ? 'bg-[#111F33]' : 'bg-[#F1F2EE]'}`} />
              ))}
            </div>
          ) : (
            <>
              {view === 'today' && renderTodayView()}
              {view === 'library' && renderLibraryView()}
              {view === 'plan' && renderPlanView()}
              {view === 'progress' && renderProgressView()}
              {view === 'archive' && renderArchiveView()}
              {view === 'settings' && renderSettingsView()}
            </>
          )}
        </main>

        <nav
          aria-label="Mobile navigation"
          className={`fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t px-1 py-1 backdrop-blur md:hidden ${
            darkMode ? 'border-[#2A3B51] bg-[#101D30]/95' : 'border-[#E7E9E5] bg-white/95'
          }`}
        >
          {navItems.map((n) => {
            const Icon = n.icon
            const on = view === n.key
            return (
              <button
                key={n.key}
                type="button"
                onClick={() => goTo(n.key)}
                className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-lg text-xs font-bold ${
                  on ? t.gold : t.muted
                }`}
              >
                <Icon size={18} />
                <span>{n.mobileLabel}</span>
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}