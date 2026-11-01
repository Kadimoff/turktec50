/* Server-only: rotate the password of every NON-root account to DEMO_ROTATED_PASSWORD (from .env).
 * Closes the publicly documented demo password (Demo2026!) on the public server. Root is untouched (managed by root:sync). */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const pw = process.env.DEMO_ROTATED_PASSWORD ?? "";
  if (pw.length < 12) throw new Error("DEMO_ROTATED_PASSWORD missing");
  const hash = await bcrypt.hash(pw, 12);
  const r = await prisma.user.updateMany({ where: { isRoot: false }, data: { passwordHash: hash } });
  console.log(`rotated ${r.count} non-root accounts`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
