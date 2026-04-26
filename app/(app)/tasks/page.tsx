'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, Plus, Trash2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { AddTaskDialog, type Task } from '@/components/AddTaskDialog'

type TabValue = 'all' | 'pending' | 'completed'

function getTodayStr() {
  return new Date().toISOString().split('T')[0]
}

function addDays(n: number) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function formatDueDate(dateStr: string) {
  const today = getTodayStr()
  const tomorrow = addDays(1)
  if (dateStr === today) return '今天'
  if (dateStr === tomorrow) return '明天'
  // format as MM-DD
  const [, mm, dd] = dateStr.split('-')
  return `${mm}/${dd}`
}

function dueBadgeClass(dateStr: string, completed: boolean) {
  if (completed) return 'bg-gray-100 text-gray-400'
  const today = getTodayStr()
  if (dateStr < today) return 'bg-red-100 text-red-600'
  if (dateStr === today) return 'bg-orange-100 text-orange-600'
  return 'bg-gray-100 text-gray-500'
}

interface TaskGroup {
  label: string
  labelClass: string
  tasks: Task[]
}

function groupPendingTasks(tasks: Task[]): TaskGroup[] {
  const today = getTodayStr()
  const in7 = addDays(7)

  const overdue = tasks.filter((t) => t.due_date < today)
  const todayTasks = tasks.filter((t) => t.due_date === today)
  const thisWeek = tasks.filter((t) => t.due_date > today && t.due_date <= in7)
  const further = tasks.filter((t) => t.due_date > in7)

  const groups: TaskGroup[] = []
  if (overdue.length) groups.push({ label: '已逾期', labelClass: 'text-red-600', tasks: overdue })
  if (todayTasks.length) groups.push({ label: '今日到期', labelClass: 'text-orange-600', tasks: todayTasks })
  if (thisWeek.length) groups.push({ label: '本周', labelClass: 'text-gray-600', tasks: thisWeek })
  if (further.length) groups.push({ label: '更远', labelClass: 'text-gray-500', tasks: further })
  return groups
}

function TaskCard({
  task,
  onToggle,
  onDelete,
}: {
  task: Task
  onToggle: (task: Task) => void
  onDelete: (id: string) => void
}) {
  const completed = !!task.completed_at
  const today = getTodayStr()
  const overdue = !completed && task.due_date < today

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-white hover:bg-gray-50 transition-colors">
      <button
        onClick={() => onToggle(task)}
        className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
          completed
            ? 'border-green-500 bg-green-500 text-white'
            : overdue
            ? 'border-red-400 hover:border-red-500'
            : 'border-gray-300 hover:border-blue-500'
        }`}
      >
        {completed && <CheckCircle2 className="w-3.5 h-3.5" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-medium ${completed ? 'line-through text-gray-400' : ''}`}>
            {task.title}
          </span>
          <span
            className={`text-xs px-1.5 py-0.5 rounded font-medium ${dueBadgeClass(task.due_date, completed)}`}
          >
            {formatDueDate(task.due_date)}
          </span>
        </div>

        {(task.quotations?.quotation_number || task.customers?.company_name) && (
          <div className="text-xs text-gray-400 mt-0.5">
            {task.quotations?.quotation_number && (
              <span>{task.quotations.quotation_number}</span>
            )}
            {task.quotations?.quotation_number && task.customers?.company_name && (
              <span className="mx-1">·</span>
            )}
            {task.customers?.company_name && (
              <span>{task.customers.company_name}</span>
            )}
          </div>
        )}

        {task.note && (
          <p className="text-xs text-gray-500 mt-0.5 truncate">{task.note}</p>
        )}
      </div>

      <button
        onClick={() => onDelete(task.id)}
        className="flex-shrink-0 p-1 text-gray-300 hover:text-red-400 transition-colors rounded"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabValue>('pending')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [overdueCount, setOverdueCount] = useState(0)

  const fetchTasks = useCallback(async (status: TabValue) => {
    setLoading(true)
    try {
      const apiStatus = status === 'pending' ? 'pending' : status === 'completed' ? 'completed' : 'all'
      const res = await fetch(`/api/tasks?status=${apiStatus}&limit=100`)
      const data = await res.json()
      if (data.error) { toast.error(data.error); return }
      setTasks(data.tasks || [])
      setOverdueCount(data.overdue_count || 0)
    } catch {
      toast.error('加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTasks(tab)
  }, [tab, fetchTasks])

  const pendingCount = tasks.filter((t) => !t.completed_at).length

  const handleToggle = async (task: Task) => {
    const nowCompleted = !task.completed_at
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, completed_at: nowCompleted ? new Date().toISOString() : null }
          : t
      )
    )

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ complete: nowCompleted }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        // Revert
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? task : t))
        )
        toast.error(data.error || '更新失败')
      } else {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? data : t)))
        if (nowCompleted) toast.success('已完成')
        window.dispatchEvent(new Event('tasks-updated'))
      }
    } catch {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)))
      toast.error('更新失败')
    }
  }

  const handleDelete = async (id: string) => {
    const original = tasks.find((t) => t.id === id)
    setTasks((prev) => prev.filter((t) => t.id !== id))
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        if (original) setTasks((prev) => [...prev, original])
        toast.error('删除失败')
      } else {
        toast.success('已删除')
        window.dispatchEvent(new Event('tasks-updated'))
      }
    } catch {
      if (original) setTasks((prev) => [...prev, original])
      toast.error('删除失败')
    }
  }

  const handleCreated = (task: Task) => {
    setTasks((prev) => [task, ...prev])
    if (tab !== 'pending') setTab('pending')
  }

  // Filter tasks for current tab display
  const displayTasks = tasks.filter((t) => {
    if (tab === 'pending') return !t.completed_at
    if (tab === 'completed') return !!t.completed_at
    return true
  })

  const pendingTasks = displayTasks.filter((t) => !t.completed_at)
  const completedTasks = displayTasks.filter((t) => !!t.completed_at)
  const groups = groupPendingTasks(pendingTasks)

  return (
    <div className="p-8 pt-16 md:pt-8 space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-6 h-6 text-amber-500" />
          <h1 className="text-2xl font-bold">跟进提醒</h1>
          {overdueCount > 0 && (
            <span className="text-xs bg-red-100 text-red-600 font-medium px-2 py-0.5 rounded-full">
              {overdueCount} 项逾期
            </span>
          )}
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          新建提醒
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(['all', 'pending', 'completed'] as TabValue[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'all' ? '全部' : t === 'pending' ? `待处理${pendingCount > 0 ? ` ${pendingCount}` : ''}` : '已完成'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">加载中...</div>
      ) : displayTasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>暂无{tab === 'completed' ? '已完成' : '待处理'}提醒</p>
            {tab === 'pending' && (
              <p className="text-sm mt-1 text-gray-400">从报价或客户页面添加跟进提醒</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Grouped pending tasks */}
          {pendingTasks.length > 0 && (
            <div className="space-y-4">
              {groups.map((group) => (
                <div key={group.label}>
                  <h3 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${group.labelClass}`}>
                    {group.label}
                  </h3>
                  <div className="space-y-2">
                    {group.tasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onToggle={handleToggle}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Completed tasks */}
          {completedTasks.length > 0 && (tab === 'all' || tab === 'completed') && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide mb-2 text-gray-400">
                已完成
              </h3>
              <div className="space-y-2">
                {completedTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <AddTaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={handleCreated}
      />
    </div>
  )
}
