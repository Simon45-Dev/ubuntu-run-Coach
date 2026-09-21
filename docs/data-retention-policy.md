# Data retention policy (draft)

This is a draft starting point, not a signed-off policy. It must be reviewed and
agreed with whoever holds the privacy/legal function for this venture before
any real personal information is loaded into the platform.

## Convention used across the schema

Every table holding personal information carries `createdAt`, `updatedAt`, and
`deletedAt` (soft delete). Where the intended end state is anonymisation
rather than deletion, the table also carries `anonymisedAt`. No automated
purge job exists yet in this slice - deletion/anonymisation is a manual
operation, run against these fields, until a scheduled job is justified by
real usage volume.

## Per-entity retention intent (draft - confirm before go-live)

| Entity | Category | Draft retention intent |
|---|---|---|
| User | Identity | Retain while account active; soft-delete on account closure; hard-delete or anonymise after a confirmed post-closure period |
| Coach | Profile | Same lifecycle as the linked User |
| Athlete | Profile | Same lifecycle as the linked User; coach relationship history retained for the org's own record-keeping needs, subject to athlete deletion request |
| PersonalBest | Training data | Retained with Athlete; deleted/anonymised with Athlete |
| CheckIn | Health-adjacent personal information | Stricter default: shorter retention than ordinary training data, and deletion on consent withdrawal, subject to any legitimate retention need being separately justified |
| Consent | Compliance record | Retained even after withdrawal, as evidence of the consent history itself (a withdrawn consent record is not deleted - it *is* the record that consent was withdrawn) |
| TrainingPlan / Workout / WorkoutResult | Training data | Retained with Athlete/Coach relationship |
| RaceGoal | Training data | Retained with Athlete |
| Message | Communication | Retention period to be agreed - communications are lower sensitivity than health data but still personal information |
| Notification | System record | Short retention; operational, not a long-term record |
| Subscription | Billing/commercial | Retained per standard financial record-keeping requirements once billing is built |
| AuditLog | Compliance record | Append-only, retained for a defined compliance period (e.g. matching security-incident investigation windows); never edited or deleted via the application |

## Open items

- Confirm exact retention periods per row above with the Information Officer
  equivalent for this venture before production launch.
- Confirm the deletion vs anonymisation choice per entity - some rows (e.g.
  CheckIn) may be better anonymised than deleted to preserve coach-visible
  training history without retaining directly identifying health detail.
- Confirm process for handling a data subject access/deletion request end to
  end, including what happens to AuditLog rows referencing a deleted user
  (the actor/target reference, not the deletion itself).
