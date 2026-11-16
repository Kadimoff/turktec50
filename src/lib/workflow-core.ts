/**
 * Process (workflow) stages — shared core used by the app, `prisma/seed.ts` and `npm run workflow:sync`.
 * No "server-only" / path aliases here: this file also runs under tsx.
 *
 * System stages (systemKey != null) mirror existing enum values and are moved automatically by the existing flows:
 *   Application: ApplicationStatus (+ project workspace created) · Project: ProjectStage, FINAL rubric (mock final),
 *   CompetitionResult. Custom stages (systemKey = null) are reached only by a manual move (ADMIN/root, with a note).
 * The enums themselves are NOT changed — the workflow stage is an additional, configurable layer.
 */
import type { PrismaClient } from "../generated/prisma/client";
import type { ApplicationStatus, CompetitionResult, ProjectStage, Role, WorkflowScope, WorkflowStageKind } from "../generated/prisma/enums";

export type StageDefault = {
  id: string;
  scope: WorkflowScope;
  systemKey: string;
  order: number;
  kind: WorkflowStageKind;
  roles: Role[];
  name: { az: string; tr: string; en: string };
  description: { az: string; tr: string; en: string };
};

/** Default process — the order the owner approved. Keep in sync with prisma/migrations/*_workflow_stages (tested). */
export const DEFAULT_STAGES: StageDefault[] = [
  {
    id: "wfs_app_submitted", scope: "APPLICATION", systemKey: "APP_SUBMITTED", order: 10, kind: "NORMAL", roles: ["TEAM"],
    name: { az: "Müraciət", tr: "Başvuru", en: "Application" },
    description: {
      az: "Komanda müraciət formasını göndərir: problem, həll, komanda.",
      tr: "Ekip başvuru formunu gönderir: problem, çözüm, ekip.",
      en: "The team submits the application form: problem, solution, team.",
    },
  },
  {
    id: "wfs_app_under_review", scope: "APPLICATION", systemKey: "APP_UNDER_REVIEW", order: 20, kind: "NORMAL", roles: ["JURY", "ADMIN"],
    name: { az: "İlkin baxış — seçim rubriki", tr: "Ön değerlendirme — seçim rubriği", en: "Pre-review — selection rubric" },
    description: {
      az: "Münsiflər seçim rubriki ilə bal verir; ballar yalnız məlumat xarakterlidir.",
      tr: "Jüri seçim rubriğiyle puan verir; puanlar yalnızca bilgilendiricidir.",
      en: "Jurors score with the selection rubric; scores are advisory only.",
    },
  },
  {
    id: "wfs_app_accepted", scope: "APPLICATION", systemKey: "APP_ACCEPTED", order: 30, kind: "DECISION", roles: ["ADMIN"],
    name: { az: "Qərar: qəbul", tr: "Karar: kabul", en: "Decision: accepted" },
    description: {
      az: "Koordinator qəbul qərarını əsaslandırma ilə qeyd edir. Qərarı insan verir.",
      tr: "Koordinatör kabul kararını gerekçesiyle kaydeder. Kararı insan verir.",
      en: "The coordinator records the acceptance with a rationale. A human decides.",
    },
  },
  {
    id: "wfs_app_waitlist", scope: "APPLICATION", systemKey: "APP_WAITLIST", order: 40, kind: "WAITING", roles: ["ADMIN"],
    name: { az: "Gözləmə siyahısı", tr: "Yedek liste", en: "Waitlist" },
    description: {
      az: "Yer boşalarsa komanda proqrama dəvət olunur.",
      tr: "Yer açılırsa ekip programa davet edilir.",
      en: "The team is invited if a place opens up.",
    },
  },
  {
    id: "wfs_app_rejected", scope: "APPLICATION", systemKey: "APP_REJECTED", order: 50, kind: "REJECTED", roles: ["ADMIN"],
    name: { az: "Rədd edildi", tr: "Reddedildi", en: "Rejected" },
    description: {
      az: "Əsaslandırma ilə rədd; növbəti dövrə yenidən müraciət tövsiyə olunur.",
      tr: "Gerekçeli ret; sonraki döneme yeniden başvuru önerilir.",
      en: "Rejected with a rationale; re-applying in the next round is encouraged.",
    },
  },
  {
    id: "wfs_app_workspace", scope: "APPLICATION", systemKey: "APP_WORKSPACE", order: 60, kind: "DONE", roles: ["ADMIN", "TEAM"],
    name: { az: "Layihə sahəsi açılır", tr: "Proje alanı açılır", en: "Project workspace opened" },
    description: {
      az: "Qəbul edilmiş müraciətdən layihə sahəsi, sənəd checklist-i və komanda hesabı yaradılır.",
      tr: "Kabul edilen başvurudan proje alanı, belge kontrol listesi ve ekip hesabı oluşturulur.",
      en: "A project workspace, document checklist and team account are created from the accepted application.",
    },
  },
  {
    id: "wfs_prj_validation", scope: "PROJECT", systemKey: "VALIDATION", order: 10, kind: "NORMAL", roles: ["TEAM", "MENTOR"],
    name: { az: "Validasiya", tr: "Doğrulama", en: "Validation" },
    description: {
      az: "Problem və istifadəçi ehtiyacı yoxlanılır; mentorla ilk görüşlər keçirilir.",
      tr: "Problem ve kullanıcı ihtiyacı doğrulanır; mentorla ilk görüşmeler yapılır.",
      en: "The problem and user need are validated; first mentor meetings take place.",
    },
  },
  {
    id: "wfs_prj_prototype", scope: "PROJECT", systemKey: "PROTOTYPE", order: 20, kind: "NORMAL", roles: ["TEAM", "MENTOR"],
    name: { az: "Prototip", tr: "Prototip", en: "Prototype" },
    description: {
      az: "İlk işlək prototip qurulur və sınaqdan keçirilir.",
      tr: "İlk çalışan prototip geliştirilir ve test edilir.",
      en: "A first working prototype is built and tested.",
    },
  },
  {
    id: "wfs_prj_mvp", scope: "PROJECT", systemKey: "MVP", order: 30, kind: "NORMAL", roles: ["TEAM", "MENTOR"],
    name: { az: "MVP", tr: "MVP", en: "MVP" },
    description: {
      az: "Minimum işlək məhsul və test sübutları hazırlanır.",
      tr: "Minimum uygulanabilir ürün ve test kanıtları hazırlanır.",
      en: "The minimum viable product and test evidence are prepared.",
    },
  },
  {
    id: "wfs_prj_qa", scope: "PROJECT", systemKey: "QA", order: 40, kind: "NORMAL", roles: ["JURY", "ADMIN"],
    name: { az: "Ara münsif", tr: "Ara jüri", en: "Midterm jury" },
    description: {
      az: "Münsiflər ara rubriklə (MIDTERM) qiymətləndirir; komanda rəyə görə düzəliş edir.",
      tr: "Jüri ara rubrikle (MIDTERM) değerlendirir; ekip geri bildirime göre düzeltir.",
      en: "Jurors score with the midterm rubric (MIDTERM); the team iterates on the feedback.",
    },
  },
  {
    id: "wfs_prj_mock_final", scope: "PROJECT", systemKey: "MOCK_FINAL", order: 50, kind: "NORMAL", roles: ["JURY", "TEAM"],
    name: { az: "Sınaq finalı", tr: "Deneme finali", en: "Mock final" },
    description: {
      az: "Pitch və canlı demo final rubriki (FINAL) ilə məşq edilir.",
      tr: "Sunum ve canlı demo final rubriğiyle (FINAL) prova edilir.",
      en: "The pitch and live demo are rehearsed with the final rubric (FINAL).",
    },
  },
  {
    id: "wfs_prj_submitted", scope: "PROJECT", systemKey: "SUBMITTED", order: 60, kind: "NORMAL", roles: ["TEAM", "ADMIN"],
    name: { az: "Müsabiqəyə müraciət", tr: "Yarışmaya başvuru", en: "Competition application" },
    description: {
      az: "Sənəd paketi keyfiyyət yoxlamasından keçir və müsabiqəyə göndərilir.",
      tr: "Belge paketi kalite kontrolünden geçer ve yarışmaya gönderilir.",
      en: "The document package passes the quality check and is submitted to the competition.",
    },
  },
  {
    id: "wfs_prj_result_finalist", scope: "PROJECT", systemKey: "RESULT_FINALIST", order: 70, kind: "DONE", roles: ["ADMIN"],
    name: { az: "Nəticə: finalçı", tr: "Sonuç: finalist", en: "Result: finalist" },
    description: {
      az: "Müsabiqə komandanı rəsmi olaraq finalçı elan edir.",
      tr: "Yarışma ekibi resmi olarak finalist ilan eder.",
      en: "The competition officially announces the team as a finalist.",
    },
  },
  {
    id: "wfs_prj_result_not_selected", scope: "PROJECT", systemKey: "RESULT_NOT_SELECTED", order: 80, kind: "REJECTED", roles: ["ADMIN"],
    name: { az: "Nəticə: seçilmədi", tr: "Sonuç: seçilmedi", en: "Result: not selected" },
    description: {
      az: "Komanda seçilmədi; dərslər çıxarılır və növbəti müsabiqə planlanır.",
      tr: "Ekip seçilmedi; çıkarımlar yapılır ve sonraki yarışma planlanır.",
      en: "Not selected; lessons are captured and the next competition is planned.",
    },
  },
];

