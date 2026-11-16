/* Process (workflow) stage logic — run with:  npm test
 * Pure tests always run. The DB idempotency test runs only against a *_dev database (T50_DB_TEST=1). */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_STAGES, applicationStatusForKey, deriveApplicationKey, deriveProjectKey, projectFieldsForKey,
} from "../src/lib/workflow-core";
import { computeLayout, wrapText } from "../src/components/process/layout";

const OWNER_ORDER = [
  "APP_SUBMITTED", "APP_UNDER_REVIEW", "APP_ACCEPTED", "APP_WAITLIST", "APP_REJECTED", "APP_WORKSPACE",
  "VALIDATION", "PROTOTYPE", "MVP", "QA", "MOCK_FINAL", "SUBMITTED", "RESULT_FINALIST", "RESULT_NOT_SELECTED",
];

test("default stages follow the approved order with unique ids/keys and 3 languages", () => {
  const sorted = [...DEFAULT_STAGES].sort((a, b) => (a.scope === b.scope ? a.order - b.order : a.scope === "APPLICATION" ? -1 : 1));
  assert.deepEqual(sorted.map((s) => s.systemKey), OWNER_ORDER);
  assert.equal(new Set(DEFAULT_STAGES.map((s) => s.id)).size, DEFAULT_STAGES.length);
  for (const s of DEFAULT_STAGES) {
    for (const l of ["az", "tr", "en"] as const) {
      assert.ok(s.name[l].length > 1, `${s.systemKey} name.${l}`);
      assert.ok(s.description[l].length > 10, `${s.systemKey} description.${l}`);
    }
    assert.ok(s.roles.length > 0, `${s.systemKey} roles`);
  }
  // Azerbaijani diacritics survived (no mojibake)
  assert.equal(DEFAULT_STAGES.find((s) => s.systemKey === "APP_UNDER_REVIEW")!.name.az, "İlkin baxış — seçim rubriki");
});

test("migration SQL inserts exactly the default stages (names/descriptions identical)", () => {
  const dir = path.join(__dirname, "..", "prisma", "migrations");
  const mig = fs.readdirSync(dir).find((d) => d.endsWith("_workflow_stages"));
  assert.ok(mig, "workflow migration folder exists");
  const sql = fs.readFileSync(path.join(dir, mig!, "migration.sql"), "utf8");
  const q = (v: string) => `'${v.replace(/'/g, "''")}'`;
  for (const s of DEFAULT_STAGES) {
    const row = `(${q(s.id)}, '${s.scope}', ${q(s.systemKey)}, ${q(s.name.az)}, ${q(s.name.tr)}, ${q(s.name.en)}, ${q(s.description.az)}, ${q(s.description.tr)}, ${q(s.description.en)}, ${s.order}, '${s.kind}'`;
    assert.ok(sql.includes(row), `migration row for ${s.systemKey}`);
  }
  assert.match(sql, /ON CONFLICT \("systemKey"\) DO NOTHING/);
  assert.doesNotMatch(sql, /DROP (TABLE|COLUMN|TYPE)|DELETE FROM|TRUNCATE/i, "migration is additive only");
});

test("application stage derivation", () => {
  assert.equal(deriveApplicationKey({ status: "SUBMITTED", projectId: null }), "APP_SUBMITTED");
  assert.equal(deriveApplicationKey({ status: "UNDER_REVIEW", projectId: null }), "APP_UNDER_REVIEW");
  assert.equal(deriveApplicationKey({ status: "ACCEPTED", projectId: null }), "APP_ACCEPTED");
  assert.equal(deriveApplicationKey({ status: "ACCEPTED", projectId: "p1" }), "APP_WORKSPACE");
  assert.equal(deriveApplicationKey({ status: "WAITLIST", projectId: null }), "APP_WAITLIST");
  assert.equal(deriveApplicationKey({ status: "REJECTED", projectId: null }), "APP_REJECTED");
  for (const st of ["SUBMITTED", "UNDER_REVIEW", "ACCEPTED", "WAITLIST", "REJECTED"] as const) {
    assert.equal(applicationStatusForKey(deriveApplicationKey({ status: st, projectId: null })), st);
  }
  assert.equal(applicationStatusForKey("APP_WORKSPACE"), null);
});

