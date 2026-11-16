# TÜRKTECH 50 — proses mərhələləri (workflow)

> Sistem qərar vermir: seçim və münsif qərarlarını insanlar verir. Platforma qeyd edir, prosesi görünən edir və hesabat verir.

Bu sənəd proqramın proses axınını, hər mərhələnin məsulunu və nəticəsini, platformadakı sistem statusunu, konfiqurasiya qaydalarını və təqdimat diaqramlarını təsvir edir.

## 1. Mərhələlər cədvəli (default)

| # | Mərhələ (AZ) | TR | Kim (məsul) | Nə edir | Nəticə | Sistem statusu | Keçid |
|---|---|---|---|---|---|---|---|
| 1 | Müraciət | Başvuru | Komanda | Müraciət formasını göndərir (problem, həll, komanda) | Müraciət qeydə alınır | `Application.status = SUBMITTED` | avtomatik |
| 2 | İlkin baxış — seçim rubriki | Ön değerlendirme — seçim rubriği | Münsif, koordinator | Seçim rubriki ilə bal verir (məsləhət xarakterli) | Ballar və şərhlər | `UNDER_REVIEW` (ilk bal göndəriləndə) | avtomatik |
| 3 | ◇ Qərar: qəbul | Karar: kabul | Koordinator | Əsaslandırma ilə qərar qeyd edir | Komanda qəbul edilir | `ACCEPTED` | avtomatik (qərar paneli) |
| 3a | Gözləmə siyahısı | Yedek liste | Koordinator | Yer boşalarsa dəvət | Yan yol (sarı) | `WAITLIST` | avtomatik |
| 3b | Rədd edildi | Reddedildi | Koordinator | Əsaslandırma ilə rədd | Yan yol (qırmızı) | `REJECTED` | avtomatik |
| 4 | Layihə sahəsi açılır | Proje alanı açılır | Koordinator, komanda | Layihə, 13 bəndlik sənəd checklist-i, komanda hesabı yaradılır | Layihə `VALIDATION`-da başlayır | `Application.projectId != null` | avtomatik |
| 5 | Validasiya | Doğrulama | Komanda, mentor | Problem və istifadəçi ehtiyacı yoxlanılır | Təsdiqlənmiş problem | `Project.stage = VALIDATION` | avtomatik |
| 6 | Prototip | Prototip | Komanda, mentor | İlk işlək prototip | Prototip + test | `PROTOTYPE` | avtomatik |
| 7 | MVP | MVP | Komanda, mentor | Minimum işlək məhsul, test sübutu | KPI: işlək prototip/MVP | `MVP` | avtomatik |
| 8 | Ara münsif | Ara jüri | Münsif, koordinator | `MIDTERM` rubriki ilə qiymətləndirmə | Rəy, düzəlişlər | `QA` | avtomatik |
| 9 | Sınaq finalı | Deneme finali | Münsif, komanda | `FINAL` rubriki ilə pitch + demo məşqi | Final hazırlığı | `QA` + göndərilmiş `FINAL` qiymətləndirməsi | avtomatik |
| 10 | Müsabiqəyə müraciət | Yarışmaya başvuru | Komanda, koordinator | Paket QC-dən keçir, müsabiqəyə göndərilir | KPI: QC paketi | `SUBMITTED` | avtomatik |
| 11 | ◇ Nəticə: finalçı | Sonuç: finalist | Koordinator | Rəsmi nəticəni qeyd edir | KPI: finalçı | `CompetitionResult = FINALIST` | avtomatik |
| 11a | Nəticə: seçilmədi | Sonuç: seçilmedi | Koordinator | Dərslər, növbəti müsabiqə | Yan yol (qırmızı) | `NOT_SELECTED` | avtomatik |

**Paralel axınlar** (bütün inkubasiya boyunca, diaqramda yan zolaq): mentor görüşləri (plan → qeyd → növbəti addım tapşırığa çevrilir), tapşırıqlar (Kanban, Meyar), sənəd yoxlama siyahısı (13 bənd, versiya, QC), risklər (3×3 matris).

**KPI hunisi (pilot hədəfləri):** 150 qiymətləndirilmiş müraciət → 100 qəbul edilmiş komanda → 50 işlək prototip/MVP → 50 QC-dən keçmiş paket → 10 finalçı. Proses səhifəsində plan və faktiki rəqəmlər (faktiki — yalnız koordinatora) göstərilir.

## 2. Konfiqurasiya qaydaları

