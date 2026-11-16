# TÜRKTECH 50 — Proje Takip Platformu (MVP demo)

Türk Dünyası Teknoloji Yarışmaları Akademisi için rol bazlı dijital proje takip sistemi (T06).
ADNSU/ASOIU Startup ve Teknoloji Transferi Şubesi pilotu · TÜRK FORUM 2026.

> **Sistem karar vermez.** Seçim ve jüri kararlarını insanlar verir. Platform yalnızca kayıt tutar, süreci görünür kılar ve raporlar.
> Uygulamadaki bütün ekipler, isimler ve rakamlar **demo verisidir**.

## Kapsam

| Modül | İçerik |
|---|---|
| Genel bakış | Her rol için ayrı dashboard, KPI hunisi (150 → 100 → 50 → 50 → 10), program takvimi |
| Başvurular | Seçim rubriği ile puanlama, insan kararı (gerekçe zorunlu), kabul edilen başvuruyu proje alanına dönüştürme |
| Projeler | Portföy, aşama geçişleri ve geçmişi, mentor ve jüri ataması, KPI kanıt bayrakları |
| Görevler | Kanban ve tablo görünümü, sorumlu, son tarih, öncelik, kabul ölçütü (Meyar) |
| Mentorlar | Oturum planlama, görüşme notları, sonraki adımı tek tıkla göreve çevirme |
| Belgeler | Başvuru paketi kontrol listesi, sürümlü yükleme, inceleme (onay / düzeltme), gizli belge koruması |
| Riskler | 3×3 olasılık × etki matrisi, program ve proje riskleri |
| Jüri | Ara jüri ve deneme finali rubrikleri, bilgilendirici ağırlıklı puan, görüş ayrılığı uyarısı |
| Süreç haritası | Yapılandırılabilir süreç aşamaları (`/admin/workflow`), canlı rol kulvarlı iş akışı diyagramı + KPI hunisi (`/process`), sunum modu, SVG/PNG indirme, proje ve başvuru aşama göstergesi (stepper) |
| Yönetim | Kullanıcılar, işlem kaydı (audit log), CSV dışa aktarma |
| Akademi · genel bakış | Hazırlık stratejisi (6 rol, 6 aşama), öğrenci/ekip/başvuru sayıları, yaklaşan resmî tarihler, açık kaynak talepleri |
| Akademi · yarışma kataloğu | TEKNOFEST 2026 arşivinden 61 resmî yarışma kartı (yön, alt kategori, resmî sayfa), 2027 kural takibi (sorumlu, son kontrol, resmî son tarih, HTTPS şartname bağlantısı; *Onaylandı* için bağlantı zorunlu) |
| Akademi · öğrenciler ve ekipler | Başvuru öncesi öğrenci kaydı, ekip kurma (bir öğrenci yalnızca bir ekipte), kaptan ve mentor, ekipten başvuru oluşturma |
| Akademi · kayıtlar | Fakülteler, laboratuvarlar, sanayi ortakları; eğitimler (takvimde görünür) |
| Kaynak talepleri | Proje sekmesi: malzeme / ekipman / laboratuvar zamanı talebi, koordinatör kararı (gerekçe zorunlu) |
| Duyurular | Role göre hedeflenen duyurular, yayınlanınca uygulama içi bildirim |
| Hazırlık başvurusu (açık form) | Öğrenci kaptanı **hesapsız** `/apply` sayfasından TEKNOFEST yarışmasını ve alt kategorisini seçer, ekip üyelerini yazar ve bölüme hazırlık başvurusu gönderir; gizli takip bağlantısıyla durumu ve koordinatör notunu görür, gerekirse düzeltip yeniden gönderir |
| Hazırlık başvuruları (iç kontrol) | Koordinatör `/academy/intake` üzerinden inceler (çakışma uyarıları: başka ekipteki/arşivdeki öğrenci, başka üniversite, açık başka başvuru), gerekçeli karar verir; kabul edilen başvuru aktif Akademi ekibine dönüşür, tüm adımlar işlem kaydına yazılır |

**Roller:**
- `ADMIN`: koordinatör, her şeyi görür.
- `TEAM`: yalnızca kendi proje alanını görür.
- `MENTOR`: yalnızca atandığı ekipleri görür.
- `JURY`: atandığı projeleri salt okunur görür ve değerlendirir.

