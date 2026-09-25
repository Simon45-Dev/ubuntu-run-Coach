// Mirrors src/common/enums and prisma/schema.prisma on the backend.
// Kept as string-literal unions (not TS `enum`) - the project's tsconfig sets
// erasableSyntaxOnly, which disallows real enums.

export const ROLES = ['PLATFORM_ADMIN', 'COACH', 'ATHLETE', 'CLUB_MEMBER', 'CLUB_ADMIN'] as const
export type Role = (typeof ROLES)[number]

export const USER_STATUSES = ['INVITED', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED'] as const
export type UserStatus = (typeof USER_STATUSES)[number]

export const CONSENT_TYPES = ['HEALTH_CHECKIN_DATA', 'TERMS_OF_SERVICE'] as const
export type ConsentType = (typeof CONSENT_TYPES)[number]

export const ORGANISATION_TYPES = ['SOLO', 'CLUB'] as const
export type OrganisationType = (typeof ORGANISATION_TYPES)[number]

export const RACE_GOAL_STATUSES = ['PLANNED', 'COMPLETED', 'DNF', 'CANCELLED'] as const
export type RaceGoalStatus = (typeof RACE_GOAL_STATUSES)[number]

export const PB_SOURCES = ['SELF_REPORTED', 'VERIFIED'] as const
export type PbSource = (typeof PB_SOURCES)[number]

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
  clubMemberId?: string
  clubAdminId?: string
}

export interface PublicUser {
  id: string
  email: string
  name: string
  role: Role
  status: UserStatus
  mfaEnabled: boolean
  avatarUrl: string | null
  createdAt: string
}

export interface Organisation {
  id: string
  name: string
  type: OrganisationType
  createdAt: string
  updatedAt: string
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

/** Scoped to one organisation - can manage club membership only, no coaching access. */
export interface ClubAdmin {
  id: string
  userId: string
  organisationId: string
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

export interface ClubMember {
  id: string
  organisationId: string
  userId: string | null
  membershipNumber: string
  firstName: string
  lastName: string
  idNumber: string | null
  email: string
  phone: string | null
  dateOfBirth: string | null
  address: string | null
  joinDate: string
  membershipExpiryDate: string | null
  lastRenewalDate: string | null
  nextOfKinName: string | null
  nextOfKinPhone: string | null
  nextOfKinRelationship: string | null
  createdAt: string
  updatedAt: string
  user: { id: string; email: string; name: string; status: UserStatus } | null
}

export type PaymentMethod = 'CASH' | 'EFT' | 'CARD' | 'OTHER'

export const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'EFT', 'CARD', 'OTHER']

/** Record-keeping only - no payment gateway integration. See ClubMemberPayment (backend). */
export interface ClubMemberPayment {
  id: string
  clubMemberId: string
  amount: string
  method: PaymentMethod
  paidAt: string
  note: string | null
  recordedByUserId: string
  createdAt: string
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

export interface RaceGoal {
  id: string
  athleteId: string
  raceName: string
  raceDate: string
  distance: string
  targetTimeSeconds: number | null
  status: RaceGoalStatus
  actualTimeSeconds: number | null
  createdAt: string
  updatedAt: string
}

export interface PersonalBest {
  id: string
  athleteId: string
  distance: string
  timeSeconds: number
  achievedDate: string | null
  source: PbSource
  createdAt: string
  updatedAt: string
}

export interface CoachNote {
  id: string
  athleteId: string
  coachId: string
  content: string
  createdAt: string
  updatedAt: string
}

export const NOTIFICATION_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const
export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number]

export const NOTIFICATION_STATUSES = ['PENDING', 'SENT', 'READ', 'FAILED'] as const
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number]

export interface Notification {
  id: string
  recipientId: string
  type: string
  priority: NotificationPriority
  status: NotificationStatus
  payload: Record<string, unknown> | null
  sentAt: string | null
  readAt: string | null
  createdAt: string
  updatedAt: string
}

export interface WeeklyTrendEntry {
  weekStart: string
  scheduled: number
  completed: number
  distanceKm: number
  durationSec: number
  plannedDistanceKm: number
}

export interface AnalyticsSummary {
  from: string
  to: string
  adherence: { scheduled: number; completed: number; rate: number | null }
  volume: { totalDistanceKm: number; totalDurationSec: number }
  weeklyTrend: WeeklyTrendEntry[]
  avgRpeDelta: number | null
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

export interface AuditLogEntry {
  id: string
  actorUserId: string | null
  actorName: string | null
  actorEmail: string | null
  action: string
  targetEntityType: string
  targetEntityId: string
  ipAddress: string | null
  userAgent: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
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

export interface WeeklySignupEntry {
  weekStart: string
  users: number
  organisations: number
}

export interface PlatformStats {
  totals: {
    organisations: number
    coaches: number
    athletes: number
    clubMembers: number
    usersByStatus: Record<UserStatus, number>
  }
  weeklySignups: WeeklySignupEntry[]
  recentOrganisations: { id: string; name: string; type: OrganisationType; createdAt: string }[]
}