- Mərhələlər `WorkflowStage` cədvəlindədir: `scope` (`APPLICATION` | `PROJECT`), `systemKey`, `nameAz/Tr/En`, `descriptionAz/Tr/En`, `order`, `kind` (`NORMAL` | `DECISION` | `WAITING` | `REJECTED` | `DONE`), `responsibleRoles` (birinci rol = diaqramda əsas zolaq), `active`. Hər layihə/müraciətdə `workflowStageId`, keçidlər `WorkflowTransition`-dadır (kim, nə vaxt, haradan → haraya, avtomatik/əl ilə, qeyd).
- **Sistem mərhələləri** (`systemKey` dolu) mövcud enum-lara bağlıdır və mövcud axınlar (qərar paneli, aşama dəyişikliyi, FINAL rubriki, müsabiqə nəticəsi, layihə sahəsinin yaradılması) onları avtomatik dəyişir. Onları silmək/deaktiv etmək olmaz; adını, təsvirini, məsul rolları və sırasını dəyişmək olar.
- **Fərdi mərhələlər** (`systemKey = null`) `/admin/workflow`-da əlavə olunur (yer, 3 dildə ad/təsvir, növ, rollar), yalnız əl ilə keçilir; deaktiv edilə və silinə bilər — içində element varsa əvvəlcə başqa aktiv mərhələyə köçürülür.
- **Əl ilə keçid** (root və koordinator): layihə/müraciət səhifəsindəki stepper-də “Mərhələni dəyiş” (qeyd məcburidir). Sistem mərhələsinə keçid bağlı sahəni də yeniləyir (layihədə `stage`/`result`, müraciətdə `status` + qərar əsaslandırması); fərdi mərhələ yalnız prosesdəki yeri dəyişir. Hər keçid `AuditLog`-a (`workflow.move`, `workflow.auto`, `workflow.stage_*`) yazılır, komanda bildiriş alır.
- **Görünürlük (RBAC):** koordinator/root — hamısı; münsif — təyin olunduğu layihələr + bütün müraciətlər (seçim rubriki üçün); mentor — təyin olunduğu layihələr; komanda — yalnız öz layihəsi/müraciəti.

## 3. Platformada

- `/process` — canlı proses xəritəsi (bütün rollar): rol zolaqlı SVG diaqram, canlı saylar, qərar nöqtələri, gözləmə/rədd yolları, paralel axınlar, KPI hunisi; mərhələyə klik → siyahı; “Təqdimat rejimi” (tam ekran, böyük şrift), “SVG yüklə” / “PNG yüklə” (2x).
- `/admin/workflow` — mərhələlərin idarəsi (root, koordinator).
- `/projects/[id]` və `/applications/[id]` — stepper: keçilmiş/cari/növbəti, tarixlər, “növbəti addım və məsul rol”, keçid tarixçəsi, “Mərhələni dəyiş”.

## 4. Statik diaqramlar (jüri, investor, TTO təqdimatı)

`docs/diagrams/` — AZ və TR, SVG + PNG (2x):

| Diaqram | AZ | TR |
|---|---|---|
| Workflow (rol zolaqları, qərar nöqtələri, alternativ yollar, paralel axınlar, KPI hunisi) | `workflow-az.svg/png` | `workflow-tr.svg/png` |
| Arxitektura (iştirakçılar → platforma və modullar → nəticə; texniki qat) | `architecture-az.svg/png` | `architecture-tr.svg/png` |
| Rollar və icazələr matrisi | `roles-az.svg/png` | `roles-tr.svg/png` |

Yenidən yaratmaq: `node docs/diagrams/generate.mjs` (SVG, asılılıq yoxdur), sonra `node docs/diagrams/render-png.mjs` (PNG; `puppeteer-core` + Chromium lazımdır — yolları `PUPPETEER_CORE`, `CHROME`, `CHROME_LIBS` ilə vermək olar; Inter şrifti üçün işləyən tətbiq: `T50_FONT_ORIGIN=http://127.0.0.1:3051/login`).

## 5. Mermaid mənbələri

### 5.1 Workflow (rol zolaqları)

```mermaid
flowchart LR
  subgraph TEAM["Komanda"]
    A1["Müraciət<br/><small>SUBMITTED</small>"]
    P1["Validasiya"] --> P2["Prototip"] --> P3["MVP"]
    P6["Müsabiqəyə müraciət<br/><small>SUBMITTED</small>"]
  end
  subgraph JURY["Münsif"]
    A2["İlkin baxış — seçim rubriki<br/><small>UNDER_REVIEW</small>"]
    P4["Ara münsif<br/><small>QA · MIDTERM</small>"] --> P5["Sınaq finalı<br/><small>FINAL rubriki</small>"]
  end
  subgraph ADMIN["Koordinator"]
    D1{"Qərar"}
    A3["Qəbul<br/><small>ACCEPTED</small>"] --> A4["Layihə sahəsi açılır"]
    D2{"Nəticə"}
    P7(["Finalçı<br/><small>FINALIST</small>"])
  end
  subgraph ALT["Alternativ yollar"]
    W["Gözləmə siyahısı<br/><small>WAITLIST</small>"]
    R["Rədd edildi<br/><small>REJECTED</small>"]
    N["Seçilmədi<br/><small>NOT_SELECTED</small>"]
  end
  A1 --> A2 --> D1
  D1 -->|qəbul| A3
  D1 -.->|gözləmə| W
  D1 -.->|rədd| R
  W -.->|yer boşalarsa| A3
  A4 --> P1
  P3 --> P4
  P5 --> P6 --> D2
  D2 -->|finalçı| P7
  D2 -.->|seçilmədi| N
  classDef wait fill:#FFF6DB,stroke:#EACB7C,color:#8A5A00
  classDef rej fill:#FDECEC,stroke:#EFB7B7,color:#B42335
  classDef done fill:#E6F5EC,stroke:#B3DCC3,color:#1F7A52
  classDef base fill:#E6F1FC,stroke:#C9DDF2,color:#1F4E8C
  class A1,A2,A3,P1,P2,P3,P4,P5,P6 base
  class W wait
  class R,N rej
  class A4,P7 done
```

