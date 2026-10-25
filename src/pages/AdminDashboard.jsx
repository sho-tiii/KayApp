import { useState, useEffect, useMemo, useCallback, useRef, useId } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  LogOut,
  RefreshCw,
  LayoutDashboard,
  Users,
  BookOpen,
  Trash2,
  ArrowLeft,
  Sun,
  Moon,
  Search,
  Shield,
  ShieldCheck,
  Layers,
  CalendarDays,
  FileEdit,
  Plus,
  X,
  Activity,
  Settings,
  Download,
  Eye,
  Menu,
  Check,
  Clock,
  AlertCircle,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  MoreHorizontal,
  CheckCircle2,
  ListChecks,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import kayappLogo from '../assets/KAYAPP.png'

/* ================================================================== */
/* Constants & Helpers                                                 */
/* ================================================================== */

const ADMIN_TABS = [
  { key: 'overview', label: 'Overview', mobileLabel: 'Overview', icon: LayoutDashboard, subtitle: 'Real-time platform snapshot, user metrics, and moderation priorities.' },
  { key: 'users', label: 'Community Users', mobileLabel: 'Users', icon: Users, subtitle: 'Manage registered student accounts, activity counts, and Super Admin roles.' },
  { key: 'curriculum', label: 'Subjects & Topics', mobileLabel: 'Subjects', icon: BookOpen, subtitle: 'Inspect, edit, or moderate subjects, topics, and prerequisite links globally.' },
  { key: 'decks', label: 'Decks & Flashcards', mobileLabel: 'Decks', icon: Layers, subtitle: 'Review uploaded study decks, inspect flashcards, and moderate content.' },
  { key: 'tasks', label: 'Study Tasks', mobileLabel: 'Tasks', icon: CalendarDays, subtitle: 'Monitor student study tasks, deadlines, priorities, and completion states.' },
  { key: 'audit', label: 'Activity & Audit Trail', mobileLabel: 'Activity', icon: Activity, subtitle: 'Track recorded study sessions, focus minutes, XP earned, and admin actions.' },
  { key: 'settings', label: 'Admin Settings', mobileLabel: 'Settings', icon: Settings, subtitle: 'Configure workspace appearance, export platform reports, and verify security.' },
]

const VALID_TABS = ADMIN_TABS.map((tab) => tab.key)
const MOBILE_PRIMARY_TABS = ['overview', 'users', 'decks', 'tasks']
const THEME_STORAGE_KEY = 'kayapp-theme'
const NAV_COLLAPSED_KEY = 'kd-admin-nav-collapsed'

const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)
const dayKey = (val) => String(val || '').slice(0, 10)

const fmtDate = (val) => {
  if (!val) return '—'
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return String(val)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const fmtDateTime = (val) => {
  if (!val) return '—'
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return String(val)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// Same subject colour palette as the student dashboard so a subject looks identical on both sides.
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

// Priority + status badges carry their own light/dark classes, so they never depend on a `dark:` variant.
const PRIORITY_BADGE = {
  high: { label: 'High', light: 'bg-[#FDE8E8] text-[#B91C1C]', dark: 'bg-rose-950/60 text-rose-300' },
  normal: { label: 'Medium', light: 'bg-[#FFF4D6] text-[#8A5F0B]', dark: 'bg-amber-950/60 text-[#F5B82E]' },
  low: { label: 'Low', light: 'bg-[#E6F0FA] text-[#1D4ED8]', dark: 'bg-sky-950/60 text-sky-300' },
}

const STATUS_BADGE = {
  done: { label: 'Completed', light: 'bg-emerald-50 text-emerald-800', dark: 'bg-emerald-950/60 text-emerald-200' },
  overdue: { label: 'Overdue', light: 'bg-[#FDE8E8] text-[#B91C1C]', dark: 'bg-rose-950/60 text-rose-300' },
  pending: { label: 'Pending', light: 'bg-[#FFF4D6] text-[#8A5F0B]', dark: 'bg-[#2A2212] text-[#F5B82E]' },
}

/* ================================================================== */
/* Theme hook                                                          */
/* Uses the app-level darkMode / onToggleTheme props when they are     */
/* provided (so the admin and student sides always agree). If the      */
/* route doesn't pass them, it falls back to its own persisted theme.  */
/* ================================================================== */

function useAdminTheme(darkModeProp, onToggleThemeProp) {
  const controlled = typeof onToggleThemeProp === 'function' && typeof darkModeProp === 'boolean'

  const [localDark, setLocalDark] = useState(() => {
    if (typeof darkModeProp === 'boolean') return darkModeProp
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY)
      if (saved === 'dark') return true
      if (saved === 'light') return false
    } catch {
      /* ignore */
    }
    return typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false
  })

  // Follow the parent if it passes darkMode without a toggle handler.
  useEffect(() => {
    if (!controlled && typeof darkModeProp === 'boolean') setLocalDark(darkModeProp)
  }, [controlled, darkModeProp])

  // Self-managed mode: keep <html class="dark"> and storage in sync.
  useEffect(() => {
    if (controlled) return
    document.documentElement.classList.toggle('dark', localDark)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, localDark ? 'dark' : 'light')
    } catch {
      /* ignore */
    }
  }, [controlled, localDark])

  const darkMode = controlled ? darkModeProp : localDark

  const setTheme = useCallback(
    (mode) => {
      const wantDark = mode === 'dark'
      if (controlled) {
        if (wantDark !== darkModeProp) onToggleThemeProp()
      } else {
        setLocalDark(wantDark)
      }
    },
    [controlled, darkModeProp, onToggleThemeProp],
  )

  const toggleTheme = useCallback(() => setTheme(darkMode ? 'light' : 'dark'), [setTheme, darkMode])

  return { darkMode, setTheme, toggleTheme }
}

/* ================================================================== */
/* Small UI Components (same building blocks as the student side)      */
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

