// Render docs/diagrams/*.svg to 2x PNG with headless Chromium (puppeteer-core).
// Fonts: the SVGs ask for Inter; to embed the real Inter glyphs (incl. ə ı ğ ş) we render inside a page of the running
// app (next/font serves Inter), e.g. T50_FONT_ORIGIN=http://127.0.0.1:3051/login. Without it, a system sans-serif is used.
//   PUPPETEER_CORE=/path/to/puppeteer-core CHROME=/path/to/chrome [CHROME_LIBS=/path/libpath.txt] node docs/diagrams/render-png.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const coreDir = process.env.PUPPETEER_CORE || "/home/hermes/.hermes/tools/shotkit/node_modules/puppeteer-core";
const pkg = JSON.parse(fs.readFileSync(path.join(coreDir, "package.json"), "utf8"));
const entry = typeof pkg.main === "string" ? pkg.main : "lib/cjs/puppeteer/puppeteer-core.js";
const puppeteer = (await import(pathToFileURL(path.join(coreDir, entry)).href)).default;
const libs = process.env.CHROME_LIBS || "/home/hermes/.hermes/tools/chrome-libs/libpath.txt";
if (fs.existsSync(libs)) process.env.LD_LIBRARY_PATH = fs.readFileSync(libs, "utf8").trim();
const DIR = path.dirname(fileURLToPath(import.meta.url));
const ORIGIN = process.env.T50_FONT_ORIGIN || "http://127.0.0.1:3051/login";

(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || "/home/hermes/.hermes/tools/chromium-1208/chrome-linux64/chrome", headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  const p = await b.newPage();
  let fontOk = false;
  try {
    await p.goto(ORIGIN, { waitUntil: "networkidle2", timeout: 30000 });
    fontOk = await p.evaluate(() => [...document.fonts].some((f) => /inter/i.test(f.family)));
  } catch { /* fall back to system fonts */ }
  console.log(fontOk ? "using Inter from " + ORIGIN : "Inter not available — system sans-serif");
  const fam = fontOk ? await p.evaluate(() => [...document.fonts].find((f) => /inter/i.test(f.family)).family.replace(/["']/g, "")) : null;
  for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".svg")).sort()) {
    let s = fs.readFileSync(path.join(DIR, f), "utf8").replace(/^<\?xml[^>]*>\s*/, "");
    if (fam) s = s.replace(/font-family="Inter,/, `font-family="'${fam}', Inter,`);
    const w = Number(s.match(/width="(\d+)"/)[1]), h = Number(s.match(/height="(\d+)"/)[1]);
    await p.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
    await p.evaluate((markup) => {
      document.documentElement.className = "";
      document.body.style.margin = "0";
      document.body.innerHTML = `<div id="wrap" style="position:fixed;left:0;top:0;z-index:99999;background:#fff;line-height:0">${markup}</div>`;
    }, s);
    await p.evaluate(async () => { await document.fonts.ready; });
    await new Promise((r) => setTimeout(r, 300));
    const el = await p.$("#wrap svg");
    const out = path.join(DIR, f.replace(/\.svg$/, ".png"));
    await el.screenshot({ path: out });
    console.log(out, `${w * 2}x${h * 2}`);
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
