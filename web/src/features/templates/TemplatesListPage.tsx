import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, ClipboardList } from 'lucide-react'
import { listTemplates } from '@/api/templates'
import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FullPageSpinner } from '@/components/Spinner'
import { EmptyState } from '@/components/EmptyState'
import { CreateTemplateDialog } from './CreateTemplateDialog'

export function TemplatesListPage() {
  const { ctx } = useAuth()
  const coachId = ctx?.coachId ?? ''
  const [createOpen, setCreateOpen] = useState(false)

  const { data: templates, isLoading } = useQuery({
    queryKey: ['templates', coachId],
    queryFn: () => listTemplates(coachId),
    enabled: !!coachId,
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Templates</h1>
          <p className="text-sm text-navy/60">Build a plan once, reuse it for any athlete or group.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New template
        </Button>
      </div>

      {isLoading && <FullPageSpinner />}

      {!isLoading && templates && templates.length === 0 && (
        <EmptyState
          title="No templates yet"
          description="Create a reusable training-plan skeleton to apply whenever you need it."
          action={<Button onClick={() => setCreateOpen(true)}>New template</Button>}
        />
      )}

      {!isLoading && templates && templates.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Link key={template.id} to={`/templates/${template.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-start gap-3 pt-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy/5">
                    <ClipboardList className="h-5 w-5 text-navy" />
                  </div>
                  <div>
                    <p className="font-semibold text-navy">{template.name}</p>
                    {template.goal && <p className="text-sm text-navy/60">{template.goal}</p>}
                    <p className="text-sm text-navy/40">
                      {template.workouts.length} {template.workouts.length === 1 ? 'workout' : 'workouts'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <CreateTemplateDialog coachId={coachId} open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