export const SYSTEM_KEYS = DEFAULT_STAGES.map((s) => s.systemKey);

/** System stage key an application belongs to (pure). */
export function deriveApplicationKey(a: { status: ApplicationStatus; projectId: string | null }): string {
  return a.projectId ? "APP_WORKSPACE" : `APP_${a.status}`;
}

/** System stage key a project belongs to (pure). Competition result wins; a submitted FINAL evaluation in QA = mock final. */
export function deriveProjectKey(p: { stage: ProjectStage; result: CompetitionResult; hasFinalEval: boolean }): string {
  if (p.result === "FINALIST") return "RESULT_FINALIST";
  if (p.result === "NOT_SELECTED") return "RESULT_NOT_SELECTED";
  if (p.stage === "QA" && p.hasFinalEval) return "MOCK_FINAL";
  return p.stage;
}

/**
 * Inverse mapping used by a MANUAL move to a system stage: the bound enum fields are updated too, so the
 * project header, KPI and filters stay consistent with the process view. Custom stages change nothing else.
 */
export function projectFieldsForKey(key: string): { stage?: ProjectStage; result?: CompetitionResult } | null {
  switch (key) {
    case "VALIDATION": case "PROTOTYPE": case "MVP": case "QA": case "SUBMITTED":
      return { stage: key, result: "PENDING" };
    case "MOCK_FINAL":
      return { stage: "QA", result: "PENDING" };
    case "RESULT_FINALIST":
      return { stage: "SUBMITTED", result: "FINALIST" };
    case "RESULT_NOT_SELECTED":
      return { stage: "SUBMITTED", result: "NOT_SELECTED" };
    default:
      return null;
  }
}

