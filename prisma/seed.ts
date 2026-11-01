/* TÜRKTECH 50 demo seed — a realistic mid-incubation snapshot (≈ week 4–5 of 8).
 * All names, teams and figures are DEMO data (not real program results).
 * Run: npm run db:seed   (wipes all tables first)
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { CHECKLIST_TEMPLATE, RUBRICS } from "../src/lib/constants";
import type {
  ProjectStage, ProjectHealth, TaskStatus, Priority, ChecklistStatus, RiskLevel, ApplicationStatus,
} from "../src/generated/prisma/enums";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? "./uploads");
export const DEMO_PASSWORD = "Demo2026!";

// ---------- deterministic random ----------
let _s = 20261101;
function rnd() {
  _s |= 0; _s = (_s + 0x6d2b79f5) | 0;
  let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const ri = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)]!;
const shuffle = <T,>(arr: T[]) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; } return a; };
const NOW = new Date();
const DAY = 86400000;
const days = (n: number, hour = 10, min = 0) => { const d = new Date(NOW.getTime() + n * DAY); d.setHours(hour, min, 0, 0); return d; };

const tr = (s: string) =>
  s.toLowerCase().replace(/ə/g, "a").replace(/ı/g, "i").replace(/ş/g, "s").replace(/ç/g, "c").replace(/ğ/g, "g")
    .replace(/ö/g, "o").replace(/ü/g, "u").replace(/i̇/g, "i").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");

// ---------- name pools ----------
const AZ_M = ["Murad", "Orxan", "Tural", "Rauf", "Fuad", "Ramin", "Nihad", "Səbuhi", "Emin", "Ülvi", "Fərid", "Toğrul", "Kənan", "Vüsal", "Cavid", "Anar", "Rəşad", "Samir", "Elşən", "Nicat", "Kamal", "Rüstəm"];
const AZ_F = ["Leyla", "Nigar", "Günel", "Lalə", "Könül", "Aytən", "Nərmin", "Fidan", "Zəhra", "Ülkər", "Aynur", "Səma", "Nərgiz", "Gülnar", "Xədicə", "Arzu", "Sevinc", "İlahə", "Mələk", "Turan"];
const AZ_L = ["Məmmədov", "Əliyev", "Həsənov", "Quliyev", "Rzayev", "Nəcəfov", "Hüseynov", "İsmayılov", "Babayev", "Səfərov", "Abbasov", "Kərimov", "Rəhimov", "Cəfərov", "Orucov", "Vəliyev", "Bağırov", "Zeynalov", "Mustafayev", "Qasımov"];
const TR_M = ["Ahmet", "Mehmet", "Can", "Burak", "Emre", "Kerem", "Mert", "Onur"];
const TR_F = ["Elif", "Zeynep", "Ece", "Defne", "Selin", "Ayşe", "İrem", "Melis"];
const TR_L = ["Yılmaz", "Kaya", "Demir", "Öztürk", "Aydın", "Şahin", "Çelik", "Arslan", "Koç", "Kurt"];
const KZ = ["Aruzhan Nurlanqyzy", "Daniyar Seitkali", "Aigerim Bekova", "Nursultan Abenov", "Dana Zhaksylyk", "Timur Ospanov"];
const UZ = ["Jasur Karimov", "Madina Rashidova", "Sardor Yusupov", "Nilufar Tursunova", "Bekzod Aliyev", "Dilnoza Ergasheva"];

function azName() {
  const f = rnd() < 0.5;
  const first = f ? pick(AZ_F) : pick(AZ_M);
  const last = pick(AZ_L) + (f ? "a" : "");
  return `${first} ${last}`;
}
function nameFor(country: string) {
  if (country === "TR") { const f = rnd() < 0.5; return `${f ? pick(TR_F) : pick(TR_M)} ${pick(TR_L)}`; }
  if (country === "KZ") return pick(KZ);
  if (country === "UZ") return pick(UZ);
  return azName();
}

// ---------- tiny PDF writer for demo documents ----------
function makePdf(title: string, lines: string[]) {
  const esc = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ə/g, "e").replace(/Ə/g, "E").replace(/ı/g, "i").replace(/İ/g, "I").replace(/[^\x20-\x7e]/g, "?").replace(/([()\\])/g, "\\$1");
  const text = [`BT /F1 18 Tf 60 780 Td (${esc(title)}) Tj ET`, ...lines.map((l, i) => `BT /F1 11 Tf 60 ${750 - i * 18} Td (${esc(l)}) Tj ET`)].join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(Buffer.byteLength(out)); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "binary");
}

// ---------- static content ----------
const UNIVERSITIES = [
  { key: "asoiu", name: "Azərbaycan Dövlət Neft və Sənaye Universiteti", shortName: "ADNSU (ASOIU)", country: "AZ", city: "Bakı", isPartner: false },
  { key: "bdu", name: "Bakı Dövlət Universiteti", shortName: "BDU", country: "AZ", city: "Bakı", isPartner: true },
  { key: "ada", name: "ADA Universiteti", shortName: "ADA", country: "AZ", city: "Bakı", isPartner: true },
  { key: "aztu", name: "Azərbaycan Texniki Universiteti", shortName: "AzTU", country: "AZ", city: "Bakı", isPartner: true },
  { key: "itu", name: "İstanbul Teknik Üniversitesi", shortName: "İTÜ", country: "TR", city: "İstanbul", isPartner: true },
  { key: "odtu", name: "Orta Doğu Teknik Üniversitesi", shortName: "ODTÜ", country: "TR", city: "Ankara", isPartner: true },
  { key: "kbtu", name: "Kazakh-British Technical University", shortName: "KBTU", country: "KZ", city: "Almaty", isPartner: true },
  { key: "tuit", name: "Tashkent University of Information Technologies", shortName: "TUIT", country: "UZ", city: "Tashkent", isPartner: true },
] as const;
// pilot is ASOIU-centred; partners contribute a minority of teams
const UNI_WEIGHTS: [string, number][] = [["asoiu", 62], ["bdu", 9], ["aztu", 9], ["ada", 6], ["itu", 5], ["odtu", 4], ["kbtu", 3], ["tuit", 2]];
function pickUni() { const total = UNI_WEIGHTS.reduce((a, [, w]) => a + w, 0); let r = rnd() * total; for (const [k, w] of UNI_WEIGHTS) { if ((r -= w) < 0) return k; } return "asoiu"; }

const COMPETITIONS = [
  { key: "tf_agri", name: "TEKNOFEST 2027 · Tarım Teknolojileri", organizer: "T3 Vakfı / TEKNOFEST", category: "agritech", country: "TR", deadline: 52, final: 290 },
  { key: "tf_health", name: "TEKNOFEST 2027 · Sağlıkta Yapay Zekâ", organizer: "T3 Vakfı / TEKNOFEST", category: "healthtech", country: "TR", deadline: 59, final: 290 },
  { key: "tf_edu", name: "TEKNOFEST 2027 · Eğitim Teknolojileri", organizer: "T3 Vakfı / TEKNOFEST", category: "edtech", country: "TR", deadline: 52, final: 290 },
  { key: "tf_human", name: "TEKNOFEST 2027 · İnsanlık Yararına Teknoloji", organizer: "T3 Vakfı / TEKNOFEST", category: "smartcity", country: "TR", deadline: 66, final: 290 },
  { key: "tf_transport", name: "TEKNOFEST 2027 · Akıllı Ulaşım", organizer: "T3 Vakfı / TEKNOFEST", category: "transport", country: "TR", deadline: 66, final: 290 },
  { key: "tf_cyber", name: "TEKNOFEST 2027 · Siber Güvenlik", organizer: "T3 Vakfı / TEKNOFEST", category: "cybersecurity", country: "TR", deadline: 45, final: 290 },
  { key: "tf_robot", name: "TEKNOFEST 2027 · Robotaksi & Otonom Sistemler", organizer: "T3 Vakfı / TEKNOFEST", category: "robotics", country: "TR", deadline: 73, final: 290 },
  { key: "tf_uav", name: "TEKNOFEST 2027 · Savaşan / Uluslararası İHA", organizer: "T3 Vakfı / TEKNOFEST", category: "aerospace", country: "TR", deadline: 24, final: 290 },
  { key: "az_energy", name: "Green Energy Startup Challenge 2027", organizer: "Regional Innovation Network (demo)", category: "energy", country: "AZ", deadline: 38, final: 120 },
  { key: "az_fintech", name: "Caspian FinTech Hackathon 2027", organizer: "Fintech Community (demo)", category: "fintech", country: "AZ", deadline: 31, final: 95 },
  { key: "turk_demo", name: "TÜRK FORUM 2026 · Demo Day", organizer: "TÜRK FORUM", category: "ai", country: "AZ", deadline: 40, final: 46 },
] as const;
const COMP_BY_CAT: Record<string, string> = { agritech: "tf_agri", healthtech: "tf_health", edtech: "tf_edu", smartcity: "tf_human", transport: "tf_transport", cybersecurity: "tf_cyber", robotics: "tf_robot", aerospace: "tf_uav", energy: "az_energy", fintech: "az_fintech", ai: "turk_demo", environment: "tf_human" };

// Root = system owner (separate credentials from .env, never the demo password)
const ROOT = {
  email: (process.env.ROOT_EMAIL ?? "qadim.qadimov@turktech50.az").toLowerCase(),
  name: process.env.ROOT_NAME ?? "Qədim Qədimov",
  title: "Sistem administratoru (root) · Rəqəmsal MVP texniki rəhbəri",
};
const ADMINS = [
  { email: "koordinator@turktech50.az", name: "Aysel Sadıqova", title: "Proqram koordinatoru · layihə yürütücüsü" },
  { email: "ahmad.ahmadzada@turktech50.az", name: "Əhməd Əhmədzadə", title: "Strateji koordinasiya" },
  { email: "adila.habibova@turktech50.az", name: "Adilə Həbibova", title: "Sənədləşmə və müraciət paketi" },
  { email: "mehriban.mircafarova@turktech50.az", name: "Mehriban Mircəfərova", title: "Sənaye, Əqli mülkiyyət və kommersiyalaşma" },
];
const MENTORS = [
  { email: "elvin.quliyev@mentor.turktech50.az", name: "Elvin Quliyev", title: "Məhsul meneceri · IoT", expertise: "Product,MVP,IoT" },
  { email: "nigar.rzayeva@mentor.turktech50.az", name: "Nigar Rzayeva", title: "UX tədqiqatçısı", expertise: "User research,Validation" },
  { email: "kamran.nacafov@mentor.turktech50.az", name: "Kamran Nəcəfov", title: "Əməliyyat və biznes planı", expertise: "Operations,Business model" },
  { email: "fuad.huseynov@mentor.turktech50.az", name: "Fuad Hüseynov", title: "Embedded sistemlər mühəndisi", expertise: "Embedded,Hardware,BOM" },
  { email: "lala.abbasova@mentor.turktech50.az", name: "Lalə Abbasova", title: "ML mühəndisi", expertise: "AI,Computer vision" },
  { email: "orxan.mammadov@mentor.turktech50.az", name: "Orxan Məmmədov", title: "TTO məsləhətçisi · Əqli mülkiyyət", expertise: "IP,Patents,Licensing" },
  { email: "zeynep.arslan@mentor.turktech50.az", name: "Zeynep Arslan", title: "Girişim danışmanı (İTÜ Çekirdek)", expertise: "Startup,Pitch" },
  { email: "emre.yildiz@mentor.turktech50.az", name: "Emre Yıldız", title: "Robotik ar-ge mühendisi", expertise: "Robotics,Autonomy" },
  { email: "aidana.bekova@mentor.turktech50.az", name: "Aidana Bekova", title: "Energy systems researcher", expertise: "Energy,Solar" },
  { email: "tural.safarov@mentor.turktech50.az", name: "Tural Səfərov", title: "Kibertəhlükəsizlik mütəxəssisi", expertise: "Security,Networks" },
  { email: "gunel.ismayilova@mentor.turktech50.az", name: "Günel İsmayılova", title: "Pitch və təqdimat kouçu", expertise: "Pitch,Storytelling" },
  { email: "rauf.babayev@mentor.turktech50.az", name: "Rauf Babayev", title: "Prototipləmə laboratoriyası rəhbəri", expertise: "Prototyping,3D printing,BOM" },
];
const JURY = [
  { email: "sebine.kerimova@jury.turktech50.az", name: "Prof. Səbinə Kərimova", title: "Professor · Kompüter mühəndisliyi" },
  { email: "mehmet.kaya@jury.turktech50.az", name: "Doç. Dr. Mehmet Kaya", title: "Elektrik-Elektronik Müh." },
  { email: "ramin.aliyev@jury.turktech50.az", name: "Dr. Ramin Əliyev", title: "Sənaye eksperti · enerji" },
  { email: "ayse.demir@jury.turktech50.az", name: "Dr. Ayşe Demir", title: "Teknoloji transfer uzmanı" },
  { email: "nurlan.seitkali@jury.turktech50.az", name: "Dr. Nurlan Seitkali", title: "Venture partner" },
  { email: "konul.rahimova@jury.turktech50.az", name: "Dr. Könül Rəhimova", title: "Biotibb mühəndisliyi" },
];

type Showcase = {
  code: string; title: string; tagline: string; summary: string; category: string; uni: string; stage: ProjectStage; health: ProjectHealth;
  lead: { name: string; email: string }; members: number; mentors: string[]; jurors: string[];
  prototypeVerified: boolean; packageQcPassed: boolean; submitted?: boolean; readinessApproved: number; // approved required items
};
const SHOWCASE: Showcase[] = [
  { code: "T50-001", title: "AgroSense", tagline: "Kiçik fermerlər üçün ağıllı suvarma sensor şəbəkəsi", summary: "Torpaq nəmliyi və hava proqnozuna əsaslanan aşağı qiymətli LoRa sensorları ilə suvarma qərarlarını dəstəkləyən sistem. Pilot: Şamaxı rayonunda 3 fermer təsərrüfatı.", category: "agritech", uni: "asoiu", stage: "PROTOTYPE", health: "ON_TRACK", lead: { name: "Rəna Məmmədli", email: "rena.mammadli@student.asoiu.az" }, members: 5, mentors: ["elvin.quliyev@mentor.turktech50.az", "fuad.huseynov@mentor.turktech50.az"], jurors: ["sebine.kerimova@jury.turktech50.az", "ramin.aliyev@jury.turktech50.az", "mehmet.kaya@jury.turktech50.az"], prototypeVerified: false, packageQcPassed: false, readinessApproved: 4 },
  { code: "T50-002", title: "EduBridge", tagline: "Kənd məktəbləri üçün oflayn-ilk rəqəmsal təhsil platforması", summary: "Zəif internet bağlantısı olan məktəblərdə dərs materiallarını sinxronlaşdıran Raspberry Pi əsaslı lokal server və mobil tətbiq.", category: "edtech", uni: "asoiu", stage: "VALIDATION", health: "WATCH", lead: { name: "Murad Əliyev", email: "murad.aliyev@student.asoiu.az" }, members: 4, mentors: ["nigar.rzayeva@mentor.turktech50.az"], jurors: ["sebine.kerimova@jury.turktech50.az", "ayse.demir@jury.turktech50.az"], prototypeVerified: false, packageQcPassed: false, readinessApproved: 2 },
  { code: "T50-003", title: "MedRoute", tagline: "Təcili yardım üçün real vaxt marşrut və xəstəxana yükü optimizasiyası", summary: "Xəstəxanaların qəbul yükünü və yol vəziyyətini nəzərə alaraq təcili yardım briqadasına ən uyğun xəstəxananı tövsiyə edən qərar dəstək sistemi.", category: "healthtech", uni: "asoiu", stage: "MVP", health: "AT_RISK", lead: { name: "Leyla Həsənova", email: "leyla.hasanova@student.asoiu.az" }, members: 6, mentors: ["kamran.nacafov@mentor.turktech50.az", "lala.abbasova@mentor.turktech50.az"], jurors: ["sebine.kerimova@jury.turktech50.az", "konul.rahimova@jury.turktech50.az"], prototypeVerified: false, packageQcPassed: false, readinessApproved: 3 },
  { code: "T50-004", title: "SolarTwin", tagline: "Günəş panelləri üçün rəqəmsal əkiz və çirklənmə proqnozu", summary: "Panel performansını hava və toz məlumatları ilə müqayisə edərək təmizləmə vaxtını proqnozlaşdıran rəqəmsal əkiz modeli.", category: "energy", uni: "asoiu", stage: "MVP", health: "ON_TRACK", lead: { name: "Tural Bağırov", email: "tural.bagirov@student.asoiu.az" }, members: 4, mentors: ["elvin.quliyev@mentor.turktech50.az", "aidana.bekova@mentor.turktech50.az"], jurors: ["sebine.kerimova@jury.turktech50.az", "ramin.aliyev@jury.turktech50.az"], prototypeVerified: true, packageQcPassed: false, readinessApproved: 6 },
  { code: "T50-005", title: "CaspiGuard", tagline: "Kiçik bizneslər üçün anomaliya əsaslı şəbəkə təhlükəsizliyi", summary: "KOB-lar üçün sadə quraşdırılan, ML ilə anomaliya aşkarlayan və Azərbaycan dilində izah verən şəbəkə monitorinq qurğusu.", category: "cybersecurity", uni: "aztu", stage: "QA", health: "ON_TRACK", lead: { name: "Nicat Zeynalov", email: "nicat.zeynalov@student.aztu.az" }, members: 3, mentors: ["tural.safarov@mentor.turktech50.az"], jurors: ["sebine.kerimova@jury.turktech50.az", "mehmet.kaya@jury.turktech50.az", "nurlan.seitkali@jury.turktech50.az"], prototypeVerified: true, packageQcPassed: true, readinessApproved: 8 },
  { code: "T50-006", title: "RoboHarvest", tagline: "İstixana pomidorları üçün görüntü əsaslı yığım robotu", summary: "Kompüter görməsi ilə yetişmiş meyvəni aşkarlayan və yumşaq tutucu ilə yığan modul robot qolu.", category: "robotics", uni: "asoiu", stage: "PROTOTYPE", health: "WATCH", lead: { name: "Kənan Orucov", email: "kenan.orucov@student.asoiu.az" }, members: 5, mentors: ["elvin.quliyev@mentor.turktech50.az", "emre.yildiz@mentor.turktech50.az"], jurors: ["mehmet.kaya@jury.turktech50.az"], prototypeVerified: false, packageQcPassed: false, readinessApproved: 3 },
  { code: "T50-007", title: "BakuFlow", tagline: "Avtobus dayanacaqlarında sərnişin axınının anonim ölçülməsi", summary: "Kamerasız, Wi-Fi/BLE siqnallarına əsaslanan anonim sərnişin sayğacı və marşrut planlaması üçün açıq API.", category: "transport", uni: "bdu", stage: "MVP", health: "ON_TRACK", lead: { name: "Fidan Cəfərova", email: "fidan.cafarova@student.bsu.az" }, members: 4, mentors: ["kamran.nacafov@mentor.turktech50.az", "elvin.quliyev@mentor.turktech50.az"], jurors: ["sebine.kerimova@jury.turktech50.az", "ayse.demir@jury.turktech50.az"], prototypeVerified: true, packageQcPassed: false, readinessApproved: 5 },
  { code: "T50-008", title: "AeroScan", tagline: "Neft-qaz boru kəmərləri üçün dron əsaslı termal inspeksiya", summary: "Termal kamera və avtonom uçuş planı ilə boru kəməri sızmalarını erkən aşkarlayan dron sistemi. Müsabiqəyə müraciət göndərilib.", category: "aerospace", uni: "asoiu", stage: "SUBMITTED", health: "ON_TRACK", lead: { name: "Ramin Vəliyev", email: "ramin.valiyev@student.asoiu.az" }, members: 6, mentors: ["fuad.huseynov@mentor.turktech50.az", "rauf.babayev@mentor.turktech50.az"], jurors: ["mehmet.kaya@jury.turktech50.az", "ramin.aliyev@jury.turktech50.az", "nurlan.seitkali@jury.turktech50.az"], prototypeVerified: true, packageQcPassed: true, submitted: true, readinessApproved: 8 },
];

const GEN_PREFIX: Record<string, string[]> = {
  agritech: ["Aqro", "Tarla", "Yaşıl", "Bağ"], edtech: ["Edu", "Dərs", "Bilik", "Mekteb"], healthtech: ["Medi", "Şəfa", "Puls", "Vita"],
  energy: ["Energo", "Günəş", "Volt", "Külək"], smartcity: ["Şəhər", "Urban", "Smart", "Məhəllə"], ai: ["Neyro", "Zəka", "Kvant", "Data"],
  robotics: ["Robo", "Mexa", "Servo", "Kinetik"], aerospace: ["Aero", "Səma", "Orbit", "Uçuş"], cybersecurity: ["Kiber", "Qalxan", "Şifrə", "Seyf"],
  fintech: ["Fin", "Kassa", "Ödə", "Manat"], environment: ["Eko", "Təmiz", "Xəzər", "Hava"], transport: ["Trans", "Yol", "Marşrut", "Mobil"],
};
const GEN_SUFFIX = ["Sense", "Track", "Lab", "Net", "Bot", "Flow", "Scan", "Guard", "Mind", "Grid", "Link", "Path", "Cast", "Wise", "Dock", "Pulse", "Hub", "Eye", "Map", "Kit"];
const TAGLINES: Record<string, string[]> = {
  agritech: ["Torpaq sağlamlığı üçün aşağı qiymətli analiz dəsti", "Arıçılıq üçün pətək monitorinq sensoru", "Taxıl anbarlarında rütubət və temperatur nəzarəti"],
  edtech: ["Şagirdlər üçün adaptiv riyaziyyat məşq tətbiqi", "Laboratoriya dərsləri üçün virtual reallıq dəsti", "Müəllimlər üçün qiymətləndirmə köməkçisi"],
  healthtech: ["Diabet xəstələri üçün qidalanma izləmə tətbiqi", "Yaşlılar üçün yıxılma aşkarlama qolbağı", "Ambulator qəbul üçün növbə optimizasiyası"],
  energy: ["Binalarda enerji itkisini termal xəritə ilə tapmaq", "Kiçik külək turbinləri üçün idarəetmə modulu", "Ev batareyaları üçün ağıllı yükləmə planlayıcısı"],
  smartcity: ["Həyət zibil konteynerləri üçün doluluq sensoru", "Şəhər parkları üçün ağıllı işıqlandırma", "Görmə məhdudiyyətli insanlar üçün naviqasiya köməkçisi"],
  ai: ["Azərbaycan dilində nitqdən mətnə çevirmə modeli", "Sənaye avadanlığı üçün proqnozlaşdırıcı texniki xidmət", "Kənd təsərrüfatı şəkillərində xəstəlik aşkarlama"],
  robotics: ["Anbarlar üçün inventar sayan mobil robot", "Kənd təsərrüfatı üçün alaq otu təmizləyən robot", "Təhsil üçün açıq mənbəli robot qol dəsti"],
  aerospace: ["Kiçik peyk üçün enerji idarəetmə lövhəsi", "Meşə yanğınlarını erkən aşkarlayan dron", "Model raketlər üçün telemetriya sistemi"],
  cybersecurity: ["Universitet şəbəkələri üçün fişinq simulyatoru", "IoT cihazları üçün yüngül şifrələmə protokolu", "Açıq mənbəli zəiflik skaneri"],
  fintech: ["Kiçik bizneslər üçün QR ödəniş və uçot tətbiqi", "Tələbələr üçün maliyyə savadlılığı oyunu", "Mikro-kreditlər üçün alternativ skorinq"],
  environment: ["Xəzər sahilində plastik çirklənmə xəritəsi", "Hava keyfiyyəti üçün aşağı qiymətli sensor şəbəkəsi", "Su anbarlarında yosun artımının monitorinqi"],
  transport: ["Taksi parkları üçün yanacaq sərfiyyatı analizi", "Elektrik skuterlər üçün təhlükəsizlik modulu", "Yük daşımaları üçün marşrut optimizasiyası"],
};

const TASKS_BY_STAGE: Record<string, { title: string; crit: string }[]> = {
  VALIDATION: [
    { title: "İstifadəçi müsahibələrini aparmaq (min. 10)", crit: "Müsahibə qeydləri və əsas tapıntılar sənədləşdirilib" },
    { title: "Problem bəyanatını mentorla dəqiqləşdirmək", crit: "Bir cümləlik problem bəyanatı mentor tərəfindən təsdiqlənib" },
    { title: "Rəqib həllərin müqayisəli analizi", crit: "Ən azı 5 alternativ cədvəldə müqayisə edilib" },
    { title: "Yarışma kateqoriyasının şərtlərini yoxlamaq", crit: "Uyğunluq checklist-i doldurulub" },
  ],
  PROTOTYPE: [
    { title: "Texniki arxitektura sxemini hazırlamaq", crit: "Modullar, interfeyslər və məlumat axını diaqramda göstərilib" },
    { title: "BOM və prototip büdcəsini hesablamaq", crit: "Bütün komponentlər qiymət və təchizatçı ilə siyahıdadır" },
    { title: "Laboratoriya vaxtını rezerv etmək", crit: "Rezervasiya təqvimdə təsdiqlənib" },
    { title: "İlk prototipin yığılması", crit: "Əsas funksiya masa üstü testdə işləyir" },
    { title: "Test protokolunu yazmaq", crit: "Ölçülən göstəricilər və uğur meyarları müəyyən edilib" },
  ],
  MVP: [
    { title: "MVP demo axınını hazırlamaq", crit: "3 dəqiqəlik demo ssenarisi mentorla yoxlanılıb" },
    { title: "Sahə testi və test qeydləri", crit: "Ən azı 2 real mühitdə test aparılıb, nəticələr qeyd edilib" },
    { title: "Demo videosunu çəkmək", crit: "2 dəqiqədən qısa, səsli izahlı video yüklənib" },
    { title: "İstifadəçi rəyini toplamaq", crit: "Ən azı 5 istifadəçidən strukturlaşdırılmış rəy" },
  ],
  QA: [
    { title: "Layihə formasını şablona uyğun tamamlamaq", crit: "Şablondakı bütün bölmələr doldurulub" },
    { title: "Büdcə cədvəlini yoxlamaq", crit: "Cəmlər və natura töhfələri uyğunlaşdırılıb" },
    { title: "Pitch məşqi və sual-cavab", crit: "Münsif sualları siyahısına cavablar hazırlanıb" },
    { title: "Portal sənəd yoxlaması", crit: "Fayl adları, formatlar və ölçülər tələblərə uyğundur" },
  ],
  SUBMITTED: [
    { title: "Müraciət təsdiqini arxivləşdirmək", crit: "Portal təsdiqi və göndərilmiş fayllar saxlanılıb" },
    { title: "Final mərhələsi üçün hazırlıq planı", crit: "Nəticə elan olunarsa növbəti addımlar yazılıb" },
  ],
};
const SESSION_TOPICS = ["Məhsul və MVP", "İstifadəçi validasiyası", "Texniki arxitektura baxışı", "Büdcə və BOM", "Əqli mülkiyyət yoxlaması", "Pitch məşqi", "Test planı", "Biznes modeli"];
const NEXT_STEPS = [
  "Test nəticələrini cədvəldə ümumiləşdirmək", "İstifadəçi müsahibələrindən 3 əsas tapıntı çıxarmaq", "BOM-da bahalı komponent üçün alternativ tapmaq",
  "Arxitektura diaqramını yeniləmək", "Demo ssenarisini 3 dəqiqəyə endirmək", "Patent axtarışı üçün açar sözləri hazırlamaq", "Büdcəni 15% ehtiyatla yenidən hesablamaq",
];
const STAGES: ProjectStage[] = ["VALIDATION", "PROTOTYPE", "MVP", "QA", "SUBMITTED"];

async function wipe() {
  const tables = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`,
  );
  if (tables.length) await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  fs.rmSync(UPLOAD_DIR, { recursive: true, force: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

async function main() {
  console.log("Seeding TÜRKTECH 50 demo data…");
  await wipe();
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // universities
  const uni: Record<string, { id: string; country: string; shortName: string }> = {};
  for (const u of UNIVERSITIES) {
    const { key, ...data } = u;
    const row = await prisma.university.create({ data });
    uni[key] = { id: row.id, country: u.country, shortName: u.shortName };
  }
  // competitions
  const comp: Record<string, string> = {};
  for (const c of COMPETITIONS) {
    const row = await prisma.competition.create({
      data: { name: c.name, organizer: c.organizer, category: c.category, country: c.country, applicationDeadline: days(c.deadline, 23, 59), finalDate: days(c.final), url: c.key.startsWith("tf_") ? "https://www.teknofest.org" : null },
    });
    comp[c.key] = row.id;
  }
  // rubrics
  const rubric: Record<string, { id: string; criteria: { id: string; weight: number; maxScore: number }[] }> = {};
  for (const kind of ["SELECTION", "MIDTERM", "FINAL"] as const) {
    const r = await prisma.rubric.create({ data: { kind, criteria: { create: RUBRICS[kind].map((c, i) => ({ key: c.key, weight: c.weight, maxScore: 5, order: i })) } }, include: { criteria: true } });
    rubric[kind] = { id: r.id, criteria: r.criteria.map((c) => ({ id: c.id, weight: c.weight, maxScore: c.maxScore })) };
  }

  // staff users
  const userByEmail: Record<string, string> = {};
  const asoiu = uni.asoiu!.id;
  const rootPassword = process.env.ROOT_PASSWORD;
  if (!rootPassword || rootPassword.length < 8) throw new Error("ROOT_PASSWORD must be set in .env (min 8 chars)");
  userByEmail[ROOT.email] = (await prisma.user.create({ data: { ...ROOT, isRoot: true, passwordHash: await bcrypt.hash(rootPassword, 12), role: "ADMIN", universityId: asoiu, lastLoginAt: days(-1) } })).id;
  for (const a of ADMINS) userByEmail[a.email] = (await prisma.user.create({ data: { ...a, passwordHash: hash, role: "ADMIN", universityId: asoiu, lastLoginAt: days(-1) } })).id;
  for (const m of MENTORS) userByEmail[m.email] = (await prisma.user.create({ data: { ...m, passwordHash: hash, role: "MENTOR", locale: m.email.includes("zeynep") || m.email.includes("emre") ? "tr" : m.email.includes("aidana") ? "en" : "az" } })).id;
  for (const j of JURY) userByEmail[j.email] = (await prisma.user.create({ data: { ...j, passwordHash: hash, role: "JURY", locale: j.email.includes("mehmet") || j.email.includes("ayse") ? "tr" : j.email.includes("nurlan") ? "en" : "az" } })).id;
  const adminId = userByEmail["koordinator@turktech50.az"]!;
  const mentorIds = MENTORS.map((m) => userByEmail[m.email]!);
  const juryIds = JURY.map((j) => userByEmail[j.email]!);
  const usedEmails = new Set(Object.keys(userByEmail));
  function uniqueEmail(name: string, uniKey: string) {
    const domain = uniKey === "asoiu" ? "student.asoiu.az" : uniKey === "bdu" ? "student.bsu.az" : `student.${uniKey}.edu`;
    let base = tr(name.replace(/^(Prof\.|Dr\.|Doç\.)\s*/g, "")); let e = `${base}@${domain}`; let i = 2;
    while (usedEmails.has(e)) e = `${base}${i++}@${domain}`;
    usedEmails.add(e); return e;
  }

  // ---------- applications (168) ----------
  const TOTAL_APPS = 168, ACCEPTED = 104, WAITLIST = 18, REJECTED = 36; // UNDER_REVIEW = 10
  type AppPlan = { status: ApplicationStatus; showcase?: Showcase; category: string; uniKey: string; title: string; tagline: string; teamName: string };
  const plans: AppPlan[] = [];
  const usedTitles = new Set(SHOWCASE.map((s) => s.title));
  const genTitle = (cat: string) => { for (;;) { const t = pick(GEN_PREFIX[cat]!) + pick(GEN_SUFFIX); if (!usedTitles.has(t)) { usedTitles.add(t); return t; } } };
  const cats = Object.keys(GEN_PREFIX);
  for (const s of SHOWCASE) plans.push({ status: "ACCEPTED", showcase: s, category: s.category, uniKey: s.uni, title: s.title, tagline: s.tagline, teamName: `${s.title} komandası` });
  while (plans.length < TOTAL_APPS) {
    const i = plans.length;
    const status: ApplicationStatus = i < ACCEPTED ? "ACCEPTED" : i < ACCEPTED + WAITLIST ? "WAITLIST" : i < ACCEPTED + WAITLIST + REJECTED ? "REJECTED" : "UNDER_REVIEW";
    const category = pick(cats); const t = genTitle(category);
    plans.push({ status, category, uniKey: pickUni(), title: t, tagline: pick(TAGLINES[category]!), teamName: `${t} Team` });
  }

  let appNo = 0, projNo = SHOWCASE.length;
  const projects: { id: string; code: string; title: string; stage: ProjectStage; health: ProjectHealth; memberIds: string[]; leadId: string; mentorIds: string[]; juryIds: string[]; showcase?: Showcase; category: string; readinessApproved: number }[] = [];
  const pendingForSebine: string[] = [];

  for (const p of plans) {
    appNo++;
    const u = uni[p.uniKey]!;
    const memberCount = p.showcase?.members ?? ri(3, 6);
    const contactName = p.showcase?.lead.name ?? nameFor(u.country);
    const submittedAt = new Date(days(-ri(40, 62)).getTime());
    const app = await prisma.application.create({
      data: {
        code: `APP-${String(appNo).padStart(4, "0")}`, teamName: p.teamName, projectTitle: p.title,
        problem: p.showcase?.summary ?? `${p.tagline}. Komanda problemi yerli istifadəçilərlə ilkin söhbətlər əsasında müəyyən edib.`,
        solution: p.showcase?.tagline ?? p.tagline, category: p.category, memberCount, contactName,
        contactEmail: p.showcase?.lead.email ?? uniqueEmail(contactName, p.uniKey), universityId: u.id,
        competitionId: comp[COMP_BY_CAT[p.category] ?? "turk_demo"] ?? null, status: p.status, submittedAt,
        decidedAt: ["ACCEPTED", "WAITLIST", "REJECTED"].includes(p.status) ? days(-ri(28, 33)) : null,
        decisionNote: p.status === "ACCEPTED" ? "Seçim jürisinin rubrik balları və komanda müsahibəsi əsasında qəbul edildi." : p.status === "WAITLIST" ? "Yer boşalarsa proqrama dəvət ediləcək." : p.status === "REJECTED" ? "Problem-həll uyğunluğu zəifdir; növbəti dövrə yenidən müraciət tövsiyə olunur." : null,
      },
    });

    // selection evaluations: 2 jurors per evaluated app; under-review: 1 submitted (some) or none
    const base = p.status === "ACCEPTED" ? 3.9 : p.status === "WAITLIST" ? 3.2 : 2.4;
    const evaluators = shuffle(juryIds).slice(0, 2);
    const nEval = p.status === "UNDER_REVIEW" ? (appNo % 3 === 0 ? 1 : 0) : 2;
    for (let k = 0; k < nEval; k++) {
      const evaluator = p.status === "UNDER_REVIEW" ? juryIds[1 + (appNo % 5)]! : evaluators[k]!;
      await prisma.evaluation.create({
        data: {
          rubricId: rubric.SELECTION!.id, evaluatorId: evaluator, applicationId: app.id, status: "SUBMITTED", submittedAt: days(-ri(30, 36)),
          comment: pick(["Problem aydın, hədəf istifadəçi yaxşı müəyyən edilib.", "Komanda tərkibi texniki tələblərə uyğundur.", "Həllin yeniliyi orta səviyyədədir; rəqib analizi gücləndirilməlidir.", "Prototip üçün real plan var, lakin büdcə optimistdir."]),
          scores: { create: rubric.SELECTION!.criteria.map((c) => ({ criterionId: c.id, score: Math.max(1, Math.min(5, Math.round(base + (rnd() - 0.5) * 1.6))) })) },
        },
      });
    }
    if (p.status === "UNDER_REVIEW") pendingForSebine.push(app.id);

    if (p.status !== "ACCEPTED") continue;

    // ---------- project ----------
    const s = p.showcase;
    const genStageRoll = rnd();
    const stage: ProjectStage = s?.stage ?? (genStageRoll < 0.3 ? "VALIDATION" : genStageRoll < 0.68 ? "PROTOTYPE" : genStageRoll < 0.9 ? "MVP" : genStageRoll < 0.97 ? "QA" : "SUBMITTED");
    const stageIdx = STAGES.indexOf(stage);
    const health: ProjectHealth = s?.health ?? (rnd() < 0.68 ? "ON_TRACK" : rnd() < 0.6 ? "WATCH" : "AT_RISK");
    const code = s?.code ?? `T50-${String(++projNo).padStart(3, "0")}`;
    const prototypeVerified = s?.prototypeVerified ?? (stageIdx >= 3 || (stage === "MVP" && rnd() < 0.55));
    const packageQcPassed = s?.packageQcPassed ?? (stage === "SUBMITTED" || (stage === "QA" && rnd() < 0.5));
    const project = await prisma.project.create({
      data: {
        code, title: p.title, tagline: p.tagline, summary: s?.summary ?? `${p.tagline}. Komanda 8 həftəlik inkubasiya çərçivəsində işlək prototip və yarışma müraciət paketi hazırlayır.`,
        category: p.category, universityId: u.id, competitionId: app.competitionId, stage, health, prototypeVerified, packageQcPassed,
        submittedAt: stage === "SUBMITTED" ? days(-ri(2, 6)) : null, createdAt: days(-27),
      },
    });
    await prisma.application.update({ where: { id: app.id }, data: { projectId: project.id } });

    // stage history
    for (let k = 1; k <= stageIdx; k++) {
      await prisma.stageChange.create({ data: { projectId: project.id, fromStage: STAGES[k - 1]!, toStage: STAGES[k]!, actorId: adminId, createdAt: days(-27 + k * 6), note: k === stageIdx ? "Mentor rəyi və mərhələ çıxışları yoxlanıldı." : null } });
    }

    // members
    const memberIds: string[] = [];
    const teamNames = new Set<string>([contactName]);
    for (let m = 0; m < memberCount; m++) {
      const isLead = m === 0;
      let name = contactName;
      if (!isLead) { do { name = nameFor(u.country); } while (teamNames.has(name)); teamNames.add(name); }
      const email = isLead && s ? s.lead.email : isLead ? app.contactEmail : uniqueEmail(name, p.uniKey);
      if (isLead && s) usedEmails.add(email);
      const user = await prisma.user.create({
        data: { email, name, passwordHash: hash, role: "TEAM", universityId: u.id, title: isLead ? "Komanda lideri" : null, locale: u.country === "TR" ? "tr" : u.country === "AZ" ? "az" : "en", lastLoginAt: rnd() < 0.7 ? days(-ri(0, 6)) : null },
      });
      memberIds.push(user.id);
      await prisma.projectMember.create({ data: { projectId: project.id, userId: user.id, isLead, teamRole: isLead ? "Team lead" : pick(["Hardware", "Software", "Data / ML", "Design", "Business", "Testing"]) } });
    }

    // mentors & jurors
    const pMentors = s ? s.mentors.map((e) => userByEmail[e]!) : shuffle(mentorIds).slice(0, ri(1, 2));
    for (const [i, mid] of pMentors.entries()) await prisma.mentorAssignment.create({ data: { projectId: project.id, mentorId: mid, focus: i === 0 ? "Technical" : pick(["Business", "IP", "Pitch"]) } });
    const pJury = s ? s.jurors.map((e) => userByEmail[e]!) : stageIdx >= 2 && rnd() < 0.5 ? shuffle(juryIds.slice(1)).slice(0, 2) : [];
    for (const jid of pJury) await prisma.juryAssignment.create({ data: { projectId: project.id, juryId: jid } });

    projects.push({ id: project.id, code, title: p.title, stage, health, memberIds, leadId: memberIds[0]!, mentorIds: pMentors, juryIds: pJury, showcase: s, category: p.category, readinessApproved: s?.readinessApproved ?? Math.min(8, stageIdx * 2 + ri(0, 2)) });
  }

  // ---------- per-project activity ----------
  const sampleStored = "sample-document.pdf";
  fs.writeFileSync(path.join(UPLOAD_DIR, sampleStored), makePdf("TURKTECH 50 - Demo document", ["Demo fayl. Real proqram materiali deyil.", "Demo file. Not a real program material."]));

  for (const pr of projects) {
    const stageIdx = STAGES.indexOf(pr.stage);
    const isShow = !!pr.showcase;

    // tasks: completed tasks from earlier stages + current stage tasks
    const taskRows: { title: string; crit: string; status: TaskStatus; due: Date; priority: Priority; week: number }[] = [];
    for (let k = 0; k <= stageIdx; k++) {
      const list = TASKS_BY_STAGE[STAGES[k]!]!;
      const subset = isShow ? list : list.slice(0, ri(2, list.length));
      subset.forEach((tk, i) => {
        const current = k === stageIdx;
        let status: TaskStatus = "DONE";
        if (current) {
          const roll = (i + (isShow ? 0 : ri(0, 2))) % 5;
          status = (["DONE", "IN_PROGRESS", "TODO", "REVIEW", "TODO"] as TaskStatus[])[roll]!;
          if (pr.health === "AT_RISK" && i === 1) status = "BLOCKED";
        }
        const due = status === "DONE" ? days(-ri(3, 25)) : days(pr.health === "AT_RISK" && i === 2 ? -ri(2, 5) : ri(-2, 14));
        taskRows.push({ title: tk.title, crit: tk.crit, status, due, priority: current && i < 2 ? "HIGH" : pick(["LOW", "MEDIUM", "MEDIUM"] as Priority[]), week: Math.min(8, k * 2 + 1 + (i % 2)) });
      });
    }
    // showcase specific extra tasks
    if (pr.showcase?.code === "T50-001") {
      taskRows.push({ title: "Mentor görüşü üçün gündəlik hazırlamaq", crit: "Suallar və irəliləyiş xülasəsi mentorla paylaşılıb", status: "TODO", due: days(1, 18), priority: "HIGH", week: 5 });
      taskRows.push({ title: "LoRa ötürmə məsafəsinin sahə testi", crit: "3 nöqtədə RSSI ölçülüb və cədvəlləşdirilib", status: "IN_PROGRESS", due: days(4, 18), priority: "HIGH", week: 5 });
    }
    if (pr.showcase?.code === "T50-003") {
      taskRows.push({ title: "Xəstəxana yük məlumatı üçün API razılaşması", crit: "Tərəfdaş xəstəxana ilə məlumat paylaşma protokolu imzalanıb", status: "BLOCKED", due: days(-3, 18), priority: "HIGH", week: 4 });
      taskRows.push({ title: "Yüksək risk üçün cavab planı yazmaq", crit: "Risk sahibi və yumşaltma addımı müəyyən edilib", status: "TODO", due: days(2, 18), priority: "HIGH", week: 5 });
    }
    for (const [i, tk] of taskRows.entries()) {
      const assignee = pr.memberIds[i % pr.memberIds.length]!;
      await prisma.task.create({
        data: {
          projectId: pr.id, title: tk.title, acceptanceCriteria: tk.crit, assigneeId: assignee, createdById: i % 3 === 0 ? pr.mentorIds[0] ?? adminId : pr.leadId,
          dueDate: tk.due, priority: tk.priority, status: tk.status, week: tk.week, completedAt: tk.status === "DONE" ? new Date(tk.due.getTime() - DAY) : null,
          createdAt: new Date(tk.due.getTime() - 9 * DAY),
        },
      });
    }

    // mentor sessions: biweekly past (completed) + upcoming
    const nPast = isShow ? 3 : ri(1, 2);
    for (let k = 0; k < nPast; k++) {
      const mentorId = pr.mentorIds[k % pr.mentorIds.length]!;
      const topic = SESSION_TOPICS[(k + stageIdx) % SESSION_TOPICS.length]!;
      const steps = shuffle(NEXT_STEPS).slice(0, 2);
      await prisma.mentorSession.create({
        data: {
          projectId: pr.id, mentorId, scheduledAt: days(-(k * 14 + ri(3, 6)), 14), durationMin: 45, topic, status: "COMPLETED", online: rnd() < 0.4,
          agenda: "Komanda həftəlik irəliləyişi və maneələri təqdim edəcək.",
          notes: pick(["Komanda irəliləyişi qənaətbəxşdir; test sübutlarını sistemli saxlamaq lazımdır.", "Texniki yanaşma düzgündür, lakin büdcə riskləri yenidən baxılmalıdır.", "İstifadəçi rəyi məhduddur; növbəti iki həftədə daha çox validasiya tövsiyə olunur."]),
          nextSteps: steps,
        },
      });
    }
    if (isShow || rnd() < 0.5) {
      const upcoming = pr.showcase?.code === "T50-001" ? days(1, 10, 30) : pr.showcase?.code === "T50-002" ? days(2, 14) : pr.showcase?.code === "T50-003" ? days(5, 11) : days(ri(1, 12), pick([10, 11, 14, 15, 16]));
      await prisma.mentorSession.create({
        data: { projectId: pr.id, mentorId: pr.mentorIds[0]!, scheduledAt: upcoming, durationMin: pr.showcase?.code === "T50-001" ? 60 : 45, topic: pr.showcase?.code === "T50-001" ? "MVP yoxlama görüşü" : pick(SESSION_TOPICS), status: rnd() < 0.6 ? "CONFIRMED" : "PLANNED", online: rnd() < 0.3, agenda: pr.showcase?.code === "T50-001" ? "Sahə testinin ilkin nəticələri, LoRa məsafəsi və növbəti sprint planı." : null },
      });
    }

    // checklist + documents
    let approvedLeft = pr.readinessApproved;
    for (const [i, item] of CHECKLIST_TEMPLATE.entries()) {
      let status: ChecklistStatus = "MISSING";
      if (item.required) {
        if (approvedLeft > 0) { status = "APPROVED"; approvedLeft--; }
        else if (stageIdx >= 1 && i % 3 === 0) status = "UPLOADED";
        else if (stageIdx >= 2 && i % 3 === 1) status = "IN_REVIEW";
        else if (pr.health === "AT_RISK" && i % 4 === 2) status = "REJECTED";
      } else if (item.category === "ANNEX" && stageIdx >= 2) status = "UPLOADED";
      const ci = await prisma.checklistItem.create({
        data: {
          projectId: pr.id, key: item.key, category: item.category, required: item.required, status, order: i,
          reviewerId: status === "APPROVED" || status === "REJECTED" ? (pr.mentorIds[0] ?? adminId) : null,
          reviewedAt: status === "APPROVED" || status === "REJECTED" ? days(-ri(1, 10)) : null,
          reviewerNote: status === "REJECTED" ? "Format şablona uyğun deyil; büdcə cəmləri yenidən yoxlanılmalıdır." : status === "APPROVED" ? "Tələblərə uyğundur." : null,
        },
      });
      if (status !== "MISSING") {
        let stored = sampleStored;
        const fileName = `${pr.code}_${item.key}.pdf`;
        if (isShow) {
          stored = `${pr.code}-${item.key}-v1.pdf`;
          fs.writeFileSync(path.join(UPLOAD_DIR, stored), makePdf(`${pr.title} - ${item.key}`, [`${pr.code} · ${pr.title}`, "TURKTECH 50 demo sened / demo document", `Version 1 · ${new Date().toISOString().slice(0, 10)}`]));
        }
        await prisma.document.create({
          data: { projectId: pr.id, checklistItemId: ci.id, fileName, storedName: stored, mimeType: "application/pdf", size: fs.statSync(path.join(UPLOAD_DIR, stored)).size, version: 1, confidential: item.key === "patent_info" || item.key === "technical_drawing", uploadedById: pr.memberIds[i % pr.memberIds.length], createdAt: days(-ri(2, 20)) },
        });
      }
    }

    // risks
    if (pr.showcase || pr.health !== "ON_TRACK") {
      const risks: { title: string; p: RiskLevel; i: RiskLevel; mit: string }[] =
        pr.showcase?.code === "T50-003"
          ? [
              { title: "Xəstəxana yük məlumatına giriş gecikir", p: "HIGH", i: "HIGH", mit: "Sintetik məlumatla demo axını hazırlamaq; ikinci tərəfdaş xəstəxana ilə görüş planlamaq." },
              { title: "Şəxsi sağlamlıq məlumatlarının məxfiliyi", p: "MEDIUM", i: "HIGH", mit: "Yalnız anonimləşdirilmiş və aqreqat məlumat istifadə etmək; giriş jurnalı." },
            ]
          : pr.showcase?.code === "T50-001"
            ? [{ title: "LoRa modullarının çatdırılması gecikə bilər", p: "MEDIUM", i: "MEDIUM", mit: "Yerli təchizatçıdan 2 ədəd ehtiyat modul almaq." }]
            : pr.showcase?.code === "T50-006"
              ? [{ title: "Yumşaq tutucu prototipi büdcəni aşır", p: "MEDIUM", i: "HIGH", mit: "3D çap ilə sadələşdirilmiş versiya; laboratoriya avadanlığından natura istifadə." }]
              : [{ title: pick(["Komponent qiymətləri gözləniləndən yüksəkdir", "Komanda üzvünün imtahan dövrü ilə üst-üstə düşmə", "Test mühitinə giriş məhduddur", "Yarışma şərtləri dəyişə bilər"]), p: pick(["MEDIUM", "HIGH"] as RiskLevel[]), i: pick(["MEDIUM", "HIGH"] as RiskLevel[]), mit: "Mentorla alternativ plan razılaşdırmaq və həftəlik izləmək." }];
      for (const r of risks) {
        await prisma.risk.create({ data: { projectId: pr.id, title: r.title, probability: r.p, impact: r.i, mitigation: r.mit, ownerId: pr.leadId, status: pr.health === "ON_TRACK" ? "MITIGATING" : "OPEN", reviewDate: days(ri(1, 10)) } });
      }
    }

    // audit trail (light for generated, richer for showcase)
    const auditN = isShow ? 10 : 2;
    for (let k = 0; k < auditN; k++) {
      const act = pick(["task.create", "task.status", "document.upload", "session.complete", "checklist.review", "risk.create"]);
      await prisma.auditLog.create({ data: { actorId: k % 3 === 0 ? pr.mentorIds[0] ?? adminId : pr.memberIds[k % pr.memberIds.length]!, action: act, entity: act.split(".")[0]!.replace(/^./, (c) => c.toUpperCase()), entityId: pr.id, projectId: pr.id, summary: pr.title, createdAt: new Date(Math.min(days(-ri(0, 20), ri(9, 19), ri(0, 59)).getTime(), NOW.getTime() - ri(5, 600) * 60000)) } });
    }
  }

  // ---------- midterm evaluations (early technical review) ----------
  const byCode = Object.fromEntries(projects.map((p) => [p.code, p]));
  const midterm = rubric.MIDTERM!;
  async function midtermEval(code: string, juryEmail: string, base: number, status: "SUBMITTED" | "DRAFT", comment: string, rec: string) {
    const pr = byCode[code]!;
    await prisma.evaluation.create({
      data: {
        rubricId: midterm.id, evaluatorId: userByEmail[juryEmail]!, projectId: pr.id, status, submittedAt: status === "SUBMITTED" ? days(-ri(1, 4)) : null, comment, recommendation: rec,
        scores: { create: midterm.criteria.map((c, i) => ({ criterionId: c.id, score: Math.max(1, Math.min(5, Math.round(base + ((i % 3) - 1) * 0.6))) })) },
      },
    });
  }
  await midtermEval("T50-005", "mehmet.kaya@jury.turktech50.az", 4.4, "SUBMITTED", "Anomaliya modeli real trafik üzərində sınaqdan keçirilib; izahlılıq modulu güclü tərəfdir.", "Kommersiya pilotu üçün 2 KOB ilə niyyət məktubu almaq.");
  await midtermEval("T50-005", "nurlan.seitkali@jury.turktech50.az", 4.0, "SUBMITTED", "Strong technical depth. Pricing model still unclear.", "Prepare a simple unit-economics slide.");
  await midtermEval("T50-005", "sebine.kerimova@jury.turktech50.az", 4.2, "SUBMITTED", "Arxitektura sənədləri tamdır, test sübutu inandırıcıdır.", "Əqli mülkiyyət yoxlamasını TTO ilə tamamlamaq.");
  await midtermEval("T50-008", "mehmet.kaya@jury.turktech50.az", 4.6, "SUBMITTED", "Termal analiz ve uçuş planlama başarılı; saha testi kanıtları yeterli.", "Final için canlı demo riskine karşı kayıtlı video hazırlayın.");
  await midtermEval("T50-008", "ramin.aliyev@jury.turktech50.az", 4.3, "SUBMITTED", "Sənaye tərəfdaşı üçün aydın dəyər təklifi var.", "Boru kəməri operatoru ilə pilot razılaşmasını sənədləşdirmək.");
  await midtermEval("T50-001", "ramin.aliyev@jury.turktech50.az", 3.6, "SUBMITTED", "Sensor prototipi işləyir, lakin sahə testləri hələ azdır.", "Ara münsifədək ən azı 2 təsərrüfatda test nəticəsi göstərmək.");
  await midtermEval("T50-004", "sebine.kerimova@jury.turktech50.az", 3.8, "DRAFT", "Rəqəmsal əkiz modeli maraqlıdır;", "");

  // demo jury also has pending selection reviews
  console.log(`  pending selection reviews: ${pendingForSebine.length}`);

  // ---------- program-level risks (proposal section 11) ----------
  const programRisks: { title: string; p: RiskLevel; i: RiskLevel; mit: string; owner: string }[] = [
    { title: "Mentor və laboratoriya tutumunun məhdud qalması", p: "MEDIUM", i: "HIGH", mit: "Mentor hovuzunu erkən təsdiqləmək; komandaları mövzular üzrə qruplaşdırıb ortaq sessiyalar; laboratoriya rezervasiya təqvimi.", owner: "koordinator@turktech50.az" },
    { title: "Prototip xərclərinin gözləniləndən yüksək olması", p: "MEDIUM", i: "MEDIUM", mit: "Erkən BOM baxışı; kiçik doğrulama prototipi; universitet avadanlığından natura istifadə.", owner: "ahmad.ahmadzada@turktech50.az" },
    { title: "Xarici yarışma təqvimi və ya qaydalarının dəyişməsi", p: "LOW", i: "HIGH", mit: "Bir neçə yarışma seçimi; təqvim izləyicisi; nəzarət edilə bilən çıxışlarla (test edilmiş prototip) birgə izləmə.", owner: "mehriban.mircafarova@turktech50.az" },
    { title: "Rəqəmsal platformada şəxsi və ya gizli məlumatın açılması", p: "LOW", i: "HIGH", mit: "Minimum məlumat; rol əsaslı giriş; ehtiyat nüsxə; ticari sirr və patentləşdirilə bilən məzmunu açıq pitch materialından ayırmaq.", owner: ROOT.email },
    { title: "Türk Dünyası tərəfdaşlıqlarının vaxtında qurulmaması", p: "MEDIUM", i: "MEDIUM", mit: "İlk dövrü ADNSU mərkəzli aparmaq; onlayn iştirak; tərəfdaşlıqları mərhələli genişləndirmək.", owner: "ahmad.ahmadzada@turktech50.az" },
    { title: "MVP-də texniki inteqrasiya gecikə bilər", p: "MEDIUM", i: "HIGH", mit: "İnteqrasiya sınağını erkən mərhələyə çəkmək və alternativ demo axını hazırlamaq.", owner: ROOT.email },
  ];
  for (const r of programRisks) await prisma.risk.create({ data: { projectId: null, title: r.title, probability: r.p, impact: r.i, mitigation: r.mit, ownerId: userByEmail[r.owner]!, status: "MITIGATING", reviewDate: days(ri(2, 12)) } });

  // ---------- notifications for demo users ----------
  const rena = byCode["T50-001"]!.leadId;
  const elvin = userByEmail["elvin.quliyev@mentor.turktech50.az"]!;
  const sebine = userByEmail["sebine.kerimova@jury.turktech50.az"]!;
  const p1 = byCode["T50-001"]!.id, p3 = byCode["T50-003"]!.id;
  await prisma.notification.createMany({
    data: [
      { userId: rena, type: "session_planned", params: { topic: "MVP yoxlama görüşü" }, href: `/projects/${p1}/sessions`, createdAt: days(-1, 9) },
      { userId: rena, type: "document_reviewed", params: { title: "Büdcə planı", status: "✓" }, href: `/projects/${p1}/documents`, createdAt: days(-2, 16) },
      { userId: rena, type: "task_assigned", params: { title: "Mentor görüşü üçün gündəlik hazırlamaq" }, href: `/projects/${p1}/tasks`, createdAt: days(0, 8) },
      { userId: elvin, type: "document_uploaded", params: { title: "AgroSense · Test sübutu" }, href: `/projects/${p1}/documents`, createdAt: days(0, 9) },
      { userId: elvin, type: "task_done", params: { title: "Texniki arxitektura sxemini hazırlamaq" }, href: `/projects/${p1}/tasks`, createdAt: days(-1, 17) },
      { userId: sebine, type: "assigned_project", params: { project: "MedRoute" }, href: `/projects/${p3}`, createdAt: days(-2, 11) },
      { userId: sebine, type: "assigned_project", params: { project: "AgroSense" }, href: `/projects/${p1}`, createdAt: days(-2, 11) },
      { userId: adminId, type: "risk_high", params: { title: "Xəstəxana yük məlumatına giriş gecikir" }, href: `/projects/${p3}/risks`, createdAt: days(-1, 12) },
      { userId: adminId, type: "evaluation_submitted", params: { project: "CaspiGuard" }, href: `/projects/${byCode["T50-005"]!.id}/evaluations`, createdAt: days(-1, 15) },
    ],
  });

  const counts = await Promise.all([prisma.user.count(), prisma.application.count(), prisma.project.count(), prisma.task.count(), prisma.mentorSession.count(), prisma.document.count(), prisma.risk.count(), prisma.evaluation.count()]);
  console.log(`  users=${counts[0]} applications=${counts[1]} projects=${counts[2]} tasks=${counts[3]} sessions=${counts[4]} documents=${counts[5]} risks=${counts[6]} evaluations=${counts[7]}`);
  console.log(`Done. Demo password for all accounts: ${DEMO_PASSWORD}`);
  console.log(`Root account: ${ROOT.email} (password from ROOT_PASSWORD in .env)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
