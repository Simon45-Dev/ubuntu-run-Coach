import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Building2, Plus } from 'lucide-react'
import { listOrganisations } from '@/api/organisations'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FullPageSpinner } from '@/components/Spinner'
import { EmptyState } from '@/components/EmptyState'
import { CreateOrganisationDialog } from './CreateOrganisationDialog'

export function OrganisationsListPage() {
  const [createOpen, setCreateOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['organisations'],
    queryFn: () => listOrganisations(),
  })
  const organisations = data?.items

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Organisations</h1>
          <p className="text-sm text-navy/60">Manage organisations and invite coaches into them.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New organisation
        </Button>
      </div>

      {isLoading && <FullPageSpinner />}

      {!isLoading && organisations && organisations.length === 0 && (
        <EmptyState
          title="No organisations yet"
          description="Create one to start inviting coaches onto the platform."
          action={<Button onClick={() => setCreateOpen(true)}>New organisation</Button>}
        />
      )}

      {!isLoading && organisations && organisations.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {organisations.map((org) => (
            <Link key={org.id} to={`/admin/organisations/${org.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-3 pt-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green/10">
                    <Building2 className="h-5 w-5 text-green" />
                  </div>
                  <div>
                    <p className="font-semibold text-navy">{org.name}</p>
                    <p className="text-sm text-navy/60">{org.type}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <CreateOrganisationDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