export function applicationStatusForKey(key: string): ApplicationStatus | null {
  switch (key) {
    case "APP_SUBMITTED": return "SUBMITTED";
    case "APP_UNDER_REVIEW": return "UNDER_REVIEW";
    case "APP_ACCEPTED": return "ACCEPTED";
    case "APP_WAITLIST": return "WAITLIST";
    case "APP_REJECTED": return "REJECTED";
    default: return null; // APP_WORKSPACE is reached only by creating the workspace
  }
}

type Db = PrismaClient;

/** Create missing default system stages. Existing rows are never overwritten (names may have been edited). */
export async function ensureDefaultStages(db: Db) {
  let created = 0;
  for (const d of DEFAULT_STAGES) {
    const exists = await db.workflowStage.findUnique({ where: { systemKey: d.systemKey }, select: { id: true } });
    if (exists) continue;
    const idTaken = await db.workflowStage.findUnique({ where: { id: d.id }, select: { id: true } });
    await db.workflowStage.create({
      data: {
        ...(idTaken ? {} : { id: d.id }),
        scope: d.scope, systemKey: d.systemKey, order: d.order, kind: d.kind, responsibleRoles: d.roles,
        nameAz: d.name.az, nameTr: d.name.tr, nameEn: d.name.en,
        descriptionAz: d.description.az, descriptionTr: d.description.tr, descriptionEn: d.description.en,
      },
    });
    created++;
  }
  return created;
}

