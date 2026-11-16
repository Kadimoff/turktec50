/* Idempotent, non-destructive TEKNOFEST catalog import (Academy) — safe on the live database after `prisma migrate deploy`.
 * The demo seed loads the catalog only together with a full TRUNCATE; this script adds just the catalog cards:
 *   - creates every card of prisma/data/teknofest-catalog-2026.json whose catalogId is not in the DB yet,
 *   - refreshes name / url / theme / subcategories of existing cards (rule tracking, deadlines, owners are left untouched),
 *   - never deletes anything and never touches non-catalog competitions.
 * Usage:  npm run academy:catalog  [-- --dry-run]
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

type CatalogCard = { id: number; name: string; url: string; theme: string; categories: string[] };
// keep in sync with prisma/seed.ts THEME_KEY
const THEME_KEY: Record<string, string> = {
  "Aviasiya": "aviation", "Enerji və ətraf mühit": "energy_environment", "Kosmos və raket": "space_rocketry",
  "Müdafiə və rabitə": "defense_comms", "Proqram təminatı və elektronika": "software_electronics",
  "Robototexnika və mobil sistemlər": "robotics_mobility", "Süni intellekt": "ai", "Səhiyyə": "health", "Tədqiqat və dizayn": "research_design",
};

async function main() {
  const dry = process.argv.includes("--dry-run");
  const cards: CatalogCard[] = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "prisma/data/teknofest-catalog-2026.json"), "utf8"));
  const existing = new Set((await prisma.competition.findMany({ where: { catalogId: { not: null } }, select: { catalogId: true } })).map((c) => c.catalogId));
  const missing = cards.filter((c) => !existing.has(c.id));
  console.log(`catalog cards=${cards.length} inDb=${existing.size} toCreate=${missing.length}${dry ? " (dry run)" : ""}`);
  if (dry) return;
  let created = 0, updated = 0;
  for (const card of cards) {
    const data = { name: card.name, url: card.url, theme: THEME_KEY[card.theme] ?? null, subcategories: card.categories };
    if (existing.has(card.id)) {
      await prisma.competition.update({ where: { catalogId: card.id }, data });
      updated++;
    } else {
      await prisma.competition.create({ data: { ...data, catalogId: card.id, organizer: "T3 Vakfı / TEKNOFEST", country: "TR" } });
      created++;
    }
  }
  console.log(`created=${created} refreshed=${updated} competitions total=${await prisma.competition.count()}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