Paralel axınlar (Validasiya → Müsabiqəyə müraciət boyunca):

```mermaid
flowchart LR
  M["Mentor görüşləri"] -->|növbəti addım| T["Tapşırıqlar"]
  T -->|test sübutu| C["Sənəd yoxlama siyahısı"]
  C -->|QC| P6["Müsabiqəyə müraciət"]
  R["Risklər (3×3)"] -.->|yumşaltma| T
```

KPI hunisi:

```mermaid
flowchart LR
  K1["150<br/>qiymətləndirilmiş müraciət"] --> K2["100<br/>qəbul edilmiş komanda"] --> K3["50<br/>işlək prototip / MVP"] --> K4["50<br/>QC-dən keçmiş paket"] --> K5["10<br/>finalçı"]
```

### 5.2 Layihənin vəziyyət diaqramı

```mermaid
stateDiagram-v2
  [*] --> Validasiya: layihə sahəsi açılır
  Validasiya --> Prototip
  Prototip --> MVP
  MVP --> AraMunsif: MIDTERM
  AraMunsif --> SinaqFinali: FINAL rubriki göndərilir
  SinaqFinali --> MusabiqeyeMuraciet: paket QC
  AraMunsif --> MusabiqeyeMuraciet
  MusabiqeyeMuraciet --> Finalci: FINALIST
  MusabiqeyeMuraciet --> Secilmedi: NOT_SELECTED
  Finalci --> [*]
  Secilmedi --> [*]
  note right of Validasiya: koordinator istənilən aktiv mərhələyə əl ilə (qeydlə) keçirə bilər
```

### 5.3 Arxitektura

```mermaid
flowchart LR
  subgraph Actors["İştirakçılar"]
    U["Universitetlər və komandalar"]
    MN["Mentorlar"]
    J["Münsiflər"]
    K["Koordinatorlar"]
    I["Tərəfdaşlar və investorlar"]
  end
  subgraph Platform["TÜRKTECH 50 platforması"]
    direction TB
    M1["Müraciətlər"] --- M2["Layihələr"] --- M3["Tapşırıqlar"]
    M4["Mentorlar"] --- M5["Sənədlər"] --- M6["Risklər"]
    M7["Jüri"] --- M8["KPI"] --- M9["İdarəetmə və audit"]
    WF["Proses xəritəsi · konfiqurasiya edilə bilən mərhələlər"]
  end
  subgraph Out["Nəticə"]
    O1["Müsabiqə müraciəti"]
    O2["Finalçılar"]
  end
  subgraph Tech["Texniki qat"]
    N["Next.js 16"] --- PG["PostgreSQL 16 + Prisma 7"] --- FS["Fayl anbarı"] --- AL["Audit log"]
  end
  U & MN & J & K --> Platform
  I -.->|hesabat, təqdimat| Platform
  Platform --> O1 --> O2
  Platform -.-> Tech
```

## 6. Canlı bazaya tətbiq (miqrasiya)

Miqrasiya `prisma/migrations/20261102120000_workflow_stages` yalnız **əlavə edir**: 2 yeni enum, 2 yeni cədvəl, `Application` və `Project`-də nullable `workflowStageId`; 14 default mərhələni `INSERT … ON CONFLICT DO NOTHING` ilə yaradır və mövcud müraciət/layihələri statuslarına görə uyğun mərhələyə bağlayır. `DROP`/`DELETE` yoxdur. Sonra `npm run workflow:sync` (idempotent) çatışmayanları tamamlayır və mövcud tarixlərdən (`submittedAt`, `decidedAt`, `StageChange`) başlanğıc keçid tarixçəsini yaradır. **`npm run db:seed` canlı bazada işlədilməməlidir** (bütün cədvəlləri sıfırlayır).

## 7. Testlər

- `npm test` — mərhələ məntiqi (default sıra, miqrasiya SQL ↔ kod uyğunluğu, status → mərhələ xəritəsi, əl ilə keçidin tərsi, diaqram düzülüşü). `T50_DB_TEST=1 npm test` əlavə olaraq dev bazada `workflow:sync`-in idempotent olduğunu yoxlayır (yalnız `*_dev` / `*_merge` test bazasında işləyir).