/**
 * Idempotent sync (safe on a live-like database, never deletes):
 *  1. creates missing default stages;
 *  2. assigns a workflow stage to every application/project that has none (derived from the enums);
 *  3. back-fills a starting history (WorkflowTransition, auto) for entities that have no history yet,
 *     using existing dates (submittedAt, decidedAt, StageChange rows…).
 * Uses raw UPDATEs for the stage pointer so Project.updatedAt is not touched.
 */
export async function syncWorkflow(db: Db, opts: { backfillHistory?: boolean } = {}) {
  const stagesCreated = await ensureDefaultStages(db);
  const stages = await db.workflowStage.findMany({ where: { systemKey: { not: null } }, select: { id: true, systemKey: true } });
  const idByKey = new Map(stages.map((s) => [s.systemKey!, s.id]));

  // --- applications
  const apps = await db.application.findMany({ where: { workflowStageId: null }, select: { id: true, status: true, projectId: true } });
  const appGroups = new Map<string, string[]>();
  for (const a of apps) {
    const sid = idByKey.get(deriveApplicationKey(a));
    if (sid) appGroups.set(sid, [...(appGroups.get(sid) ?? []), a.id]);
  }
  for (const [sid, ids] of appGroups) {
    await db.$executeRaw`UPDATE "Application" SET "workflowStageId" = ${sid} WHERE id = ANY(${ids}::text[]) AND "workflowStageId" IS NULL`;
  }

  // --- projects
  const projects = await db.project.findMany({
    where: { workflowStageId: null },
    select: { id: true, stage: true, result: true, evaluations: { where: { status: "SUBMITTED", rubric: { kind: "FINAL" } }, select: { id: true }, take: 1 } },
  });
  const prjGroups = new Map<string, string[]>();
  for (const p of projects) {
    const sid = idByKey.get(deriveProjectKey({ stage: p.stage, result: p.result, hasFinalEval: p.evaluations.length > 0 }));
    if (sid) prjGroups.set(sid, [...(prjGroups.get(sid) ?? []), p.id]);
  }
  for (const [sid, ids] of prjGroups) {
    await db.$executeRaw`UPDATE "Project" SET "workflowStageId" = ${sid} WHERE id = ANY(${ids}::text[]) AND "workflowStageId" IS NULL`;
  }

  let historyRows = 0;
  if (opts.backfillHistory !== false) historyRows = await backfillHistory(db, idByKey);
  return { stagesCreated, applicationsMapped: apps.length, projectsMapped: projects.length, historyRows };
}

