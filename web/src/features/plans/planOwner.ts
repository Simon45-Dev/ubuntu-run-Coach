// A TrainingPlan targets either one athlete or a group (see the backend's
// Groups slice) - this is the shared shape PlansTab/CreatePlanDialog/
// PlanDetailPage use to work with either without duplicating the whole
// calendar/workout UI per parent type.
export type PlanOwner = { type: 'athlete'; id: string } | { type: 'group'; id: string }
