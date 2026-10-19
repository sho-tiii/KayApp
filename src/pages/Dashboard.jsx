import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Plus, Check, Trash2, CalendarDays, Sun, Moon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import kayappLogo from '../assets/KAYAPP.png'
import SubjectManager from '../components/dashboard/SubjectManager'

export default function Dashboard({ session, darkMode, onToggleTheme }) {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState([])
  const [newTask, setNewTask] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (session) {
      fetchTasks()
    }
  }, [session])

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setTasks(data || [])
    } catch (error) {
      console.error('Error fetching tasks:', error.message)
    } finally {
      setLoading(false)
    }
  }

  const addTask = async (e) => {
    e.preventDefault()
    if (!newTask.trim()) return

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([{ title: newTask, user_id: session.user.id }])
        .select()

      if (error) throw error
      setTasks([data[0], ...tasks])
      setNewTask('')
    } catch (error) {
      console.error('Error adding task:', error.message)
    }
  }

  const toggleTask = async (id, currentStatus) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ is_done: !currentStatus })
        .eq('id', id)
      
      if (error) throw error
      setTasks(tasks.map(t => t.id === id ? { ...t, is_done: !currentStatus } : t))
    } catch (error) {
      console.error('Error updating task:', error.message)
    }
  }

  const deleteTask = async (id) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      setTasks(tasks.filter(t => t.id !== id))
    } catch (error) {
      console.error('Error deleting task:', error.message)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const bgClass = darkMode ? 'bg-[#0B1525] text-slate-100' : 'bg-[#FAFAF7] text-[#173761]'
  const headerBg = darkMode ? 'border-white/10 bg-[#101D30]/95' : 'border-[#E9E9E3] bg-white/90'
  const cardBg = darkMode ? 'bg-[#111F33] border-[#2A3B51]' : 'bg-white border-[#E7E9E5]'
  const inputBg = darkMode 
    ? 'bg-[#0B1525] border-[#2A3B51] text-white focus:border-[#F5B82E]' 
    : 'bg-[#FAFAF7] border-[#E7E9E5] text-[#173761] focus:border-[#F5B82E]'

  return (
    <div className={`min-h-screen ${bgClass}`}>
      {/* Private Dashboard Header */}
      <header className={`sticky top-0 z-50 border-b backdrop-blur transition-colors duration-300 px-6 py-3 ${headerBg}`}>
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={kayappLogo} alt="KayApp" className="h-10 w-20 object-contain object-left" />
            <span className={`hidden sm:block text-sm font-bold uppercase tracking-wider ${darkMode ? 'text-[#F5B82E]' : 'text-[#B78116]'}`}>
              Student Workspace
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <span className={`hidden sm:block text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {session?.user?.email}
            </span>
            
            <button
              onClick={onToggleTheme}
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              title={darkMode ? "Light mode" : "Dark mode"}
              className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] ${
                darkMode 
                  ? 'text-slate-300 hover:bg-white/10 hover:text-white' 
                  : 'text-slate-600 hover:bg-slate-100 hover:text-[#173761]'
              }`}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button
              onClick={handleSignOut}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] ${
                darkMode ? 'hover:bg-white/10 text-red-400' : 'hover:bg-red-50 text-red-600'
              }`}
            >
              <LogOut size={16} />
              <span className="hidden sm:block">Log out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-5xl px-6 py-12 space-y-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Your Study Plan</h1>
          <p className={`mt-2 text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Manage your tasks, subjects, and topics here. This data is securely saved to your account.
          </p>
        </div>

        {/* Subjects and Topics Management Section */}
        <SubjectManager session={session} darkMode={darkMode} />

        {/* Real Task Manager Section */}
        <div className={`rounded-2xl border p-6 shadow-sm transition-colors duration-300 ${cardBg}`}>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <CalendarDays size={20} className={darkMode ? 'text-[#F5B82E]' : 'text-[#173761]'} />
            Upcoming Tasks
          </h2>

          <form onSubmit={addTask} className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="What do you need to study?"
              className={`flex-1 rounded-lg border px-4 py-2.5 text-sm transition focus:outline-none focus:ring-1 ${inputBg}`}
            />
            <button
              type="submit"
              disabled={!newTask.trim()}
              className="flex items-center justify-center gap-2 rounded-lg bg-[#173761] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#244B7D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] disabled:opacity-50"
            >
              <Plus size={16} />
              <span>Add Task</span>
            </button>
          </form>

          <div className="mt-6">
            {loading ? (
              <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Loading tasks...</p>
            ) : tasks.length === 0 ? (
              <div className={`rounded-xl border border-dashed py-10 text-center ${darkMode ? 'border-[#2A3B51] bg-[#0B1525]' : 'border-slate-300 bg-[#FAFAF7]'}`}>
                <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>No tasks yet. Create your first study plan above!</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {tasks.map((task) => (
                  <li
                    key={task.id}
                    className={`group flex items-center justify-between rounded-xl border p-3 transition-colors duration-300 ${
                      darkMode ? 'border-[#2A3B51] bg-[#0B1525] hover:border-[#D6B75E]' : 'border-[#E7E9E5] bg-[#FAFAF7] hover:border-[#D6B75E]'
                    }`}
                  >
                    <div className="flex flex-1 items-center gap-3 overflow-hidden">
                      <button
                        onClick={() => toggleTask(task.id, task.is_done)}
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] ${
                          task.is_done
                            ? 'border-[#173761] bg-[#173761] text-white'
                            : darkMode
                            ? 'border-slate-600 bg-transparent text-transparent group-hover:border-[#F5B82E]'
                            : 'border-slate-300 bg-white text-transparent group-hover:border-[#173761]'
                        }`}
                        aria-label={task.is_done ? "Mark as undone" : "Mark as done"}
                      >
                        <Check size={14} strokeWidth={3} />
                      </button>
                      
                      <span className={`truncate text-sm transition ${
                        task.is_done 
                          ? (darkMode ? 'text-slate-500 line-through' : 'text-slate-400 line-through')
                          : (darkMode ? 'text-slate-200' : 'text-[#173761]')
                      }`}>
                        {task.title}
                      </span>
                    </div>

                    <button
                      onClick={() => deleteTask(task.id)}
                      className={`ml-2 shrink-0 rounded-lg p-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] ${
                        darkMode ? 'text-slate-500 hover:bg-red-500/10 hover:text-red-400' : 'text-slate-400 hover:bg-red-50 hover:text-red-600'
                      }`}
                      aria-label="Delete task"
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}