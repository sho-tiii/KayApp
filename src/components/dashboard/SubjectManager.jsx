import { useState, useEffect } from 'react'
import { Plus, Trash2, BookOpen, Layers } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function SubjectManager({ session, darkMode }) {
  const [subjects, setSubjects] = useState([])
  const [topics, setTopics] = useState([])
  const [newSubjectName, setNewSubjectName] = useState('')
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [newTopicTitle, setNewTopicTitle] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (session) {
      fetchSubjectsAndTopics()
    }
  }, [session])

  const fetchSubjectsAndTopics = async () => {
    try {
      setLoading(true)
      const [subjRes, topRes] = await Promise.all([
        supabase.from('subjects').select('*').order('created_at', { ascending: false }),
        supabase.from('topics').select('*').order('created_at', { ascending: false })
      ])

      if (subjRes.error) throw subjRes.error
      if (topRes.error) throw topRes.error

      setSubjects(subjRes.data || [])
      setTopics(topRes.data || [])
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
      setSubjects(subjects.filter(s => s.id !== id))
      setTopics(topics.filter(t => t.subject_id !== id))
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

    try {
      const { data, error } = await supabase
        .from('topics')
        .insert([{ title: newTopicTitle, subject_id: selectedSubjectId, user_id: session.user.id }])
        .select()

      if (error) throw error
      setTopics([data[0], ...topics])
      setNewTopicTitle('')
    } catch (error) {
      console.error('Error adding topic:', error.message)
    }
  }

  const deleteTopic = async (id) => {
    try {
      const { error } = await supabase.from('topics').delete().eq('id', id)
      if (error) throw error
      setTopics(topics.filter(t => t.id !== id))
    } catch (error) {
      console.error('Error deleting topic:', error.message)
    }
  }

  const cardBg = darkMode ? 'bg-[#111F33] border-[#2A3B51]' : 'bg-white border-[#E7E9E5]'
  const inputBg = darkMode 
    ? 'bg-[#0B1525] border-[#2A3B51] text-white focus:border-[#F5B82E]' 
    : 'bg-[#FAFAF7] border-[#E7E9E5] text-[#173761] focus:border-[#F5B82E]'

  if (loading) {
    return <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Loading subjects...</p>
  }

  const activeTopics = topics.filter(t => t.subject_id === selectedSubjectId)

  return (
    <div className="grid gap-6 md:grid-cols-2">
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
            className={`flex-1 rounded-lg border px-4 py-2 text-sm transition focus:outline-none focus:ring-1 ${inputBg}`}
          />
          <button
            type="submit"
            disabled={!newSubjectName.trim()}
            className="flex items-center gap-1 rounded-lg bg-[#173761] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#244B7D] disabled:opacity-50"
          >
            <Plus size={16} /> Add
          </button>
        </form>

        <div className="mt-5 space-y-2 max-h-60 overflow-y-auto">
          {subjects.length === 0 ? (
            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>No subjects added yet.</p>
          ) : (
            subjects.map((sub) => (
              <div
                key={sub.id}
                onClick={() => setSelectedSubjectId(sub.id)}
                className={`flex items-center justify-between rounded-xl border p-3 cursor-pointer transition-colors ${
                  selectedSubjectId === sub.id
                    ? darkMode ? 'border-[#F5B82E] bg-[#172840]' : 'border-[#173761] bg-slate-50'
                    : darkMode ? 'border-[#2A3B51] bg-[#0B1525]' : 'border-[#E7E9E5] bg-[#FAFAF7]'
                }`}
              >
                <span className="text-sm font-semibold">{sub.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteSubject(sub.id); }}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Topics Panel */}
      <div className={`rounded-2xl border p-6 shadow-sm transition-colors duration-300 ${cardBg}`}>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Layers size={20} className={darkMode ? 'text-[#F5B82E]' : 'text-[#173761]'} />
          Topics
        </h2>

        {subjects.length === 0 ? (
          <p className={`mt-5 text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Please add a subject first.</p>
        ) : (
          <>
            <form onSubmit={addTopic} className="mt-5 flex gap-2">
              <input
                type="text"
                value={newTopicTitle}
                onChange={(e) => setNewTopicTitle(e.target.value)}
                placeholder="e.g. Binary Trees"
                className={`flex-1 rounded-lg border px-4 py-2 text-sm transition focus:outline-none focus:ring-1 ${inputBg}`}
              />
              <button
                type="submit"
                disabled={!newTopicTitle.trim() || !selectedSubjectId}
                className="flex items-center gap-1 rounded-lg bg-[#173761] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#244B7D] disabled:opacity-50"
              >
                <Plus size={16} /> Add
              </button>
            </form>

            <div className="mt-5 space-y-2 max-h-60 overflow-y-auto">
              {activeTopics.length === 0 ? (
                <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>No topics under this subject.</p>
              ) : (
                activeTopics.map((top) => (
                  <div
                    key={top.id}
                    className={`flex items-center justify-between rounded-xl border p-3 ${
                      darkMode ? 'border-[#2A3B51] bg-[#0B1525]' : 'border-[#E7E9E5] bg-[#FAFAF7]'
                    }`}
                  >
                    <span className="text-sm">{top.title}</span>
                    <button
                      onClick={() => deleteTopic(top.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}