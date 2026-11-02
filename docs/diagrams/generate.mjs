// TÜRKTECH 50 — static presentation diagrams (jury / investors / TTO).
// Generates docs/diagrams/{workflow,architecture,roles}-{az,tr}.svg with no dependencies:   node docs/diagrams/generate.mjs
// PNG (2x) rendering: node docs/diagrams/render-png.mjs  (needs puppeteer-core + Chromium, see docs/PROCESS.md)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FONT = "Inter, 'Segoe UI', Roboto, Arial, sans-serif";
const C = {
  bg: "#FFFFFF", box: "#E6F1FC", border: "#C9DDF2", text: "#1F4E8C", sub: "#4A6485", muted: "#6B7F99", arrow: "#8A96A3",
  lane: "#F7FAFD", laneLine: "#E3EAF2", band1: "#F1F7FE", band2: "#F4F9F6",
  rej: { fill: "#FDECEC", border: "#EFB7B7", text: "#B42335" },
  wait: { fill: "#FFF6DB", border: "#EACB7C", text: "#8A5A00" },
  done: { fill: "#E6F5EC", border: "#B3DCC3", text: "#1F7A52" },
  strong: "#D4E6FA",
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const T = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-size="${o.size ?? 13}" font-weight="${o.weight ?? 400}" fill="${o.fill ?? C.text}"${o.anchor ? ` text-anchor="${o.anchor}"` : ""}${o.italic ? ' font-style="italic"' : ""} dominant-baseline="${o.base ?? "central"}">${esc(s)}</text>`;
const R = (x, y, w, h, o = {}) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx ?? 12}" fill="${o.fill ?? C.box}" stroke="${o.stroke ?? C.border}" stroke-width="${o.sw ?? 1.5}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ""}/>`;
function wrap(s, max) {
  const out = []; let cur = "";
  for (const w of String(s).split(/\s+/)) { const n = cur ? `${cur} ${w}` : w; if (n.length <= max || !cur) cur = n; else { out.push(cur); cur = w; } }
  if (cur) out.push(cur);
  return out;
}
/** centered multi-line label */
function ML(cx, cy, s, max, o = {}) {
  const lines = Array.isArray(s) ? s : wrap(s, max);
  const lh = o.lh ?? (o.size ?? 13) * 1.25;
  const top = cy - ((lines.length - 1) * lh) / 2;
  return lines.map((l, i) => T(cx, top + i * lh, l, { ...o, anchor: o.anchor ?? "middle" })).join("");
}
const defs = `<defs>
  <marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.arrow}"/></marker>
  <marker id="ar-w" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.wait.text}"/></marker>
  <marker id="ar-r" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.rej.text}"/></marker>
</defs>`;
const svg = (w, h, body, title) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${FONT}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
${defs}
<rect width="${w}" height="${h}" fill="${C.bg}"/>
${body}
</svg>
`;

// ------------------------------------------------------------------ texts
const L = {
  az: {
    wf: {
      title: "TÜRKTECH 50 — proses axını",
      subtitle: "Müraciətdən müsabiqə nəticəsinə: rollar, qərar nöqtələri, gözləmə və rədd yolları, paralel axınlar və KPI hunisi",
      phase1: "1. Seçim · müraciətlər", phase2: "2. İnkubasiya və final · layihələr",
      lanes: [["Komanda", "müraciət, iş, sənədlər, pitch"], ["Koordinator", "qərar, təyinat, keyfiyyət yoxlaması"], ["Mentor", "görüşlər, rəy, növbəti addımlar"], ["Münsif", "rubrik balları (məsləhət xarakterli)"]],
      branchLane: ["Alternativ yollar", "gözləmə siyahısı, rədd, seçilmədi"],
      streamsLane: ["Paralel axınlar", "bütün inkubasiya boyunca"],
      funnelLane: ["KPI hunisi", "pilot hədəfləri"],
      decision: "Qərar",
      stages: {
        s1: ["Müraciət", "SUBMITTED"], s2: ["İlkin baxış — seçim rubriki", "UNDER_REVIEW"], s3: ["Qərar: qəbul", "ACCEPTED"],
        w: ["Gözləmə siyahısı", "WAITLIST"], r: ["Rədd edildi", "REJECTED"], s4: ["Layihə sahəsi açılır", "layihə + checklist"],
        p1: ["Validasiya", "VALIDATION"], p2: ["Prototip", "PROTOTYPE"], p3: ["MVP", "MVP"], p4: ["Ara münsif", "QA · MIDTERM rubriki"],
        p5: ["Sınaq finalı", "FINAL rubriki"], p6: ["Müsabiqəyə müraciət", "SUBMITTED"], p7: ["Nəticə: finalçı", "FINALIST"], n: ["Nəticə: seçilmədi", "NOT_SELECTED"],
      },
      pills: { TEAM: "komanda işi", ADMIN: "koordinator nəzarəti", MENTOR: "mentor dəstəyi", JURY: "münsif rəyi" },
      streams: [["Mentor görüşləri", "plan → görüş qeydi → növbəti addım tapşırığa çevrilir"], ["Tapşırıqlar", "Kanban · məsul · son tarix · Meyar (qəbul meyarı)"], ["Sənəd yoxlama siyahısı", "13 bənd · versiyalar · koordinator/mentor yoxlaması · QC"], ["Risklər", "3×3 ehtimal × təsir · yumşaltma · məsul"]],
      funnel: [["150", "Qiymətləndirilmiş müraciət", "İlkin baxış"], ["100", "Qəbul edilmiş komanda", "Qərar: qəbul"], ["50", "İşlək prototip / MVP", "MVP · test sübutu"], ["50", "QC-dən keçmiş paket", "Müsabiqəyə müraciət"], ["10", "Finalçı (pilot)", "Nəticə"]],
      legend: ["Əsas mərhələ", "Qərar nöqtəsi (insan qərar verir)", "Gözləmə yolu", "Rədd / seçilmədi", "Uğurlu nəticə", "İştirak edən rol"],
      note: "Sistem qərar vermir: seçim və münsif qərarlarını insanlar verir; platforma qeyd edir, prosesi görünən edir və hesabat verir. Mərhələlər platformada konfiqurasiya edilə bilir.",
    },
    arch: {
      title: "TÜRKTECH 50 — platformanın arxitekturası",
      subtitle: "İştirakçılar → rol əsaslı platforma və modullar → nəticə; altda texniki qat",
      actorsH: "İştirakçılar", platformTop: "Platforma və modullar", platformH: "TÜRKTECH 50 platforması", platformS: "rol əsaslı layihə izləmə · proses xəritəsi · KPI", outH: "Nəticə", techH: "Texniki qat",
      actors: [["Universitetlər və komandalar", "ADNSU, ASOİU və tərəfdaş universitetlər"], ["Mentorlar", "texniki, biznes, əqli mülkiyyət"], ["Münsiflər", "seçim, ara münsif, sınaq finalı"], ["Koordinatorlar", "Startap və Texnologiya Transferi Şöbəsi"], ["Tərəfdaşlar və investorlar", "KPI hesabatı və təqdimat materialı"]],
      modules: [["Müraciətlər", "seçim rubriki, insan qərarı"], ["Layihələr", "mərhələlər, stepper, təyinatlar"], ["Tapşırıqlar", "Kanban, məsul, Meyar"], ["Mentorlar", "sessiyalar, qeydlər, növbəti addım"], ["Sənədlər", "checklist, versiya, gizlilik"], ["Risklər", "3×3 matris, yumşaltma"], ["Jüri", "ara münsif, sınaq finalı"], ["KPI", "huni 150 → 10, CSV"], ["İdarəetmə və audit", "istifadəçilər, jurnal, mərhələlər"]],
      engine: "Proses xəritəsi · konfiqurasiya edilə bilən mərhələlər · avtomatik + əl ilə keçidlər",
      outs: [["Müsabiqə müraciəti", "QC-dən keçmiş paket (TEKNOFEST və s.)"], ["Finalçılar", "pilot hədəf: 10 komanda"], ["Hesabat və izlənəbilirlik", "KPI, audit izi, təqdimat"]],
      tech: [["Next.js 16", "App Router, Server Actions, React 19"], ["PostgreSQL 16", "Prisma 7 ORM, miqrasiyalar"], ["Fayl anbarı", "yüklənən sənədlər, versiyalar"], ["Audit log", "hər dəyişiklik qeyd olunur"], ["Təhlükəsizlik", "JWT sessiya, RBAC, root hesabı"]],
      note: "Tərəfdaşlar və investorlar platformada ayrıca rol deyil: onlara KPI hesabatı, proses xəritəsi (təqdimat rejimi, SVG/PNG) və finalçılar təqdim olunur.",
    },
    roles: {
      title: "TÜRKTECH 50 — rollar və icazələr",
      subtitle: "Kim nəyi görür və nə edə bilir (rol əsaslı giriş, hər dəyişiklik audit jurnalına yazılır)",
      cols: ["Modul / əməliyyat", "Root (sistem sahibi)", "Koordinator (ADMIN)", "Komanda (TEAM)", "Mentor", "Münsif (JURY)"],
      F: "Tam", O: "Öz layihəsi", A: "Təyin olunduğu", RD: "Yalnız oxu", N: "—",
      rows: [
        ["İcmal (dashboard)", "F", "F", "O", "A", "A"],
        ["Proses xəritəsi", "F", "F", "O", "A", "A+"],
        ["Müraciətlər və seçim rubriki", "F", "F", "N", "N", "SC"],
        ["Müraciət qərarı (qəbul / gözləmə / rədd)", "F", "F", "N", "N", "N"],
        ["Layihələr", "F", "F", "O", "A", "AR"],
        ["Tapşırıqlar", "F", "F", "O", "A", "N"],
        ["Mentor sessiyaları", "F", "F", "O", "A", "N"],
        ["Sənədlər və checklist", "F", "F", "OU", "AV", "AR"],
        ["Risklər", "F", "F", "O", "A", "N"],
        ["Ara münsif / sınaq finalı qiymətləndirməsi", "F", "F", "FB", "FB", "AE"],
        ["Mərhələni dəyişmək (qeyd ilə)", "F", "F", "N", "N", "N"],
        ["Mərhələləri konfiqurasiya etmək", "F", "F", "N", "N", "N"],
        ["KPI və hesabatlar", "F", "F", "N", "N", "N"],
        ["İstifadəçilər", "F", "NA", "N", "N", "N"],
        ["Əməliyyat jurnalı (audit)", "F", "F", "N", "N", "N"],
        ["Sistem: birdəfəlik silmə, təmizləmə", "F", "N", "N", "N", "N"],
      ],
      extra: { "A+": "Təyin olunduğu + müraciətlər", SC: "Bal verir (məsləhət)", AR: "Təyin olunduğu, oxu", OU: "Yükləyir", AV: "Yoxlayır", FB: "Rəyi oxuyur", AE: "Bal verir", NA: "ADMIN-dən başqa" },
      legend: [["F", "Tam giriş"], ["O", "Yalnız öz layihəsi"], ["A", "Yalnız təyin olunduğu layihələr"], ["RD", "Oxu / məsləhət"], ["N", "Giriş yoxdur"]],
      note: "Sistem qərar vermir: seçim və münsif qərarlarını insanlar verir. Tərəfdaşlar / investorlar üçün ayrıca rol yoxdur — onlara hesabat və təqdimat materialı verilir.",
    },
  },
  tr: {
    wf: {
      title: "TÜRKTECH 50 — süreç akışı",
      subtitle: "Başvurudan yarışma sonucuna: roller, karar noktaları, bekleme ve ret yolları, paralel akışlar ve KPI hunisi",
      phase1: "1. Seçim · başvurular", phase2: "2. Kuluçka ve final · projeler",
      lanes: [["Ekip", "başvuru, çalışma, belgeler, sunum"], ["Koordinatör", "karar, atama, kalite kontrol"], ["Mentor", "görüşmeler, geri bildirim, sonraki adımlar"], ["Jüri", "rubrik puanları (tavsiye niteliğinde)"]],
      branchLane: ["Alternatif yollar", "yedek liste, ret, seçilmedi"],
      streamsLane: ["Paralel akışlar", "kuluçka boyunca"],
      funnelLane: ["KPI hunisi", "pilot hedefleri"],
      decision: "Karar",
      stages: {
        s1: ["Başvuru", "SUBMITTED"], s2: ["Ön değerlendirme — seçim rubriği", "UNDER_REVIEW"], s3: ["Karar: kabul", "ACCEPTED"],
        w: ["Yedek liste", "WAITLIST"], r: ["Reddedildi", "REJECTED"], s4: ["Proje alanı açılır", "proje + kontrol listesi"],
        p1: ["Doğrulama", "VALIDATION"], p2: ["Prototip", "PROTOTYPE"], p3: ["MVP", "MVP"], p4: ["Ara jüri", "QA · MIDTERM rubriği"],
        p5: ["Deneme finali", "FINAL rubriği"], p6: ["Yarışmaya başvuru", "SUBMITTED"], p7: ["Sonuç: finalist", "FINALIST"], n: ["Sonuç: seçilmedi", "NOT_SELECTED"],
      },
      pills: { TEAM: "ekip çalışması", ADMIN: "koordinatör denetimi", MENTOR: "mentor desteği", JURY: "jüri görüşü" },
      streams: [["Mentor görüşmeleri", "plan → görüşme notu → sonraki adım göreve dönüşür"], ["Görevler", "Kanban · sorumlu · son tarih · kabul ölçütü"], ["Belge kontrol listesi", "13 madde · sürümler · koordinatör/mentor incelemesi · QC"], ["Riskler", "3×3 olasılık × etki · azaltma · sorumlu"]],
      funnel: [["150", "Değerlendirilen başvuru", "Ön değerlendirme"], ["100", "Kabul edilen ekip", "Karar: kabul"], ["50", "Çalışan prototip / MVP", "MVP · test kanıtı"], ["50", "Kalite kontrolden geçen paket", "Yarışmaya başvuru"], ["10", "Finalist (pilot)", "Sonuç"]],
      legend: ["Ana aşama", "Karar noktası (kararı insan verir)", "Bekleme yolu", "Ret / seçilmedi", "Başarılı sonuç", "Katılan rol"],
      note: "Sistem karar vermez: seçim ve jüri kararlarını insanlar verir; platform kaydeder, süreci görünür kılar ve raporlar. Aşamalar platformda yapılandırılabilir.",
    },
    arch: {
      title: "TÜRKTECH 50 — platform mimarisi",
      subtitle: "Paydaşlar → rol tabanlı platform ve modüller → sonuç; altta teknik katman",
      actorsH: "Paydaşlar", platformTop: "Platform ve modüller", platformH: "TÜRKTECH 50 platformu", platformS: "rol tabanlı proje takibi · süreç haritası · KPI", outH: "Sonuç", techH: "Teknik katman",
      actors: [["Üniversiteler ve ekipler", "ADNSU, ASOİU ve ortak üniversiteler"], ["Mentorlar", "teknik, iş, fikri mülkiyet"], ["Jüri", "seçim, ara jüri, deneme finali"], ["Koordinatörler", "Startup ve Teknoloji Transferi Şubesi"], ["Ortaklar ve yatırımcılar", "KPI raporu ve sunum materyali"]],
      modules: [["Başvurular", "seçim rubriği, insan kararı"], ["Projeler", "aşamalar, aşama göstergesi, atamalar"], ["Görevler", "Kanban, sorumlu, kabul ölçütü"], ["Mentorlar", "oturumlar, notlar, sonraki adım"], ["Belgeler", "kontrol listesi, sürüm, gizlilik"], ["Riskler", "3×3 matris, azaltma"], ["Jüri", "ara jüri, deneme finali"], ["KPI", "huni 150 → 10, CSV"], ["Yönetim ve denetim", "kullanıcılar, kayıt, aşamalar"]],
      engine: "Süreç haritası · yapılandırılabilir aşamalar · otomatik + elle geçişler",
      outs: [["Yarışma başvurusu", "kalite kontrolden geçen paket (TEKNOFEST vb.)"], ["Finalistler", "pilot hedef: 10 ekip"], ["Raporlama ve izlenebilirlik", "KPI, denetim izi, sunum"]],
      tech: [["Next.js 16", "App Router, Server Actions, React 19"], ["PostgreSQL 16", "Prisma 7 ORM, migrasyonlar"], ["Dosya deposu", "yüklenen belgeler, sürümler"], ["Denetim kaydı", "her değişiklik kaydedilir"], ["Güvenlik", "JWT oturum, RBAC, root hesabı"]],
      note: "Ortaklar ve yatırımcılar platformda ayrı bir rol değildir: onlara KPI raporu, süreç haritası (sunum modu, SVG/PNG) ve finalistler sunulur.",
    },
    roles: {
      title: "TÜRKTECH 50 — roller ve yetkiler",
      subtitle: "Kim neyi görür ve ne yapabilir (rol tabanlı erişim, her değişiklik denetim kaydına yazılır)",
      cols: ["Modül / işlem", "Root (sistem sahibi)", "Koordinatör (ADMIN)", "Ekip (TEAM)", "Mentor", "Jüri (JURY)"],
      F: "Tam", O: "Kendi projesi", A: "Atandığı", RD: "Salt okunur", N: "—",
      rows: [
        ["Genel bakış (dashboard)", "F", "F", "O", "A", "A"],
        ["Süreç haritası", "F", "F", "O", "A", "A+"],
        ["Başvurular ve seçim rubriği", "F", "F", "N", "N", "SC"],
        ["Başvuru kararı (kabul / yedek / ret)", "F", "F", "N", "N", "N"],
        ["Projeler", "F", "F", "O", "A", "AR"],
        ["Görevler", "F", "F", "O", "A", "N"],
        ["Mentor oturumları", "F", "F", "O", "A", "N"],
        ["Belgeler ve kontrol listesi", "F", "F", "OU", "AV", "AR"],
        ["Riskler", "F", "F", "O", "A", "N"],
        ["Ara jüri / deneme finali değerlendirmesi", "F", "F", "FB", "FB", "AE"],
        ["Aşamayı değiştirme (notla)", "F", "F", "N", "N", "N"],
        ["Aşamaları yapılandırma", "F", "F", "N", "N", "N"],
        ["KPI ve raporlar", "F", "F", "N", "N", "N"],
        ["Kullanıcılar", "F", "NA", "N", "N", "N"],
        ["İşlem kaydı (denetim)", "F", "F", "N", "N", "N"],
        ["Sistem: kalıcı silme, temizleme", "F", "N", "N", "N", "N"],
      ],
      extra: { "A+": "Atandığı + başvurular", SC: "Puanlar (tavsiye)", AR: "Atandığı, salt okunur", OU: "Yükler", AV: "İnceler", FB: "Geri bildirimi okur", AE: "Puanlar", NA: "ADMIN hariç" },
      legend: [["F", "Tam erişim"], ["O", "Yalnızca kendi projesi"], ["A", "Yalnızca atandığı projeler"], ["RD", "Okuma / tavsiye"], ["N", "Erişim yok"]],
      note: "Sistem karar vermez: seçim ve jüri kararlarını insanlar verir. Ortaklar / yatırımcılar için ayrı rol yoktur — onlara rapor ve sunum materyali verilir.",
    },
  },
};

// ------------------------------------------------------------------ a) workflow
function workflow(t) {
  const W = 2280, LW = 200, CW = 186, NW = 150, NH = 70, LH = 104;
  const titleH = 92, phaseH = 36;
  const lanesTop = titleH + phaseH;
  const lane = { TEAM: 0, ADMIN: 1, MENTOR: 2, JURY: 3 };
  const branchTop = lanesTop + 4 * LH;
  const branchH = 2 * (NH + 16) + 20;
  const streamsTop = branchTop + branchH;
  const streamsH = 4 * 38 + 26;
  const funnelTop = streamsTop + streamsH;
  const funnelH = 250;
  const legendTop = funnelTop + funnelH;
  const H = legendTop + 110;
  const S = t.stages;
  const cols = [
    { k: "s1", r: ["TEAM"] }, { k: "s2", r: ["JURY", "ADMIN"] }, { k: "s3", r: ["ADMIN"], dec: ["w", "r"], kind: "dec" }, { k: "s4", r: ["ADMIN", "TEAM"], kind: "done" },
    { k: "p1", r: ["TEAM", "MENTOR"] }, { k: "p2", r: ["TEAM", "MENTOR"] }, { k: "p3", r: ["TEAM", "MENTOR"] }, { k: "p4", r: ["JURY", "ADMIN"] },
    { k: "p5", r: ["JURY", "TEAM"] }, { k: "p6", r: ["TEAM", "ADMIN"] }, { k: "p7", r: ["ADMIN"], dec: ["n"], kind: "done" },
  ];
  const x = (i) => LW + i * CW + (CW - NW) / 2;
  const y = (r) => lanesTop + lane[r] * LH + (LH - NH) / 2;
  const out = [];
  out.push(T(28, 34, t.title, { size: 26, weight: 800 }));
  out.push(T(28, 64, t.subtitle, { size: 14, fill: C.sub }));
  // phase bands
  const ph1x = LW + 4, ph1w = 4 * CW - 8, ph2x = LW + 4 * CW + 4, ph2w = 7 * CW - 8;
  out.push(R(ph1x, titleH, ph1w, branchTop + branchH - titleH, { fill: C.band1, stroke: "none", rx: 14 }));
  out.push(R(ph2x, titleH, ph2w, branchTop + branchH - titleH, { fill: C.band2, stroke: "none", rx: 14 }));
  out.push(T(ph1x + 14, titleH + 19, t.phase1, { size: 14, weight: 700 }));
  out.push(T(ph2x + 14, titleH + 19, t.phase2, { size: 14, weight: 700, fill: C.done.text }));
  // lanes
  const laneLabel = (yy, h, [a, b]) => {
    const lines = wrap(b, 24);
    const t0 = yy + h / 2 - (lines.length * 14) / 2 - 3;
    return T(24, t0, a, { size: 15, weight: 700 }) + lines.map((l, i) => T(24, t0 + 19 + i * 14, l, { size: 11.5, fill: C.muted })).join("");
  };
  t.lanes.forEach((l, i) => { const yy = lanesTop + i * LH; out.push(`<line x1="16" x2="${W - 16}" y1="${yy}" y2="${yy}" stroke="${C.laneLine}"/>`); out.push(laneLabel(yy, LH, l)); });
  out.push(`<line x1="16" x2="${W - 16}" y1="${branchTop}" y2="${branchTop}" stroke="${C.laneLine}"/>`); out.push(laneLabel(branchTop, branchH, t.branchLane));
  out.push(`<line x1="16" x2="${W - 16}" y1="${streamsTop}" y2="${streamsTop}" stroke="${C.laneLine}"/>`); out.push(laneLabel(streamsTop, streamsH, t.streamsLane));
  out.push(`<line x1="16" x2="${W - 16}" y1="${funnelTop}" y2="${funnelTop}" stroke="${C.laneLine}"/>`); out.push(laneLabel(funnelTop, 150, t.funnelLane));
  // pills (secondary roles)
  cols.forEach((c, i) => {
    for (const r of c.r.slice(1)) {
      const py = lanesTop + lane[r] * LH + LH / 2, ny = py > y(c.r[0]) ? y(c.r[0]) + NH : y(c.r[0]);
      out.push(`<path d="M${x(i) + NW / 2},${ny} V${py + (py > ny ? -14 : 14)}" stroke="${C.arrow}" stroke-width="1.2" stroke-dasharray="2 3" fill="none"/>`);
      out.push(R(x(i) + 4, py - 14, NW - 8, 28, { fill: "#FFFFFF", stroke: C.arrow, sw: 1, dash: "4 3", rx: 14 }));
      out.push(T(x(i) + NW / 2, py, t.pills[r], { size: 11.5, fill: C.sub, anchor: "middle" }));
    }
  });
  // arrows between main nodes
  cols.forEach((c, i) => {
    if (i === 0) return;
    const p = cols[i - 1];
    const x1 = x(i - 1) + NW, y1 = y(p.r[0]) + NH / 2, x2 = x(i), y2 = y(c.r[0]) + NH / 2;
    const dash = i === 4 ? ' stroke-dasharray="6 4"' : "";
    const d = Math.abs(y1 - y2) < 1 ? `M${x1},${y1} H${x2 - 2}` : `M${x1},${y1} H${x1 + 12} V${y2} H${x2 - 2}`;
    out.push(`<path d="${d}" fill="none" stroke="${C.arrow}" stroke-width="1.6"${dash} marker-end="url(#ar)"/>`);
  });
  // decision diamonds + side paths
  cols.forEach((c, i) => {
    if (!c.dec) return;
    const dx = x(i) - 20, dy = y(c.r[0]) + NH / 2, r = 10;
    const last = branchTop + 14 + (c.dec.length - 1) * (NH + 16) + NH / 2;
    out.push(`<path d="M${dx},${dy + r} V${last}" stroke="${C.arrow}" stroke-width="1.4" fill="none"/>`);
    c.dec.forEach((k, j) => {
      const by = branchTop + 14 + j * (NH + 16);
      const st = k === "w" ? C.wait : C.rej;
      out.push(`<path d="M${dx},${by + NH / 2} H${x(i) - 2}" stroke="${st.text}" stroke-width="1.8" stroke-dasharray="5 3" fill="none" marker-end="url(#${k === "w" ? "ar-w" : "ar-r"})"/>`);
      out.push(R(x(i), by, NW, NH, { fill: st.fill, stroke: st.border, dash: "6 4" }));
      out.push(ML(x(i) + NW / 2, by + NH / 2 - 8, S[k][0], 18, { size: 13.5, weight: 700, fill: st.text }));
      out.push(T(x(i) + NW / 2, by + NH - 13, S[k][1], { size: 10.5, fill: st.text, anchor: "middle" }));
    });
    out.push(`<polygon points="${dx},${dy - r} ${dx + r},${dy} ${dx},${dy + r} ${dx - r},${dy}" fill="#FFFFFF" stroke="${C.text}" stroke-width="1.8"/>`);
    out.push(T(dx, dy - r - 9, t.decision, { size: 11, weight: 700, anchor: "middle" }));
  });
  // main nodes
  cols.forEach((c, i) => {
    const st = c.kind === "done" ? C.done : { fill: C.box, border: C.border, text: C.text };
    const yy = y(c.r[0]);
    out.push(R(x(i), yy, NW, NH, { fill: st.fill, stroke: c.kind === "dec" ? C.text : st.border, sw: c.kind === "dec" ? 1.8 : 1.5 }));
    const lines = wrap(S[c.k][0], 17);
    out.push(ML(x(i) + NW / 2, yy + NH / 2 - (lines.length > 1 ? 6 : 8), lines, 17, { size: 13.5, weight: 700, fill: st.text, lh: 16 }));
    out.push(T(x(i) + NW / 2, yy + NH - 11, S[c.k][1], { size: 10.5, fill: C.muted, anchor: "middle" }));
  });
  // parallel streams (incubation columns)
  const sx0 = x(4) - 8, sx1 = x(9) + NW + 8;
  t.streams.forEach(([a, b], i) => {
    const yy = streamsTop + 14 + i * 38;
    out.push(R(sx0, yy, sx1 - sx0, 30, { fill: C.box, stroke: C.border, rx: 15 }));
    out.push(T(sx0 + 16, yy + 15, a, { size: 13, weight: 700 }));
    out.push(T(sx0 + 230, yy + 15, b, { size: 12, fill: C.sub }));
  });
  // KPI funnel
  const fx0 = LW + 10, fw = (W - 40 - fx0) / 5, mid = funnelTop + 78, hh = (v) => 30 + 92 * (v / 150);
  t.funnel.forEach(([n, label, src], i) => {
    const xx = fx0 + i * fw, h1 = hh(+n), h2 = i < 4 ? hh(+t.funnel[i + 1][0]) : hh(+n) * 0.8;
    out.push(`<polygon points="${xx + 6},${mid - h1 / 2} ${xx + fw - 6},${mid - h2 / 2} ${xx + fw - 6},${mid + h2 / 2} ${xx + 6},${mid + h1 / 2}" fill="${i === 4 ? C.done.fill : C.box}" stroke="${i === 4 ? C.done.border : C.border}" stroke-width="1.5"/>`);
    out.push(T(xx + fw / 2, mid, n, { size: 28, weight: 800, fill: i === 4 ? C.done.text : C.text, anchor: "middle" }));
    if (i < 4) out.push(T(xx + fw, mid, "→", { size: 18, fill: C.arrow, anchor: "middle" }));
    out.push(T(xx + fw / 2, funnelTop + 170, label, { size: 14, weight: 700, anchor: "middle" }));
    out.push(T(xx + fw / 2, funnelTop + 192, src, { size: 12, fill: C.muted, anchor: "middle" }));
  });
  // legend
  const ly = legendTop + 26;
  const items = [
    () => R(0, -10, 28, 20, { rx: 6 }), () => `<polygon points="14,-10 24,0 14,10 4,0" fill="#FFFFFF" stroke="${C.text}" stroke-width="1.8"/>`,
    () => R(0, -10, 28, 20, { rx: 6, fill: C.wait.fill, stroke: C.wait.border, dash: "5 3" }), () => R(0, -10, 28, 20, { rx: 6, fill: C.rej.fill, stroke: C.rej.border, dash: "5 3" }),
    () => R(0, -10, 28, 20, { rx: 6, fill: C.done.fill, stroke: C.done.border }), () => R(0, -10, 34, 20, { rx: 10, fill: "#FFFFFF", stroke: C.arrow, dash: "4 3", sw: 1 }),
  ];
  let lx = 28;
  t.legend.forEach((l, i) => { out.push(`<g transform="translate(${lx},${ly})">${items[i]()}${T(44, 0, l, { size: 13, fill: C.sub })}</g>`); lx += 60 + l.length * 7.4; });
  out.push(T(28, ly + 44, t.note, { size: 13, fill: C.sub, italic: true }));
  out.push(`<line x1="16" x2="${W - 16}" y1="${legendTop}" y2="${legendTop}" stroke="${C.laneLine}"/>`);
  return svg(W, H, out.join("\n"), t.title);
}

// ------------------------------------------------------------------ b) architecture
function architecture(t) {
  const W = 1760;
  const out = [];
  out.push(T(32, 38, t.title, { size: 26, weight: 800 }));
  out.push(T(32, 68, t.subtitle, { size: 14, fill: C.sub }));
  const top = 112;
  // actors
  const ax = 32, aw = 330, ah = 84, agap = 18;
  out.push(T(ax, top, t.actorsH, { size: 16, weight: 800 }));
  const actorY = (i) => top + 24 + i * (ah + agap);
  t.actors.forEach(([a, b], i) => {
    const partner = i === 4;
    out.push(R(ax, actorY(i), aw, ah, partner ? { fill: "#FFFFFF", stroke: C.border, dash: "6 4" } : {}));
    out.push(T(ax + 20, actorY(i) + 32, a, { size: 16, weight: 700 }));
    out.push(T(ax + 20, actorY(i) + 57, b, { size: 12.5, fill: C.sub }));
  });
  // platform
  const px = 440, pw = 880, py = top + 24, ph = 5 * (ah + agap) - agap;
  out.push(T(px, top, t.platformTop, { size: 16, weight: 800 }));
  out.push(R(px, py, pw, ph, { fill: "#F5F9FE", stroke: C.text, sw: 2, rx: 18 }));
  out.push(T(px + 24, py + 30, t.platformH, { size: 20, weight: 800 }));
  out.push(T(px + 24, py + 55, t.platformS, { size: 13, fill: C.sub }));
  const mx0 = px + 24, my0 = py + 78, mw = (pw - 48 - 2 * 16) / 3, mh = 86;
  t.modules.forEach(([a, b], i) => {
    const cx = mx0 + (i % 3) * (mw + 16), cy = my0 + Math.floor(i / 3) * (mh + 14);
    out.push(R(cx, cy, mw, mh));
    out.push(T(cx + 18, cy + 32, a, { size: 16, weight: 700 }));
    out.push(T(cx + 18, cy + 58, b, { size: 12.5, fill: C.sub }));
  });
  const ey = my0 + 3 * (mh + 14);
  out.push(R(mx0, ey, pw - 48, 46, { fill: C.strong, stroke: C.border }));
  out.push(T(mx0 + (pw - 48) / 2, ey + 23, t.engine, { size: 14, weight: 700, anchor: "middle" }));
  // outcomes
  const ox = 1400, ow = 328, oh = 104;
  out.push(T(ox, top, t.outH, { size: 16, weight: 800 }));
  const outY = (i) => py + 40 + i * (oh + 40);
  t.outs.forEach(([a, b], i) => {
    const st = i === 1 ? { fill: C.done.fill, stroke: C.done.border } : {};
    out.push(R(ox, outY(i), ow, oh, st));
    out.push(T(ox + 20, outY(i) + 40, a, { size: 17, weight: 700, fill: i === 1 ? C.done.text : C.text }));
    out.push(ML(ox + 20, outY(i) + 70, b, 40, { size: 12.5, fill: C.sub, anchor: "start", lh: 15 }));
  });
  // arrows actors → platform, platform → outcomes
  t.actors.forEach((_, i) => out.push(`<path d="M${ax + aw},${actorY(i) + ah / 2} H${px - 2}" stroke="${C.arrow}" stroke-width="1.6" fill="none" marker-end="url(#ar)"${i === 4 ? ' stroke-dasharray="6 4"' : ""}/>`));
  t.outs.forEach((_, i) => out.push(`<path d="M${px + pw},${outY(i) + oh / 2} H${ox - 2}" stroke="${C.arrow}" stroke-width="1.6" fill="none" marker-end="url(#ar)"/>`));
  // partner feedback: reports back to partners (dashed)
  out.push(`<path d="M${ox + ow / 2},${outY(2) + oh} V${py + ph + 26} H${ax + aw / 2} V${actorY(4) + ah + 2}" stroke="${C.arrow}" stroke-width="1.3" stroke-dasharray="5 4" fill="none" marker-end="url(#ar)"/>`);
  // tech layer
  const ty = py + ph + 70;
  out.push(T(32, ty, t.techH, { size: 16, weight: 800 }));
  out.push(R(32, ty + 20, W - 64, 140, { fill: "#FAFBFD", stroke: C.laneLine, rx: 16 }));
  const tw = (W - 64 - 40 - 4 * 16) / 5;
  t.tech.forEach(([a, b], i) => {
    const tx = 52 + i * (tw + 16);
    out.push(R(tx, ty + 44, tw, 92));
    out.push(T(tx + 18, ty + 78, a, { size: 16, weight: 700 }));
    out.push(ML(tx + 18, ty + 108, b, 40, { size: 12.5, fill: C.sub, anchor: "start", lh: 15 }));
  });
  out.push(`<path d="M${px + pw / 2},${py + ph} V${ty + 18}" stroke="${C.arrow}" stroke-width="1.6" stroke-dasharray="6 4" fill="none" marker-end="url(#ar)"/>`);
  const H = ty + 20 + 140 + 72;
  out.push(T(32, H - 30, t.note, { size: 13, fill: C.sub, italic: true }));
  return svg(W, H, out.join("\n"), t.title);
}

// ------------------------------------------------------------------ c) roles matrix
function roles(t) {
  const W = 1560, col0 = 430, cw = (W - 64 - col0) / 5, rh = 44, top = 150;
  const H = top + rh * t.rows.length + 40 + 80;
  const out = [];
  out.push(T(32, 38, t.title, { size: 26, weight: 800 }));
  out.push(T(32, 68, t.subtitle, { size: 14, fill: C.sub }));
  // header
  out.push(R(32, top - 50, W - 64, 50, { fill: C.text, stroke: C.text, rx: 12 }));
  t.cols.forEach((c, i) => out.push(T(i === 0 ? 52 : 32 + col0 + (i - 1) * cw + cw / 2, top - 25, c, { size: 14, weight: 700, fill: "#FFFFFF", anchor: i === 0 ? "start" : "middle" })));
  const style = (code) => {
    if (code === "F") return { fill: C.strong, stroke: C.border, text: C.text, label: t.F };
    if (code === "N") return null;
    if (code === "O" || code === "OU") return { fill: C.done.fill, stroke: C.done.border, text: C.done.text, label: code === "O" ? t.O : t.extra.OU };
    if (code === "A" || code === "A+" || code === "AV" || code === "AE") return { fill: C.box, stroke: C.border, text: C.text, label: code === "A" ? t.A : t.extra[code] };
    if (code === "NA") return { fill: C.strong, stroke: C.border, text: C.text, label: t.extra.NA };
    return { fill: "#F2F5F9", stroke: "#DCE3EC", text: C.sub, label: t.extra[code] ?? t.RD };
  };
  t.rows.forEach((row, ri) => {
    const yy = top + ri * rh;
    if (ri % 2 === 0) out.push(`<rect x="32" y="${yy}" width="${W - 64}" height="${rh}" fill="${C.lane}"/>`);
    out.push(T(52, yy + rh / 2, row[0], { size: 14, weight: 600 }));
    row.slice(1).forEach((code, ci) => {
      const cx = 32 + col0 + ci * cw + cw / 2;
      const s = style(code);
      if (!s) { out.push(T(cx, yy + rh / 2, "—", { size: 14, fill: "#A8B4C3", anchor: "middle" })); return; }
      const w = Math.min(cw - 16, 24 + s.label.length * 7.4);
      out.push(R(cx - w / 2, yy + 8, w, rh - 16, { fill: s.fill, stroke: s.stroke, rx: 14, sw: 1 }));
      out.push(T(cx, yy + rh / 2, s.label, { size: 12.5, weight: 600, fill: s.text, anchor: "middle" }));
    });
  });
  out.push(`<line x1="32" x2="${W - 32}" y1="${top + t.rows.length * rh}" y2="${top + t.rows.length * rh}" stroke="${C.laneLine}"/>`);
  // legend
  const ly = top + t.rows.length * rh + 40;
  let lx = 32;
  t.legend.forEach(([code, label]) => {
    const s = code === "RD" ? { fill: "#F2F5F9", stroke: "#DCE3EC" } : code === "N" ? null : style(code);
    out.push(`<g transform="translate(${lx},${ly})">${s ? R(0, -10, 30, 20, { fill: s.fill, stroke: s.stroke, rx: 10, sw: 1 }) : T(15, 0, "—", { size: 14, fill: "#A8B4C3", anchor: "middle" })}${T(40, 0, label, { size: 13, fill: C.sub })}</g>`);
    lx += 70 + label.length * 7.2;
  });
  out.push(T(32, ly + 46, t.note, { size: 13, fill: C.sub, italic: true }));
  return svg(W, H, out.join("\n"), t.title);
}

for (const lang of ["az", "tr"]) {
  const t = L[lang];
  fs.writeFileSync(path.join(DIR, `workflow-${lang}.svg`), workflow(t.wf));
  fs.writeFileSync(path.join(DIR, `architecture-${lang}.svg`), architecture(t.arch));
  fs.writeFileSync(path.join(DIR, `roles-${lang}.svg`), roles(t.roles));
}
console.log("SVG written to", DIR);
