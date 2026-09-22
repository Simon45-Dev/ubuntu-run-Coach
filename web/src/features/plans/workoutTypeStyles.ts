import type { WorkoutType } from '@/api/types'

// Brand colours (Section 9/18) applied to workout types on the calendar.
// Orange never carries white text, so REST/RACE pair it with Navy instead.
export const WORKOUT_TYPE_STYLES: Record<WorkoutType, { bg: string; text: string; label: string }> = {
  EASY: { bg: '#2E7D32', text: '#FFFFFF', label: 'Easy' },
  TEMPO: { bg: '#0D1B2A', text: '#FFFFFF', label: 'Tempo' },
  INTERVAL: { bg: '#0D1B2A', text: '#FFFFFF', label: 'Interval' },
  LONG_RUN: { bg: '#2E7D32', text: '#FFFFFF', label: 'Long run' },
  RACE: { bg: '#F39C12', text: '#0D1B2A', label: 'Race' },
  REST: { bg: '#9AA5B1', text: '#0D1B2A', label: 'Rest' },
  CROSS_TRAIN: { bg: '#F39C12', text: '#0D1B2A', label: 'Cross-train' },
}
