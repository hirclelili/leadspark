'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

export interface Task {
  id: string
  user_id: string
  title: string
  due_date: string
  note: string | null
  completed_at: string | null
  quotation_id: string | null
  customer_id: string | null
  created_at: string
  updated_at: string
  customers?: { company_name: string } | null
  quotations?: { quotation_number: string } | null
}

interface AddTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultTitle?: string
  quotationId?: string
  quotationNumber?: string
  customerId?: string
  customerName?: string
  onCreated?: (task: Task) => void
}

function getTodayStr() {
  return new Date().toISOString().split('T')[0]
}

function addDays(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

const QUICK_OPTIONS = [
  { label: '明天', days: 1 },
  { label: '3天后', days: 3 },
  { label: '7天后', days: 7 },
  { label: '14天后', days: 14 },
]

export function AddTaskDialog({
  open,
  onOpenChange,
  defaultTitle = '',
  quotationId,
  quotationNumber,
  customerId,
  customerName,
  onCreated,
}: AddTaskDialogProps) {
  const [title, setTitle] = useState(defaultTitle)
  const [dueDate, setDueDate] = useState(addDays(3))
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  // Reset when dialog opens
  const handleOpenChange = (value: boolean) => {
    if (value) {
      setTitle(defaultTitle)
      setDueDate(addDays(3))
      setNote('')
    }
    onOpenChange(value)
  }

  const handleQuickSelect = (days: number) => {
    setDueDate(addDays(days))
  }

  const isQuickSelected = (days: number) => dueDate === addDays(days)

  const handleSave = async () => {
    if (!title.trim()) { toast.error('请填写提醒标题'); return }
    if (!dueDate) { toast.error('请选择截止日期'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          due_date: dueDate,
          note: note.trim() || null,
          quotation_id: quotationId || null,
          customer_id: customerId || null,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        toast.error(data.error || '创建失败')
        return
      }
      toast.success('跟进提醒已添加')
      onCreated?.(data)
      onOpenChange(false)
    } catch {
      toast.error('创建失败，请检查网络连接')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>添加跟进提醒</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Association hint */}
          {(quotationNumber || customerName) && (
            <div className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-md">
              {quotationNumber && <span>关联：{quotationNumber}</span>}
              {quotationNumber && customerName && <span className="mx-2">·</span>}
              {customerName && <span>客户：{customerName}</span>}
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">标题 *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="提醒标题"
            />
          </div>

          {/* Due date */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">截止日期 *</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {QUICK_OPTIONS.map((opt) => (
                <button
                  key={opt.days}
                  type="button"
                  onClick={() => handleQuickSelect(opt.days)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    isQuickSelected(opt.days)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <input
              type="date"
              value={dueDate}
              min={getTodayStr()}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">备注</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="备注（可选）"
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
