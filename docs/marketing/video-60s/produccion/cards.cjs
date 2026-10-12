// Placas del video (1920×1080): fondo con la ventana, máscara de la app, textos por escena y las animaciones de
// apertura y cierre, cuadro por cuadro. Colores Campo y Public Sans, los del front.
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");
const FRONT = process.env.FRONT ?? path.resolve(__dirname, "../../../..");
const { chromium } = require(`${FRONT}/node_modules/@playwright/test`);
const { layout, captions, fps, introSeconds, outroSeconds } = require("./storyboard.cjs");

const work = process.env.WORK ?? path.join(os.tmpdir(), "arquitecturabase-video");
const out = path.join(work, "cards");
fs.mkdirSync(out, { recursive: true });
const font = fs.readFileSync(`${FRONT}/node_modules/@fontsource-variable/public-sans/files/public-sans-latin-wght-normal.woff2`).toString("base64");
const { window: win } = layout;

const base = `
  @font-face { font-family: "Public Sans"; font-weight: 100 900; src: url(data:font/woff2;base64,${font}) format("woff2"); }
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 1920px; height: 1080px; overflow: hidden; font-family: "Public Sans", sans-serif; -webkit-font-smoothing: antialiased; }
  .stage { position: absolute; inset: 0; background: radial-gradient(1200px 800px at 80% 10%, #2e4a39 0%, rgba(46,74,57,0) 60%), linear-gradient(160deg, #24352b 0%, #1b2921 100%); overflow: hidden; }
  .fields { position: absolute; left: -10%; right: -10%; bottom: -40px; height: 360px; }
  .mark { display: grid; place-items: center; border-radius: 22px; background: #285a3d; box-shadow: 0 18px 40px rgba(0,0,0,.28), inset 0 0 0 1px rgba(255,255,255,.08); }
`;
const fields = `<svg class="fields" viewBox="0 0 2304 360" preserveAspectRatio="none">
  <path d="M0 210 C 380 120 760 250 1150 190 S 1900 110 2304 200 L2304 360 L0 360 Z" fill="#2c4636" opacity=".55"/>
  <path d="M0 270 C 420 200 820 300 1250 255 S 1950 200 2304 260 L2304 360 L0 360 Z" fill="#335240" opacity=".5"/>
  <path d="M0 320 C 500 280 900 340 1350 310 S 2000 290 2304 315 L2304 360 L0 360 Z" fill="#3b5d48" opacity=".45"/></svg>`;
