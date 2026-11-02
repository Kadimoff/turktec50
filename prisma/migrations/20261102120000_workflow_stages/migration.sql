-- TÜRKTECH 50 · configurable process (workflow) stages
-- Additive only: 2 new enums, 2 new tables, 1 nullable column on "Application" and "Project".
-- No existing column, enum value or row is changed or deleted (except the new "workflowStageId" pointer being filled).

-- CreateEnum
CREATE TYPE "WorkflowScope" AS ENUM ('APPLICATION', 'PROJECT');

-- CreateEnum
CREATE TYPE "WorkflowStageKind" AS ENUM ('NORMAL', 'DECISION', 'WAITING', 'REJECTED', 'DONE');

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "workflowStageId" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "workflowStageId" TEXT;

-- CreateTable
CREATE TABLE "WorkflowStage" (
    "id" TEXT NOT NULL,
    "scope" "WorkflowScope" NOT NULL,
    "systemKey" TEXT,
    "nameAz" TEXT NOT NULL,
    "nameTr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "descriptionAz" TEXT,
    "descriptionTr" TEXT,
    "descriptionEn" TEXT,
    "order" INTEGER NOT NULL,
    "kind" "WorkflowStageKind" NOT NULL DEFAULT 'NORMAL',
    "responsibleRoles" "Role"[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowTransition" (
    "id" TEXT NOT NULL,
    "scope" "WorkflowScope" NOT NULL,
    "projectId" TEXT,
    "applicationId" TEXT,
    "fromStageId" TEXT,
    "toStageId" TEXT,
    "actorId" TEXT,
    "auto" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowTransition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowStage_systemKey_key" ON "WorkflowStage"("systemKey");

-- CreateIndex
CREATE INDEX "WorkflowStage_scope_order_idx" ON "WorkflowStage"("scope", "order");

-- CreateIndex
CREATE INDEX "WorkflowTransition_projectId_createdAt_idx" ON "WorkflowTransition"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkflowTransition_applicationId_createdAt_idx" ON "WorkflowTransition"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "Application_workflowStageId_idx" ON "Application"("workflowStageId");

-- CreateIndex
CREATE INDEX "Project_workflowStageId_idx" ON "Project"("workflowStageId");

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_workflowStageId_fkey" FOREIGN KEY ("workflowStageId") REFERENCES "WorkflowStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_workflowStageId_fkey" FOREIGN KEY ("workflowStageId") REFERENCES "WorkflowStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_fromStageId_fkey" FOREIGN KEY ("fromStageId") REFERENCES "WorkflowStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_toStageId_fkey" FOREIGN KEY ("toStageId") REFERENCES "WorkflowStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Default process stages (data). Idempotent: existing system stages are kept as they are.
INSERT INTO "WorkflowStage" ("id", "scope", "systemKey", "nameAz", "nameTr", "nameEn", "descriptionAz", "descriptionTr", "descriptionEn", "order", "kind", "responsibleRoles", "active", "createdAt", "updatedAt") VALUES
  ('wfs_app_submitted', 'APPLICATION', 'APP_SUBMITTED', 'Müraciət', 'Başvuru', 'Application', 'Komanda müraciət formasını göndərir: problem, həll, komanda.', 'Ekip başvuru formunu gönderir: problem, çözüm, ekip.', 'The team submits the application form: problem, solution, team.', 10, 'NORMAL', ARRAY['TEAM']::"Role"[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('wfs_app_under_review', 'APPLICATION', 'APP_UNDER_REVIEW', 'İlkin baxış — seçim rubriki', 'Ön değerlendirme — seçim rubriği', 'Pre-review — selection rubric', 'Münsiflər seçim rubriki ilə bal verir; ballar yalnız məlumat xarakterlidir.', 'Jüri seçim rubriğiyle puan verir; puanlar yalnızca bilgilendiricidir.', 'Jurors score with the selection rubric; scores are advisory only.', 20, 'NORMAL', ARRAY['JURY', 'ADMIN']::"Role"[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('wfs_app_accepted', 'APPLICATION', 'APP_ACCEPTED', 'Qərar: qəbul', 'Karar: kabul', 'Decision: accepted', 'Koordinator qəbul qərarını əsaslandırma ilə qeyd edir. Qərarı insan verir.', 'Koordinatör kabul kararını gerekçesiyle kaydeder. Kararı insan verir.', 'The coordinator records the acceptance with a rationale. A human decides.', 30, 'DECISION', ARRAY['ADMIN']::"Role"[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('wfs_app_waitlist', 'APPLICATION', 'APP_WAITLIST', 'Gözləmə siyahısı', 'Yedek liste', 'Waitlist', 'Yer boşalarsa komanda proqrama dəvət olunur.', 'Yer açılırsa ekip programa davet edilir.', 'The team is invited if a place opens up.', 40, 'WAITING', ARRAY['ADMIN']::"Role"[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('wfs_app_rejected', 'APPLICATION', 'APP_REJECTED', 'Rədd edildi', 'Reddedildi', 'Rejected', 'Əsaslandırma ilə rədd; növbəti dövrə yenidən müraciət tövsiyə olunur.', 'Gerekçeli ret; sonraki döneme yeniden başvuru önerilir.', 'Rejected with a rationale; re-applying in the next round is encouraged.', 50, 'REJECTED', ARRAY['ADMIN']::"Role"[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('wfs_app_workspace', 'APPLICATION', 'APP_WORKSPACE', 'Layihə sahəsi açılır', 'Proje alanı açılır', 'Project workspace opened', 'Qəbul edilmiş müraciətdən layihə sahəsi, sənəd checklist-i və komanda hesabı yaradılır.', 'Kabul edilen başvurudan proje alanı, belge kontrol listesi ve ekip hesabı oluşturulur.', 'A project workspace, document checklist and team account are created from the accepted application.', 60, 'DONE', ARRAY['ADMIN', 'TEAM']::"Role"[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('wfs_prj_validation', 'PROJECT', 'VALIDATION', 'Validasiya', 'Doğrulama', 'Validation', 'Problem və istifadəçi ehtiyacı yoxlanılır; mentorla ilk görüşlər keçirilir.', 'Problem ve kullanıcı ihtiyacı doğrulanır; mentorla ilk görüşmeler yapılır.', 'The problem and user need are validated; first mentor meetings take place.', 10, 'NORMAL', ARRAY['TEAM', 'MENTOR']::"Role"[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('wfs_prj_prototype', 'PROJECT', 'PROTOTYPE', 'Prototip', 'Prototip', 'Prototype', 'İlk işlək prototip qurulur və sınaqdan keçirilir.', 'İlk çalışan prototip geliştirilir ve test edilir.', 'A first working prototype is built and tested.', 20, 'NORMAL', ARRAY['TEAM', 'MENTOR']::"Role"[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('wfs_prj_mvp', 'PROJECT', 'MVP', 'MVP', 'MVP', 'MVP', 'Minimum işlək məhsul və test sübutları hazırlanır.', 'Minimum uygulanabilir ürün ve test kanıtları hazırlanır.', 'The minimum viable product and test evidence are prepared.', 30, 'NORMAL', ARRAY['TEAM', 'MENTOR']::"Role"[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('wfs_prj_qa', 'PROJECT', 'QA', 'Ara münsif', 'Ara jüri', 'Midterm jury', 'Münsiflər ara rubriklə (MIDTERM) qiymətləndirir; komanda rəyə görə düzəliş edir.', 'Jüri ara rubrikle (MIDTERM) değerlendirir; ekip geri bildirime göre düzeltir.', 'Jurors score with the midterm rubric (MIDTERM); the team iterates on the feedback.', 40, 'NORMAL', ARRAY['JURY', 'ADMIN']::"Role"[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('wfs_prj_mock_final', 'PROJECT', 'MOCK_FINAL', 'Sınaq finalı', 'Deneme finali', 'Mock final', 'Pitch və canlı demo final rubriki (FINAL) ilə məşq edilir.', 'Sunum ve canlı demo final rubriğiyle (FINAL) prova edilir.', 'The pitch and live demo are rehearsed with the final rubric (FINAL).', 50, 'NORMAL', ARRAY['JURY', 'TEAM']::"Role"[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('wfs_prj_submitted', 'PROJECT', 'SUBMITTED', 'Müsabiqəyə müraciət', 'Yarışmaya başvuru', 'Competition application', 'Sənəd paketi keyfiyyət yoxlamasından keçir və müsabiqəyə göndərilir.', 'Belge paketi kalite kontrolünden geçer ve yarışmaya gönderilir.', 'The document package passes the quality check and is submitted to the competition.', 60, 'NORMAL', ARRAY['TEAM', 'ADMIN']::"Role"[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('wfs_prj_result_finalist', 'PROJECT', 'RESULT_FINALIST', 'Nəticə: finalçı', 'Sonuç: finalist', 'Result: finalist', 'Müsabiqə komandanı rəsmi olaraq finalçı elan edir.', 'Yarışma ekibi resmi olarak finalist ilan eder.', 'The competition officially announces the team as a finalist.', 70, 'DONE', ARRAY['ADMIN']::"Role"[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('wfs_prj_result_not_selected', 'PROJECT', 'RESULT_NOT_SELECTED', 'Nəticə: seçilmədi', 'Sonuç: seçilmedi', 'Result: not selected', 'Komanda seçilmədi; dərslər çıxarılır və növbəti müsabiqə planlanır.', 'Ekip seçilmedi; çıkarımlar yapılır ve sonraki yarışma planlanır.', 'Not selected; lessons are captured and the next competition is planned.', 80, 'REJECTED', ARRAY['ADMIN']::"Role"[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("systemKey") DO NOTHING;

-- Map existing applications / projects to the matching system stage (only rows without a stage).
-- Same rules as deriveApplicationKey / deriveProjectKey in src/lib/workflow-core.ts. "updatedAt" is not touched.
UPDATE "Application" a SET "workflowStageId" = s."id"
FROM "WorkflowStage" s
WHERE a."workflowStageId" IS NULL
  AND s."systemKey" = CASE WHEN a."projectId" IS NOT NULL THEN 'APP_WORKSPACE' ELSE 'APP_' || a."status"::text END;

UPDATE "Project" p SET "workflowStageId" = s."id"
FROM "WorkflowStage" s
WHERE p."workflowStageId" IS NULL
  AND s."systemKey" = CASE
    WHEN p."result" = 'FINALIST' THEN 'RESULT_FINALIST'
    WHEN p."result" = 'NOT_SELECTED' THEN 'RESULT_NOT_SELECTED'
    WHEN p."stage" = 'QA' AND EXISTS (
      SELECT 1 FROM "Evaluation" e JOIN "Rubric" r ON r."id" = e."rubricId"
      WHERE e."projectId" = p."id" AND e."status" = 'SUBMITTED' AND r."kind" = 'FINAL'
    ) THEN 'MOCK_FINAL'
    ELSE p."stage"::text
  END;
