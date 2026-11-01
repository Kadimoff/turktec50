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
| Yönetim | Kullanıcılar, işlem kaydı (audit log), CSV dışa aktarma |

**Roller:**
- `ADMIN`: koordinatör, her şeyi görür.
- `TEAM`: yalnızca kendi proje alanını görür.
- `MENTOR`: yalnızca atandığı ekipleri görür.
- `JURY`: atandığı projeleri salt okunur görür ve değerlendirir.

**Diller:** Azerbaycanca (varsayılan), Türkçe, İngilizce. **Tema:** açık, koyu ve sistem.

## Lokal çalıştırma

Gereksinimler: Node 22+ ve Docker.

```bash
cp .env.example .env              # SESSION_SECRET'ı değiştirin (openssl rand -base64 32)
npm install
npm run db:up                     # PostgreSQL 17 → 127.0.0.1:5433
npx prisma migrate deploy
npm run db:seed                   # demo verisi (tüm tabloları sıfırlar)
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

## Teknik yapı

- Next.js 16 (App Router, Turbopack, Server Actions), React 19, TypeScript
- Prisma 7 + PostgreSQL (`prisma/schema.prisma`)
- Tailwind v4 + shadcn (Base UI), tasarım token'ları `src/app/globals.css` içinde (tüm metinler WCAG AA kontrastında, açık ve koyu modda)
- next-intl (çerez tabanlı dil seçimi), mesajlar `messages/<dil>/<modül>.json`
- Oturum: imzalı JWT (httpOnly çerez). `src/proxy.ts` erişimi korur, `src/lib/rbac.ts` görünürlüğü belirler.
- Her değişiklik `AuditLog` tablosuna yazılır. Bildirimler uygulama içindedir.

Geliştirme kuralları için: [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md)