Akademi kayıtlarını (`/academy/*`) koordinatör yönetir; ekipler ve mentorlar kataloğu, eğitimleri ve duyuruları okur.

**Diller:** Azerbaycanca (varsayılan), Türkçe, İngilizce. **Tema:** açık, koyu ve sistem (mor kimlik).

> ADNSU TEKNOFEST 2027 Academy paneli (Python/SQLite) bu uygulamaya taşındı. Katalog verisi: `prisma/data/teknofest-catalog-2026.json` (elle güncellenir).

## Lokal çalıştırma

Gereksinimler: Node 22+ ve Docker.

```bash
cp .env.example .env              # SESSION_SECRET'ı değiştirin (openssl rand -base64 32)
npm install
npm run db:up                     # PostgreSQL 17 → 127.0.0.1:5433
npx prisma migrate deploy
npm run db:seed                   # demo verisi (tüm tabloları sıfırlar)
npm run workflow:sync             # süreç aşamaları (idempotent, veri silmez; mevcut veritabanında da güvenli)
npm run academy:catalog           # TEKNOFEST kataloğunu yükler/tazeler (idempotent, veri silmez; canlı veritabanında db:seed yerine)
npm run dev                       # http://localhost:3000
```

### Demo hesaplar

Tüm hesapların şifresi `Demo2026!`. Giriş sayfasındaki "Demo hesaplar" kartlarıyla tek tıkla girilebilir.

| Rol | E-posta |
|---|---|
| Koordinatör | koordinator@turktech50.az |
| Ekip (AgroSense lideri) | rena.mammadli@student.asoiu.az |
| Mentor | elvin.quliyev@mentor.turktech50.az |
| Jüri | sebine.kerimova@jury.turktech50.az |

Demo verisini sıfırlamak için: `npm run db:seed`

Tüm demo kullanıcıların listesi: [`docs/USERS.md`](docs/USERS.md)

### Root hesabı (sistem sahibi)

| İsim | Kullanıcı adı | Şifre |
|---|---|---|
| Qədim Qədimov | `root` (veya qadim.qadimov@turktech50.az) | `.env` dosyasındaki `ROOT_PASSWORD` (demo şifresinden ayrı) |

- **Hesabın korunması:** root hesabını kimse düzenleyemez, devre dışı bırakamaz ya da silemez. Rolü de değiştirilemez.
- **Rol yetkisi:** koordinatör (ADMIN) hesaplarını yalnızca root oluşturur, düzenler ve devre dışı bırakır. ADMIN rolünü vermek ve geri almak da yalnızca root'a açıktır. Root, istediği kullanıcıya istediği rolü atayabilir.
- **Veri silme:** yalnızca root'a açık **Sistem** sayfası (`/admin/system`) şunları sunar:
  - veritabanı özeti;
  - kullanıcı, proje veya başvuruyu kalıcı olarak silme (adı ya da kodu elle yazarak onay);
  - tüm program verisini temizleme (onay ifadesi `DELETE ALL`; root hesabı, üniversiteler, yarışmalar ve rubrikler korunur).
- **İzlenebilirlik:** her silme işlemi işlem kaydına yazılır.
- **Şifre değiştirme:** `.env` dosyasında `ROOT_PASSWORD` değerini güncelleyip `npm run root:sync` çalıştırın. Bu komut veriyi silmez.

## Teknik yapı

- Next.js 16 (App Router, Turbopack, Server Actions), React 19, TypeScript
- Prisma 7 + PostgreSQL (`prisma/schema.prisma`)
- Tailwind v4 + shadcn (Base UI), tasarım token'ları `src/app/globals.css` içinde (tüm metinler WCAG AA kontrastında, açık ve koyu modda)
- next-intl (çerez tabanlı dil seçimi), mesajlar `messages/<dil>/<modül>.json`
- Oturum: imzalı JWT (httpOnly çerez). `src/proxy.ts` erişimi korur, `src/lib/rbac.ts` görünürlüğü belirler.
- Her değişiklik `AuditLog` tablosuna yazılır. Bildirimler uygulama içindedir.

Geliştirme kuralları için: [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md)

Süreç aşamaları, roller ve sunum diyagramları (AZ/TR, SVG + PNG): [`docs/PROCESS.md`](docs/PROCESS.md), [`docs/diagrams/`](docs/diagrams/). Testler: `npm test`.
