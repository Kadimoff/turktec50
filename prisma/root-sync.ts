/* Ensure the root (system owner) account exists and matches .env (ROOT_EMAIL / ROOT_NAME / ROOT_PASSWORD).
 * Use after changing ROOT_PASSWORD, without wiping data:  npm run root:sync
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const email = (process.env.ROOT_EMAIL ?? "").toLowerCase().trim();
  const name = process.env.ROOT_NAME ?? "Root";
  const password = process.env.ROOT_PASSWORD ?? "";
  if (!email || password.length < 8) throw new Error("Set ROOT_EMAIL and ROOT_PASSWORD (min 8 chars) in .env");
  const passwordHash = await bcrypt.hash(password, 12);
  // exactly one root: demote any other root flag
  await prisma.user.updateMany({ where: { isRoot: true, NOT: { email } }, data: { isRoot: false } });
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role: "ADMIN", isRoot: true, active: true },
    create: { email, name, passwordHash, role: "ADMIN", isRoot: true, title: "Sistem administratoru (root)" },
  });
  await prisma.auditLog.create({ data: { actorId: user.id, action: "user.update", entity: "User", entityId: user.id, summary: `${name} · root sync` } });
  console.log(`Root account synced: ${email}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
