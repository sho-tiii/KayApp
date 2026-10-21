import { useState, useEffect } from 'react'
import {
  Plus, Trash2, X, ChevronDown, ListOrdered, Route, Unlock, GitBranch, Sparkles, Trophy,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import {
  ALGORITHMS,
  topologicalSort,
  bfs,
  bfsPath,
  dijkstra,
  wouldCreateCycle,
  layerOf,
} from '../../lib/graph'
import PathMap from './PathMap'

const tools = [
  { key: 'order', label: 'Study order', icon: ListOrdered, algos: ['topo'], q: 'What should I study first? Prerequisites always come before the topics that need them.' },
  { key: 'route', label: 'Route finder', icon: Route, algos: ['bfs', 'dijkstra'], q: 'How do I get from one topic to another? Compare the route with the fewest topics and the route with the least study time.' },
  { key: 'unlocks', label: 'What it unlocks', icon: Unlock, algos: ['bfs'], q: 'What opens up after I finish a topic? The map lights up as you choose.' },
]

function TopicSelect({ label, value, onChange, options, className }) {
  return (
    <label className="block text-xs font-semibold">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1 h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#F5B82E] ${className}`}
      >
        <option value="">Choose a topic</option>
        {options.map((t) => (
          <option key={t.id} value={t.id}>{t.title}</option>
        ))}
      </select>
    </label>
  )
}

function AlgoNote({ keys, muted }) {
  return (
    <p className={`mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] ${muted}`}>
      {keys.map((k) => (
        <span key={k}>
          <span className="font-semibold text-[#B78116]">{ALGORITHMS[k].name}</span>
          {' · '}{ALGORITHMS[k].uses}{' · '}{ALGORITHMS[k].time}
        </span>
      ))}
    </p>
  )
}

function RouteResult({ heading, path, total, titleOf, minutes }) {
  return (
    <div>
      <p className="text-xs font-semibold">{heading}</p>
      <ol className="mt-2 space-y-1 text-sm">
        {path.map((id) => (
          <li key={id} className="flex items-center gap-2">
            <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#F5B82E]" />
            <span className="truncate">{titleOf(id)}</span>
            <span className="ml-auto shrink-0 text-xs text-slate-400">{minutes[id]} min</span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs font-semibold text-[#B78116]">
        {path.length} {path.length === 1 ? 'topic' : 'topics'} · {total} min
      </p>
    </div>
  )
}

export default function SubjectManager({ session, darkMode, fire }) {
  const [subjects, setSubjects] = useState([])
  const [topics, setTopics] = useState([])
  const [prereqs, setPrereqs] = useState([])
  const [setupNeeded, setSetupNeeded] = useState(false)
  const [newSubjectName, setNewSubjectName] = useState('')
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [newTopicTitle, setNewTopicTitle] = useState('')
  const [newTopicMinutes, setNewTopicMinutes] = useState('30')
  const [loading, setLoading] = useState(true)
  const [topicId, setTopicId] = useState('')
  const [needsId, setNeedsId] = useState('')
  const [notice, setNotice] = useState('')
  const [mapNote, setMapNote] = useState('')
  const [tool, setTool] = useState('order')
  const [routeFrom, setRouteFrom] = useState('')
  const [routeTo, setRouteTo] = useState('')
  const [unlockId, setUnlockId] = useState('')
  const [hoverId, setHoverId] = useState('')
  const [shakeId, setShakeId] = useState('')

  useEffect(() => {
    if (session) {
      fetchSubjectsAndTopics()
    }
  }, [session])

  const fetchSubjectsAndTopics = async () => {
    try {
      setLoading(true)
      const [subjRes, topRes, preRes] = await Promise.all([
        supabase.from('subjects').select('*').order('created_at', { ascending: false }),
        supabase.from('topics').select('*').order('created_at', { ascending: false }),
        supabase.from('topic_prerequisites').select('*').order('created_at', { ascending: false }),
      ])

      if (subjRes.error) throw subjRes.error
      if (topRes.error) throw topRes.error

      setSubjects(subjRes.data || [])
      setTopics(topRes.data || [])
      if (preRes.error) {
        console.error('Error fetching prerequisites:', preRes.error.message)
        setSetupNeeded(true)
      } else {
        setPrereqs(preRes.data || [])
        setSetupNeeded(false)
      }
      if (subjRes.data?.length > 0 && !selectedSubjectId) {
        setSelectedSubjectId(subjRes.data[0].id)
      }
    } catch (error) {
      console.error('Error fetching subjects/topics:', error.message)
    } finally {
      setLoading(false)
    }
  }

  const addSubject = async (e) => {
    e.preventDefault()
    if (!newSubjectName.trim()) return

    try {
      const { data, error } = await supabase
        .from('subjects')
        .insert([{ name: newSubjectName, user_id: session.user.id }])
        .select()

      if (error) throw error
      setSubjects([data[0], ...subjects])
      setNewSubjectName('')
      if (!selectedSubjectId) {
        setSelectedSubjectId(data[0].id)
      }
    } catch (error) {
      console.error('Error adding subject:', error.message)
    }
  }

  const deleteSubject = async (id) => {
    try {
      const { error } = await supabase.from('subjects').delete().eq('id', id)
      if (error) throw error
      const removed = new Set(topics.filter(t => t.subject_id === id).map(t => t.id))
      setSubjects(subjects.filter(s => s.id !== id))
      setTopics(topics.filter(t => t.subject_id !== id))
      setPrereqs(prereqs.filter(p => !removed.has(p.topic_id) && !removed.has(p.prerequisite_id)))
      if (selectedSubjectId === id) {
        const remaining = subjects.filter(s => s.id !== id)
        setSelectedSubjectId(remaining.length > 0 ? remaining[0].id : '')
      }
    } catch (error) {
      console.error('Error deleting subject:', error.message)
    }
  }

  const addTopic = async (e) => {
    e.preventDefault()
    if (!newTopicTitle.trim() || !selectedSubjectId) return

    const parsed = Number.parseInt(newTopicMinutes, 10)
    const minutesValue = Number.isNaN(parsed) ? 30 : Math.max(0, parsed)

    try {
      const { data, error } = await supabase
        .from('topics')
        .insert([{
          title: newTopicTitle,
          subject_id: selectedSubjectId,
          user_id: session.user.id,
          study_minutes: minutesValue,
        }])
        .select()

      if (error) throw error
      setTopics([data[0], ...topics])
      setNewTopicTitle('')
      setNewTopicMinutes('30')
    } catch (error) {
      console.error('Error adding topic:', error.message)
    }
  }

  const deleteTopic = async (id) => {
    try {
      const { error } = await supabase.from('topics').delete().eq('id', id)
      if (error) throw error
      setTopics(topics.filter(t => t.id !== id))
      setPrereqs(prereqs.filter(p => p.topic_id !== id && p.prerequisite_id !== id))
    } catch (error) {
      console.error('Error deleting topic:', error.message)
    }
  }

  /* ---------- derived data ---------- */
  const topicsById = Object.fromEntries(topics.map(t => [t.id, t]))
  const activeTopics = topics.filter(t => t.subject_id === selectedSubjectId)
  const ids = activeTopics.map(t => t.id)
  const idSet = new Set(ids)
  const pick = (v) => (idSet.has(v) ? v : '')
  const edges = prereqs
    .filter(p => idSet.has(p.topic_id) && idSet.has(p.prerequisite_id))
    .map(p => ({ from: p.prerequisite_id, to: p.topic_id }))
  const minutes = Object.fromEntries(topics.map(t => [t.id, t.study_minutes ?? 30]))
  const titleOf = (id) => topicsById[id]?.title ?? ''

  const needsOf = new Map(ids.map(id => [id, []]))
  edges.forEach(e => needsOf.get(e.to).push(e.from))
  const status = Object.fromEntries(
    activeTopics.map(t => [
      t.id,
      t.is_mastered
        ? 'done'
        : needsOf.get(t.id).every(p => topicsById[p]?.is_mastered) ? 'ready' : 'locked',
    ]),
  )
  const layer = layerOf(ids, edges)
  const sorted = topologicalSort(ids, edges)

  /* ---------- progress ---------- */
  const masteredAll = topics.filter(t => t.is_mastered).length
  const xp = masteredAll * 25
  const level = Math.floor(xp / 100) + 1
  const intoLevel = xp % 100
  const masteredHere = activeTopics.filter(t => t.is_mastered).length
  const nextUp = sorted.order.map(id => topicsById[id]).find(t => t && status[t.id] === 'ready')
  const nextUnlocks = nextUp ? bfs(ids, edges, nextUp.id).length : 0

  /* ---------- tool results ---------- */
  const from = pick(routeFrom)
  const to = pick(routeTo)
  const fewest = from && to ? bfsPath(ids, edges, from, to) : null
  const fastest = from && to ? dijkstra(ids, edges, minutes, from, to) : null
  const fewestMinutes = fewest ? fewest.reduce((sum, id) => sum + (minutes[id] || 0), 0) : 0
  const sameRoute = fewest && fastest && fewest.join() === fastest.path.join()
  const unlock = pick(unlockId)
  const reach = unlock ? bfs(ids, edges, unlock) : []
  const levels = reach.reduce((acc, n) => {
    (acc[n.level] ||= []).push(n.id)
    return acc
  }, {})
  const activeTool = tools.find(t => t.key === tool)
  const totalMinutes = activeTopics.reduce((sum, t) => sum + (t.study_minutes ?? 30), 0)

  /* ---------- map highlights ---------- */
  const focusId = pick(hoverId) || (tool === 'unlocks' ? unlock : '')
  const lit = new Map(focusId ? bfs(ids, edges, focusId).map(n => [n.id, n.level]) : [])
  const routeEdges = new Set()
  if (tool === 'route' && fastest) {
    fastest.path.forEach((id, i) => {
      if (i > 0) routeEdges.add(`${fastest.path[i - 1]}>${id}`)
    })
  }

  const toggleMastered = async (id, el) => {
    const t = topicsById[id]
    if (!t) return
    if (!t.is_mastered && status[id] === 'locked') {
      const missing = needsOf.get(id).filter(p => !topicsById[p]?.is_mastered).map(titleOf)
      setShakeId(id)
      setTimeout(() => setShakeId(''), 450)
      setMapNote(`Master ${missing.join(', ')} first to unlock "${t.title}".`)
      return
    }
    const rect = el?.getBoundingClientRect?.()
    try {
      const { error } = await supabase.from('topics').update({ is_mastered: !t.is_mastered }).eq('id', id)
      if (error) throw error
      setTopics(topics.map(x => (x.id === id ? { ...x, is_mastered: !t.is_mastered } : x)))
      setMapNote('')
      if (!t.is_mastered && rect && fire) {
        const x = rect.left + rect.width / 2
        const y = rect.top + rect.height / 2
        const complete = activeTopics.every(a => a.id === id || a.is_mastered)
        if (complete) {
          fire({ x: 0, y: window.innerHeight, count: 90, angle: -55, spread: 40, power: 22 })
          fire({ x: window.innerWidth, y: window.innerHeight, count: 90, angle: -125, spread: 40, power: 22 })
          fire({ x, y, count: 60, power: 10 })
        } else {
          fire({ x, y, count: 30, power: 8 })
        }
      }
    } catch (error) {
      console.error('Error saving progress:', error.message)
      setMapNote('Could not save progress. Make sure the latest SQL has been run.')
    }
  }

  const addPrereq = async (e) => {
    e.preventDefault()
    const topic = pick(topicId)
    const needs = pick(needsId)
    if (!topic || !needs) return
    if (edges.some(x => x.from === needs && x.to === topic)) {
      setNotice('That prerequisite already exists.')
      return
    }
    // Depth-First Search loop check
    const loop = wouldCreateCycle(ids, edges, topic, needs)
    if (loop) {
      setNotice(`That would create a loop: ${loop.map(titleOf).join(' → ')}. Remove or change a link first.`)
      return
    }

    try {
      const { data, error } = await supabase
        .from('topic_prerequisites')
        .insert([{ topic_id: topic, prerequisite_id: needs, user_id: session.user.id }])
        .select()

      if (error) throw error
      setPrereqs([data[0], ...prereqs])
      setNeedsId('')
      setNotice('')
    } catch (error) {
      console.error('Error adding prerequisite:', error.message)
      setNotice('Could not save that prerequisite. Please try again.')
    }
  }

  const removePrereq = async (id) => {
    try {
      const { error } = await supabase.from('topic_prerequisites').delete().eq('id', id)
      if (error) throw error
      setPrereqs(prereqs.filter(p => p.id !== id))
      setNotice('')
    } catch (error) {
      console.error('Error removing prerequisite:', error.message)
    }
  }

  const cardBg = darkMode ? 'bg-[#111F33] border-[#2A3B51]' : 'bg-white border-[#E7E9E5]'
  const rowBg = darkMode ? 'border-[#2A3B51] bg-[#0B1525]' : 'border-[#E7E9E5] bg-[#FAFAF7]'
  const inputBg = darkMode
    ? 'bg-[#0B1525] border-[#2A3B51] text-white focus:border-[#F5B82E]'
    : 'bg-[#FAFAF7] border-[#E7E9E5] text-[#173761] focus:border-[#F5B82E]'
  const muted = darkMode ? 'text-slate-400' : 'text-slate-500'
  const danger = darkMode ? 'text-red-400' : 'text-red-600'

  if (loading) {
    return <p className={`text-sm ${muted}`}>Loading subjects...</p>
  }

  return (
    <div className="space-y-6">
      {/* Journey */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#173761] to-[#244B7D] p-6 text-white shadow-[0_24px_50px_-24px_rgba(23,55,97,0.8)] sm:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 h-64 w-64 rounded-full bg-[#F5B82E]/25 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[230px_1fr] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[2px] text-[#F5B82E]">
              <Trophy size={14} aria-hidden="true" /> Your level
            </p>
            <p className="mt-1 text-5xl font-bold">{level}</p>
            <div
              role="progressbar"
              aria-label="Progress to next level"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={intoLevel}
              className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/15"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#F5B82E] to-[#E6A51C] transition-all duration-700"
                style={{ width: `${intoLevel}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-white/70">{intoLevel}/100 XP · 25 XP for every mastered topic</p>
          </div>

          <div className="rounded-2xl bg-white/10 p-5 backdrop-blur">
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[2px] text-[#F5B82E]">
              <Sparkles size={14} aria-hidden="true" /> Next up
            </p>
            {nextUp ? (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xl font-bold">{nextUp.title}</p>
                  <p className="mt-1 text-sm text-white/70">
                    {nextUp.study_minutes ?? 30} min · opens {nextUnlocks} {nextUnlocks === 1 ? 'topic' : 'topics'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => toggleMastered(nextUp.id, e.currentTarget)}
                  className="h-10 rounded-lg bg-[#F5B82E] px-5 text-sm font-semibold text-[#173761] transition hover:bg-[#FFD878] focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  I mastered this
                </button>
              </div>
            ) : (
              <p className="mt-2 text-sm text-white/80">
                {activeTopics.length === 0
                  ? 'Add your first topic below and your map will appear.'
                  : masteredHere === activeTopics.length
                  ? 'Every topic in this subject is mastered. Great work!'
                  : 'No topic is ready yet. Check your links for a loop.'}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Subjects + map */}
      <section className={`rounded-3xl border p-6 shadow-sm transition-colors duration-300 ${cardBg}`}>
        <div className="flex flex-wrap items-center gap-2">
          {subjects.map((sub) => {
            const on = selectedSubjectId === sub.id
            return (
              <span
                key={sub.id}
                className={`inline-flex items-center rounded-full border-2 transition ${
                  on
                    ? darkMode ? 'border-[#F5B82E] bg-[#172840] text-[#F5B82E]' : 'border-[#F5B82E] bg-[#FFF8E3] text-[#8A5F0B]'
                    : `${rowBg} hover:border-[#D6B75E]`
                }`}
              >
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSelectedSubjectId(sub.id)}
                  className="h-10 rounded-full pl-4 pr-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E]"
                >
                  {sub.name}
                </button>
                <button
                  type="button"
                  onClick={() => deleteSubject(sub.id)}
                  aria-label={`Delete subject ${sub.name}`}
                  className="mr-1 rounded-full p-2 text-slate-400 transition-colors hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E]"
                >
                  <X size={14} />
                </button>
              </span>
            )
          })}
          <form onSubmit={addSubject} className="inline-flex items-center gap-2">
            <input
              type="text"
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              placeholder="New subject"
              aria-label="New subject name"
              className={`h-10 w-36 rounded-full border px-4 text-sm transition focus:outline-none focus:ring-1 focus:ring-[#F5B82E] ${inputBg}`}
            />
            <button
              type="submit"
              disabled={!newSubjectName.trim()}
              aria-label="Add subject"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#173761] text-white transition hover:bg-[#244B7D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] disabled:opacity-50"
            >
              <Plus size={16} />
            </button>
          </form>
        </div>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <GitBranch size={20} className={darkMode ? 'text-[#F5B82E]' : 'text-[#173761]'} />
              Learning map
            </h2>
            <p className={`mt-1 text-xs ${muted}`}>
              Click a glowing topic when you have mastered it. Hover any topic to see what it opens.
            </p>
          </div>
          <ul className={`flex flex-wrap gap-4 text-xs ${muted}`}>
            <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#F5B82E]" />Mastered</li>
            <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#173761] ring-2 ring-[#F5B82E]" />Ready</li>
            <li className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded border border-dashed ${darkMode ? 'border-slate-500' : 'border-slate-400'}`} />Locked</li>
          </ul>
        </div>

        <p aria-live="polite" className={`mt-3 min-h-[1rem] text-xs ${danger}`}>{mapNote}</p>

        <div className={`mt-2 rounded-2xl border p-3 ${rowBg}`}>
          {subjects.length === 0 ? (
            <p className={`py-10 text-center text-sm ${muted}`}>Add your first subject above to start your map.</p>
          ) : activeTopics.length === 0 ? (
            <p className={`py-10 text-center text-sm ${muted}`}>No topics yet. Add some below and they will appear here.</p>
          ) : (
            <PathMap
              topics={activeTopics}
              edges={edges}
              layer={layer}
              status={status}
              focusId={focusId}
              lit={lit}
              routeEdges={routeEdges}
              shakeId={shakeId}
              minutes={minutes}
              darkMode={darkMode}
              onPick={toggleMastered}
              onHover={setHoverId}
            />
          )}
        </div>
        {activeTopics.length > 0 && (
          <p className={`mt-3 text-xs ${muted}`}>
            {masteredHere} of {activeTopics.length} topics mastered · {totalMinutes} min of study in total
          </p>
        )}
      </section>

      {/* Build */}
      <section className={`rounded-3xl border p-6 shadow-sm transition-colors duration-300 ${cardBg}`}>
        <h2 className="text-lg font-bold">Build your map</h2>
        <p className={`mt-1 text-xs ${muted}`}>Add topics, then say which topic needs another first. Example: Calculus needs Algebra.</p>

        {setupNeeded && (
          <p role="alert" className="mt-4 rounded-lg border border-[#EBDDB0] bg-[#FFF8E3] px-3 py-2 text-xs text-[#8A5F0B]">
            Prerequisites are not set up yet. Run the SQL migration in Supabase, then refresh this page.
          </p>
        )}

        <div className="mt-5 grid gap-6 md:grid-cols-2">
          <form onSubmit={addTopic}>
            <p className="text-xs font-semibold">1. Add a topic</p>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={newTopicTitle}
                onChange={(e) => setNewTopicTitle(e.target.value)}
                placeholder="e.g. Binary Trees"
                aria-label="New topic title"
                disabled={!selectedSubjectId}
                className={`h-10 min-w-0 flex-1 rounded-lg border px-4 text-sm transition focus:outline-none focus:ring-1 focus:ring-[#F5B82E] disabled:opacity-50 ${inputBg}`}
              />
              <input
                type="number"
                min="0"
                max="600"
                value={newTopicMinutes}
                onChange={(e) => setNewTopicMinutes(e.target.value)}
                aria-label="Study minutes"
                title="Study minutes"
                className={`h-10 w-20 rounded-lg border px-3 text-sm transition focus:outline-none focus:ring-1 focus:ring-[#F5B82E] ${inputBg}`}
              />
              <button
                type="submit"
                disabled={!newTopicTitle.trim() || !selectedSubjectId}
                className="flex h-10 items-center gap-1 rounded-lg bg-[#173761] px-4 text-sm font-semibold text-white transition hover:bg-[#244B7D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] disabled:opacity-50"
              >
                <Plus size={16} /> Add
              </button>
            </div>
            <p className={`mt-2 text-xs ${muted}`}>
              {selectedSubjectId ? 'The number is how many minutes you expect to study it.' : 'Add a subject first.'}
            </p>
          </form>

          <form onSubmit={addPrereq}>
            <p className="text-xs font-semibold">2. Link two topics</p>
            {activeTopics.length < 2 ? (
              <p className={`mt-2 text-xs ${muted}`}>Add at least two topics to link them.</p>
            ) : (
              <>
                <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                  <TopicSelect label="This topic" value={pick(topicId)} onChange={setTopicId} options={activeTopics} className={inputBg} />
                  <TopicSelect
                    label="Needs this first"
                    value={pick(needsId)}
                    onChange={setNeedsId}
                    options={activeTopics.filter(t => t.id !== pick(topicId))}
                    className={inputBg}
                  />
                  <button
                    type="submit"
                    disabled={!pick(topicId) || !pick(needsId) || setupNeeded}
                    className="flex h-10 items-center justify-center gap-1 rounded-lg bg-[#173761] px-4 text-sm font-semibold text-white transition hover:bg-[#244B7D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] disabled:opacity-50"
                  >
                    <Plus size={16} /> Link
                  </button>
                </div>
                <p aria-live="polite" className={`mt-2 min-h-[1rem] text-xs ${danger}`}>{notice}</p>
                <p className={`text-[11px] ${muted}`}>
                  Loop check: <span className="font-semibold text-[#B78116]">{ALGORITHMS.dfs.name}</span>
                  {' · '}{ALGORITHMS.dfs.uses}{' · '}{ALGORITHMS.dfs.time}
                </p>
              </>
            )}
          </form>
        </div>

        <details className="group mt-6">
          <summary className={`flex h-10 cursor-pointer list-none items-center gap-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] ${muted}`}>
            <ChevronDown size={16} className="transition group-open:rotate-180" />
            Manage topics and links ({activeTopics.length})
          </summary>
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
            {activeTopics.length === 0 ? (
              <p className={`text-xs ${muted}`}>No topics under this subject.</p>
            ) : (
              activeTopics.map((top) => {
                const needs = prereqs.filter(p => p.topic_id === top.id && idSet.has(p.prerequisite_id))
                return (
                  <div key={top.id} className={`rounded-xl border p-3 ${rowBg}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-sm">{top.title}</span>
                        <span className="ml-2 rounded-full bg-[#FFF4D6] px-2 py-0.5 text-[11px] font-semibold text-[#8A5F0B]">
                          {top.study_minutes ?? 30} min
                        </span>
                      </div>
                      <button
                        onClick={() => deleteTopic(top.id)}
                        aria-label={`Delete topic ${top.title}`}
                        className="rounded-lg p-2 text-slate-400 transition-colors hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E]"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    {needs.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className={`text-xs ${muted}`}>Needs</span>
                        {needs.map((p) => (
                          <span
                            key={p.id}
                            className={`inline-flex items-center gap-1 rounded-full border py-0.5 pl-2.5 pr-1 text-xs ${
                              darkMode ? 'border-[#2A3B51]' : 'border-[#E7E9E5] bg-white'
                            }`}
                          >
                            {titleOf(p.prerequisite_id)}
                            <button
                              onClick={() => removePrereq(p.id)}
                              aria-label={`Remove ${titleOf(p.prerequisite_id)} as a prerequisite of ${top.title}`}
                              className="rounded-full p-1 text-slate-400 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E]"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </details>
      </section>

      {/* Tools */}
      {activeTopics.length >= 2 && (
        <section className={`rounded-3xl border p-6 shadow-sm transition-colors duration-300 ${cardBg}`}>
          <h2 className="text-lg font-bold">Plan with algorithms</h2>
          <div role="tablist" aria-label="Learning path tools" className={`mt-4 flex flex-wrap gap-1 rounded-lg p-1 ${darkMode ? 'bg-[#0B1525]' : 'bg-[#F1F2EE]'}`}>
            {tools.map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={tool === t.key}
                  onClick={() => setTool(t.key)}
                  className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] ${
                    tool === t.key
                      ? 'bg-[#173761] text-white shadow-sm'
                      : darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-[#173761]'
                  }`}
                >
                  <Icon size={16} />
                  {t.label}
                </button>
              )
            })}
          </div>

          <div role="tabpanel" className={`mt-3 rounded-xl border p-4 ${rowBg}`}>
            <p className={`text-xs ${muted}`}>{activeTool.q}</p>

            <div className="mt-4">
              {tool === 'order' && (
                sorted.hasCycle ? (
                  <p className={`text-xs ${danger}`}>These links form a loop. Remove one prerequisite to get an order.</p>
                ) : (
                  <ol className="space-y-1.5 text-sm">
                    {sorted.order.map((id, i) => (
                      <li key={id} className="flex items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#173761] text-[11px] font-bold text-white">
                          {i + 1}
                        </span>
                        <span className="truncate">{titleOf(id)}</span>
                        <span className="ml-auto shrink-0 text-xs text-slate-400">{minutes[id]} min</span>
                      </li>
                    ))}
                  </ol>
                )
              )}

              {tool === 'route' && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TopicSelect label="Where I start" value={from} onChange={setRouteFrom} options={activeTopics} className={inputBg} />
                    <TopicSelect label="Where I want to end up" value={to} onChange={setRouteTo} options={activeTopics} className={inputBg} />
                  </div>
                  <div aria-live="polite" className="mt-4">
                    {from && to && (fastest && fewest ? (
                      <>
                        <div className="grid gap-5 sm:grid-cols-2">
                          <RouteResult heading="Fewest topics" path={fewest} total={fewestMinutes} titleOf={titleOf} minutes={minutes} />
                          <RouteResult heading="Least study time" path={fastest.path} total={fastest.cost} titleOf={titleOf} minutes={minutes} />
                        </div>
                        <p className={`mt-4 text-xs ${muted}`}>
                          {sameRoute
                            ? 'Both methods found the same route. It is drawn in gold on the map.'
                            : 'The shortest chain and the quickest chain differ here. The quickest is drawn in gold on the map.'}
                        </p>
                      </>
                    ) : (
                      <p className={`text-xs ${muted}`}>
                        No chain of prerequisites leads from the start to the goal. Try a topic that the goal builds on.
                      </p>
                    ))}
                  </div>
                </>
              )}

              {tool === 'unlocks' && (
                <>
                  <div className="sm:max-w-xs">
                    <TopicSelect label="When I finish" value={unlock} onChange={setUnlockId} options={activeTopics} className={inputBg} />
                  </div>
                  <div aria-live="polite" className="mt-4 space-y-2 text-sm">
                    {unlock && reach.length === 0 && (
                      <p className={`text-xs ${muted}`}>Nothing depends on this topic yet.</p>
                    )}
                    {Object.entries(levels).map(([lvl, list]) => (
                      <div key={lvl}>
                        <p className={`text-xs font-semibold ${muted}`}>
                          {lvl === '1' ? 'Unlocks right away' : `${lvl} steps away`}
                        </p>
                        <p>{list.map(titleOf).join(', ')}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <AlgoNote keys={activeTool.algos} muted={muted} />
          </div>
        </section>
      )}
    </div>
  )
}