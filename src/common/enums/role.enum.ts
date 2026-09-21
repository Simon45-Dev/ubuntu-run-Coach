// Re-exported rather than redeclared: a hand-written string enum with the
// same members is a structurally distinct TypeScript type from Prisma's
// generated one, so every value coming out of PrismaService (e.g.
// user.role) would need casting. The schema is the single source of truth.
export { Role } from '@prisma/client';
