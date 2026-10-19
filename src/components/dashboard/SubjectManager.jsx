import { useState, useEffect } from 'react'
import { Plus, Trash2, BookOpen, Layers, GitBranch, ListOrdered, Route, Unlock, X, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { topologicalSort, bfs, dijkstra, wouldCreateCycle } from '../../lib/Graph'

const tools = [
  { key: 'order', label: 'Study order', icon: ListOrdered, q: 'What should I study first? Prerequisites always come before the topics that need them.' },
  { key: 'route', label: 'Fastest route', icon: Route, q: "What's the quickest way to reach a goal? Pick where you start and where you want to end up." },
  { key: 'unlocks', label: 'What it unlocks', icon: Unlock, q: 'What opens up after I finish a topic?' },
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

export default function SubjectManager({ session, darkMode }) {
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
  const [tool, setTool] = useState('order')
  const [routeFrom, setRouteFrom] = useState('')
  const [routeTo, setRouteTo] = useState('')
  const [unlockId, setUnlockId] = useState('')

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
    const minutes = Number.isNaN(parsed) ? 30 : Math.max(0, parsed)

    try {
      const { data, error } = await supabase
        .from('topics')
        .insert([{
          title: newTopicTitle,
          subject_id: selectedSubjectId,
          user_id: session.user.id,
          study_minutes: minutes,
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
  const activeTopics = topics.filter(t => t.subject_id === selectedSubjectId)
  const ids = activeTopics.map(t => t.id)
  const idSet = new Set(ids)
  const pick = (v) => (idSet.has(v) ? v : '')
  const edges = prereqs
    .filter(p => idSet.has(p.topic_id) && idSet.has(p.prerequisite_id))
    .map(p => ({ from: p.prerequisite_id, to: p.topic_id }))
  const minutes = Object.fromEntries(topics.map(t => [t.id, t.study_minutes ?? 30]))
  const titleOf = (id) => topics.find(t => t.id === id)?.title ?? ''

  const addPrereq = async (e) => {
    e.preventDefault()
    const topic = pick(topicId)
    const needs = pick(needsId)
    if (!topic || !needs) return
    if (edges.some(x => x.from === needs && x.to === topic)) {
      setNotice('That prerequisite already exists.')
      return
    }
    if (wouldCreateCycle(ids, edges, topic, needs)) {
      setNotice(`"${titleOf(needs)}" can't be a prerequisite of "${titleOf(topic)}" because that would create a loop.`)
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

  /* ---------- guide ---------- */
  const guide = [
    { label: 'Add a subject', done: subjects.length > 0, hint: 'Start with a class you are taking, like Mathematics.' },
    { label: 'Add topics', done: topics.length >= 2, hint: 'Add the lessons inside it, like Algebra and Calculus. You need at least two.' },
    { label: 'Link topics', done: prereqs.length > 0, hint: 'Say which topic needs another first, like Calculus needs Algebra.' },
  ]
  const nextIdx = guide.findIndex(s => !s.done)
  const guideHint = nextIdx === -1 ? 'All set. Pick a tool in Learning path to plan what to study.' : guide[nextIdx].hint

  /* ---------- algorithms ---------- */
  const sorted = topologicalSort(ids, edges)
  const totalMinutes = activeTopics.reduce((sum, t) => sum + (t.study_minutes ?? 30), 0)
  const from = pick(routeFrom)
  const to = pick(routeTo)
  const route = from && to ? dijkstra(ids, edges, minutes, from, to) : null
  const unlock = pick(unlockId)
  const reach = unlock ? bfs(ids, edges, unlock) : []
  const levels = reach.reduce((acc, n) => {
    (acc[n.level] ||= []).push(n.id)
    return acc
  }, {})
  const activeTool = tools.find(t => t.key === tool)

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Guide */}
      <div className={`rounded-2xl border p-5 shadow-sm transition-colors duration-300 md:col-span-2 ${cardBg}`}>
        <ol className="grid gap-3 sm:grid-cols-3">
          {guide.map((s, i) => (
            <li
              key={s.label}
              className={`flex items-center gap-3 rounded-xl border p-3 ${
                !s.done && i === nextIdx ? 'border-[#F5B82E] bg-[#FFF8E3] text-[#8A5F0B]' : rowBg
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  s.done ? 'bg-[#F5B82E] text-[#173761]' : 'bg-[#173761] text-white'
                }`}
              >
                {s.done ? <Check size={14} strokeWidth={3} /> : i + 1}
              </span>
              <span className="text-sm font-semibold">{s.label}</span>
            </li>
          ))}
        </ol>
        <p aria-live="polite" className={`mt-3 text-xs ${muted}`}>{guideHint}</p>
      </div>

      {/* Subjects Panel */}
      <div className={`rounded-2xl border p-6 shadow-sm transition-colors duration-300 ${cardBg}`}>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <BookOpen size={20} className={darkMode ? 'text-[#F5B82E]' : 'text-[#173761]'} />
          Subjects
        </h2>

        <form onSubmit={addSubject} className="mt-5 flex gap-2">
          <input
            type="text"
            value={newSubjectName}
            onChange={(e) => setNewSubjectName(e.target.value)}
            placeholder="e.g. Data Structures"
            aria-label="New subject name"
            className={`h-10 flex-1 rounded-lg border px-4 text-sm transition focus:outline-none focus:ring-1 focus:ring-[#F5B82E] ${inputBg}`}
          />
          <button
            type="submit"
            disabled={!newSubjectName.trim()}
            className="flex h-10 items-center gap-1 rounded-lg bg-[#173761] px-4 text-sm font-semibold text-white transition hover:bg-[#244B7D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] disabled:opacity-50"
          >
            <Plus size={16} /> Add
          </button>
        </form>

        <div className="mt-5 max-h-60 space-y-2 overflow-y-auto">
          {subjects.length === 0 ? (
            <p className={`text-xs ${muted}`}>No subjects added yet.</p>
          ) : (
            subjects.map((sub) => (
              <div
                key={sub.id}
                role="button"
                tabIndex={0}
                aria-pressed={selectedSubjectId === sub.id}
                onClick={() => setSelectedSubjectId(sub.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelectedSubjectId(sub.id)
                  }
                }}
                className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] ${
                  selectedSubjectId === sub.id
                    ? darkMode ? 'border-[#F5B82E] bg-[#172840]' : 'border-[#173761] bg-slate-50'
                    : `${rowBg} hover:border-[#D6B75E]`
                }`}
              >
                <span className="text-sm font-semibold">{sub.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteSubject(sub.id) }}
                  aria-label={`Delete subject ${sub.name}`}
                  className="rounded-lg p-2 text-slate-400 transition-colors hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E]"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}
        </div>
        {subjects.length > 1 && (
          <p className={`mt-3 text-xs ${muted}`}>Click a subject to see its topics and learning path.</p>
        )}
      </div>

      {/* Topics Panel */}
      <div className={`rounded-2xl border p-6 shadow-sm transition-colors duration-300 ${cardBg}`}>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Layers size={20} className={darkMode ? 'text-[#F5B82E]' : 'text-[#173761]'} />
          Topics
        </h2>

        {subjects.length === 0 ? (
          <p className={`mt-5 text-xs ${muted}`}>Please add a subject first.</p>
        ) : (
          <>
            <form onSubmit={addTopic} className="mt-5 flex gap-2">
              <input
                type="text"
                value={newTopicTitle}
                onChange={(e) => setNewTopicTitle(e.target.value)}
                placeholder="e.g. Binary Trees"
                aria-label="New topic title"
                className={`h-10 min-w-0 flex-1 rounded-lg border px-4 text-sm transition focus:outline-none focus:ring-1 focus:ring-[#F5B82E] ${inputBg}`}
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
            </form>
            <p className={`mt-2 text-xs ${muted}`}>The number is how many minutes you expect to study the topic.</p>

            <div className="mt-4 max-h-60 space-y-2 overflow-y-auto">
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
          </>
        )}
      </div>

      {/* Learning Path Panel */}
      <div className={`rounded-2xl border p-6 shadow-sm transition-colors duration-300 md:col-span-2 ${cardBg}`}>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <GitBranch size={20} className={darkMode ? 'text-[#F5B82E]' : 'text-[#173761]'} />
          Learning path
        </h2>
        <p className={`mt-1 text-xs ${muted}`}>
          Example: Calculus needs Algebra. KayApp uses these links to plan what you study and when.
        </p>

        {setupNeeded && (
          <p role="alert" className="mt-4 rounded-lg border border-[#EBDDB0] bg-[#FFF8E3] px-3 py-2 text-xs text-[#8A5F0B]">
            Prerequisites are not set up yet. Run the SQL migration in Supabase, then refresh this page.
          </p>
        )}

        {activeTopics.length < 2 ? (
          <p className={`mt-5 text-xs ${muted}`}>Add at least two topics to this subject to link prerequisites.</p>
        ) : (
          <>
            <form onSubmit={addPrereq} className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
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
                <Plus size={16} /> Add link
              </button>
            </form>
            <p aria-live="polite" className={`mt-2 min-h-[1rem] text-xs ${danger}`}>{notice}</p>

            {/* Tool tabs */}
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
                    <>
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
                      <p className={`mt-3 text-xs ${muted}`}>Total: {totalMinutes} min</p>
                    </>
                  )
                )}

                {tool === 'route' && (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <TopicSelect label="Where I start" value={from} onChange={setRouteFrom} options={activeTopics} className={inputBg} />
                      <TopicSelect label="Where I want to end up" value={to} onChange={setRouteTo} options={activeTopics} className={inputBg} />
                    </div>
                    <div aria-live="polite" className="mt-4 text-sm">
                      {from && to && (route ? (
                        <>
                          <ol className="space-y-1">
                            {route.path.map((id) => (
                              <li key={id} className="flex items-center gap-2">
                                <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#F5B82E]" />
                                <span className="truncate">{titleOf(id)}</span>
                                <span className="ml-auto shrink-0 text-xs text-slate-400">{minutes[id]} min</span>
                              </li>
                            ))}
                          </ol>
                          <p className="mt-2 text-xs font-semibold text-[#B78116]">Total: {route.cost} min</p>
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
                      {Object.entries(levels).map(([level, list]) => (
                        <div key={level}>
                          <p className={`text-xs font-semibold ${muted}`}>
                            {level === '1' ? 'Unlocks right away' : `${level} steps away`}
                          </p>
                          <p>{list.map(titleOf).join(', ')}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}