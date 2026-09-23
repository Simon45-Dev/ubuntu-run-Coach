// Mirrors src/common/enums and prisma/schema.prisma on the backend.
// Kept as string-literal unions (not TS `enum`) - the project's tsconfig sets
// erasableSyntaxOnly, which disallows real enums.

export const ROLES = ['PLATFORM_ADMIN', 'COACH', 'ATHLETE'] as const
export type Role = (typeof ROLES)[number]

export const USER_STATUSES = ['INVITED', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED'] as const
export type UserStatus = (typeof USER_STATUSES)[number]

export const CONSENT_TYPES = ['HEALTH_CHECKIN_DATA', 'TERMS_OF_SERVICE'] as const
export type ConsentType = (typeof CONSENT_TYPES)[number]

export const TRAINING_PLAN_PHASES = ['BASE', 'BUILD', 'PEAK', 'TAPER', 'RECOVERY'] as const
export type TrainingPlanPhase = (typeof TRAINING_PLAN_PHASES)[number]

export const TRAINING_PLAN_STATUSES = ['DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED'] as const
export type TrainingPlanStatus = (typeof TRAINING_PLAN_STATUSES)[number]

export const WORKOUT_TYPES = [
  'EASY',
  'TEMPO',
  'INTERVAL',
  'LONG_RUN',
  'RACE',
  'REST',
  'CROSS_TRAIN',
] as const
export type WorkoutType = (typeof WORKOUT_TYPES)[number]

export interface AuthContext {
  userId: string
  role: Role
  organisationId?: string
  coachId?: string
  athleteId?: string
}

export interface PublicUser {
  id: string
  email: string
  name: string
  role: Role
  status: UserStatus
  mfaEnabled: boolean
  createdAt: string
}

export interface Coach {
  id: string
  userId: string
  organisationId: string
  bio: string | null
  experienceYears: number | null
  athleteLimit: number | null
  createdAt: string
  updatedAt: string
  user: { id: string; email: string; name: string; status: UserStatus }
}

export interface Athlete {
  id: string
  userId: string
  coachId: string | null
  organisationId: string | null
  goal: string | null
  availability: Record<string, unknown> | null
  trainingBackground: string | null
  createdAt: string
  updatedAt: string
  user: { id: string; email: string; name: string; status: UserStatus }
  coach: { id: string; user: { id: string; name: string } } | null
}

export interface GroupMembership {
  id: string
  athleteId: string
  joinedAt: string
  athlete: { id: string; user: { id: string; name: string } }
}

export interface Group {
  id: string
  coachId: string
  organisationId: string
  name: string
  createdAt: string
  updatedAt: string
  memberships: GroupMembership[]
}

export interface TrainingPlan {
  id: string
  organisationId: string
  coachId: string
  // A plan targets either an athlete or a group, never both - see the
  // backend's Groups slice.
  athleteId: string | null
  groupId: string | null
  name: string
  startDate: string
  endDate: string | null
  goal: string | null
  phase: TrainingPlanPhase | null
  version: number
  status: TrainingPlanStatus
  createdAt: string
  updatedAt: string
}

export interface TemplateWorkout {
  id: string
  templateId: string
  dayOffset: number
  type: WorkoutType
  distanceTargetKm: string | null
  durationTargetSec: number | null
  paceTarget: string | null
  hrZoneTarget: string | null
  rpeTarget: number | null
  instructions: string | null
}

export interface Template {
  id: string
  coachId: string
  organisationId: string
  name: string
  goal: string | null
  phase: TrainingPlanPhase | null
  createdAt: string
  updatedAt: string
  workouts: TemplateWorkout[]
}

export interface Consent {
  id: string
  athleteId: string
  consentType: ConsentType
  policyVersion: string
  grantedAt: string
  withdrawnAt: string | null
}

export interface CheckIn {
  id: string
  athleteId: string
  date: string
  sleepQuality: number | null
  energy: number | null
  soreness: number | null
  stress: number | null
  motivation: number | null
  pain: string | null
  consentId: string
}

export interface Workout {
  id: string
  trainingPlanId: string
  scheduledDate: string
  type: WorkoutType
  distanceTargetKm: string | null
  durationTargetSec: number | null
  paceTarget: string | null
  hrZoneTarget: string | null
  rpeTarget: number | null
  instructions: string | null
  createdAt: string
  updatedAt: string
}

export interface WorkoutResult {
  id: string
  workoutId: string
  athleteId: string
  actualDistanceKm: string | null
  actualDurationSec: number | null
  actualPace: string | null
  avgHr: number | null
  maxHr: number | null
  rpe: number | null
  comments: string | null
  completedAt: string
  createdAt: string
  updatedAt: string
}

export interface Message {
  id: string
  senderId: string
  receiverId: string | null
  groupId: string | null
  content: string
  sentAt: string
  readAt: string | null
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export const ALERT_TYPES = [
  'PAIN_INJURY',
  'MISSED_TRAINING',
  'LOW_READINESS',
  'TRAINING_SPIKE',
  'RACE_APPROACHING',
  'POSITIVE_PROGRESS',
] as const
export type AlertType = (typeof ALERT_TYPES)[number]

export const ALERT_PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'] as const
export type AlertPriority = (typeof ALERT_PRIORITIES)[number]

export interface ActionCentreAlert {
  athleteId: string
  athleteName: string
  type: AlertType
  priority: AlertPriority
  message: string
  detectedAt: string
  payload?: Record<string, unknown>
}
