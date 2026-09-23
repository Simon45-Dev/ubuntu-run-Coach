import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { submitCheckIn } from '@/api/checkIns'
import type { CheckIn } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const scale = z.coerce.number().int().min(1).max(10).optional().or(z.literal(''))

const schema = z.object({
  sleepQuality: scale,
  energy: scale,
  soreness: scale,
  stress: scale,
  motivation: scale,
  pain: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

const todayIso = () => new Date().toISOString()
const isToday = (dateIso: string) => new Date(dateIso).toDateString() === new Date().toDateString()

export function CheckInForm({ athleteId, todaysCheckIn }: { athleteId: string; todaysCheckIn?: CheckIn }) {
  const queryClient = useQueryClient()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    reset({
      sleepQuality: todaysCheckIn?.sleepQuality ?? '',
      energy: todaysCheckIn?.energy ?? '',
      soreness: todaysCheckIn?.soreness ?? '',
      stress: todaysCheckIn?.stress ?? '',
      motivation: todaysCheckIn?.motivation ?? '',
      pain: todaysCheckIn?.pain ?? '',
    })
  }, [todaysCheckIn, reset])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      submitCheckIn(athleteId, {
        date: todayIso(),
        sleepQuality: values.sleepQuality === '' ? undefined : Number(values.sleepQuality),
        energy: values.energy === '' ? undefined : Number(values.energy),
        soreness: values.soreness === '' ? undefined : Number(values.soreness),
        stress: values.stress === '' ? undefined : Number(values.stress),
        motivation: values.motivation === '' ? undefined : Number(values.motivation),
        pain: values.pain || undefined,
      }),
    onSuccess: () => {
      toast.success("Today's check-in saved")
      void queryClient.invalidateQueries({ queryKey: ['check-ins', athleteId] })
    },
    onError: () => toast.error('Could not save check-in'),
  })

  const alreadyLoggedToday = todaysCheckIn && isToday(todaysCheckIn.date)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{alreadyLoggedToday ? "Update today's check-in" : "Today's check-in"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="flex flex-col gap-4"
        >
          <div className="grid grid-cols-5 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sleepQuality">Sleep</Label>
              <Input id="sleepQuality" type="number" min={1} max={10} {...register('sleepQuality')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="energy">Energy</Label>
              <Input id="energy" type="number" min={1} max={10} {...register('energy')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="soreness">Soreness</Label>
              <Input id="soreness" type="number" min={1} max={10} {...register('soreness')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="stress">Stress</Label>
              <Input id="stress" type="number" min={1} max={10} {...register('stress')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="motivation">Motivation</Label>
              <Input id="motivation" type="number" min={1} max={10} {...register('motivation')} />
            </div>
          </div>
          {(errors.sleepQuality || errors.energy || errors.soreness || errors.stress || errors.motivation) && (
            <p className="text-sm text-status-attention">Each field is a scale of 1-10.</p>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pain">Any pain or discomfort? (optional)</Label>
            <Textarea id="pain" placeholder="e.g. slight tightness in left calf" {...register('pain')} />
          </div>
          <Button type="submit" disabled={mutation.isPending} className="self-start">
            {mutation.isPending ? 'Saving...' : alreadyLoggedToday ? 'Update check-in' : 'Save check-in'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
