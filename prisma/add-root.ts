/* Create (or update) an ADDITIONAL root (system owner) account without touching the primary root or any data.
 * Values from env (never printed): EXTRA_ROOT_EMAIL, EXTRA_ROOT_NAME, EXTRA_ROOT_PASSWORD.   npm run root:add */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const email = (process.env.EXTRA_ROOT_EMAIL ?? "").toLowerCase().trim();
  const name = (process.env.EXTRA_ROOT_NAME ?? "").trim();
  const password = process.env.EXTRA_ROOT_PASSWORD ?? "";
  if (!email || !name || password.length < 8) throw new Error("Set EXTRA_ROOT_EMAIL, EXTRA_ROOT_NAME, EXTRA_ROOT_PASSWORD (min 8)");
  if (email === (process.env.ROOT_EMAIL ?? "").toLowerCase().trim()) throw new Error("That is the primary root (use root:sync)");
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    // passwordChangedAt: an updated password signs out the account's older sessions (academy hardening)
    update: { name, passwordHash, role: "ADMIN", isRoot: true, active: true, passwordChangedAt: new Date() },
    create: { email, name, passwordHash, role: "ADMIN", isRoot: true, title: "Sistem administratoru (root)" },
  });
  await prisma.auditLog.create({ data: { actorId: user.id, action: "user.update", entity: "User", entityId: user.id, summary: `${name} · additional root` } });
  console.log(`Additional root ready: ${email}; roots total: ${await prisma.user.count({ where: { isRoot: true } })}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