function HeroIllustration() {
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

// Tracks open modals so Escape only closes the top-most one (e.g. the card editor over the deck inspector).
const modalStack = []

function Modal({ isOpen, onClose, title, children, darkMode, maxWidth = 'max-w-lg', zIndex = 'z-[90]' }) {
  const uid = useId()
  const headingId = `${uid}-heading`
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!isOpen) return undefined
    modalStack.push(uid)
    const onKey = (e) => {
      if (e.key === 'Escape' && modalStack[modalStack.length - 1] === uid) closeRef.current?.()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      const idx = modalStack.indexOf(uid)
      if (idx > -1) modalStack.splice(idx, 1)
    }
  }, [isOpen, uid])

  if (!isOpen) return null

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeRef.current?.()
      }}
      className={`fixed inset-0 ${zIndex} flex items-center justify-center overflow-y-auto bg-[#0B1525]/65 p-3 backdrop-blur-sm sm:p-5`}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className={`my-auto w-full ${maxWidth} max-h-[min(92dvh,820px)] overflow-y-auto rounded-3xl border p-4 shadow-[0_28px_90px_-28px_rgba(8,24,46,.65)] sm:p-6 ${
          darkMode ? 'border-[#2A3B51] bg-[#111F33] text-slate-100' : 'border-[#E7E9E5] bg-white text-[#173761]'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={headingId} className="text-lg font-bold">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => closeRef.current?.()}
            aria-label="Close dialog"
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
      className="pointer-events-none fixed bottom-20 right-4 z-[95] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 md:bottom-6 md:right-6"
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
          <span className="min-w-0 flex-1">{toast.message}</span>
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
/* Main Component                                                      */
/* ================================================================== */

export default function AdminDashboard({ session, darkMode: darkModeProp, onToggleTheme: onToggleThemeProp }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { darkMode, setTheme, toggleTheme } = useAdminTheme(darkModeProp, onToggleThemeProp)

  const rawTab = searchParams.get('tab')
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState(VALID_TABS.includes(rawTab) ? rawTab : 'overview')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false)
  const [navCollapsed, setNavCollapsed] = useState(() => {
    try {
      return localStorage.getItem(NAV_COLLAPSED_KEY) === '1'
    } catch {
      return false
    }
  })
  const avatarMenuRef = useRef(null)

  // Global Platform Collections
  const [usersList, setUsersList] = useState([])
  const [rolesList, setRolesList] = useState([])
  const [subjects, setSubjects] = useState([])
  const [topics, setTopics] = useState([])
  const [prereqs, setPrereqs] = useState([])
  const [decks, setDecks] = useState([])
  const [cards, setCards] = useState([])
  const [tasks, setTasks] = useState([])
  const [studySessions, setStudySessions] = useState([])
  const [auditLogs, setAuditLogs] = useState([])

  // Filters & Search States
  const [userSearch, setUserSearch] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState('all')
  const [curriculumSearch, setCurriculumSearch] = useState('')
  const [curriculumSubFilter, setCurriculumSubFilter] = useState('all')
  const [deckSearch, setDeckSearch] = useState('')
  const [taskSearch, setTaskSearch] = useState('')
  const [taskStatusFilter, setTaskStatusFilter] = useState('all')
  const [taskPriorityFilter, setTaskPriorityFilter] = useState('all')

  // Modals & Editor States
  const [toasts, setToasts] = useState([])
  const [busyId, setBusyId] = useState('')
  const [editingSubject, setEditingSubject] = useState(null)
  const [editingTopic, setEditingTopic] = useState(null)
  const [editingTask, setEditingTask] = useState(null)
  const [inspectingDeck, setInspectingDeck] = useState(null)
  const [editingCard, setEditingCard] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [manualRoleForm, setManualRoleForm] = useState({ user_id: '', role: 'super_admin' })

  const goToTab = useCallback(
    (key) => {
      if (!VALID_TABS.includes(key)) return
      setActiveTab(key)
      setSearchParams(
        (cur) => {
          const next = new URLSearchParams(cur)
          next.set('tab', key)
          return next
        },
        { replace: true },
      )
      setMobileMenuOpen(false)
      setAvatarMenuOpen(false)
    },
    [setSearchParams],
  )

  const setCollapsed = useCallback((next) => {
    setNavCollapsed(next)
    try {
      localStorage.setItem(NAV_COLLAPSED_KEY, next ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target)) {
        setAvatarMenuOpen(false)
      }
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const pushToast = useCallback((message, type = 'info') => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id))
    }, 4500)
  }, [])

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const logAdminAction = useCallback((action, target) => {
    setAuditLogs((prev) => [
      {
        id: `${Date.now()}-${Math.random()}`,
        action,
        target,
        timestamp: new Date().toISOString(),
        actor: session?.user?.email || 'Super Admin',
      },
      ...prev,
    ])
  }, [session?.user?.email])

  const fetchAllAdminData = useCallback(async () => {
    setRefreshing(true)
    try {
      const [
        rolesRes,
        subjRes,
        topRes,
        prereqRes,
        decksRes,
        cardsRes,
        tasksRes,
        sessionsRes,
        rpcUsersRes,
      ] = await Promise.all([
        supabase.from('user_roles').select('*').order('created_at', { ascending: false }),
        supabase.from('subjects').select('*').order('created_at', { ascending: false }),
        supabase.from('topics').select('*').order('created_at', { ascending: false }),
        supabase.from('topic_prerequisites').select('*'),
        supabase.from('decks').select('*').order('created_at', { ascending: false }),
        supabase.from('cards').select('*').order('created_at', { ascending: false }),
        supabase.from('tasks').select('*').order('created_at', { ascending: false }),
        supabase.from('kayapp_study_sessions').select('*').order('studied_on', { ascending: false }).limit(200),
        supabase.rpc('get_admin_users_overview'),
      ])

      const rolesData = rolesRes.data || []
      const subjData = subjRes.data || []
      const topData = topRes.data || []
      const decksData = decksRes.data || []
      const cardsData = cardsRes.data || []
      const tasksData = tasksRes.data || []
      const sessionsData = sessionsRes.data || []

      setRolesList(rolesData)
      setSubjects(subjData)
      setTopics(topData)
      setPrereqs(prereqRes.data || [])
      setDecks(decksData)
      setCards(cardsData)
      setTasks(tasksData)
      setStudySessions(sessionsData)

      if (!rpcUsersRes.error && Array.isArray(rpcUsersRes.data) && rpcUsersRes.data.length > 0) {
        setUsersList(rpcUsersRes.data)
      } else {
        // Fallback directory synthesized from unique user_ids across tables if RPC wasn't run yet
        const roleMap = new Map(rolesData.map((r) => [r.user_id, r.role]))
        const allUserIds = new Set([
          session?.user?.id,
          ...rolesData.map((r) => r.user_id),
          ...subjData.map((s) => s.user_id),
          ...tasksData.map((t) => t.user_id),
          ...decksData.map((d) => d.user_id),
        ].filter(Boolean))

        const synthesized = Array.from(allUserIds).map((uid) => ({
          user_id: uid,
          email: uid === session?.user?.id ? session.user.email : `User (${uid.slice(0, 8)}…)`,
          full_name: uid === session?.user?.id
            ? (session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Admin')
            : `Student ${uid.slice(0, 6)}`,
          role: roleMap.get(uid) || 'student',
          created_at: null,
          last_sign_in_at: null,
        }))
        setUsersList(synthesized)
      }
    } catch (err) {
      console.error('Error loading admin data:', err)
      pushToast('Some global data could not be loaded. Check your SQL policies.', 'error')
    } finally {
      setRefreshing(false)
    }
  }, [session, pushToast])

  useEffect(() => {
    const verifyAndLoad = async () => {
      if (!session) {
        navigate('/')
        return
      }
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .single()

        if (error || data?.role !== 'super_admin') {
          navigate('/dashboard')
          return
        }
        setIsAdmin(true)
        await fetchAllAdminData()
      } catch {
        navigate('/dashboard')
      } finally {
        setLoading(false)
      }
    }
    verifyAndLoad()
  }, [session, navigate, fetchAllAdminData])


  /* ================================================================== */
  /* Lookup Maps & Derived Statistics                                   */
  /* ================================================================== */

  const userMap = useMemo(() => {
    const map = {}
    usersList.forEach((u) => {
      map[u.user_id] = u
    })
    return map
  }, [usersList])

  const subjectMap = useMemo(() => {
    const map = {}
    subjects.forEach((s) => {
      map[s.id] = s
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

  const userActivityCounts = useMemo(() => {
    const counts = {}
    const ensure = (uid) => {
      if (!uid) return null
      if (!counts[uid]) counts[uid] = { subjects: 0, topics: 0, decks: 0, tasks: 0, studyMinutes: 0 }
      return counts[uid]
    }
    subjects.forEach((s) => { const c = ensure(s.user_id); if (c) c.subjects += 1 })
    topics.forEach((t) => { const c = ensure(t.user_id); if (c) c.topics += 1 })
    decks.forEach((d) => { const c = ensure(d.user_id); if (c) c.decks += 1 })
    tasks.forEach((tk) => { const c = ensure(tk.user_id); if (c) c.tasks += 1 })
    studySessions.forEach((ss) => { const c = ensure(ss.user_id); if (c) c.studyMinutes += Number(ss.duration_minutes || 0) })
    return counts
  }, [subjects, topics, decks, tasks, studySessions])

  const totalStudyMinutes = useMemo(
    () => studySessions.reduce((sum, s) => sum + Number(s.duration_minutes || 0), 0),
    [studySessions],
  )

  const superAdminCount = useMemo(
    () => usersList.filter((u) => u.role === 'super_admin').length || rolesList.filter((r) => r.role === 'super_admin').length,
    [usersList, rolesList],
  )

  /* ================================================================== */
  /* Administrative CRUD Handlers                                       */
  /* ================================================================== */

  const handleRoleChange = async (targetUserId, nextRole) => {
    if (!targetUserId) return
    if (targetUserId === session.user.id && nextRole !== 'super_admin') {
      pushToast('You cannot demote your own active Super Admin session.', 'error')
      return
    }
    setBusyId(targetUserId)
    try {
      const { error } = await supabase
        .from('user_roles')
        .upsert({ user_id: targetUserId, role: nextRole }, { onConflict: 'user_id' })
      if (error) throw error

      setUsersList((prev) =>
        prev.map((u) => (u.user_id === targetUserId ? { ...u, role: nextRole } : u)),
      )
      logAdminAction(`Changed role to ${nextRole}`, userMap[targetUserId]?.email || targetUserId)
      pushToast(`Updated user role to ${nextRole}.`, 'success')
      await fetchAllAdminData()
    } catch (err) {
      pushToast(err.message || 'Could not update role.', 'error')
    } finally {
      setBusyId('')
    }
  }

  const handleManualRoleAssign = async (e) => {
    e.preventDefault()
    const cleanId = manualRoleForm.user_id.trim()
    if (!cleanId) return
    await handleRoleChange(cleanId, manualRoleForm.role)
    setManualRoleForm({ user_id: '', role: 'super_admin' })
  }

  const handleSaveSubject = async (e) => {
    e.preventDefault()
    if (!editingSubject?.name?.trim()) return
    setBusyId(editingSubject.id || 'new-subject')
    try {
      if (editingSubject.id) {
        const { data, error } = await supabase
          .from('subjects')
          .update({ name: editingSubject.name.trim() })
          .eq('id', editingSubject.id)
          .select()
          .single()
        if (error) throw error
        setSubjects((prev) => prev.map((s) => (s.id === data.id ? data : s)))
        logAdminAction('Updated subject', data.name)
        pushToast(`Subject "${data.name}" updated.`, 'success')
      } else {
        const { data, error } = await supabase
          .from('subjects')
          .insert([{ name: editingSubject.name.trim(), user_id: editingSubject.user_id || session.user.id }])
          .select()
          .single()
        if (error) throw error
        setSubjects((prev) => [data, ...prev])
        logAdminAction('Created subject', data.name)
        pushToast(`Created subject "${data.name}".`, 'success')
      }
      setEditingSubject(null)
    } catch (err) {
      pushToast(err.message || 'Could not save subject.', 'error')
    } finally {
      setBusyId('')
    }
  }

  const handleSaveTopic = async (e) => {
    e.preventDefault()
    if (!editingTopic?.title?.trim() || !editingTopic?.subject_id) return
    setBusyId(editingTopic.id || 'new-topic')
    try {
      const payload = {
        title: editingTopic.title.trim(),
        subject_id: editingTopic.subject_id,
        study_minutes: Math.max(5, Number(editingTopic.study_minutes) || 30),
        is_mastered: Boolean(editingTopic.is_mastered),
      }
      if (editingTopic.id) {
        const { data, error } = await supabase
          .from('topics')
          .update(payload)
          .eq('id', editingTopic.id)
          .select()
          .single()
        if (error) throw error
        setTopics((prev) => prev.map((t) => (t.id === data.id ? data : t)))
        logAdminAction('Updated topic', data.title)
        pushToast(`Topic "${data.title}" updated.`, 'success')
      } else {
        const targetSub = subjectMap[editingTopic.subject_id]
        const { data, error } = await supabase
          .from('topics')
          .insert([{ ...payload, user_id: targetSub?.user_id || session.user.id }])
          .select()
          .single()
        if (error) throw error
        setTopics((prev) => [data, ...prev])
        logAdminAction('Created topic', data.title)
        pushToast(`Created topic "${data.title}".`, 'success')
      }
      setEditingTopic(null)
    } catch (err) {
      pushToast(err.message || 'Could not save topic.', 'error')
    } finally {
      setBusyId('')
    }
  }

  const handleToggleTopicMastered = async (topic) => {
    const nextVal = !topic.is_mastered
    setTopics((prev) => prev.map((t) => (t.id === topic.id ? { ...t, is_mastered: nextVal } : t)))
    try {
      const { error } = await supabase.from('topics').update({ is_mastered: nextVal }).eq('id', topic.id)
      if (error) throw error
      logAdminAction(nextVal ? 'Marked topic mastered' : 'Unmarked topic mastered', topic.title)
      pushToast(`Topic "${topic.title}" marked as ${nextVal ? 'mastered' : 'open'}.`, 'success')
    } catch (err) {
      setTopics((prev) => prev.map((t) => (t.id === topic.id ? topic : t)))
      pushToast(err.message || 'Could not update topic.', 'error')
    }
  }

  const handleSaveTask = async (e) => {
    e.preventDefault()
    if (!editingTask?.title?.trim()) return
    setBusyId(editingTask.id || 'new-task')
    try {
      const payload = {
        title: editingTask.title.trim(),
        subject_id: editingTask.subject_id || null,
        due_date: editingTask.due_date || null,
        priority: ['high', 'normal', 'low'].includes(editingTask.priority) ? editingTask.priority : 'normal',
        is_done: Boolean(editingTask.is_done),
      }
      if (editingTask.id) {
        const { data, error } = await supabase
          .from('tasks')
          .update(payload)
          .eq('id', editingTask.id)
          .select()
          .single()
        if (error) throw error
        setTasks((prev) => prev.map((tk) => (tk.id === data.id ? data : tk)))
        logAdminAction('Edited task', data.title)
        pushToast(`Updated task "${data.title}".`, 'success')
      } else {
        const { data, error } = await supabase
          .from('tasks')
          .insert([{ ...payload, user_id: editingTask.user_id || session.user.id }])
          .select()
          .single()
        if (error) throw error
        setTasks((prev) => [data, ...prev])
        logAdminAction('Created task', data.title)
        pushToast(`Created task "${data.title}".`, 'success')
      }
      setEditingTask(null)
    } catch (err) {
      pushToast(err.message || 'Could not save task.', 'error')
    } finally {
      setBusyId('')
    }
  }

  const handleToggleTaskDone = async (task) => {
    const nextDone = !task.is_done
    setTasks((prev) => prev.map((tk) => (tk.id === task.id ? { ...tk, is_done: nextDone } : tk)))
    try {
      const { error } = await supabase.from('tasks').update({ is_done: nextDone }).eq('id', task.id)
      if (error) throw error
      logAdminAction(nextDone ? 'Completed task' : 'Reopened task', task.title)
    } catch (err) {
      setTasks((prev) => prev.map((tk) => (tk.id === task.id ? task : tk)))
      pushToast(err.message || 'Could not toggle task status.', 'error')
    }
  }

  const handleSaveCard = async (e) => {
    e.preventDefault()
    if (!editingCard?.prompt?.trim() || !editingCard?.answer?.trim()) return
    setBusyId(editingCard.id || 'new-card')
    try {
      const payload = {
        prompt: editingCard.prompt.trim(),
        answer: editingCard.answer.trim(),
        is_mastered: Boolean(editingCard.is_mastered),
      }
      if (editingCard.id) {
        const { data, error } = await supabase
          .from('cards')
          .update(payload)
          .eq('id', editingCard.id)
          .select()
          .single()
        if (error) throw error
        setCards((prev) => prev.map((c) => (c.id === data.id ? data : c)))
        logAdminAction('Edited flashcard', data.prompt.slice(0, 40))
        pushToast('Flashcard updated.', 'success')
      } else {
        const { data, error } = await supabase
          .from('cards')
          .insert([{
            ...payload,
            deck_id: editingCard.deck_id,
            user_id: editingCard.user_id || session.user.id,
          }])
          .select()
          .single()
        if (error) throw error
        setCards((prev) => [data, ...prev])
        logAdminAction('Added flashcard', data.prompt.slice(0, 40))
        pushToast('Flashcard added to deck.', 'success')
      }
      setEditingCard(null)
    } catch (err) {
      pushToast(err.message || 'Could not save flashcard.', 'error')
    } finally {
      setBusyId('')
    }
  }

  const executeConfirmedDelete = async () => {
    if (!confirmDelete) return
    const { type, item } = confirmDelete
    setConfirmDelete(null)
    setBusyId(item.id)
    try {
      if (type === 'subject') {
        const { error } = await supabase.from('subjects').delete().eq('id', item.id)
        if (error) throw error
        setSubjects((prev) => prev.filter((s) => s.id !== item.id))
        setTopics((prev) => prev.filter((tp) => tp.subject_id !== item.id))
        logAdminAction('Deleted subject', item.name)
        pushToast(`Deleted subject "${item.name}".`, 'info')
      } else if (type === 'topic') {
        const { error } = await supabase.from('topics').delete().eq('id', item.id)
        if (error) throw error
        setTopics((prev) => prev.filter((tp) => tp.id !== item.id))
        logAdminAction('Deleted topic', item.title)
        pushToast(`Deleted topic "${item.title}".`, 'info')
      } else if (type === 'deck') {
        const { error } = await supabase.from('decks').delete().eq('id', item.id)
        if (error) throw error
        setDecks((prev) => prev.filter((d) => d.id !== item.id))
        setCards((prev) => prev.filter((c) => c.deck_id !== item.id))
        if (inspectingDeck?.id === item.id) setInspectingDeck(null)
        logAdminAction('Deleted deck', item.title)
        pushToast(`Deleted deck "${item.title}".`, 'info')
      } else if (type === 'card') {
        const { error } = await supabase.from('cards').delete().eq('id', item.id)
        if (error) throw error
        setCards((prev) => prev.filter((c) => c.id !== item.id))
        logAdminAction('Deleted flashcard', item.prompt?.slice(0, 35) || item.id)
        pushToast('Flashcard deleted.', 'info')
      } else if (type === 'task') {
        const { error } = await supabase.from('tasks').delete().eq('id', item.id)
        if (error) throw error
        setTasks((prev) => prev.filter((tk) => tk.id !== item.id))
        logAdminAction('Deleted task', item.title)
        pushToast(`Deleted task "${item.title}".`, 'info')
      } else if (type === 'session') {
        const { error } = await supabase.from('kayapp_study_sessions').delete().eq('id', item.id)
        if (error) throw error
        setStudySessions((prev) => prev.filter((ss) => ss.id !== item.id))
        logAdminAction('Deleted study session log', `${item.duration_minutes}m session`)
        pushToast('Study session record removed.', 'info')
      }
    } catch (err) {
      pushToast(err.message || 'Delete failed.', 'error')
    } finally {
      setBusyId('')
    }
  }

  const exportPlatformReportCsv = () => {
    const escapeCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`
    const rows = [
      ['Metric / Category', 'Name / Title', 'Owner Email', 'Status / Role', 'Created Date'],
      ...usersList.map((u) => ['User Account', u.full_name, u.email, u.role, fmtDate(u.created_at)]),
      ...subjects.map((s) => ['Subject', s.name, userMap[s.user_id]?.email || s.user_id, 'Active', fmtDate(s.created_at)]),
      ...topics.map((tp) => ['Topic', tp.title, userMap[tp.user_id]?.email || tp.user_id, tp.is_mastered ? 'Mastered' : 'Open', fmtDate(tp.created_at)]),
      ...decks.map((d) => ['Deck', d.title, userMap[d.user_id]?.email || d.user_id, `${(cardsByDeck[d.id] || []).length} cards`, fmtDate(d.created_at)]),
      ...tasks.map((tk) => ['Study Task', tk.title, userMap[tk.user_id]?.email || tk.user_id, tk.is_done ? 'Completed' : 'Pending', fmtDate(tk.created_at)]),
    ]
    const csv = rows.map((r) => r.map(escapeCsv).join(',')).join('\r\n')
    const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `kayapp-admin-report-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    logAdminAction('Exported CSV platform report', `${rows.length - 1} records`)
    pushToast('Exported complete platform report as CSV.', 'success')
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  /* ================================================================== */
  /* Extra derived stats for the redesigned UI (read-only)               */
  /* ================================================================== */

  const today = ymd(new Date())

  const subjectStyles = useMemo(() => {
    const map = {}
    subjects.forEach((s) => {
      map[s.id] = getSubjectStyle(s.id)
    })
    return map
  }, [subjects])

  const overdueTasks = useMemo(
    () => tasks.filter((tk) => !tk.is_done && tk.due_date && dayKey(tk.due_date) < today),
    [tasks, today],
  )
  const completedTasksCount = useMemo(() => tasks.filter((tk) => tk.is_done).length, [tasks])
  const masteredTopicsCount = useMemo(() => topics.filter((tp) => tp.is_mastered).length, [topics])
  const masteredCardsCount = useMemo(() => cards.filter((c) => c.is_mastered).length, [cards])
  const emptyDecks = useMemo(() => decks.filter((d) => !(cardsByDeck[d.id] || []).length), [decks, cardsByDeck])
  const totalSessionXp = useMemo(
    () => studySessions.reduce((sum, s) => sum + Number(s.xp_earned || 0), 0),
    [studySessions],
  )

  const last7 = useMemo(() => {
    const byDay = {}
    studySessions.forEach((s) => {
      const key = dayKey(s.studied_on)
      if (key) byDay[key] = (byDay[key] || 0) + Number(s.duration_minutes || 0)
    })
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      const key = ymd(d)
      return { key, label: d.toLocaleDateString('en-US', { weekday: 'short' }), mins: byDay[key] || 0 }
    })
  }, [studySessions])

  const tabCounts = {
    users: usersList.length,
    curriculum: subjects.length,
    decks: decks.length,
    tasks: tasks.length,
  }

  /* ================================================================== */
  /* Design Tokens — identical structure to the student dashboard (`t`)  */
  /* Everything is driven by `darkMode`, so no `dark:` variant is needed */
  /* ================================================================== */

  const t = {
    bg: darkMode ? 'bg-[#0B1525] text-slate-100' : 'bg-[#FAFAF7] text-[#173761]',
    sidebar: darkMode ? 'border-[#2A3B51] bg-[#101D30]' : 'border-[#ECECE6] bg-[#FBF9F3]',
    header: darkMode ? 'border-[#2A3B51] bg-[#0B1525]/90' : 'border-[#ECECE6] bg-[#FAFAF7]/90',
    card: darkMode
      ? 'bg-[#111F33] border-[#2A3B51] shadow-sm'
      : 'bg-white border-[#ECECE6] shadow-[0_10px_30px_-18px_rgba(23,55,97,0.10)]',
    panel: darkMode ? 'border-[#2A3B51] bg-[#0B1525]' : 'border-[#ECECE6] bg-[#FAFAF7]',
    divider: darkMode ? 'border-[#2A3B51]' : 'border-[#ECECE6]',
    divideY: darkMode ? 'divide-[#2A3B51]' : 'divide-[#ECECE6]',
    row: darkMode
      ? 'border-[#2A3B51] bg-[#0B1525] hover:border-[#D6B75E]'
      : 'border-[#ECECE6] bg-[#FAFAF7] hover:border-[#D6B75E]',
    rowHover: darkMode ? 'hover:bg-white/[0.03]' : 'hover:bg-[#FAFAF7]',
    tableHead: darkMode ? 'bg-[#0B1525]/70' : 'bg-[#FAFAF7]',
    input: darkMode
      ? 'bg-[#0B1525] border-[#2A3B51] text-white focus:border-[#F5B82E]'
      : 'bg-[#FAFAF7] border-[#E7E9E5] text-[#173761] focus:border-[#173761]',
    muted: darkMode ? 'text-slate-300' : 'text-slate-500',
    danger: darkMode ? 'text-red-400' : 'text-red-600',
    gold: darkMode ? 'text-[#F5B82E]' : 'text-[#B78116]',
    track: darkMode ? 'bg-[#0B1525]' : 'bg-[#E9EDF2]',
    ghost: darkMode ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-[#173761]',
    iconChip: darkMode ? 'bg-[#2A2212] text-[#F5B82E]' : 'bg-[#FFF4D6] text-[#B78116]',
    goldBadge: darkMode ? 'bg-[#2A2212] text-[#F5B82E]' : 'bg-[#FFF4D6] text-[#8A5F0B]',
    blueBadge: darkMode ? 'bg-[#172840] text-sky-200' : 'bg-[#E6F0FA] text-[#173761]',
    okText: darkMode ? 'text-emerald-400' : 'text-emerald-600',
    avatar: 'bg-[#F5B82E] text-[#173761]',
    btn: 'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#173761] px-4 text-sm font-semibold text-white transition hover:bg-[#244B7D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] disabled:cursor-not-allowed disabled:opacity-50',
    btnGold:
      'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#F5B82E] px-4 text-sm font-semibold text-[#173761] transition hover:bg-[#FFD878] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#173761] disabled:cursor-not-allowed disabled:opacity-50',
    btnSecondary: `inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] disabled:cursor-not-allowed disabled:opacity-50 ${
      darkMode
        ? 'border-[#2A3B51] bg-[#0B1525] text-slate-200 hover:border-[#D6B75E]'
        : 'border-[#E7E9E5] bg-[#FAFAF7] text-[#173761] hover:border-[#D6B75E]'
    }`,
    btnDanger:
      'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-50',
    btnHeader: `inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 ${
      darkMode
        ? 'border-[#2A3B51] bg-[#0B1525] text-slate-200 hover:border-[#D6B75E]'
        : 'border-[#E7E9E5] bg-[#FAFAF7] text-[#173761] hover:border-[#D6B75E]'
    }`,
    iconBtn: `inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] ${
      darkMode ? 'text-slate-300 hover:bg-white/10 hover:text-white' : 'text-slate-500 hover:bg-[#173761]/5 hover:text-[#173761]'
    }`,
    iconBtnDanger: `inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 ${
      darkMode ? 'text-red-400 hover:bg-red-500/15' : 'text-red-500 hover:bg-red-500/10'
    }`,
    menuItem: `flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-semibold transition ${
      darkMode ? 'text-slate-300 hover:bg-white/10 hover:text-white' : 'text-slate-600 hover:bg-slate-500/10 hover:text-[#173761]'
    }`,
  }
  const field = `h-10 w-full rounded-lg border px-3 text-sm transition focus:outline-none focus:ring-1 focus:ring-[#F5B82E] ${t.input}`
  const areaField = `w-full rounded-lg border p-3 text-sm transition focus:outline-none focus:ring-1 focus:ring-[#F5B82E] ${t.input}`

  if (loading) {
    return (
      <div className={`flex min-h-screen items-center justify-center ${t.bg}`} style={{ colorScheme: darkMode ? 'dark' : 'light' }}>
        <div className="flex items-center gap-3 text-sm font-bold">
          <RefreshCw size={18} className="animate-spin text-[#F5B82E]" />
          <span>Verifying Super Admin credentials…</span>
        </div>
      </div>
    )
  }

  if (!isAdmin) return null

  const meta = session?.user?.user_metadata || {}
  const adminFullName = (
    meta.full_name ||
    meta.name ||
    meta.display_name ||
    [meta.first_name, meta.last_name].filter(Boolean).join(' ') ||
    session?.user?.email?.split('@')[0] ||
    'Admin'
  ).trim()
  const adminFirstName = adminFullName.split(' ')[0]
  const adminInitials =
    adminFullName
      .split(' ')
      .map((p) => p.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'SA'

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const currentTabMeta = ADMIN_TABS.find((tab) => tab.key === activeTab) || ADMIN_TABS[0]
  const compact = navCollapsed && !mobileMenuOpen

  /* ================================================================== */
  /* Shared render helpers                                              */
  /* ================================================================== */

  const badgeCls = (b) => (darkMode ? b.dark : b.light)

  const renderAvatar = (name, size = 'h-9 w-9') => (
    <span className={`flex ${size} shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase ${t.avatar}`}>
      {(name || 'U').charAt(0)}
    </span>
  )

  const renderRoleBadge = (role) => {
    const isSuper = role === 'super_admin'
    return (
      <span
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
          isSuper ? t.goldBadge : t.blueBadge
        }`}
      >
        {isSuper ? <ShieldCheck size={12} /> : <Shield size={12} />}
        {isSuper ? 'Super Admin' : 'Student'}
      </span>
    )
  }

  const renderSubjectBadge = (subId, fallback = 'General') => {
    const sub = subjectMap[subId]
    if (!sub) {
      return (
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold ${t.blueBadge}`}>{fallback}</span>
      )
    }
    const st = subjectStyles[sub.id] || SUBJECT_BADGES[0]
    return (
      <span className={`inline-flex max-w-full items-center rounded-md px-2 py-0.5 text-[11px] font-bold ${badgeCls(st)}`}>
        <span className="truncate">{sub.name}</span>
      </span>
    )
  }

  const renderPriorityBadge = (priority) => {
    const prio = PRIORITY_BADGE[priority || 'normal'] || PRIORITY_BADGE.normal
    return <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold ${badgeCls(prio)}`}>{prio.label}</span>
  }

  const taskStatusOf = (tk) => (tk.is_done ? 'done' : tk.due_date && dayKey(tk.due_date) < today ? 'overdue' : 'pending')

  const renderStatusBadge = (tk) => {
    const status = STATUS_BADGE[taskStatusOf(tk)]
    return <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold ${badgeCls(status)}`}>{status.label}</span>
  }

  const renderEmpty = (Icon, title, hint) => (
    <div className={`rounded-2xl border border-dashed p-8 text-center ${t.panel}`}>
      <Icon size={28} className={`mx-auto mb-2 ${t.muted} opacity-60`} aria-hidden="true" />
      <p className="text-sm font-bold">{title}</p>
      {hint && <p className={`mx-auto mt-1 max-w-sm text-xs ${t.muted}`}>{hint}</p>}
    </div>
  )

  const renderTaskToggle = (tk) => (
    <button
      type="button"
      onClick={() => handleToggleTaskDone(tk)}
      aria-pressed={Boolean(tk.is_done)}
      aria-label={tk.is_done ? `Reopen task ${tk.title}` : `Mark task ${tk.title} as completed`}
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] ${
        tk.is_done
          ? 'border-emerald-500 bg-emerald-500 text-white'
          : darkMode
          ? 'border-slate-500 bg-transparent hover:border-[#F5B82E]'
          : 'border-[#C9D5E3] bg-white hover:border-[#173761]'
      }`}
    >
      {tk.is_done && <Check size={13} strokeWidth={3} />}
    </button>
  )

  const renderTopicToggle = (tp) => (
    <button
      type="button"
      onClick={() => handleToggleTopicMastered(tp)}
      aria-pressed={Boolean(tp.is_mastered)}
      aria-label={tp.is_mastered ? `Mark ${tp.title} as open` : `Mark ${tp.title} as mastered`}
      title="Toggle mastered state"
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] ${
        tp.is_mastered
          ? 'border-[#F5B82E] bg-[#F5B82E] text-[#173761]'
          : darkMode
          ? 'border-slate-500 bg-transparent hover:border-[#F5B82E]'
          : 'border-[#C9D5E3] bg-white hover:border-[#173761]'
      }`}
    >
      {tp.is_mastered && <Check size={13} strokeWidth={3} />}
    </button>
  )

  const renderSearch = (value, onChange, placeholder, label) => (
    <div className="relative min-w-[200px] flex-1">
      <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className={`${field} pl-9`}
      />
    </div>
  )

  /* ================================================================== */
  /* TAB 1: OVERVIEW                                                    */
  /* ================================================================== */

  const renderOverviewTab = () => {
    const pendingTasks = tasks.filter((tk) => !tk.is_done)
    const attentionCount = overdueTasks.length + emptyDecks.length
    const maxMins = Math.max(30, ...last7.map((d) => d.mins))
    const weekMinutes = last7.reduce((sum, d) => sum + d.mins, 0)

    const kpis = [
      {
        label: 'Community users',
        value: usersList.length,
        sub: `${superAdminCount} Super Admin${superAdminCount === 1 ? '' : 's'} active`,
        icon: Users,
        tab: 'users',
      },
      {
        label: 'Subjects & topics',
        value: subjects.length,
        sub: `${topics.length} topics (${masteredTopicsCount} mastered)`,
        icon: BookOpen,
        tab: 'curriculum',
      },
      {
        label: 'Reviewer decks',
        value: decks.length,
        sub: `${cards.length} total flashcards`,
        icon: Layers,
        tab: 'decks',
      },
      {
        label: 'Study tasks',
        value: tasks.length,
        sub: `${completedTasksCount} completed · ${totalStudyMinutes}m logged`,
        icon: CalendarDays,
        tab: 'tasks',
      },
    ]

    const health = [
      { label: 'Tasks completed', done: completedTasksCount, total: tasks.length },
      { label: 'Topics mastered', done: masteredTopicsCount, total: topics.length },
      { label: 'Flashcards mastered', done: masteredCardsCount, total: cards.length },
    ]

    return (
      <div className="mx-auto w-full max-w-[1440px] space-y-6">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#173761] via-[#1B3F6E] to-[#132C4E] p-6 text-white shadow-[0_20px_50px_-24px_rgba(23,55,97,0.75)] sm:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-16 -right-16 h-64 w-64 rounded-full bg-[#F5B82E]/25 blur-3xl"
          />

          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-bold text-[#F5B82E]">
                <CalendarDays size={14} aria-hidden="true" />
                {todayFormatted}
              </p>
              <h2 className="mt-2 font-serif text-3xl font-bold tracking-tight sm:text-4xl">Welcome back, {adminFirstName}.</h2>
              <p className="mt-1 max-w-xl text-sm text-white/80">
                Monitor student accounts, review decks, and keep KayApp running smoothly.
              </p>
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-bold text-[#F5B82E] backdrop-blur-xs">
              <ShieldCheck size={13} /> Super Admin
            </span>
          </div>

          <div className="relative mt-6 flex flex-col justify-between gap-6 rounded-2xl border border-white/15 bg-white/[0.06] p-5 backdrop-blur-xs lg:flex-row lg:items-center">
            <div className="flex items-start gap-4">
              <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/90 sm:flex">
                <ListChecks size={22} />
              </span>
              <div>
                <span className="inline-block rounded-full bg-[#F5B82E] px-2.5 py-0.5 text-[11px] font-bold text-[#173761]">
                  {attentionCount > 0
                    ? `${attentionCount} item${attentionCount === 1 ? '' : 's'} need attention`
                    : 'All clear'}
                </span>
                <h3 className="mt-1.5 text-lg font-bold">
                  {attentionCount > 0 ? 'A few things are worth reviewing' : 'Nothing needs your attention right now'}
                </h3>
                <p className="mt-0.5 text-xs text-white/75">
                  {overdueTasks.length} overdue task{overdueTasks.length === 1 ? '' : 's'} · {emptyDecks.length} empty deck
                  {emptyDecks.length === 1 ? '' : 's'} · {pendingTasks.length} pending task{pendingTasks.length === 1 ? '' : 's'}
                </p>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={() => goToTab('tasks')}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#F5B82E] px-5 text-xs font-bold text-[#173761] shadow-sm transition hover:bg-[#FFD878] focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <ListChecks size={14} /> Review tasks
                  </button>
                  <button
                    type="button"
                    onClick={() => goToTab('users')}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/25 px-4 text-xs font-semibold text-white transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E]"
                  >
                    <Users size={14} /> Manage users
                  </button>
                  <button
                    type="button"
                    onClick={exportPlatformReportCsv}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/25 px-4 text-xs font-semibold text-white transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E]"
                  >
                    <Download size={14} /> Export report
                  </button>
                </div>
              </div>
            </div>
            <HeroIllustration />
          </div>
        </section>

        {/* KPI cards */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((stat) => {
            const Icon = stat.icon
            return (
              <button
                key={stat.label}
                type="button"
                onClick={() => goToTab(stat.tab)}
                className={`flex flex-col justify-between rounded-2xl border p-5 text-left transition hover:border-[#F5B82E] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] ${t.card}`}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className={`text-xs font-semibold ${t.muted}`}>{stat.label}</span>
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${t.iconChip}`}>
                    <Icon size={18} />
                  </span>
                </div>
                <p className="mt-2 text-3xl font-extrabold tracking-tight">{stat.value}</p>
                <p className={`mt-1 text-xs ${t.muted}`}>{stat.sub}</p>
              </button>
            )
          })}
        </section>

        {/* Study activity + platform health */}
        <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
          <section className={`rounded-3xl border p-6 ${t.card}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-bold">Study minutes, last 7 days</h3>
                <p className={`text-xs ${t.muted}`}>Across all students, from the 200 most recent recorded sessions.</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${t.goldBadge}`}>{weekMinutes} min this week</span>
            </div>
            <div
              role="img"
              aria-label={`Study minutes per day: ${last7.map((d) => `${d.label} ${d.mins}`).join(', ')}`}
              className="mt-5 grid grid-cols-7 items-end gap-2 sm:gap-3"
            >
              {last7.map((day) => (
                <div key={day.key} className="flex min-w-0 flex-col items-center gap-2">
                  <span className={`text-[11px] font-semibold ${t.muted}`}>{day.mins}m</span>
                  <div className={`flex h-28 w-full items-end overflow-hidden rounded-lg ${t.track}`}>
                    <div
                      className="w-full rounded-t-md bg-[#F5B82E] transition-all"
                      style={{ height: `${day.mins ? Math.max(5, (day.mins / maxMins) * 100) : 2}%` }}
                    />
                  </div>
                  <span className={`text-[11px] ${t.muted}`}>{day.label}</span>
                </div>
              ))}
            </div>
          </section>

          <section className={`rounded-3xl border p-6 ${t.card}`}>
            <h3 className="text-base font-bold">Platform health</h3>
            <p className={`text-xs ${t.muted}`}>How much of the content is completed or mastered.</p>
            <ul className="mt-5 space-y-5">
              {health.map((item) => (
                <li key={item.label}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-bold">{item.label}</span>
                    <span className={`text-xs ${t.muted}`}>
                      {item.done}/{item.total} · {pct(item.done, item.total)}%
                    </span>
                  </div>
                  <div className="mt-2">
                    <Bar value={pct(item.done, item.total)} label={item.label} track={t.track} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Recent users + recent content */}
        <div className="grid gap-6 lg:grid-cols-2">
          <section className={`rounded-3xl border p-6 ${t.card}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold">Recent community users</h3>
                <p className={`text-xs ${t.muted}`}>Latest accounts and their workspace activity.</p>
              </div>
              <button
                type="button"
                onClick={() => goToTab('users')}
                className={`shrink-0 text-xs font-bold hover:underline ${t.gold}`}
              >
                View all →
              </button>
            </div>

            <div className="mt-4">
              {usersList.length === 0 ? (
                renderEmpty(Users, 'No users found', 'Registered student accounts will appear here.')
              ) : (
                <ul className="space-y-2.5">
                  {usersList.slice(0, 5).map((u) => {
                    const counts = userActivityCounts[u.user_id] || { subjects: 0, decks: 0, tasks: 0 }
                    return (
                      <li key={u.user_id} className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition ${t.row}`}>
                        <div className="flex min-w-0 items-center gap-3">
                          {renderAvatar(u.full_name || u.email)}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold">{u.full_name}</p>
                            <p className={`truncate text-xs ${t.muted}`}>
                              {counts.subjects} subjects · {counts.decks} decks · {counts.tasks} tasks
                            </p>
                          </div>
                        </div>
                        {renderRoleBadge(u.role)}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </section>

          <section className={`rounded-3xl border p-6 ${t.card}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold">Recent subjects &amp; tasks</h3>
                <p className={`text-xs ${t.muted}`}>{pendingTasks.length} task{pendingTasks.length === 1 ? '' : 's'} pending platform-wide.</p>
              </div>
              <button
                type="button"
                onClick={() => goToTab('curriculum')}
                className={`shrink-0 text-xs font-bold hover:underline ${t.gold}`}
              >
                Manage all →
              </button>
            </div>

            <div className="mt-4">
              {subjects.length === 0 && tasks.length === 0 ? (
                renderEmpty(BookOpen, 'You’re all caught up', 'Subjects and study tasks created by students will appear here.')
              ) : (
                <ul className="space-y-2.5">
                  {subjects.slice(0, 3).map((sub) => (
                    <li key={sub.id} className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition ${t.row}`}>
                      <div className="min-w-0">
                        <span className="rounded bg-[#173761] px-2 py-0.5 text-[11px] font-bold text-[#F5B82E]">Subject</span>
                        <p className="mt-1 truncate text-sm font-bold">{sub.name}</p>
                        <p className={`truncate text-xs ${t.muted}`}>
                          {userMap[sub.user_id]?.email || sub.user_id?.slice(0, 8)} · {fmtDate(sub.created_at)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete({ type: 'subject', item: sub })}
                        aria-label={`Delete subject ${sub.name}`}
                        className={t.iconBtnDanger}
                      >
                        <Trash2 size={15} />
                      </button>
                    </li>
                  ))}
                  {tasks.slice(0, 3).map((tk) => (
                    <li key={tk.id} className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition ${t.row}`}>
                      <div className="min-w-0">
                        <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${t.goldBadge}`}>Task</span>
                        <p className={`mt-1 truncate text-sm font-bold ${tk.is_done ? `${t.muted} line-through` : ''}`}>{tk.title}</p>
                        <p className={`truncate text-xs ${t.muted}`}>
                          {userMap[tk.user_id]?.email || tk.user_id?.slice(0, 8)} · {tk.due_date ? `Due ${fmtDate(tk.due_date)}` : 'No due date'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete({ type: 'task', item: tk })}
                        aria-label={`Delete task ${tk.title}`}
                        className={t.iconBtnDanger}
                      >
                        <Trash2 size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        <p className={`pt-2 text-center text-xs italic ${t.muted}`}>Kaya mo ’yan. May plano ka na.</p>
      </div>
    )
  }

  /* ================================================================== */
  /* TAB 2: COMMUNITY USERS & ROLE MANAGEMENT                           */
  /* ================================================================== */

  const renderRoleAction = (u) => {
    const isSelf = u.user_id === session.user.id
    const isSuper = u.role === 'super_admin'
    return isSuper ? (
      <button
        type="button"
        disabled={isSelf || busyId === u.user_id}
        onClick={() => handleRoleChange(u.user_id, 'student')}
        className={t.btnSecondary}
        title={isSelf ? 'Cannot demote your own active account' : 'Demote to Student'}
      >
        Demote to Student
      </button>
    ) : (
      <button
        type="button"
        disabled={busyId === u.user_id}
        onClick={() => handleRoleChange(u.user_id, 'super_admin')}
        className={t.btnGold}
      >
        <ShieldCheck size={14} /> Promote to Super Admin
      </button>
    )
  }

  const renderActivityChips = (act) => (
    <div className="flex flex-wrap gap-1.5">
      {[
        [act.subjects, 'Subjects'],
        [act.topics, 'Topics'],
        [act.decks, 'Decks'],
        [act.tasks, 'Tasks'],
      ].map(([count, label]) => (
        <span key={label} className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${t.panel}`}>
          {count} {label}
        </span>
      ))}
      {act.studyMinutes > 0 && (
        <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${t.goldBadge}`}>{act.studyMinutes}m studied</span>
      )}
    </div>
  )

  const renderUsersTab = () => {
    const filteredUsers = usersList.filter((u) => {
      if (userRoleFilter !== 'all' && u.role !== userRoleFilter) return false
      if (userSearch.trim()) {
        const q = userSearch.trim().toLowerCase()
        const matchEmail = (u.email || '').toLowerCase().includes(q)
        const matchName = (u.full_name || '').toLowerCase().includes(q)
        const matchId = (u.user_id || '').toLowerCase().includes(q)
        if (!matchEmail && !matchName && !matchId) return false
      }
      return true
    })
    const emptyAct = { subjects: 0, topics: 0, decks: 0, tasks: 0, studyMinutes: 0 }

    return (
      <div className="mx-auto w-full max-w-[1440px] space-y-6">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <section className={`rounded-2xl border p-4 ${t.card}`}>
            <h3 className="text-sm font-bold">Search &amp; filter users</h3>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-[1fr_190px]">
              {renderSearch(userSearch, setUserSearch, 'Search by name, email, or User UID…', 'Search users')}
              <select
                aria-label="Filter by role"
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className={field}
              >
                <option value="all">All roles ({usersList.length})</option>
                <option value="super_admin">Super Admins</option>
                <option value="student">Students</option>
              </select>
            </div>
          </section>

          <section className={`rounded-2xl border p-4 ${t.card}`}>
            <h3 className="text-sm font-bold">Assign role by User UID</h3>
            <form onSubmit={handleManualRoleAssign} className="mt-3 flex flex-wrap gap-2">
              <input
                type="text"
                aria-label="Supabase User UID"
                value={manualRoleForm.user_id}
                onChange={(e) => setManualRoleForm((f) => ({ ...f, user_id: e.target.value }))}
                placeholder="Paste Supabase User UID…"
                className={`${field} min-w-[180px] flex-1 font-mono text-xs`}
              />
              <select
                aria-label="Role to assign"
                value={manualRoleForm.role}
                onChange={(e) => setManualRoleForm((f) => ({ ...f, role: e.target.value }))}
                className={`${field} w-auto`}
              >
                <option value="super_admin">super_admin</option>
                <option value="student">student</option>
              </select>
              <button type="submit" disabled={!manualRoleForm.user_id.trim()} className={t.btn}>
                Apply
              </button>
            </form>
          </section>
        </div>

        <section className={`overflow-hidden rounded-3xl border ${t.card}`}>
          <div className={`flex flex-wrap items-center justify-between gap-2 border-b px-6 py-4 ${t.divider}`}>
            <h3 className="text-base font-bold">Registered users ({filteredUsers.length})</h3>
            <span className={`text-xs ${t.muted}`}>Promote or demote accounts with the role action on each row.</span>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="p-6">{renderEmpty(Users, 'No users match your filters', 'Try a different name, email, or role.')}</div>
          ) : (
            <>
              {/* Mobile: stacked cards */}
              <ul className="space-y-2.5 p-4 md:hidden">
                {filteredUsers.map((u) => {
                  const act = userActivityCounts[u.user_id] || emptyAct
                  const isSelf = u.user_id === session.user.id
                  return (
                    <li key={u.user_id} className={`rounded-xl border p-4 ${t.row}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          {renderAvatar(u.full_name || u.email)}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold">
                              {u.full_name} {isSelf && <span className={`text-[11px] ${t.gold}`}>(You)</span>}
                            </p>
                            <p className={`truncate text-xs ${t.muted}`}>{u.email}</p>
                          </div>
                        </div>
                        {renderRoleBadge(u.role)}
                      </div>
                      <div className="mt-3">{renderActivityChips(act)}</div>
                      <p className={`mt-3 text-[11px] ${t.muted}`}>
                        Joined {fmtDate(u.created_at)} · Last active {fmtDate(u.last_sign_in_at)}
                      </p>
                      <p className={`mt-1 break-all font-mono text-[10px] opacity-70 ${t.muted}`}>{u.user_id}</p>
                      <div className="mt-3">{renderRoleAction(u)}</div>
                    </li>
                  )
                })}
              </ul>

              {/* Desktop: table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[860px] text-left text-xs">
                  <thead className={t.tableHead}>
                    <tr className={`border-b text-[11px] ${t.muted} ${t.divider}`}>
                      <th scope="col" className="px-6 py-3 font-semibold">User</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Role</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Workspace activity</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Joined / last sign-in</th>
                      <th scope="col" className="px-6 py-3 text-right font-semibold">Role action</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${t.divideY}`}>
                    {filteredUsers.map((u) => {
                      const act = userActivityCounts[u.user_id] || emptyAct
                      const isSelf = u.user_id === session.user.id
                      return (
                        <tr key={u.user_id} className={`transition ${t.rowHover}`}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {renderAvatar(u.full_name || u.email)}
                              <div className="min-w-0">
                                <p className="text-sm font-bold">
                                  {u.full_name} {isSelf && <span className={`text-[11px] ${t.gold}`}>(You)</span>}
                                </p>
                                <p className={t.muted}>{u.email}</p>
                                <p className={`font-mono text-[10px] opacity-70 ${t.muted}`}>{u.user_id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">{renderRoleBadge(u.role)}</td>
                          <td className="px-4 py-4">{renderActivityChips(act)}</td>
                          <td className={`px-4 py-4 ${t.muted}`}>
                            <p>Joined {fmtDate(u.created_at)}</p>
                            <p className="text-[11px]">Last active {fmtDate(u.last_sign_in_at)}</p>
                          </td>
                          <td className="px-6 py-4 text-right">{renderRoleAction(u)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    )
  }

  /* ================================================================== */
  /* TAB 3: SUBJECTS & TOPICS (CURRICULUM CRUD)                         */
  /* ================================================================== */

  const renderCurriculumTab = () => {
    const q = curriculumSearch.trim().toLowerCase()
    const filteredSubjects = subjects.filter((s) => {
      if (curriculumSubFilter !== 'all' && s.id !== curriculumSubFilter) return false
      if (!q) return true
      return s.name.toLowerCase().includes(q) || (userMap[s.user_id]?.email || '').toLowerCase().includes(q)
    })

    const filteredTopics = topics.filter((tp) => {
      if (curriculumSubFilter !== 'all' && tp.subject_id !== curriculumSubFilter) return false
      if (!q) return true
      const subName = subjectMap[tp.subject_id]?.name?.toLowerCase() || ''
      return tp.title.toLowerCase().includes(q) || subName.includes(q)
    })

    return (
      <div className="mx-auto w-full max-w-[1440px] space-y-6">
        <section className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 ${t.card}`}>
          <div className="flex flex-1 flex-wrap items-center gap-2.5">
            {renderSearch(curriculumSearch, setCurriculumSearch, 'Search subjects or topics…', 'Search subjects or topics')}
            <select
              aria-label="Filter by subject"
              value={curriculumSubFilter}
              onChange={(e) => setCurriculumSubFilter(e.target.value)}
              className={`${field} sm:w-56`}
            >
              <option value="all">All subjects ({subjects.length})</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setEditingSubject({ name: '', user_id: session.user.id })} className={t.btnSecondary}>
              <Plus size={15} /> New subject
            </button>
            <button
              type="button"
              disabled={subjects.length === 0}
              onClick={() =>
                setEditingTopic({
                  title: '',
                  subject_id: subjects[0]?.id || '',
                  study_minutes: 30,
                  is_mastered: false,
                })
              }
              className={t.btn}
            >
              <Plus size={15} /> New topic
            </button>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className={`rounded-3xl border p-6 ${t.card}`}>
            <h3 className="text-base font-bold">Global subjects ({filteredSubjects.length})</h3>
            <div className="mt-4">
              {filteredSubjects.length === 0 ? (
                renderEmpty(BookOpen, 'No matching subjects', 'Adjust the search or create a new subject.')
              ) : (
                <ul className="max-h-[640px] space-y-2.5 overflow-y-auto pr-1">
                  {filteredSubjects.map((sub) => {
                    const topicCount = topics.filter((tp) => tp.subject_id === sub.id).length
                    const st = subjectStyles[sub.id] || SUBJECT_BADGES[0]
                    return (
                      <li key={sub.id} className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 transition ${t.row}`}>
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            aria-hidden="true"
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: darkMode ? st.darkDot : st.dot }}
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold">{sub.name}</p>
                            <p className={`truncate text-xs ${t.muted}`}>
                              {topicCount} topic{topicCount === 1 ? '' : 's'} · {userMap[sub.user_id]?.email || sub.user_id?.slice(0, 8)}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button type="button" onClick={() => setEditingSubject(sub)} aria-label={`Edit ${sub.name}`} className={t.iconBtn}>
                            <FileEdit size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete({ type: 'subject', item: sub })}
                            aria-label={`Delete ${sub.name}`}
                            className={t.iconBtnDanger}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </section>

          <section className={`rounded-3xl border p-6 ${t.card}`}>
            <h3 className="text-base font-bold">Global topics ({filteredTopics.length})</h3>
            <div className="mt-4">
              {filteredTopics.length === 0 ? (
                renderEmpty(Layers, 'No matching topics', 'Adjust the search or create a new topic.')
              ) : (
                <ul className="max-h-[640px] space-y-2.5 overflow-y-auto pr-1">
                  {filteredTopics.map((tp) => {
                    const prereqCount = prereqs.filter((p) => p.topic_id === tp.id).length
                    return (
                      <li key={tp.id} className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 transition ${t.row}`}>
                        <div className="flex min-w-0 items-center gap-3">
                          {renderTopicToggle(tp)}
                          <div className="min-w-0">
                            <p className={`truncate text-sm font-bold ${tp.is_mastered ? `${t.muted} line-through` : ''}`}>{tp.title}</p>
                            <div className={`mt-1 flex flex-wrap items-center gap-1.5 text-xs ${t.muted}`}>
                              {renderSubjectBadge(tp.subject_id, 'Unlinked')}
                              <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${t.goldBadge}`}>
                                {tp.study_minutes ?? 30} min
                              </span>
                              {prereqCount > 0 && <span>{prereqCount} prereq{prereqCount === 1 ? '' : 's'}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button type="button" onClick={() => setEditingTopic(tp)} aria-label={`Edit ${tp.title}`} className={t.iconBtn}>
                            <FileEdit size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete({ type: 'topic', item: tp })}
                            aria-label={`Delete ${tp.title}`}
                            className={t.iconBtnDanger}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    )
  }

  /* ================================================================== */
  /* TAB 4: DECKS & FLASHCARDS                                          */
  /* ================================================================== */

  const renderDecksTab = () => {
    const q = deckSearch.trim().toLowerCase()
    const filteredDecks = decks.filter((d) => {
      if (!q) return true
      const subName = subjectMap[d.subject_id]?.name?.toLowerCase() || ''
      const ownerEmail = (userMap[d.user_id]?.email || '').toLowerCase()
      return d.title.toLowerCase().includes(q) || subName.includes(q) || ownerEmail.includes(q)
    })

    return (
      <div className="mx-auto w-full max-w-[1440px] space-y-6">
        <section className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 ${t.card}`}>
          {renderSearch(deckSearch, setDeckSearch, 'Search reviewer decks by title, subject, or owner…', 'Search decks')}
          <span className={`text-xs font-semibold ${t.muted}`}>
            {decks.length} decks · {cards.length} flashcards
          </span>
        </section>

        {filteredDecks.length === 0 ? (
          renderEmpty(Layers, 'No reviewer decks found', 'Decks students create from uploaded reviewers will appear here.')
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredDecks.map((d) => {
              const dCards = cardsByDeck[d.id] || []
              const masteredCount = dCards.filter((c) => c.is_mastered).length
              return (
                <article key={d.id} className={`flex flex-col justify-between rounded-2xl border p-5 ${t.card}`}>
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      {renderSubjectBadge(d.subject_id, 'General')}
                      <span className={`shrink-0 text-xs font-bold ${t.gold}`}>+{d.xp_awarded || 0} XP</span>
                    </div>
                    <h3 className="mt-2.5 text-base font-bold">{d.title}</h3>
                    <p className={`mt-1 truncate text-xs ${t.muted}`}>Owner: {userMap[d.user_id]?.email || d.user_id?.slice(0, 8)}</p>
                    <p className={`mt-0.5 text-xs ${t.muted}`}>
                      {dCards.length} cards · {masteredCount} mastered · Created {fmtDate(d.created_at)}
                    </p>
                    <div className="mt-3">
                      <Bar value={pct(masteredCount, dCards.length)} label={`${d.title} mastery`} track={t.track} />
                    </div>
                  </div>

                  <div className={`mt-5 flex items-center justify-between gap-2 border-t pt-3.5 ${t.divider}`}>
                    <button type="button" onClick={() => setInspectingDeck(d)} className={t.btnSecondary}>
                      <Eye size={15} /> Inspect cards ({dCards.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete({ type: 'deck', item: d })}
                      aria-label={`Delete deck ${d.title}`}
                      className={t.iconBtnDanger}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  /* ================================================================== */
  /* TAB 5: STUDY TASKS & DEADLINES                                     */
  /* ================================================================== */

  const renderTaskActions = (tk) => (
    <div className="inline-flex items-center gap-0.5">
      <button type="button" onClick={() => setEditingTask(tk)} aria-label={`Edit ${tk.title}`} className={t.iconBtn}>
        <FileEdit size={15} />
      </button>
      <button
        type="button"
        onClick={() => setConfirmDelete({ type: 'task', item: tk })}
        aria-label={`Delete ${tk.title}`}
        className={t.iconBtnDanger}
      >
        <Trash2 size={15} />
      </button>
    </div>
  )

  const renderTasksTab = () => {
    const q = taskSearch.trim().toLowerCase()
    const filteredTasks = tasks.filter((tk) => {
      if (taskStatusFilter === 'pending' && tk.is_done) return false
      if (taskStatusFilter === 'done' && !tk.is_done) return false
      if (taskPriorityFilter !== 'all' && (tk.priority || 'normal') !== taskPriorityFilter) return false
      if (!q) return true
      const ownerEmail = (userMap[tk.user_id]?.email || '').toLowerCase()
      return tk.title.toLowerCase().includes(q) || ownerEmail.includes(q)
    })

    return (
      <div className="mx-auto w-full max-w-[1440px] space-y-6">
        <section className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 ${t.card}`}>
          <div className="flex flex-1 flex-wrap items-center gap-2.5">
            {renderSearch(taskSearch, setTaskSearch, 'Search study tasks by title or student email…', 'Search study tasks')}
            <select
              aria-label="Filter by status"
              value={taskStatusFilter}
              onChange={(e) => setTaskStatusFilter(e.target.value)}
              className={`${field} sm:w-44`}
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending only</option>
              <option value="done">Completed only</option>
            </select>
            <select
              aria-label="Filter by priority"
              value={taskPriorityFilter}
              onChange={(e) => setTaskPriorityFilter(e.target.value)}
              className={`${field} sm:w-44`}
            >
              <option value="all">All priorities</option>
              <option value="high">High priority</option>
              <option value="normal">Medium priority</option>
              <option value="low">Low priority</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() =>
              setEditingTask({
                title: '',
                subject_id: subjects[0]?.id || '',
                due_date: new Date().toISOString().slice(0, 10),
                priority: 'normal',
                is_done: false,
                user_id: session.user.id,
              })
            }
            className={t.btn}
          >
            <Plus size={15} /> Add task
          </button>
        </section>

        <section className={`overflow-hidden rounded-3xl border ${t.card}`}>
          <div className={`flex flex-wrap items-center justify-between gap-2 border-b px-6 py-4 ${t.divider}`}>
            <h3 className="text-base font-bold">Global study tasks ({filteredTasks.length})</h3>
            <span className={`text-xs ${t.muted}`}>
              {overdueTasks.length} overdue · {tasks.filter((tk) => !tk.is_done).length} pending
            </span>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="p-6">{renderEmpty(CalendarDays, 'No tasks match your filters', 'Try clearing the search or changing the filters.')}</div>
          ) : (
            <>
              {/* Mobile: stacked cards */}
              <ul className="space-y-2.5 p-4 md:hidden">
                {filteredTasks.map((tk) => (
                  <li key={tk.id} className={`rounded-xl border p-4 ${t.row}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        {renderTaskToggle(tk)}
                        <div className="min-w-0">
                          <p className={`break-words text-sm font-bold ${tk.is_done ? `${t.muted} line-through` : ''}`}>{tk.title}</p>
                          <p className={`mt-0.5 truncate text-xs ${t.muted}`}>{userMap[tk.user_id]?.email || tk.user_id?.slice(0, 8)}</p>
                        </div>
                      </div>
                      {renderTaskActions(tk)}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {renderSubjectBadge(tk.subject_id, 'No subject')}
                      {renderPriorityBadge(tk.priority)}
                      {renderStatusBadge(tk)}
                      <span className={`text-[11px] ${t.muted}`}>Due {fmtDate(tk.due_date)}</span>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Desktop: table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[900px] text-left text-xs">
                  <thead className={t.tableHead}>
                    <tr className={`border-b text-[11px] ${t.muted} ${t.divider}`}>
                      <th scope="col" className="px-6 py-3 font-semibold">Task</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Student</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Subject</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Priority</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Due date</th>
                      <th scope="col" className="px-6 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${t.divideY}`}>
                    {filteredTasks.map((tk) => (
                      <tr key={tk.id} className={`transition ${t.rowHover}`}>
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            {renderTaskToggle(tk)}
                            <span className={`text-sm font-bold ${tk.is_done ? `${t.muted} line-through` : ''}`}>{tk.title}</span>
                          </div>
                        </td>
                        <td className={`px-4 py-3.5 ${t.muted}`}>{userMap[tk.user_id]?.email || tk.user_id?.slice(0, 8)}</td>
                        <td className="px-4 py-3.5">{tk.subject_id ? renderSubjectBadge(tk.subject_id) : <span className={t.muted}>—</span>}</td>
                        <td className="px-4 py-3.5">{renderPriorityBadge(tk.priority)}</td>
                        <td className="px-4 py-3.5">{renderStatusBadge(tk)}</td>
                        <td className={`px-4 py-3.5 ${t.muted}`}>{fmtDate(tk.due_date)}</td>
                        <td className="px-6 py-3.5 text-right">{renderTaskActions(tk)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    )
  }

  /* ================================================================== */
  /* TAB 6: ACTIVITY & AUDIT TRAIL                                      */
  /* ================================================================== */

  const renderAuditTab = () => (
    <div className="mx-auto w-full max-w-[1440px] space-y-6">
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: 'Sessions recorded', value: studySessions.length, sub: 'Most recent 200' },
          { label: 'Minutes logged', value: totalStudyMinutes, sub: 'Focus and review time' },
          { label: 'XP earned', value: totalSessionXp, sub: 'From recorded sessions' },
          { label: 'Admin actions', value: auditLogs.length, sub: 'During this session' },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-2xl border p-4 ${t.card}`}>
            <p className={`text-xs font-semibold ${t.muted}`}>{stat.label}</p>
            <p className="mt-2 text-2xl font-extrabold tracking-tight">{stat.value}</p>
            <p className={`mt-1 text-xs ${t.muted}`}>{stat.sub}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recorded Study Sessions */}
        <section className={`rounded-3xl border p-6 ${t.card}`}>
          <h3 className="text-base font-bold">Student study sessions ({studySessions.length})</h3>
          <p className={`text-xs ${t.muted}`}>Total logged focus &amp; review time: {totalStudyMinutes} minutes</p>

          <div className="mt-4">
            {studySessions.length === 0 ? (
              renderEmpty(Activity, 'No study sessions recorded yet', 'Sessions appear once students finish a focus timer or deck review.')
            ) : (
              <ul className="max-h-[640px] space-y-2.5 overflow-y-auto pr-1">
                {studySessions.slice(0, 25).map((ss) => (
                  <li key={ss.id} className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 text-xs transition ${t.row}`}>
                    <div className="min-w-0">
                      <p className="text-sm font-bold">
                        {ss.duration_minutes || 0} mins · <span className="capitalize">{ss.session_type || 'study'}</span>
                      </p>
                      <p className={`truncate ${t.muted}`}>
                        {userMap[ss.user_id]?.email || ss.user_id?.slice(0, 8)} · {fmtDate(ss.studied_on)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete({ type: 'session', item: ss })}
                      aria-label="Delete session record"
                      className={t.iconBtnDanger}
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Admin Action Audit Trail */}
        <section className={`rounded-3xl border p-6 ${t.card}`}>
          <h3 className="text-base font-bold">Session audit trail ({auditLogs.length})</h3>
          <p className={`text-xs ${t.muted}`}>Administrative actions performed during this session.</p>

          <div className="mt-4">
            {auditLogs.length === 0 ? (
              renderEmpty(Clock, 'No admin actions recorded yet', 'Edits, role changes, exports, and deletions are logged here as you make them.')
            ) : (
              <ul className="max-h-[640px] space-y-2.5 overflow-y-auto pr-1">
                {auditLogs.map((log) => (
                  <li key={log.id} className={`rounded-xl border p-3.5 text-xs ${t.row}`}>
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                      <span className="text-sm font-bold">{log.action}</span>
                      <span className={t.muted}>{fmtDateTime(log.timestamp)}</span>
                    </div>
                    <p className={`mt-0.5 break-words ${t.muted}`}>
                      Target: <strong className={darkMode ? 'text-slate-100' : 'text-[#173761]'}>{log.target}</strong> · By {log.actor}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  )

  /* ================================================================== */
  /* TAB 7: ADMIN SETTINGS, THEME & EXPORT                              */
  /* ================================================================== */

  const renderThemeTile = (mode) => {
    const isDarkTile = mode === 'dark'
    const active = darkMode === isDarkTile
    const c = isDarkTile
      ? { bg: '#0B1525', side: '#101D30', card: '#111F33', line: '#2A3B51' }
      : { bg: '#FAFAF7', side: '#FBF9F3', card: '#FFFFFF', line: '#ECECE6' }
    return (
      <button
        key={mode}
        type="button"
        onClick={() => setTheme(mode)}
        aria-pressed={active}
        className={`rounded-2xl border-2 p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] ${
          active ? 'border-[#F5B82E]' : `${t.divider} hover:border-[#D6B75E]`
        }`}
      >
        <span aria-hidden="true" className="flex h-24 overflow-hidden rounded-xl border" style={{ backgroundColor: c.bg, borderColor: c.line }}>
          <span className="block w-1/4 border-r p-2" style={{ backgroundColor: c.side, borderColor: c.line }}>
            <span className="block h-1.5 w-full rounded-full bg-[#F5B82E]" />
            <span className="mt-1.5 block h-1.5 w-2/3 rounded-full" style={{ backgroundColor: c.line }} />
            <span className="mt-1.5 block h-1.5 w-1/2 rounded-full" style={{ backgroundColor: c.line }} />
          </span>
          <span className="block flex-1 p-2">
            <span className="block h-5 rounded-md bg-[#173761]" />
            <span className="mt-1.5 flex gap-1.5">
              <span className="block h-8 flex-1 rounded-md border" style={{ backgroundColor: c.card, borderColor: c.line }} />
              <span className="block h-8 flex-1 rounded-md border" style={{ backgroundColor: c.card, borderColor: c.line }} />
            </span>
          </span>
        </span>
        <span className="mt-3 flex items-center justify-between text-sm font-semibold">
          <span className="inline-flex items-center gap-2">
            {isDarkTile ? <Moon size={15} /> : <Sun size={15} />}
            {isDarkTile ? 'Dark' : 'Light'}
          </span>
          {active && (
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#F5B82E] text-[#173761]">
              <Check size={12} strokeWidth={3} />
            </span>
          )}
        </span>
      </button>
    )
  }

  const renderSettingsTab = () => (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <section className={`rounded-3xl border p-6 ${t.card}`}>
        <h3 className="text-base font-bold">Super Admin profile &amp; security</h3>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-extrabold ${t.avatar}`}>
              {adminInitials}
            </span>
            <div className="min-w-0">
              <p className="text-base font-bold">{adminFullName}</p>
              <p className={`truncate text-xs ${t.muted}`}>{session?.user?.email}</p>
              <p className={`mt-1 break-all font-mono text-[11px] opacity-80 ${t.muted}`}>UID: {session?.user?.id}</p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold ${t.goldBadge}`}>
            <CheckCircle2 size={13} /> Verified Super Admin
          </span>
        </div>
      </section>

      <section className={`rounded-3xl border p-6 ${t.card}`}>
        <h3 className="text-base font-bold">Appearance</h3>
        <p className={`mt-1 text-xs ${t.muted}`}>
          Choose how the admin workspace looks. Your choice carries over to the student dashboard.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2" role="group" aria-label="Theme">
          {renderThemeTile('light')}
          {renderThemeTile('dark')}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={() => navigate('/dashboard')} className={t.btn}>
            <ArrowLeft size={15} /> Open student workspace
          </button>
        </div>
      </section>

      <section className={`rounded-3xl border p-6 ${t.card}`}>
        <h3 className="text-base font-bold">Platform data export</h3>
        <p className={`mt-1 text-xs ${t.muted}`}>
          Download a CSV snapshot of all registered users, subjects, topics, reviewer decks, and study tasks.
        </p>
        <button type="button" onClick={exportPlatformReportCsv} className={`mt-4 ${t.btnGold}`}>
          <Download size={15} /> Export full platform report (CSV)
        </button>
      </section>
    </div>
  )

  /* ================================================================== */
  /* Main Layout Shell                                                  */
  /* ================================================================== */

  const confirmItem = confirmDelete?.item
  const confirmLabel =
    confirmItem?.name || confirmItem?.title || confirmItem?.prompt?.slice(0, 40) || (confirmDelete?.type === 'session' ? `${confirmItem?.duration_minutes || 0}m session` : confirmItem?.id)

  return (
    <div
      className={`min-h-screen pb-16 transition-colors duration-200 md:pb-0 ${t.bg}`}
      style={{ colorScheme: darkMode ? 'dark' : 'light' }}
    >
      <ToastRegion toasts={toasts} onDismiss={dismissToast} darkMode={darkMode} />

      {mobileMenuOpen && (
        <div onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 z-40 bg-black/50 md:hidden" aria-hidden="true" />
      )}

      {/* Left Sidebar — same structure as the student side, with the decorative warm waves */}
      <aside
        aria-label="Admin navigation"
        className={`fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden border-r transition-all duration-200 md:translate-x-0 ${t.sidebar} ${
          navCollapsed ? 'md:w-18' : 'md:w-64'
        } ${mobileMenuOpen ? 'w-64 translate-x-0' : '-translate-x-full'}`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 260 320"
          preserveAspectRatio="none"
          className="pointer-events-none absolute bottom-0 left-0 h-72 w-full"
        >
          <path d="M0,190 C90,150 175,90 260,25 L260,320 L0,320 Z" fill={darkMode ? 'rgba(245, 184, 46, 0.05)' : '#F5EFE0'} />
          <path d="M75,320 C115,215 190,145 260,120 L260,320 Z" fill={darkMode ? 'rgba(245, 184, 46, 0.09)' : '#EFE4C8'} />
        </svg>

        <div className="relative z-10 px-5 pb-3 pt-5">
          {!compact ? (
            <div>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => goToTab('overview')}
                  className="flex items-center gap-2.5 rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E]"
                >
                  <img src={kayappLogo} alt="" className="h-9 w-9 object-contain" />
                  <span className="text-xl font-extrabold tracking-tight">
                    <span className={darkMode ? 'text-white' : 'text-[#173761]'}>KAY</span>
                    <span className="text-[#E6A51C]">APP</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setCollapsed(true)}
                  aria-label="Collapse sidebar"
                  className={`hidden h-7 w-7 items-center justify-center rounded-lg md:flex ${t.ghost}`}
                >
                  <PanelLeftClose size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close menu"
                  className={`flex h-7 w-7 items-center justify-center rounded-lg md:hidden ${t.ghost}`}
                >
                  <X size={17} />
                </button>
              </div>
              <p className={`mt-1 text-[11px] font-semibold ${t.gold}`}>Admin workspace</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => goToTab('overview')}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#173761] text-sm font-extrabold text-[#F5B82E]"
                title="KayApp Admin"
              >
                K
              </button>
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                aria-label="Expand sidebar"
                className={`hidden h-7 w-7 items-center justify-center rounded-lg md:flex ${t.ghost}`}
              >
                <PanelLeftOpen size={15} />
              </button>
            </div>
          )}
        </div>

        <div className="relative z-10 flex-1 space-y-6 overflow-y-auto px-3 py-3">
          <nav aria-label="Admin sections" className="space-y-1.5">
            {ADMIN_TABS.map((tab) => {
              const Icon = tab.icon
              const on = activeTab === tab.key
              const count = tabCounts[tab.key] || 0
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => goToTab(tab.key)}
                  aria-current={on ? 'page' : undefined}
                  title={compact ? tab.label : undefined}
                  className={`flex h-11 w-full items-center gap-3 rounded-2xl px-4 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] ${
                    compact ? 'justify-center px-0' : ''
                  } ${
                    on
                      ? 'bg-gradient-to-r from-[#F6CC66] to-[#F5B82E] font-bold text-[#173761] shadow-[0_6px_16px_-6px_rgba(245,184,46,0.75)]'
                      : darkMode
                      ? 'text-slate-300 hover:bg-white/5 hover:text-white'
                      : 'text-[#173761]/80 hover:bg-black/5 hover:text-[#173761]'
                  }`}
                >
                  <Icon size={18} strokeWidth={2} />
                  {!compact && (
                    <>
                      <span className="truncate">{tab.label}</span>
                      {count > 0 && (
                        <span
                          className={`ml-auto flex h-5 min-w-[1.35rem] items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${
                            on ? 'bg-[#173761] text-[#F5B82E]' : darkMode ? 'bg-white/10 text-slate-300' : 'bg-[#E5E7EB] text-[#173761]'
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </>
                  )}
                </button>
              )
            })}
          </nav>

          {!compact && (
            <div className="pt-2">
              <p className={`px-3 pb-2 text-xs font-bold ${t.muted}`}>Workspaces</p>
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] ${t.ghost} ${
                  darkMode ? 'hover:bg-white/5' : 'hover:bg-black/5'
                }`}
              >
                <ArrowLeft size={15} className={t.gold} />
                <span>Student workspace</span>
              </button>
            </div>
          )}
        </div>

        <div className="relative z-10 p-3.5">
          {!compact ? (
            <div className={`rounded-2xl border p-4 shadow-sm ${t.card}`}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold">
                  <ShieldCheck size={14} className={t.gold} /> Super Admin
                </span>
                <span className={`text-xs font-bold ${t.okText}`}>Verified</span>
              </div>
              <p className={`mt-2 truncate text-[11px] ${t.muted}`}>{session?.user?.email}</p>
              <div className={`mt-2 flex items-center justify-between text-[11px] ${t.muted}`}>
                <span>{usersList.length} users</span>
                <span>{auditLogs.length} actions this session</span>
              </div>
            </div>
          ) : (
            <div title="Verified Super Admin" className="flex justify-center">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#173761] text-[#F5B82E]">
                <ShieldCheck size={17} />
              </span>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`transition-[padding] duration-200 ${navCollapsed ? 'md:pl-18' : 'md:pl-64'}`}>
        <header className={`sticky top-0 z-30 flex h-16 items-center justify-between border-b px-4 backdrop-blur sm:px-8 ${t.header}`}>
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border md:hidden ${t.panel}`}
            >
              <Menu size={19} />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold sm:text-lg">{currentTabMeta.label}</h1>
              <p className={`hidden truncate text-xs sm:block ${t.muted}`}>{currentTabMeta.subtitle}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={fetchAllAdminData}
              disabled={refreshing}
              aria-label="Refresh platform data"
              className={`${t.btnHeader}`}
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin text-[#F5B82E]' : ''} />
              <span className="hidden sm:inline">{refreshing ? 'Refreshing…' : 'Refresh'}</span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className={`flex h-10 w-10 items-center justify-center rounded-full border shadow-2xs transition hover:border-[#D6B75E] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] ${t.card}`}
            >
              {darkMode ? <Sun size={16} className="text-[#F5B82E]" /> : <Moon size={16} />}
            </button>

            <div ref={avatarMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setAvatarMenuOpen((o) => !o)}
                aria-expanded={avatarMenuOpen}
                aria-haspopup="menu"
                aria-label="Account menu"
                className={`flex items-center gap-2 rounded-full border p-1 pr-3 text-xs font-semibold shadow-2xs transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] ${t.card}`}
              >
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold uppercase ${t.avatar}`}>
                  {adminInitials.charAt(0)}
                </span>
                <span className="hidden max-w-[140px] truncate sm:inline">{adminFullName}</span>
                <ChevronDown size={14} className={t.muted} />
              </button>

              {avatarMenuOpen && (
                <div role="menu" className={`absolute right-0 mt-2 w-60 rounded-xl border p-1.5 shadow-xl ${t.card}`}>
                  <div className={`border-b px-3 py-2 ${t.divider}`}>
                    <p className="truncate text-xs font-bold">{adminFullName}</p>
                    <p className={`truncate text-xs ${t.muted}`}>{session?.user?.email}</p>
                    <span className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${t.goldBadge}`}>
                      <ShieldCheck size={11} /> Super Admin
                    </span>
                  </div>

                  <button type="button" role="menuitem" onClick={() => goToTab('settings')} className={`mt-1 ${t.menuItem}`}>
                    <Settings size={15} /> Admin settings
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAvatarMenuOpen(false)
                      navigate('/dashboard')
                    }}
                    className={t.menuItem}
                  >
                    <ArrowLeft size={15} /> Student workspace
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      toggleTheme()
                      setAvatarMenuOpen(false)
                    }}
                    className={t.menuItem}
                  >
                    {darkMode ? <Sun size={15} /> : <Moon size={15} />}
                    {darkMode ? 'Switch to Light mode' : 'Switch to Dark mode'}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-semibold text-red-500 transition hover:bg-red-500/10"
                  >
                    <LogOut size={15} /> Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] px-3 pb-24 pt-4 sm:px-8 sm:py-8 sm:pb-8">
          {activeTab === 'overview' && renderOverviewTab()}
          {activeTab === 'users' && renderUsersTab()}
          {activeTab === 'curriculum' && renderCurriculumTab()}
          {activeTab === 'decks' && renderDecksTab()}
          {activeTab === 'tasks' && renderTasksTab()}
          {activeTab === 'audit' && renderAuditTab()}
          {activeTab === 'settings' && renderSettingsTab()}
        </main>

        {/* Mobile bottom navigation — four primary sections + "More" opens the drawer */}
        <nav
          aria-label="Mobile navigation"
          className={`fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t px-1 py-1 backdrop-blur md:hidden ${
            darkMode ? 'border-[#2A3B51] bg-[#101D30]/95' : 'border-[#E7E9E5] bg-white/95'
          }`}
        >
          {ADMIN_TABS.filter((tab) => MOBILE_PRIMARY_TABS.includes(tab.key)).map((tab) => {
            const Icon = tab.icon
            const on = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => goToTab(tab.key)}
                aria-current={on ? 'page' : undefined}
                className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-lg text-xs font-bold ${on ? t.gold : t.muted}`}
              >
                <Icon size={18} />
                <span>{tab.mobileLabel}</span>
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-lg text-xs font-bold ${
              MOBILE_PRIMARY_TABS.includes(activeTab) ? t.muted : t.gold
            }`}
          >
            <MoreHorizontal size={18} />
            <span>More</span>
          </button>
        </nav>
      </div>

      {/* ================================================================ */}
      {/* MODALS: Subject, Topic, Task, Deck Inspector, Card, Delete       */}
      {/* ================================================================ */}

      <Modal
        isOpen={Boolean(editingSubject)}
        onClose={() => setEditingSubject(null)}
        title={editingSubject?.id ? 'Edit subject' : 'Create subject'}
        darkMode={darkMode}
        maxWidth="max-w-md"
      >
        {editingSubject && (
          <form onSubmit={handleSaveSubject} className="space-y-4">
            <label className="block text-xs font-semibold">
              Subject name
              <input
                type="text"
                required
                autoFocus
                value={editingSubject.name}
                onChange={(e) => setEditingSubject((s) => ({ ...s, name: e.target.value }))}
                className={`mt-1.5 ${field}`}
              />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditingSubject(null)} className={t.btnSecondary}>
                Cancel
              </button>
              <button type="submit" disabled={busyId === (editingSubject.id || 'new-subject')} className={t.btn}>
                {busyId === (editingSubject.id || 'new-subject') ? 'Saving…' : 'Save subject'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(editingTopic)}
        onClose={() => setEditingTopic(null)}
        title={editingTopic?.id ? 'Edit topic' : 'Create topic'}
        darkMode={darkMode}
        maxWidth="max-w-md"
      >
        {editingTopic && (
          <form onSubmit={handleSaveTopic} className="space-y-4">
            <label className="block text-xs font-semibold">
              Topic title
              <input
                type="text"
                required
                autoFocus
                value={editingTopic.title}
                onChange={(e) => setEditingTopic((tp) => ({ ...tp, title: e.target.value }))}
                className={`mt-1.5 ${field}`}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold">
                Subject
                <select
                  value={editingTopic.subject_id}
                  onChange={(e) => setEditingTopic((tp) => ({ ...tp, subject_id: e.target.value }))}
                  className={`mt-1.5 ${field}`}
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold">
                Study minutes
                <input
                  type="number"
                  min="5"
                  max="600"
                  value={editingTopic.study_minutes ?? 30}
                  onChange={(e) => setEditingTopic((tp) => ({ ...tp, study_minutes: e.target.value }))}
                  className={`mt-1.5 ${field}`}
                />
              </label>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
              <input
                type="checkbox"
                checked={Boolean(editingTopic.is_mastered)}
                onChange={(e) => setEditingTopic((tp) => ({ ...tp, is_mastered: e.target.checked }))}
                className="h-4 w-4 accent-[#173761]"
              />
              Mark topic as mastered
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditingTopic(null)} className={t.btnSecondary}>
                Cancel
              </button>
              <button type="submit" disabled={busyId === (editingTopic.id || 'new-topic')} className={t.btn}>
                {busyId === (editingTopic.id || 'new-topic') ? 'Saving…' : 'Save topic'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(editingTask)}
        onClose={() => setEditingTask(null)}
        title={editingTask?.id ? 'Edit study task' : 'Create study task'}
        darkMode={darkMode}
        maxWidth="max-w-md"
      >
        {editingTask && (
          <form onSubmit={handleSaveTask} className="space-y-4">
            <label className="block text-xs font-semibold">
              Task title
              <input
                type="text"
                required
                autoFocus
                value={editingTask.title}
                onChange={(e) => setEditingTask((tk) => ({ ...tk, title: e.target.value }))}
                className={`mt-1.5 ${field}`}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold">
                Subject
                <select
                  value={editingTask.subject_id || ''}
                  onChange={(e) => setEditingTask((tk) => ({ ...tk, subject_id: e.target.value }))}
                  className={`mt-1.5 ${field}`}
                >
                  <option value="">No subject</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold">
                Priority
                <select
                  value={editingTask.priority || 'normal'}
                  onChange={(e) => setEditingTask((tk) => ({ ...tk, priority: e.target.value }))}
                  className={`mt-1.5 ${field}`}
                >
                  <option value="high">High</option>
                  <option value="normal">Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>
            </div>
            <label className="block text-xs font-semibold">
              Due date
              <input
                type="date"
                value={editingTask.due_date ? String(editingTask.due_date).slice(0, 10) : ''}
                onChange={(e) => setEditingTask((tk) => ({ ...tk, due_date: e.target.value }))}
                className={`mt-1.5 ${field}`}
              />
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
              <input
                type="checkbox"
                checked={Boolean(editingTask.is_done)}
                onChange={(e) => setEditingTask((tk) => ({ ...tk, is_done: e.target.checked }))}
                className="h-4 w-4 accent-[#173761]"
              />
              Mark task as completed
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditingTask(null)} className={t.btnSecondary}>
                Cancel
              </button>
              <button type="submit" disabled={busyId === (editingTask.id || 'new-task')} className={t.btn}>
                {busyId === (editingTask.id || 'new-task') ? 'Saving…' : 'Save task'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Deck Flashcard Inspector */}
      <Modal
        isOpen={Boolean(inspectingDeck)}
        onClose={() => setInspectingDeck(null)}
        title={inspectingDeck ? `Deck inspector · ${inspectingDeck.title}` : 'Deck inspector'}
        darkMode={darkMode}
        maxWidth="max-w-3xl"
      >
        {inspectingDeck && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className={`text-sm ${t.muted}`}>{(cardsByDeck[inspectingDeck.id] || []).length} flashcards inside this deck</p>
              <button
                type="button"
                onClick={() =>
                  setEditingCard({
                    deck_id: inspectingDeck.id,
                    user_id: inspectingDeck.user_id,
                    prompt: '',
                    answer: '',
                    is_mastered: false,
                  })
                }
                className={t.btn}
              >
                <Plus size={15} /> Add card
              </button>
            </div>

            <div className="max-h-[55dvh] space-y-2.5 overflow-y-auto pr-1">
              {(cardsByDeck[inspectingDeck.id] || []).length === 0 ? (
                renderEmpty(Layers, 'This deck has no flashcards', 'Add the first card to get it started.')
              ) : (
                (cardsByDeck[inspectingDeck.id] || []).map((c, idx) => (
                  <article key={c.id} className={`flex items-start justify-between gap-3 rounded-xl border p-3.5 ${t.row}`}>
                    <div className="min-w-0">
                      <p className={`text-xs font-bold ${t.gold}`}>
                        Card {idx + 1}
                        {c.is_mastered ? ' · Mastered' : ''}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm font-semibold">{c.prompt}</p>
                      <p className={`mt-2 whitespace-pre-wrap text-xs ${t.muted}`}>Answer: {c.answer}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button type="button" onClick={() => setEditingCard(c)} aria-label={`Edit card ${idx + 1}`} className={t.iconBtn}>
                        <FileEdit size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete({ type: 'card', item: c })}
                        aria-label={`Delete card ${idx + 1}`}
                        className={t.iconBtnDanger}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Flashcard Create / Edit (stacks above the inspector) */}
      <Modal
        isOpen={Boolean(editingCard)}
        onClose={() => setEditingCard(null)}
        title={editingCard?.id ? 'Edit flashcard' : 'Add flashcard'}
        darkMode={darkMode}
        maxWidth="max-w-lg"
        zIndex="z-[92]"
      >
        {editingCard && (
          <form onSubmit={handleSaveCard} className="space-y-4">
            <label className="block text-xs font-semibold">
              Question / prompt
              <textarea
                rows={3}
                required
                value={editingCard.prompt}
                onChange={(e) => setEditingCard((c) => ({ ...c, prompt: e.target.value }))}
                className={`mt-1.5 ${areaField}`}
              />
            </label>
            <label className="block text-xs font-semibold">
              Answer
              <textarea
                rows={3}
                required
                value={editingCard.answer}
                onChange={(e) => setEditingCard((c) => ({ ...c, answer: e.target.value }))}
                className={`mt-1.5 ${areaField}`}
              />
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
              <input
                type="checkbox"
                checked={Boolean(editingCard.is_mastered)}
                onChange={(e) => setEditingCard((c) => ({ ...c, is_mastered: e.target.checked }))}
                className="h-4 w-4 accent-[#173761]"
              />
              Mark card as mastered
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditingCard(null)} className={t.btnSecondary}>
                Cancel
              </button>
              <button type="submit" disabled={busyId === (editingCard.id || 'new-card')} className={t.btn}>
                {busyId === (editingCard.id || 'new-card') ? 'Saving…' : 'Save flashcard'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Permanent Delete Confirmation */}
      <Modal
        isOpen={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title={`Permanently delete this ${confirmDelete?.type || 'item'}?`}
        darkMode={darkMode}
        maxWidth="max-w-md"
        zIndex="z-[94]"
      >
        {confirmDelete && (
          <>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-500">
                <AlertCircle size={20} />
              </span>
              <p className={`text-sm leading-relaxed ${t.muted}`}>
                <strong className={darkMode ? 'text-slate-100' : 'text-[#173761]'}>{confirmLabel}</strong> will be deleted from the platform
                and can’t be recovered.
              </p>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDelete(null)} className={t.btnSecondary}>
                Cancel
              </button>
              <button type="button" onClick={executeConfirmedDelete} className={t.btnDanger}>
                <Trash2 size={15} /> Delete permanently
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}