import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LogOut,
  RefreshCw,
  LayoutDashboard,
  Users,
  BookOpen,
  CheckCircle2,
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
  Sparkles,
  AlertCircle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import kayappLogo from '../assets/KAYAPP.png'

const ADMIN_TABS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard, subtitle: 'Real-time platform snapshot, user metrics, and moderation priorities.' },
  { key: 'users', label: 'Community Users', icon: Users, subtitle: 'Manage registered student accounts, activity counts, and Super Admin roles.' },
  { key: 'curriculum', label: 'Subjects & Topics', icon: BookOpen, subtitle: 'Inspect, edit, or moderate subjects, topics, and prerequisite links globally.' },
  { key: 'decks', label: 'Decks & Flashcards', icon: Layers, subtitle: 'Review uploaded study decks, inspect flashcards, and moderate content.' },
  { key: 'tasks', label: 'Study Tasks', icon: CalendarDays, subtitle: 'Monitor student study tasks, deadlines, priorities, and completion states.' },
  { key: 'audit', label: 'Activity & Audit Trail', icon: Activity, subtitle: 'Track recorded study sessions, focus minutes, XP earned, and admin actions.' },
  { key: 'settings', label: 'Admin Settings', icon: Settings, subtitle: 'Configure workspace appearance, export platform reports, and verify security.' },
]

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

