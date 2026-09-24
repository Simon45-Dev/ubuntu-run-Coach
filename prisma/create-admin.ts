/**
 * One-off bootstrap for a fresh database. PLATFORM_ADMIN has no
 * self-registration route by design (only coach self-signup is exposed), so
 * this is the only way to get the first admin account onto a new deployment.
 * Usage: npm run create-admin -- <email> <password> ["Full Name"]
 */
import { PrismaClient, Role, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const [email, password, name] = process.argv.slice(2);
  if (!email || !password) {
    // eslint-disable-next-line no-console
    console.error('Usage: npm run create-admin -- <email> <password> ["Full Name"]');
    process.exitCode = 1;
    return;
  }

  const passwordHash = await argon2.hash(password);
  const admin = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: name ?? 'Platform Admin',
      role: Role.PLATFORM_ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  // eslint-disable-next-line no-console
  console.log(`Created PLATFORM_ADMIN ${admin.email} (${admin.id})`);
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
