import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Admin@123', 12);

  await seedUser('ramesh.avancha@neurom.in', 'Admin', Role.ADMIN, passwordHash);
  await seedUser('manager@neurom.in', 'Manager', Role.MANAGER, passwordHash);
  await seedUser(
    'bd.executive@neurom.in',
    'BD Executive',
    Role.BD_EXECUTIVE,
    passwordHash,
  );
  await seedUser('finance@neurom.in', 'Finance', Role.FINANCE, passwordHash);
  await seedUser(
    'tech.reviewer@neurom.in',
    'Technical Reviewer',
    Role.TECH_REVIEWER,
    passwordHash,
  );
}

function seedUser(
  email: string,
  name: string,
  role: Role,
  passwordHash: string,
) {
  return prisma.user.upsert({
    where: { email },
    update: { name, role, passwordHash, isActive: true },
    create: {
      email,
      name,
      passwordHash,
      role,
      isActive: true,
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