test("project stage derivation: result wins, FINAL rubric in QA = mock final", () => {
  assert.equal(deriveProjectKey({ stage: "MVP", result: "PENDING", hasFinalEval: false }), "MVP");
  assert.equal(deriveProjectKey({ stage: "QA", result: "PENDING", hasFinalEval: false }), "QA");
  assert.equal(deriveProjectKey({ stage: "QA", result: "PENDING", hasFinalEval: true }), "MOCK_FINAL");
  assert.equal(deriveProjectKey({ stage: "MVP", result: "PENDING", hasFinalEval: true }), "MVP");
  assert.equal(deriveProjectKey({ stage: "SUBMITTED", result: "FINALIST", hasFinalEval: true }), "RESULT_FINALIST");
  assert.equal(deriveProjectKey({ stage: "SUBMITTED", result: "NOT_SELECTED", hasFinalEval: false }), "RESULT_NOT_SELECTED");
});

test("manual move to a system stage sets fields that derive back to the same stage", () => {
  for (const s of DEFAULT_STAGES.filter((d) => d.scope === "PROJECT")) {
    const f = projectFieldsForKey(s.systemKey);
    assert.ok(f && f.stage && f.result, s.systemKey);
    const back = deriveProjectKey({ stage: f!.stage!, result: f!.result!, hasFinalEval: s.systemKey === "MOCK_FINAL" });
    assert.equal(back, s.systemKey);
  }
  assert.equal(projectFieldsForKey("SOMETHING_CUSTOM"), null);
});

test("diagram layout: side paths hang off decision stages, no overlapping boxes", () => {
  const stages = DEFAULT_STAGES.map((s) => ({ id: s.systemKey, scope: s.scope, kind: s.kind, roles: s.roles }));
  const L = computeLayout(stages, ["TEAM", "ADMIN", "MENTOR", "JURY"], 4);
  assert.equal(L.cols.length, 11);
  assert.deepEqual(L.cols.find((c) => c.main === "APP_ACCEPTED")!.branches, ["APP_WAITLIST", "APP_REJECTED"]);
  assert.deepEqual(L.cols.find((c) => c.main === "RESULT_FINALIST")!.branches, ["RESULT_NOT_SELECTED"]);
  const boxes = [...L.nodes.values()];
  for (const a of boxes) {
    assert.ok(a.x >= 0 && a.x + a.w <= L.width && a.y >= 0 && a.y + a.h <= L.height, `${a.id} inside canvas`);
    for (const b of boxes) {
      if (a === b) continue;
      const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      assert.ok(!overlap, `${a.id} overlaps ${b.id}`);
    }
  }
  // a custom NORMAL stage inserted after MVP becomes its own column; a custom REJECTED one becomes a branch
  const custom = [...stages.slice(0, 9), { id: "C1", scope: "PROJECT" as const, kind: "NORMAL" as const, roles: ["MENTOR" as const] }, { id: "C2", scope: "PROJECT" as const, kind: "REJECTED" as const, roles: ["ADMIN" as const] }, ...stages.slice(9)];
  const L2 = computeLayout(custom, ["TEAM", "ADMIN", "MENTOR", "JURY"], 4);
  assert.equal(L2.cols.length, 12);
  assert.deepEqual(L2.cols.find((c) => c.main === "C1")!.branches, ["C2"]);
  assert.equal(L2.nodes.get("C1")!.lane, 2);
});

test("wrapText keeps words and limits lines", () => {
  assert.deepEqual(wrapText("İlkin baxış — seçim rubriki", 17), ["İlkin baxış —", "seçim rubriki"]);
  assert.equal(wrapText("a b c d e f g h i j k l m n o p q r s t u v w x y z", 3, 2).length, 2);
});

test("workflow:sync is idempotent on the dev database", { skip: process.env.T50_DB_TEST !== "1" }, async () => {
  await import("dotenv/config");
  const url = process.env.DATABASE_URL ?? "";
  assert.match(url, /\/turktech50_(dev|merge)(\?|$)/, "refusing to run against a non-dev database");
  const { PrismaClient } = await import("../src/generated/prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { syncWorkflow } = await import("../src/lib/workflow-core");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    await syncWorkflow(db);
    const second = await syncWorkflow(db);
    assert.deepEqual(second, { stagesCreated: 0, applicationsMapped: 0, projectsMapped: 0, historyRows: 0 });
    assert.equal(await db.project.count({ where: { workflowStageId: null } }), 0);
    assert.equal(await db.application.count({ where: { workflowStageId: null } }), 0);
    assert.equal(await db.workflowStage.count({ where: { systemKey: { not: null } } }), DEFAULT_STAGES.length);
  } finally {
    await db.$disconnect();
  }
});