export default function AdminDashboard({ session, darkMode, onToggleTheme }) {
  const navigate = useNavigate()
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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

  const pushToast = useCallback((message, type = 'info') => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id))
    }, 4500)
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
  /* Design Tokens (Insulated for stable Light/Dark execution)          */
  /* ================================================================== */

  const ui = {
    bg: darkMode ? 'bg-[#0B1525] text-slate-100' : 'bg-[#F9FAFB] text-[#173761]',
    sidebar: darkMode ? 'border-[#2A3B51] bg-[#101D30]' : 'border-[#E5E7EB] bg-[#F1F3F5]',
    header: darkMode ? 'border-[#2A3B51] bg-[#0B1525]/90' : 'border-[#E5E7EB] bg-[#F9FAFB]/90',
    card: darkMode
      ? 'bg-[#111F33] border-[#2A3B51] shadow-sm'
      : 'bg-[#FFFFFF] border-[#E5E7EB] shadow-sm',
    panel: darkMode ? 'border-[#2A3B51] bg-[#0B1525]' : 'border-[#E5E7EB] bg-[#F9FAFB]',
    input: darkMode
      ? 'bg-[#0B1525] border-[#2A3B51] text-white focus:border-[#F5B82E]'
      : 'bg-[#FFFFFF] border-[#E5E7EB] text-[#173761] focus:border-[#173761]',
    muted: darkMode ? 'text-slate-400' : 'text-slate-500',
    goldText: darkMode ? 'text-[#F5B82E]' : 'text-[#B78116]',
    btnPrimary:
      'inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#173761] px-4 text-xs font-bold text-white transition hover:bg-[#244B7D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] disabled:opacity-50',
    btnGold:
      'inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#F5B82E] px-4 text-xs font-bold text-[#173761] transition hover:bg-[#E6A51C] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#173761] disabled:opacity-50',
    btnSecondary: `inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-xs font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] ${
      darkMode
        ? 'border-[#2A3B51] bg-[#0B1525] text-slate-200 hover:border-[#F5B82E]'
        : 'border-[#E5E7EB] bg-[#FFFFFF] text-[#173761] hover:border-[#173761]'
    }`,
  }

  if (loading) {
    return (
      <div className={`flex min-h-screen items-center justify-center ${ui.bg}`}>
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
  const adminInitials = adminFullName
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

  const currentTabMeta = ADMIN_TABS.find((t) => t.key === activeTab) || ADMIN_TABS[0]

  /* ================================================================== */
  /* TAB 1: OVERVIEW                                                    */
  /* ================================================================== */

  const renderOverviewTab = () => {
    const pendingTasks = tasks.filter((t) => !t.is_done)
    const completedTasks = tasks.filter((t) => t.is_done)
    const masteredTopics = topics.filter((t) => t.is_mastered)

    return (
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#173761] via-[#1B3F6E] to-[#132C4E] p-7 text-white shadow-[0_20px_50px_-24px_rgba(23,55,97,0.75)] sm:p-9">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-12 -top-12 h-72 w-72 rounded-full bg-[#F5B82E]/20 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-20 right-10 h-60 w-60 rounded-full bg-white/5"
          />

          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-widest text-[#F5B82E]">
                {todayFormatted}
              </p>
              <h2 className="mt-2 font-serif text-3xl font-bold tracking-tight sm:text-4xl">
                Welcome back, {adminFirstName}.
              </h2>
              <p className="mt-2.5 text-sm leading-relaxed text-white/85">
                Monitor student accounts, inspect subjects and reviewer decks, manage global tasks, and keep KayApp running smoothly.
              </p>
            </div>

            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-bold text-[#F5B82E]">
              <Sparkles size={14} /> “Kaya mo ’yan. May plano ka na.”
            </span>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: 'COMMUNITY USERS',
              value: usersList.length,
              sub: `${superAdminCount} Super Admin(s) active`,
              icon: Users,
              onClick: () => setActiveTab('users'),
            },
            {
              label: 'SUBJECTS & TOPICS',
              value: subjects.length,
              sub: `${topics.length} topics (${masteredTopics.length} mastered)`,
              icon: BookOpen,
              onClick: () => setActiveTab('curriculum'),
            },
            {
              label: 'REVIEWER DECKS',
              value: decks.length,
              sub: `${cards.length} total flashcards generated`,
              icon: Layers,
              onClick: () => setActiveTab('decks'),
            },
            {
              label: 'STUDY TASKS & SESSIONS',
              value: tasks.length,
              sub: `${completedTasks.length} completed · ${totalStudyMinutes}m logged`,
              icon: CalendarDays,
              onClick: () => setActiveTab('tasks'),
            },
          ].map((stat) => {
            const Icon = stat.icon
            return (
              <button
                key={stat.label}
                type="button"
                onClick={stat.onClick}
                className={`flex flex-col justify-between rounded-3xl border p-6 text-left transition hover:-translate-y-0.5 hover:border-[#F5B82E] ${ui.card}`}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${ui.muted}`}>
                    {stat.label}
                  </span>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FFF4D6] text-[#B78116] dark:bg-[#2A2212] dark:text-[#F5B82E]">
                    <Icon size={18} />
                  </span>
                </div>
                <p className="mt-3 text-4xl font-extrabold tracking-tight">{stat.value}</p>
                <p className={`mt-1 text-xs ${ui.muted}`}>{stat.sub}</p>
              </button>
            )
          })}
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className={`rounded-3xl border p-6 ${ui.card}`}>
            <div className="flex items-center justify-between border-b pb-4 border-inherit">
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-wider ${ui.goldText}`}>
                  USER DIRECTORY
                </p>
                <h3 className="mt-0.5 text-lg font-bold">Recent Community Users</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('users')}
                className={`text-xs font-bold hover:underline ${ui.goldText}`}
              >
                View all →
              </button>
            </div>

            {usersList.length === 0 ? (
              <div className="py-12 text-center">
                <Users size={30} className={`mx-auto mb-2 opacity-30 ${ui.muted}`} />
                <p className="text-sm font-bold">No users found</p>
              </div>
            ) : (
              <ul className="mt-3 divide-y divide-slate-200/60 dark:divide-[#2A3B51]">
                {usersList.slice(0, 5).map((u) => {
                  const counts = userActivityCounts[u.user_id] || { subjects: 0, decks: 0, tasks: 0 }
                  return (
                    <li key={u.user_id} className="flex items-center justify-between gap-3 py-3.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#173761] text-xs font-bold uppercase text-[#F5B82E]">
                          {(u.full_name || u.email || 'U').charAt(0)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">{u.full_name}</p>
                          <p className={`truncate text-xs ${ui.muted}`}>
                            {u.email} · {counts.subjects} subj · {counts.decks} decks · {counts.tasks} tasks
                          </p>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          u.role === 'super_admin'
                            ? 'bg-[#FFF4D6] text-[#8A5F0B] dark:bg-[#2A2212] dark:text-[#F5B82E]'
                            : 'bg-[#E5E7EB] text-[#173761] dark:bg-[#172840] dark:text-sky-200'
                        }`}
                      >
                        {u.role === 'super_admin' ? 'Super Admin' : 'Student'}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className={`rounded-3xl border p-6 ${ui.card}`}>
            <div className="flex items-center justify-between border-b pb-4 border-inherit">
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-wider ${ui.goldText}`}>
                  LIVE PLATFORM CONTENT
                </p>
                <h3 className="mt-0.5 text-lg font-bold">Recent Subjects &amp; Tasks ({pendingTasks.length} pending)</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('curriculum')}
                className={`text-xs font-bold hover:underline ${ui.goldText}`}
              >
                Manage all →
              </button>
            </div>

            {subjects.length === 0 && tasks.length === 0 ? (
              <div className="py-12 text-center">
                <BookOpen size={30} className={`mx-auto mb-2 opacity-30 ${ui.muted}`} />
                <p className="text-sm font-bold">You’re all caught up</p>
                <p className={`mt-1 text-xs ${ui.muted}`}>
                  Subjects and study tasks created by students will appear here.
                </p>
              </div>
            ) : (
              <ul className="mt-3 divide-y divide-slate-200/60 dark:divide-[#2A3B51]">
                {subjects.slice(0, 3).map((sub) => (
                  <li key={sub.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <span className="rounded bg-[#173761] px-2 py-0.5 text-[10px] font-bold uppercase text-[#F5B82E]">
                        Subject
                      </span>
                      <p className="mt-1 truncate text-sm font-bold">{sub.name}</p>
                      <p className={`text-xs ${ui.muted}`}>
                        Owner: {userMap[sub.user_id]?.email || sub.user_id?.slice(0, 8)} · {fmtDate(sub.created_at)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete({ type: 'subject', item: sub })}
                      aria-label={`Delete subject ${sub.name}`}
                      className="rounded-lg p-2 text-red-500 transition hover:bg-red-500/10"
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
                {tasks.slice(0, 3).map((tk) => (
                  <li key={tk.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <span className="rounded bg-[#FFF4D6] px-2 py-0.5 text-[10px] font-bold uppercase text-[#8A5F0B]">
                        Task
                      </span>
                      <p className={`mt-1 truncate text-sm font-bold ${tk.is_done ? 'line-through opacity-60' : ''}`}>
                        {tk.title}
                      </p>
                      <p className={`text-xs ${ui.muted}`}>
                        Owner: {userMap[tk.user_id]?.email || tk.user_id?.slice(0, 8)} · {tk.due_date ? `Due ${fmtDate(tk.due_date)}` : 'No due date'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete({ type: 'task', item: tk })}
                      aria-label={`Delete task ${tk.title}`}
                      className="rounded-lg p-2 text-red-500 transition hover:bg-red-500/10"
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    )
  }

  /* ================================================================== */
  /* TAB 2: COMMUNITY USERS & ROLE MANAGEMENT                           */
  /* ================================================================== */

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

    return (
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <section className={`rounded-2xl border p-4 ${ui.card}`}>
            <p className="text-xs font-bold">Search &amp; Filter Community Users</p>
            <div className="mt-2.5 grid gap-2.5 sm:grid-cols-[1fr_170px]">
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search by name, email, or User UID…"
                  className={`h-10 w-full rounded-xl border pl-9 pr-3 text-xs ${ui.input}`}
                />
              </div>
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className={`h-10 rounded-xl border px-3 text-xs font-semibold ${ui.input}`}
              >
                <option value="all">All roles ({usersList.length})</option>
                <option value="super_admin">Super Admins</option>
                <option value="student">Students</option>
              </select>
            </div>
          </section>

          <section className={`rounded-2xl border p-4 ${ui.card}`}>
            <p className="text-xs font-bold">Assign Role by User UID</p>
            <form onSubmit={handleManualRoleAssign} className="mt-2.5 flex flex-wrap gap-2">
              <input
                type="text"
                value={manualRoleForm.user_id}
                onChange={(e) => setManualRoleForm((f) => ({ ...f, user_id: e.target.value }))}
                placeholder="Paste Supabase User UID…"
                className={`h-10 min-w-[180px] flex-1 rounded-xl border px-3 text-xs font-mono ${ui.input}`}
              />
              <select
                value={manualRoleForm.role}
                onChange={(e) => setManualRoleForm((f) => ({ ...f, role: e.target.value }))}
                className={`h-10 rounded-xl border px-3 text-xs font-semibold ${ui.input}`}
              >
                <option value="super_admin">super_admin</option>
                <option value="student">student</option>
              </select>
              <button type="submit" disabled={!manualRoleForm.user_id.trim()} className={ui.btnPrimary}>
                Apply
              </button>
            </form>
          </section>
        </div>

        <section className={`overflow-hidden rounded-3xl border ${ui.card}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-6 py-4 border-inherit">
            <h3 className="text-base font-bold">
              Registered Users ({filteredUsers.length})
            </h3>
            <span className={`text-xs ${ui.muted}`}>
              Promote or demote accounts directly using the action buttons.
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className={`border-b text-[11px] uppercase tracking-wider ${ui.muted} border-inherit`}>
                  <th className="px-6 py-3.5 font-bold">User</th>
                  <th className="px-4 py-3.5 font-bold">Role</th>
                  <th className="px-4 py-3.5 font-bold">Workspace Activity</th>
                  <th className="px-4 py-3.5 font-bold">Joined / Last Sign-In</th>
                  <th className="px-6 py-3.5 text-right font-bold">Role Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-[#2A3B51]">
                {filteredUsers.map((u) => {
                  const act = userActivityCounts[u.user_id] || { subjects: 0, topics: 0, decks: 0, tasks: 0, studyMinutes: 0 }
                  const isSelf = u.user_id === session.user.id
                  const isSuper = u.role === 'super_admin'
                  return (
                    <tr key={u.user_id} className="transition hover:bg-slate-500/5">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#173761] text-xs font-bold uppercase text-[#F5B82E]">
                            {(u.full_name || u.email || 'U').charAt(0)}
                          </span>
                          <div>
                            <p className="font-bold text-sm">
                              {u.full_name} {isSelf && <span className={`text-[11px] ${ui.goldText}`}>(You)</span>}
                            </p>
                            <p className={ui.muted}>{u.email}</p>
                            <p className={`font-mono text-[10px] opacity-60 ${ui.muted}`}>{u.user_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${
                            isSuper
                              ? 'bg-[#FFF4D6] text-[#8A5F0B] dark:bg-[#2A2212] dark:text-[#F5B82E]'
                              : 'bg-[#E5E7EB] text-[#173761] dark:bg-[#172840] dark:text-sky-200'
                          }`}
                        >
                          {isSuper ? <ShieldCheck size={13} /> : <Shield size={13} />}
                          {isSuper ? 'Super Admin' : 'Student'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          <span className={`rounded-md border px-2 py-0.5 font-semibold ${ui.panel}`}>
                            {act.subjects} Subjects
                          </span>
                          <span className={`rounded-md border px-2 py-0.5 font-semibold ${ui.panel}`}>
                            {act.topics} Topics
                          </span>
                          <span className={`rounded-md border px-2 py-0.5 font-semibold ${ui.panel}`}>
                            {act.decks} Decks
                          </span>
                          <span className={`rounded-md border px-2 py-0.5 font-semibold ${ui.panel}`}>
                            {act.tasks} Tasks
                          </span>
                          {act.studyMinutes > 0 && (
                            <span className="rounded-md bg-[#FFF4D6] px-2 py-0.5 font-bold text-[#8A5F0B]">
                              {act.studyMinutes}m studied
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={`px-4 py-4 ${ui.muted}`}>
                        <p>Joined: {fmtDate(u.created_at)}</p>
                        <p className="text-[11px]">Last active: {fmtDate(u.last_sign_in_at)}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isSuper ? (
                          <button
                            type="button"
                            disabled={isSelf || busyId === u.user_id}
                            onClick={() => handleRoleChange(u.user_id, 'student')}
                            className={ui.btnSecondary}
                            title={isSelf ? 'Cannot demote your own active account' : 'Demote to Student'}
                          >
                            Demote to Student
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busyId === u.user_id}
                            onClick={() => handleRoleChange(u.user_id, 'super_admin')}
                            className={ui.btnGold}
                          >
                            <ShieldCheck size={14} /> Promote to Super Admin
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    )
  }

  /* ================================================================== */
  /* TAB 3: SUBJECTS & TOPICS                                           */
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
      <div className="space-y-6">
        <section className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 ${ui.card}`}>
          <div className="flex flex-1 flex-wrap items-center gap-2.5">
            <div className="relative min-w-[220px] flex-1">
              <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={curriculumSearch}
                onChange={(e) => setCurriculumSearch(e.target.value)}
                placeholder="Search subjects or topics…"
                className={`h-10 w-full rounded-xl border pl-9 pr-3 text-xs ${ui.input}`}
              />
            </div>
            <select
              value={curriculumSubFilter}
              onChange={(e) => setCurriculumSubFilter(e.target.value)}
              className={`h-10 rounded-xl border px-3 text-xs font-semibold ${ui.input}`}
            >
              <option value="all">All Subjects ({subjects.length})</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setEditingSubject({ name: '', user_id: session.user.id })}
              className={ui.btnSecondary}
            >
              <Plus size={14} /> New Subject
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
              className={ui.btnPrimary}
            >
              <Plus size={14} /> New Topic
            </button>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className={`overflow-hidden rounded-3xl border ${ui.card}`}>
            <div className="border-b px-6 py-4 border-inherit">
              <h3 className="text-base font-bold">Global Subjects ({filteredSubjects.length})</h3>
            </div>
            {filteredSubjects.length === 0 ? (
              <p className={`p-8 text-center text-xs ${ui.muted}`}>No matching subjects.</p>
            ) : (
              <ul className="divide-y divide-slate-200/60 dark:divide-[#2A3B51]">
                {filteredSubjects.map((sub) => {
                  const topicCount = topics.filter((t) => t.subject_id === sub.id).length
                  return (
                    <li key={sub.id} className="flex items-center justify-between gap-3 px-6 py-3.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{sub.name}</p>
                        <p className={`text-xs ${ui.muted}`}>
                          {topicCount} topics · Owner: {userMap[sub.user_id]?.email || sub.user_id?.slice(0, 8)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingSubject(sub)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-slate-500/10 hover:text-current"
                        >
                          <FileEdit size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete({ type: 'subject', item: sub })}
                          className="rounded-lg p-2 text-red-500 hover:bg-red-500/10"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className={`overflow-hidden rounded-3xl border ${ui.card}`}>
            <div className="border-b px-6 py-4 border-inherit">
              <h3 className="text-base font-bold">Global Topics ({filteredTopics.length})</h3>
            </div>
            {filteredTopics.length === 0 ? (
              <p className={`p-8 text-center text-xs ${ui.muted}`}>No matching topics.</p>
            ) : (
              <ul className="divide-y divide-slate-200/60 dark:divide-[#2A3B51]">
                {filteredTopics.map((tp) => {
                  const subName = subjectMap[tp.subject_id]?.name || 'Unlinked'
                  const prereqCount = prereqs.filter((p) => p.topic_id === tp.id).length
                  return (
                    <li key={tp.id} className="flex items-center justify-between gap-3 px-6 py-3.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleToggleTopicMastered(tp)}
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
                            tp.is_mastered
                              ? 'border-[#F5B82E] bg-[#F5B82E] text-[#173761]'
                              : 'border-slate-400 bg-transparent'
                          }`}
                        >
                          {tp.is_mastered && <Check size={13} strokeWidth={3} />}
                        </button>
                        <div className="min-w-0">
                          <p className={`truncate text-sm font-bold ${tp.is_mastered ? 'line-through opacity-60' : ''}`}>
                            {tp.title}
                          </p>
                          <p className={`text-xs ${ui.muted}`}>
                            {subName} · {tp.study_minutes ?? 30}m
                            {prereqCount > 0 ? ` · ${prereqCount} prereq(s)` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingTopic(tp)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-slate-500/10 hover:text-current"
                        >
                          <FileEdit size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete({ type: 'topic', item: tp })}
                          className="rounded-lg p-2 text-red-500 hover:bg-red-500/10"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
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
      <div className="space-y-6">
        <section className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 ${ui.card}`}>
          <div className="relative min-w-[240px] flex-1">
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={deckSearch}
              onChange={(e) => setDeckSearch(e.target.value)}
              placeholder="Search reviewer decks by title, subject, or owner…"
              className={`h-10 w-full rounded-xl border pl-9 pr-3 text-xs ${ui.input}`}
            />
          </div>
          <span className={`text-xs font-semibold ${ui.muted}`}>
            {decks.length} Total Decks · {cards.length} Total Flashcards
          </span>
        </section>

        {filteredDecks.length === 0 ? (
          <section className={`rounded-3xl border p-12 text-center ${ui.card}`}>
            <Layers size={32} className={`mx-auto mb-2 opacity-30 ${ui.muted}`} />
            <p className="text-sm font-bold">No reviewer decks found</p>
          </section>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredDecks.map((d) => {
              const dCards = cardsByDeck[d.id] || []
              const masteredCount = dCards.filter((c) => c.is_mastered).length
              const subName = subjectMap[d.subject_id]?.name || 'General'
              return (
                <article key={d.id} className={`flex flex-col justify-between rounded-3xl border p-5 ${ui.card}`}>
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="rounded-md bg-[#FFF4D6] px-2.5 py-0.5 text-[11px] font-bold text-[#8A5F0B]">
                        {subName}
                      </span>
                      <span className={`text-xs font-bold ${ui.goldText}`}>
                        +{d.xp_awarded || 0} XP
                      </span>
                    </div>
                    <h3 className="mt-2.5 text-base font-bold">{d.title}</h3>
                    <p className={`mt-1 text-xs ${ui.muted}`}>
                      Owner: {userMap[d.user_id]?.email || d.user_id?.slice(0, 8)}
                    </p>
                    <p className={`mt-1 text-xs ${ui.muted}`}>
                      {dCards.length} cards ({masteredCount} mastered) · Created {fmtDate(d.created_at)}
                    </p>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-2 border-t pt-3.5 border-inherit">
                    <button
                      type="button"
                      onClick={() => setInspectingDeck(d)}
                      className={ui.btnSecondary}
                    >
                      <Eye size={14} /> Inspect Cards ({dCards.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete({ type: 'deck', item: d })}
                      className="rounded-xl p-2 text-red-500 transition hover:bg-red-500/10"
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
  /* TAB 5: STUDY TASKS                                                 */
  /* ================================================================== */

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
      <div className="space-y-6">
        <section className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 ${ui.card}`}>
          <div className="flex flex-1 flex-wrap items-center gap-2.5">
            <div className="relative min-w-[200px] flex-1">
              <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                placeholder="Search study tasks by title or student email…"
                className={`h-10 w-full rounded-xl border pl-9 pr-3 text-xs ${ui.input}`}
              />
            </div>
            <select
              value={taskStatusFilter}
              onChange={(e) => setTaskStatusFilter(e.target.value)}
              className={`h-10 rounded-xl border px-3 text-xs font-semibold ${ui.input}`}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending Only</option>
              <option value="done">Completed Only</option>
            </select>
            <select
              value={taskPriorityFilter}
              onChange={(e) => setTaskPriorityFilter(e.target.value)}
              className={`h-10 rounded-xl border px-3 text-xs font-semibold ${ui.input}`}
            >
              <option value="all">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="normal">Medium Priority</option>
              <option value="low">Low Priority</option>
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
            className={ui.btnPrimary}
          >
            <Plus size={14} /> Add Task
          </button>
        </section>

        <section className={`overflow-hidden rounded-3xl border ${ui.card}`}>
          <div className="border-b px-6 py-4 border-inherit">
            <h3 className="text-base font-bold">Global Study Tasks ({filteredTasks.length})</h3>
          </div>
          {filteredTasks.length === 0 ? (
            <p className={`p-10 text-center text-xs ${ui.muted}`}>No tasks match your filter criteria.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className={`border-b text-[11px] uppercase tracking-wider ${ui.muted} border-inherit`}>
                    <th className="px-6 py-3.5 font-bold">Status &amp; Task Title</th>
                    <th className="px-4 py-3.5 font-bold">Student Owner</th>
                    <th className="px-4 py-3.5 font-bold">Subject</th>
                    <th className="px-4 py-3.5 font-bold">Priority</th>
                    <th className="px-4 py-3.5 font-bold">Due Date</th>
                    <th className="px-6 py-3.5 text-right font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-[#2A3B51]">
                  {filteredTasks.map((tk) => (
                    <tr key={tk.id} className="transition hover:bg-slate-500/5">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleToggleTaskDone(tk)}
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
                              tk.is_done
                                ? 'border-[#173761] bg-[#173761] text-[#F5B82E]'
                                : 'border-slate-400 bg-transparent'
                            }`}
                          >
                            {tk.is_done && <Check size={13} strokeWidth={3} />}
                          </button>
                          <span className={`font-bold text-sm ${tk.is_done ? 'line-through opacity-60' : ''}`}>
                            {tk.title}
                          </span>
                        </div>
                      </td>
                      <td className={`px-4 py-3.5 ${ui.muted}`}>
                        {userMap[tk.user_id]?.email || tk.user_id?.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3.5">
                        {subjectMap[tk.subject_id]?.name || '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="rounded-md bg-[#FFF4D6] px-2 py-0.5 text-[11px] font-bold capitalize text-[#8A5F0B]">
                          {tk.priority || 'normal'}
                        </span>
                      </td>
                      <td className={`px-4 py-3.5 ${ui.muted}`}>
                        {fmtDate(tk.due_date)}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingTask(tk)}
                            className="rounded-lg p-2 text-slate-400 hover:bg-slate-500/10 hover:text-current"
                          >
                            <FileEdit size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete({ type: 'task', item: tk })}
                            className="rounded-lg p-2 text-red-500 hover:bg-red-500/10"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    )
  }

  /* ================================================================== */
  /* TAB 6: ACTIVITY & AUDIT TRAIL                                      */
  /* ================================================================== */

  const renderAuditTab = () => (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className={`overflow-hidden rounded-3xl border ${ui.card}`}>
        <div className="flex items-center justify-between border-b px-6 py-4 border-inherit">
          <div>
            <h3 className="text-base font-bold">Student Study Sessions ({studySessions.length})</h3>
            <p className={`text-xs ${ui.muted}`}>Total logged focus &amp; review time: {totalStudyMinutes} minutes</p>
          </div>
        </div>
        {studySessions.length === 0 ? (
          <p className={`p-10 text-center text-xs ${ui.muted}`}>No study sessions recorded yet.</p>
        ) : (
          <ul className="divide-y divide-slate-200/60 dark:divide-[#2A3B51]">
            {studySessions.slice(0, 25).map((ss) => (
              <li key={ss.id} className="flex items-center justify-between gap-3 px-6 py-3.5 text-xs">
                <div>
                  <p className="font-bold text-sm">
                    {ss.duration_minutes || 0} mins · <span className="capitalize">{ss.session_type || 'study'}</span>
                  </p>
                  <p className={ui.muted}>
                    Student: {userMap[ss.user_id]?.email || ss.user_id?.slice(0, 8)} · Date: {fmtDate(ss.studied_on)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmDelete({ type: 'session', item: ss })}
                  className="rounded-lg p-2 text-red-500 hover:bg-red-500/10"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`overflow-hidden rounded-3xl border ${ui.card}`}>
        <div className="border-b px-6 py-4 border-inherit">
          <h3 className="text-base font-bold">Session Admin Audit Trail ({auditLogs.length})</h3>
          <p className={`text-xs ${ui.muted}`}>Administrative actions performed during this session.</p>
        </div>
        {auditLogs.length === 0 ? (
          <div className="p-10 text-center">
            <Clock size={28} className={`mx-auto mb-2 opacity-30 ${ui.muted}`} />
            <p className="text-sm font-bold">No admin actions recorded yet</p>
            <p className={`mt-1 text-xs ${ui.muted}`}>
              Edits, role changes, exports, and deletions will be logged here in real time.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-200/60 dark:divide-[#2A3B51]">
            {auditLogs.map((log) => (
              <li key={log.id} className="px-6 py-3.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">{log.action}</span>
                  <span className={ui.muted}>{fmtDateTime(log.timestamp)}</span>
                </div>
                <p className={`mt-0.5 ${ui.muted}`}>
                  Target: <strong>{log.target}</strong> · By {log.actor}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )

  /* ================================================================== */
  /* TAB 7: ADMIN SETTINGS & EXPORT                                     */
  /* ================================================================== */

  const renderSettingsTab = () => (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className={`rounded-3xl border p-6 ${ui.card}`}>
        <h3 className="text-base font-bold">Super Admin Profile &amp; Security</h3>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#173761] text-lg font-extrabold text-[#F5B82E]">
              {adminInitials}
            </span>
            <div>
              <p className="text-base font-bold">{adminFullName}</p>
              <p className={`text-xs ${ui.muted}`}>{session?.user?.email}</p>
              <p className="mt-1 font-mono text-[11px] opacity-75">UID: {session?.user?.id}</p>
            </div>
          </div>
          <span className="rounded-full bg-[#FFF4D6] px-3.5 py-1.5 text-xs font-bold text-[#8A5F0B]">
            Verified Super Admin
          </span>
        </div>
      </section>

      <section className={`rounded-3xl border p-6 ${ui.card}`}>
        <h3 className="text-base font-bold">Workspace Appearance &amp; Navigation</h3>
        <p className={`mt-1 text-xs ${ui.muted}`}>
          Switch between Light and Dark mode or jump back to your personal Student Dashboard.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button 
            type="button" 
            onClick={() => onToggleTheme?.()} 
            className={ui.btnSecondary}
          >
            {darkMode ? <Sun size={15} className="text-[#F5B82E]" /> : <Moon size={15} />}
            {darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          </button>
          <button type="button" onClick={() => navigate('/dashboard')} className={ui.btnPrimary}>
            <ArrowLeft size={15} /> Open Student Workspace
          </button>
        </div>
      </section>

      <section className={`rounded-3xl border p-6 ${ui.card}`}>
        <h3 className="text-base font-bold">Platform Data Export</h3>
        <p className={`mt-1 text-xs ${ui.muted}`}>
          Download a comprehensive CSV snapshot of all registered users, subjects, topics, reviewer decks, and study tasks.
        </p>
        <button type="button" onClick={exportPlatformReportCsv} className={`mt-4 ${ui.btnGold}`}>
          <Download size={15} /> Export Full Platform Report (CSV)
        </button>
      </section>
    </div>
  )

  /* ================================================================== */
  /* Main Layout Shell                                                  */
  /* ================================================================== */

  return (
    <div className={`min-h-screen ${ui.bg}`}>
      <div aria-live="polite" className="pointer-events-none fixed bottom-6 right-6 z-[95] flex max-w-sm flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-bold shadow-lg ${
              toast.type === 'error'
                ? 'border-red-400 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-200'
                : ui.card
            }`}
          >
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              aria-label="Close notification"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Admin navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-68 flex-col justify-between border-r transition-transform duration-200 lg:translate-x-0 ${
          ui.sidebar
        } ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div>
          <div className="flex items-center justify-between border-b px-6 py-5 border-inherit">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className="flex items-center gap-3 text-left focus:outline-none"
            >
              <img src={kayappLogo} alt="" className="h-10 w-10 object-contain" />
              <div>
                <span className="block text-lg font-extrabold tracking-tight">
                  <span className={darkMode ? 'text-white' : 'text-[#173761]'}>Kay</span>
                  <span className="text-[#E6A51C]">App</span>
                </span>
                <span className={`block text-[10px] font-bold uppercase tracking-widest ${ui.goldText}`}>
                  ADMIN WORKSPACE
                </span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg p-1.5 lg:hidden"
            >
              <X size={18} />
            </button>
          </div>

          <div className="px-4 py-5">
            <p className={`px-3 pb-2.5 text-[10px] font-bold uppercase tracking-widest ${ui.muted}`}>
              NAVIGATION
            </p>
            <nav className="space-y-1.5">
              {ADMIN_TABS.map((tab) => {
                const Icon = tab.icon
                const active = activeTab === tab.key
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.key)
                      setMobileMenuOpen(false)
                    }}
                    className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-xs font-bold transition ${
                      active
                        ? 'bg-[#F5B82E] text-[#173761] shadow-md'
                        : darkMode
                        ? 'text-slate-300 hover:bg-white/5 hover:text-white'
                        : 'text-[#173761]/80 hover:bg-black/5 hover:text-[#173761]'
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                        active
                          ? 'bg-[#173761] text-[#F5B82E]'
                          : 'bg-[#FFF4D6] text-[#B78116] dark:bg-[#172840] dark:text-[#F5B82E]'
                      }`}
                    >
                      <Icon size={15} />
                    </span>
                    <span className="truncate">{tab.label}</span>
                  </button>
                )
              })}
            </nav>

            <div className="mt-6 border-t pt-4 border-inherit">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className={`flex w-full items-center gap-2.5 rounded-2xl px-4 py-2.5 text-left text-xs font-bold transition ${
                  darkMode ? 'text-slate-300 hover:bg-white/5' : 'text-[#173761] hover:bg-black/5'
                }`}
              >
                <ArrowLeft size={15} className={ui.goldText} />
                <span>Student Workspace</span>
              </button>
            </div>
          </div>
        </div>

        <div className="border-t p-4 border-inherit">
          <div className={`rounded-2xl border p-3.5 ${ui.card}`}>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#173761] text-xs font-extrabold text-[#F5B82E]">
                {adminInitials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold">{adminFullName}</p>
                <p className={`truncate text-[11px] ${ui.muted}`}>Super Admin</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t pt-2.5 text-[11px] border-inherit">
              <span className={ui.muted}>Session status</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">Verified</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className={`mt-2.5 flex h-10 w-full items-center justify-center gap-2 rounded-2xl border text-xs font-bold transition ${
              darkMode
                ? 'border-[#2A3B51] bg-[#111F33] text-red-400 hover:bg-red-950/30'
                : 'border-[#E5E7EB] bg-[#FFFFFF] text-[#173761] hover:bg-red-50 hover:text-red-600'
            }`}
          >
            <LogOut size={14} /> Log Out
          </button>
        </div>
      </aside>

      <div className="lg:pl-68">
        <header className={`sticky top-0 z-30 flex min-h-20 flex-wrap items-center justify-between gap-4 border-b px-5 py-3 backdrop-blur sm:px-8 ${ui.header}`}>
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border lg:hidden ${ui.card}`}
            >
              <Menu size={18} />
            </button>
            <div>
              <h1 className="font-serif text-xl font-bold sm:text-2xl">{currentTabMeta.label}</h1>
              <p className={`hidden text-xs sm:block ${ui.muted}`}>{currentTabMeta.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={fetchAllAdminData}
              disabled={refreshing}
              className={ui.btnSecondary}
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin text-[#F5B82E]' : ''} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => onToggleTheme?.()}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${ui.card}`}
            >
              {darkMode ? <Sun size={16} className="text-[#F5B82E]" /> : <Moon size={16} />}
            </button>

            <span className="hidden items-center gap-1.5 rounded-full bg-[#FFF4D6] px-3.5 py-1.5 text-xs font-bold text-[#8A5F0B] sm:inline-flex dark:bg-[#2A2212] dark:text-[#F5B82E]">
              ● Super Admin
            </span>
          </div>
        </header>

        <main className="mx-auto max-w-[1400px] p-5 sm:p-8">
          {activeTab === 'overview' && renderOverviewTab()}
          {activeTab === 'users' && renderUsersTab()}
          {activeTab === 'curriculum' && renderCurriculumTab()}
          {activeTab === 'decks' && renderDecksTab()}
          {activeTab === 'tasks' && renderTasksTab()}
          {activeTab === 'audit' && renderAuditTab()}
          {activeTab === 'settings' && renderSettingsTab()}
        </main>
      </div>

      {/* ================================================================ */}
      {/* MODALS                                                           */}
      {/* ================================================================ */}

      {editingSubject && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0B1525]/65 p-4 backdrop-blur-xs">
          <div className={`w-full max-w-md rounded-3xl border p-6 shadow-2xl ${ui.card}`}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">
                {editingSubject.id ? 'Edit Subject' : 'Create Subject'}
              </h2>
              <button type="button" onClick={() => setEditingSubject(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveSubject} className="mt-4 space-y-4">
              <label className="block text-xs font-bold">
                Subject Name
                <input
                  type="text"
                  required
                  autoFocus
                  value={editingSubject.name}
                  onChange={(e) => setEditingSubject((s) => ({ ...s, name: e.target.value }))}
                  className={`mt-1.5 h-10 w-full rounded-xl border px-3 text-sm ${ui.input}`}
                />
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditingSubject(null)} className={ui.btnSecondary}>
                  Cancel
                </button>
                <button type="submit" className={ui.btnPrimary}>
                  Save Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingTopic && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0B1525]/65 p-4 backdrop-blur-xs">
          <div className={`w-full max-w-md rounded-3xl border p-6 shadow-2xl ${ui.card}`}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">
                {editingTopic.id ? 'Edit Topic' : 'Create Topic'}
              </h2>
              <button type="button" onClick={() => setEditingTopic(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveTopic} className="mt-4 space-y-4">
              <label className="block text-xs font-bold">
                Topic Title
                <input
                  type="text"
                  required
                  autoFocus
                  value={editingTopic.title}
                  onChange={(e) => setEditingTopic((t) => ({ ...t, title: e.target.value }))}
                  className={`mt-1.5 h-10 w-full rounded-xl border px-3 text-sm ${ui.input}`}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-bold">
                  Subject
                  <select
                    value={editingTopic.subject_id}
                    onChange={(e) => setEditingTopic((t) => ({ ...t, subject_id: e.target.value }))}
                    className={`mt-1.5 h-10 w-full rounded-xl border px-3 text-xs ${ui.input}`}
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-bold">
                  Study Minutes
                  <input
                    type="number"
                    min="5"
                    max="600"
                    value={editingTopic.study_minutes ?? 30}
                    onChange={(e) => setEditingTopic((t) => ({ ...t, study_minutes: e.target.value }))}
                    className={`mt-1.5 h-10 w-full rounded-xl border px-3 text-sm ${ui.input}`}
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold">
                <input
                  type="checkbox"
                  checked={Boolean(editingTopic.is_mastered)}
                  onChange={(e) => setEditingTopic((t) => ({ ...t, is_mastered: e.target.checked }))}
                  className="h-4 w-4 accent-[#173761]"
                />
                Mark topic as Mastered
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditingTopic(null)} className={ui.btnSecondary}>
                  Cancel
                </button>
                <button type="submit" className={ui.btnPrimary}>
                  Save Topic
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingTask && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0B1525]/65 p-4 backdrop-blur-xs">
          <div className={`w-full max-w-md rounded-3xl border p-6 shadow-2xl ${ui.card}`}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">
                {editingTask.id ? 'Edit Study Task' : 'Create Study Task'}
              </h2>
              <button type="button" onClick={() => setEditingTask(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveTask} className="mt-4 space-y-4">
              <label className="block text-xs font-bold">
                Task Title
                <input
                  type="text"
                  required
                  autoFocus
                  value={editingTask.title}
                  onChange={(e) => setEditingTask((tk) => ({ ...tk, title: e.target.value }))}
                  className={`mt-1.5 h-10 w-full rounded-xl border px-3 text-sm ${ui.input}`}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-bold">
                  Subject
                  <select
                    value={editingTask.subject_id || ''}
                    onChange={(e) => setEditingTask((tk) => ({ ...tk, subject_id: e.target.value }))}
                    className={`mt-1.5 h-10 w-full rounded-xl border px-3 text-xs ${ui.input}`}
                  >
                    <option value="">No Subject</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-bold">
                  Priority
                  <select
                    value={editingTask.priority || 'normal'}
                    onChange={(e) => setEditingTask((tk) => ({ ...tk, priority: e.target.value }))}
                    className={`mt-1.5 h-10 w-full rounded-xl border px-3 text-xs ${ui.input}`}
                  >
                    <option value="high">High</option>
                    <option value="normal">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </label>
              </div>
              <label className="block text-xs font-bold">
                Due Date
                <input
                  type="date"
                  value={editingTask.due_date ? String(editingTask.due_date).slice(0, 10) : ''}
                  onChange={(e) => setEditingTask((tk) => ({ ...tk, due_date: e.target.value }))}
                  className={`mt-1.5 h-10 w-full rounded-xl border px-3 text-xs ${ui.input}`}
                />
              </label>
              <label className="flex items-center gap-2 text-xs font-bold">
                <input
                  type="checkbox"
                  checked={Boolean(editingTask.is_done)}
                  onChange={(e) => setEditingTask((tk) => ({ ...tk, is_done: e.target.checked }))}
                  className="h-4 w-4 accent-[#173761]"
                />
                Mark task as Completed
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditingTask(null)} className={ui.btnSecondary}>
                  Cancel
                </button>
                <button type="submit" className={ui.btnPrimary}>
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {inspectingDeck && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0B1525]/65 p-4 backdrop-blur-xs">
          <div className={`flex max-h-[88dvh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border shadow-2xl ${ui.card}`}>
            <div className="flex items-center justify-between border-b px-6 py-4 border-inherit">
              <div>
                <h2 className="text-base font-bold">Deck Inspector · {inspectingDeck.title}</h2>
                <p className={`text-xs ${ui.muted}`}>
                  {(cardsByDeck[inspectingDeck.id] || []).length} flashcards inside this deck
                </p>
              </div>
              <div className="flex items-center gap-2">
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
                  className={ui.btnPrimary}
                >
                  <Plus size={14} /> Add Card
                </button>
                <button type="button" onClick={() => setInspectingDeck(null)} className="rounded-lg p-1.5">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-2.5 overflow-y-auto p-6">
              {(cardsByDeck[inspectingDeck.id] || []).length === 0 ? (
                <p className={`py-8 text-center text-xs ${ui.muted}`}>This deck has no flashcards.</p>
              ) : (
                (cardsByDeck[inspectingDeck.id] || []).map((c, idx) => (
                  <div key={c.id} className={`flex items-start justify-between gap-3 rounded-2xl border p-4 ${ui.panel}`}>
                    <div className="min-w-0">
                      <span className={`text-[11px] font-bold ${ui.goldText}`}>
                        Card #{idx + 1} {c.is_mastered ? '· Mastered' : ''}
                      </span>
                      <p className="mt-1 text-sm font-bold">{c.prompt}</p>
                      <p className={`mt-1 text-xs ${ui.muted}`}>Answer: {c.answer}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingCard(c)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-500/10 hover:text-current"
                      >
                        <FileEdit size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete({ type: 'card', item: c })}
                        className="rounded-lg p-2 text-red-500 hover:bg-red-500/10"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {editingCard && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-[#0B1525]/70 p-4 backdrop-blur-xs">
          <div className={`w-full max-w-lg rounded-3xl border p-6 shadow-2xl ${ui.card}`}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">
                {editingCard.id ? 'Edit Flashcard' : 'Add Flashcard'}
              </h2>
              <button type="button" onClick={() => setEditingCard(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveCard} className="mt-4 space-y-4">
              <label className="block text-xs font-bold">
                Question / Prompt
                <textarea
                  rows={3}
                  required
                  value={editingCard.prompt}
                  onChange={(e) => setEditingCard((c) => ({ ...c, prompt: e.target.value }))}
                  className={`mt-1.5 w-full rounded-xl border p-3 text-sm ${ui.input}`}
                />
              </label>
              <label className="block text-xs font-bold">
                Answer
                <textarea
                  rows={3}
                  required
                  value={editingCard.answer}
                  onChange={(e) => setEditingCard((c) => ({ ...c, answer: e.target.value }))}
                  className={`mt-1.5 w-full rounded-xl border p-3 text-sm ${ui.input}`}
                />
              </label>
              <label className="flex items-center gap-2 text-xs font-bold">
                <input
                  type="checkbox"
                  checked={Boolean(editingCard.is_mastered)}
                  onChange={(e) => setEditingCard((c) => ({ ...c, is_mastered: e.target.checked }))}
                  className="h-4 w-4 accent-[#173761]"
                />
                Mark card as Mastered
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditingCard(null)} className={ui.btnSecondary}>
                  Cancel
                </button>
                <button type="submit" className={ui.btnPrimary}>
                  Save Flashcard
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#0B1525]/70 p-4 backdrop-blur-xs">
          <div className={`w-full max-w-md rounded-3xl border p-6 shadow-2xl ${ui.card}`}>
            <div className="flex items-center gap-3 text-red-500">
              <AlertCircle size={22} />
              <h2 className="text-base font-bold">Confirm Permanent Deletion</h2>
            </div>
            <p className={`mt-3 text-xs leading-relaxed ${ui.muted}`}>
              Are you sure you want to permanently delete this <strong>{confirmDelete.type}</strong> (
              <strong>{confirmDelete.item?.name || confirmDelete.item?.title || confirmDelete.item?.prompt?.slice(0, 40) || confirmDelete.item?.id}</strong>)? This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDelete(null)} className={ui.btnSecondary}>
                Cancel
              </button>
              <button
                type="button"
                onClick={executeConfirmedDelete}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-red-600 px-4 text-xs font-bold text-white transition hover:bg-red-700"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}