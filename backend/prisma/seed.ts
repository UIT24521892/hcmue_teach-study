import { PrismaClient, UserRole } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const seedUsers = [
  { email: "teacher@mach.local", name: "Cô Minh Anh", role: UserRole.TEACHER },
  { email: "student@mach.local", name: "Nguyễn An", role: UserRole.STUDENT },
  { email: "learner@mach.local", name: "Lê Chi", role: UserRole.SELF_LEARNER },
] as const;

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Development seed cannot run in production.");
  }

  const password = process.env.SEED_PASSWORD ?? "ChangeMe123!";
  const passwordHash = await hash(password, 12);

  for (const user of seedUsers) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        passwordHash,
        role: user.role,
      },
      create: {
        ...user,
        passwordHash,
      },
    });
  }

  console.info(`Seeded ${seedUsers.length} local accounts.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
