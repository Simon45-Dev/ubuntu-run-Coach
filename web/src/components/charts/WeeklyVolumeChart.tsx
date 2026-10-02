import { formatDate } from '@/lib/format'

/** Actual distance as a solid bar, planned distance as an outline behind it - no charting library needed for this. */
export function WeeklyVolumeChart({
  weeklyTrend,
}: {
  weeklyTrend: { weekStart: string; distanceKm: number; plannedDistanceKm: number }[]
}) {
  const max = Math.max(1, ...weeklyTrend.map((w) => Math.max(w.distanceKm, w.plannedDistanceKm)))
  return (
    <div className="flex h-40 items-end gap-3">
      {weeklyTrend.map((week) => (
        <div key={week.weekStart} className="flex flex-1 flex-col items-center gap-1">
          <div className="relative flex h-32 w-full items-end justify-center">
            <div
              className="absolute bottom-0 w-full rounded-t border border-navy/30"
              style={{ height: `${Math.round((week.plannedDistanceKm / max) * 100)}%` }}
            />
            <div
              className="relative w-2/3 rounded-t bg-green"
              style={{ height: `${Math.round((week.distanceKm / max) * 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-navy/50">{formatDate(week.weekStart, 'd MMM')}</p>
        </div>
      ))}
    </div>
  )
}
