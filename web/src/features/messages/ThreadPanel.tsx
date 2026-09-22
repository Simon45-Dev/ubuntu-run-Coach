import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Send } from 'lucide-react'
import { getThread, markRead, sendMessage } from '@/api/messages'
import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { Spinner } from '@/components/Spinner'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

export function ThreadPanel({ counterpartUserId, counterpartName }: { counterpartUserId: string; counterpartName: string }) {
  const { ctx } = useAuth()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [draft, setDraft] = useState('')
  const markedRef = useRef(new Set<string>())

  const { data, isLoading } = useQuery({
    queryKey: ['thread', counterpartUserId, page],
    queryFn: () => getThread(counterpartUserId, page, 20),
  })

  const sendMutation = useMutation({
    mutationFn: (content: string) => sendMessage(counterpartUserId, content),
    onSuccess: () => {
      setDraft('')
      void queryClient.invalidateQueries({ queryKey: ['thread', counterpartUserId] })
    },
  })

  const userId = ctx?.userId

  useEffect(() => {
    if (!data || !userId) return
    const unread = data.items.filter(
      (m) => m.receiverId === userId && !m.readAt && !markedRef.current.has(m.id),
    )
    if (unread.length === 0) return
    for (const message of unread) markedRef.current.add(message.id)
    void Promise.all(unread.map((m) => markRead(m.id))).then(() =>
      queryClient.invalidateQueries({ queryKey: ['thread', counterpartUserId] }),
    )
  }, [data, userId, counterpartUserId, queryClient])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!draft.trim()) return
    sendMutation.mutate(draft.trim())
  }

  const messages = data ? [...data.items].reverse() : []

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col rounded-lg border border-navy/10 bg-white">
      <div className="border-b border-navy/10 px-4 py-3">
        <p className="font-semibold text-navy">{counterpartName}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {data && data.page * data.pageSize < data.total && (
          <button
            className="mb-3 text-sm text-green hover:underline"
            onClick={() => setPage((p) => p + 1)}
          >
            Load earlier messages
          </button>
        )}
        {isLoading && <Spinner />}
        <div className="flex flex-col gap-2">
          {messages.map((message) => {
            const mine = message.senderId === ctx?.userId
            return (
              <div
                key={message.id}
                className={cn(
                  'max-w-[75%] rounded-lg px-3 py-2 text-sm',
                  mine ? 'self-end bg-green text-white' : 'self-start bg-mist text-navy',
                )}
              >
                <p>{message.content}</p>
                <p className={cn('mt-1 text-xs', mine ? 'text-white/70' : 'text-navy/40')}>
                  {format(new Date(message.sentAt), 'd MMM HH:mm')}
                </p>
              </div>
            )
          })}
          {!isLoading && messages.length === 0 && (
            <p className="text-center text-sm text-navy/40">No messages yet. Say hello.</p>
          )}
        </div>
      </div>

      <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-navy/10 p-3">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a message..."
          className="min-h-10 flex-1"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSubmit(e)
            }
          }}
        />
        <Button type="submit" size="icon" disabled={sendMutation.isPending || !draft.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
}