async function backfillHistory(db: Db, idByKey: Map<string, string>) {
  const rows: { scope: WorkflowScope; projectId?: string; applicationId?: string; fromStageId: string | null; toStageId: string | null; actorId: string | null; note: string | null; createdAt: Date; auto: boolean }[] = [];
  const k = (key: string) => idByKey.get(key) ?? null;

  const apps = await db.application.findMany({
    where: { workflowHistory: { none: {} } },
    select: {
      id: true, status: true, submittedAt: true, decidedAt: true, workflowStageId: true,
      project: { select: { createdAt: true } },
      evaluations: { where: { status: "SUBMITTED", submittedAt: { not: null } }, orderBy: { submittedAt: "asc" }, take: 1, select: { submittedAt: true } },
    },
  });
  for (const a of apps) {
    const path: [string, Date][] = [["APP_SUBMITTED", a.submittedAt]];
    const firstEval = a.evaluations[0]?.submittedAt;
    if (a.status !== "SUBMITTED" && firstEval) path.push(["APP_UNDER_REVIEW", firstEval]);
    if (["ACCEPTED", "WAITLIST", "REJECTED"].includes(a.status)) path.push([`APP_${a.status}`, a.decidedAt ?? firstEval ?? a.submittedAt]);
    else if (a.status === "UNDER_REVIEW" && !firstEval) path.push(["APP_UNDER_REVIEW", a.submittedAt]);
    if (a.project) path.push(["APP_WORKSPACE", a.project.createdAt]);
    let prev: string | null = null;
    for (const [key, at] of path) {
      const to = k(key);
      rows.push({ scope: "APPLICATION", applicationId: a.id, fromStageId: prev, toStageId: to, actorId: null, note: null, createdAt: at, auto: true });
      prev = to;
    }
    // a custom/manually placed current stage that is not the end of the derived path
    if (a.workflowStageId && a.workflowStageId !== prev) {
      rows.push({ scope: "APPLICATION", applicationId: a.id, fromStageId: prev, toStageId: a.workflowStageId, actorId: null, note: null, createdAt: new Date(), auto: true });
    }
  }

  const projects = await db.project.findMany({
    where: { workflowHistory: { none: {} } },
    select: {
      id: true, createdAt: true, stage: true, result: true, submittedAt: true, updatedAt: true, workflowStageId: true,
      stageHistory: { orderBy: { createdAt: "asc" }, select: { fromStage: true, toStage: true, actorId: true, note: true, createdAt: true } },
      evaluations: { where: { status: "SUBMITTED", rubric: { kind: "FINAL" } }, orderBy: { submittedAt: "asc" }, take: 1, select: { submittedAt: true } },
    },
  });
  for (const p of projects) {
    const startKey: string = p.stageHistory[0]?.fromStage ?? p.stage;
    rows.push({ scope: "PROJECT", projectId: p.id, fromStageId: null, toStageId: k(startKey), actorId: null, note: null, createdAt: p.createdAt, auto: true });
    let prev = k(startKey);
    for (const h of p.stageHistory) {
      const to = k(h.toStage);
      rows.push({ scope: "PROJECT", projectId: p.id, fromStageId: k(h.fromStage), toStageId: to, actorId: h.actorId, note: h.note, createdAt: h.createdAt, auto: true });
      prev = to;
    }
    const finalKey = deriveProjectKey({ stage: p.stage, result: p.result, hasFinalEval: p.evaluations.length > 0 });
    if (k(finalKey) && k(finalKey) !== prev && finalKey !== p.stage) {
      if (finalKey === "MOCK_FINAL") {
        const at = p.evaluations[0]?.submittedAt ?? p.updatedAt;
        rows.push({ scope: "PROJECT", projectId: p.id, fromStageId: prev, toStageId: k(finalKey), actorId: null, note: null, createdAt: at, auto: true });
        prev = k(finalKey);
      } else {
        if (prev !== k("SUBMITTED") && p.stage === "SUBMITTED") {
          rows.push({ scope: "PROJECT", projectId: p.id, fromStageId: prev, toStageId: k("SUBMITTED"), actorId: null, note: null, createdAt: p.submittedAt ?? p.updatedAt, auto: true });
          prev = k("SUBMITTED");
        }
        rows.push({ scope: "PROJECT", projectId: p.id, fromStageId: prev, toStageId: k(finalKey), actorId: null, note: null, createdAt: p.updatedAt, auto: true });
        prev = k(finalKey);
      }
    }
    if (p.workflowStageId && p.workflowStageId !== prev) {
      rows.push({ scope: "PROJECT", projectId: p.id, fromStageId: prev, toStageId: p.workflowStageId, actorId: null, note: null, createdAt: new Date(), auto: true });
    }
  }
  if (rows.length) {
    for (let i = 0; i < rows.length; i += 1000) await db.workflowTransition.createMany({ data: rows.slice(i, i + 1000) });
  }
  return rows.length;
}