const logo = size => `<div class="mark" style="width:${size}px;height:${size}px"><svg width="${size * 0.62}" height="${size * 0.62}" viewBox="0 0 48 48">
  <path class="l1" d="M24 9 L39 17 L24 25 L9 17 Z" fill="#fff"/>
  <path class="l2" d="M10.5 24.5 L24 31.5 L37.5 24.5" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>
  <path class="l3" d="M10.5 31.5 L24 38.5 L37.5 31.5" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;

const backgroundHtml = `<style>${base}
  .window { position: absolute; left: ${win.x}px; top: ${win.y - win.bar}px; width: ${win.width}px; height: ${win.height + win.bar}px; border-radius: 14px;
    background: #fff; box-shadow: 0 40px 90px rgba(0,0,0,.45), 0 8px 24px rgba(0,0,0,.25), 0 0 0 1px rgba(255,255,255,.06); overflow: hidden; }
  .bar { height: ${win.bar}px; background: #eef1ec; border-bottom: 1px solid #d9dfd6; display: flex; align-items: center; gap: 9px; padding: 0 18px; }
  .dot { width: 13px; height: 13px; border-radius: 50%; } .bar .title { margin: 0 auto; transform: translateX(-30px); display: flex; align-items: center; gap: 8px;
    font-size: 15px; font-weight: 550; color: #526258; letter-spacing: .01em; }
  .mini { width: 18px; height: 18px; border-radius: 5px; background: #285a3d; display: grid; place-items: center; }
</style><div class="stage">${fields}<div class="window"><div class="bar"><span class="dot" style="background:#e46a5e"></span><span class="dot" style="background:#e5b842"></span>
  <span class="dot" style="background:#5fb35c"></span><span class="title"><span class="mini"><svg width="12" height="12" viewBox="0 0 48 48"><path d="M24 9 L39 17 L24 25 L9 17 Z" fill="#fff"/>
  <path d="M10.5 26 L24 33 L37.5 26" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>ArquitecturaBase</span></div></div></div>`;

const maskHtml = `<style>${base} body { background: #000; } .hole { position: absolute; left: ${win.x}px; top: ${win.y}px; width: ${win.width}px; height: ${win.height}px;
  background: #fff; border-radius: 0 0 14px 14px; }</style><div class="hole"></div>`;

const captionHtml = ({ eyebrow, title, subtitle }) => `<style>${base}
  html, body { background: transparent; }
  .caption { position: absolute; left: ${layout.column.x}px; width: ${layout.column.width}px; top: 50%; transform: translateY(-50%); color: #fff; }
  .eyebrow { display: inline-flex; align-items: center; gap: 10px; font-size: 21px; font-weight: 650; letter-spacing: .08em; text-transform: uppercase; color: #a9d3b5; }
  .eyebrow::before { content: ""; width: 28px; height: 3px; border-radius: 2px; background: #a9d3b5; }
  h1 { margin-top: 22px; font-size: 58px; line-height: 1.08; font-weight: 700; letter-spacing: -.02em; text-wrap: balance; }
  p { margin-top: 22px; font-size: 29px; line-height: 1.32; font-weight: 450; color: #d3e3d7; text-wrap: pretty; }
</style><div class="caption"><div class="eyebrow">${eyebrow}</div><h1>${title}</h1>${subtitle ? `<p>${subtitle}</p>` : ""}</div>`;

const introHtml = `<style>${base}
  .center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 34px; padding-bottom: 60px; }
  .center .mark { animation: pop .9s cubic-bezier(.2,.9,.25,1.15) .15s both; }
  .l1 { animation: drop .6s cubic-bezier(.2,.8,.2,1) .45s both; } .l2 { animation: drop .6s cubic-bezier(.2,.8,.2,1) .6s both; } .l3 { animation: drop .6s cubic-bezier(.2,.8,.2,1) .75s both; }
  .word { font-size: 104px; font-weight: 750; letter-spacing: -.035em; color: #fff; animation: rise .9s cubic-bezier(.2,.8,.2,1) .9s both; }
  .word span { color: #a9d3b5; }
  .tag { font-size: 40px; font-weight: 450; color: #d3e3d7; animation: rise .9s cubic-bezier(.2,.8,.2,1) 1.35s both; }
  .fields { animation: fields 1.6s cubic-bezier(.2,.8,.2,1) 0s both; }
  .stage { animation: out .5s ease-in ${introSeconds - 0.5}s both; }
  @keyframes pop { from { transform: scale(.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  @keyframes drop { from { transform: translateY(-10px); opacity: 0; } to { transform: none; opacity: 1; } }
  @keyframes rise { from { transform: translateY(26px); opacity: 0; } to { transform: none; opacity: 1; } }
  @keyframes fields { from { transform: translateY(160px); } to { transform: none; } }
  @keyframes out { from { filter: none; } to { filter: none; } }
</style><div class="stage">${fields}<div class="center">${logo(150)}<div class="word">Arquitectura<span>Base</span></div><div class="tag">La base para tu próximo sistema.</div></div></div>`;

const outroHtml = `<style>${base}
  .center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 30px; padding-bottom: 70px; }
  .brand { display: flex; align-items: center; gap: 30px; animation: rise .8s cubic-bezier(.2,.8,.2,1) .1s both; }
  .word { font-size: 92px; font-weight: 750; letter-spacing: -.035em; color: #fff; } .word span { color: #a9d3b5; }
  .stack { display: flex; gap: 16px; animation: rise .8s cubic-bezier(.2,.8,.2,1) .55s both; }
  .chip { padding: 12px 22px; border-radius: 999px; border: 1.5px solid rgba(169,211,181,.45); color: #d3e3d7; font-size: 27px; font-weight: 550; background: rgba(255,255,255,.04); }
  .cta { margin-top: 18px; padding: 22px 46px; border-radius: 14px; background: #fff; color: #224d34; font-size: 36px; font-weight: 700; letter-spacing: -.01em;
    box-shadow: 0 20px 44px rgba(0,0,0,.3); animation: pop .8s cubic-bezier(.2,.9,.25,1.15) 1.1s both; }
  @keyframes rise { from { transform: translateY(26px); opacity: 0; } to { transform: none; opacity: 1; } }
  @keyframes pop { from { transform: scale(.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
</style><div class="stage">${fields}<div class="center"><div class="brand">${logo(116)}<div class="word">Arquitectura<span>Base</span></div></div>
  <div class="stack"><span class="chip">.NET 10</span><span class="chip">Aspire</span><span class="chip">PostgreSQL</span><span class="chip">React</span></div>
  <div class="cta">Pedí una demo</div></div></div>`;

async function frames(page, html, seconds, dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => document.getAnimations().forEach(animation => animation.pause()));
  const count = Math.round(seconds * fps);
  for (let index = 0; index < count; index++) {
    await page.evaluate(ms => document.getAnimations().forEach(animation => { animation.currentTime = ms; }), (index / fps) * 1000);
    await page.screenshot({ path: path.join(dir, `${String(index).padStart(4, "0")}.png`) });
  }
}

(async () => {
  const only = process.argv[2];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const still = async (name, html, transparent = false) => {
    await page.setContent(html);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(out, `${name}.png`), omitBackground: transparent });
  };
  if (!only || only === "stills") {
    await still("background", backgroundHtml);
    await still("mask", maskHtml);
    for (const [name, caption] of Object.entries(captions)) await still(`caption-${name}`, captionHtml(caption), true);
  }
  if (!only || only === "intro") await frames(page, introHtml, introSeconds, path.join(out, "intro"));
  if (!only || only === "outro") await frames(page, outroHtml, outroSeconds, path.join(out, "outro"));
  await browser.close();
  console.log("cards ready");
})();
