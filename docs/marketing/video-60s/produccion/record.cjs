// Graba cada escena de la app real (servida por `aspire run`) con datos ficticios. Uso:
//   node record.cjs [escena,escena,...]   (con `aspire run` levantado; WORK cambia la carpeta de trabajo)
// Deja un .webm por escena y un .json con las marcas de tiempo (segundos desde que arranca el video).
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");
const FRONT = process.env.FRONT ?? path.resolve(__dirname, "../../../..");
const { chromium } = require(`${FRONT}/node_modules/@playwright/test`);
const { installMarketingRoutes } = require("./fixtures.cjs");

const origin = process.env.ORIGIN ?? "https://localhost:5173";
const size = { width: 1280, height: 800 };
const work = process.env.WORK ?? path.join(os.tmpdir(), "arquitecturabase-video");
const out = path.join(work, "raw");
fs.mkdirSync(out, { recursive: true });
const session = screen => `/src/test/visual/session.html?screen=${encodeURIComponent(screen)}`;

// Cursor visible: Playwright no graba el puntero del sistema. Sigue los eventos del mouse y marca cada clic.
const cursorScript = () => {
  const install = () => {
    if (document.getElementById("mk-cursor")) return;
    const style = document.createElement("style");
    style.textContent = `
      #mk-cursor { position: fixed; left: 0; top: 0; width: 26px; height: 26px; z-index: 2147483647; pointer-events: none;
        transform: translate(var(--x, -100px), var(--y, -100px)); filter: drop-shadow(0 2px 3px rgba(0,0,0,.35)); }
      .mk-ripple { position: fixed; z-index: 2147483646; pointer-events: none; width: 34px; height: 34px; margin: -17px 0 0 -17px;
        border-radius: 50%; border: 3px solid rgba(40,90,61,.85); background: rgba(40,90,61,.18); animation: mk-ripple .55s ease-out forwards; }
      @keyframes mk-ripple { from { transform: scale(.3); opacity: 1; } to { transform: scale(1.35); opacity: 0; } }`;
    document.head.appendChild(style);
    const cursor = document.createElement("div");
    cursor.id = "mk-cursor";
    cursor.innerHTML = `<svg width="26" height="26" viewBox="0 0 26 26"><path d="M3 2 L3 21 L8.2 16.4 L11.6 24 L15 22.5 L11.7 15 L18.5 15 Z" fill="#fff" stroke="#1d1d1b" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
    document.body.appendChild(cursor);
    const place = (x, y) => { cursor.style.setProperty("--x", `${x - 3}px`); cursor.style.setProperty("--y", `${y - 2}px`); };
    const saved = JSON.parse(sessionStorage.getItem("mk-cursor") ?? "null");
    if (saved) place(saved.x, saved.y);
    document.addEventListener("mousemove", event => { place(event.clientX, event.clientY); sessionStorage.setItem("mk-cursor", JSON.stringify({ x: event.clientX, y: event.clientY })); }, true);
    document.addEventListener("mousedown", event => {
      const ripple = document.createElement("div");
      ripple.className = "mk-ripple";
      ripple.style.left = `${event.clientX}px`;
      ripple.style.top = `${event.clientY}px`;
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 700);
    }, true);
  };
  if (document.body) install(); else document.addEventListener("DOMContentLoaded", install);
};

function director(page, startedAt) {
  let x = size.width * 0.62, y = size.height * 0.55;
  const marks = {};
  const wait = ms => page.waitForTimeout(ms);
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  async function glide(tx, ty, duration = 520) {
    const steps = Math.max(8, Math.round(duration / 16));
    const fx = x, fy = y;
    for (let index = 1; index <= steps; index++) {
      const k = ease(index / steps);
      await page.mouse.move(fx + (tx - fx) * k, fy + (ty - fy) * k);
      await wait(duration / steps);
    }
    x = tx; y = ty;
  }
  async function point(locator, { dx = 0.5, dy = 0.5, duration } = {}) {
    await locator.waitFor({ state: "visible" });
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    await glide(box.x + box.width * dx, box.y + box.height * dy, duration);
  }
  async function click(locator, options = {}) {
    await point(locator, options);
    await wait(140);
    await page.mouse.down();
    await wait(70);
    await page.mouse.up();
    await wait(options.after ?? 260);
  }
  async function type(text, delay = 55, chunk = 1) {
    const chars = [...text];
    for (let index = 0; index < chars.length; index += chunk) {
      const piece = chars.slice(index, index + chunk).join("");
      // Una tecla por vez donde el control escucha el teclado (código, número); de a varias en textos largos.
      if (chunk === 1) await page.keyboard.type(piece); else await page.keyboard.insertText(piece);
      await wait(delay + (piece.includes(" ") ? 20 : Math.random() * 25));
    }
  }
  // Marca el clic sin hacerlo: para controles nativos (selector de color) que abrirían un diálogo del sistema.
  async function tap(locator, options = {}) {
    await point(locator, options);
    await wait(120);
    await page.evaluate(([px, py]) => {
      const ripple = document.createElement("div");
      ripple.className = "mk-ripple";
      ripple.style.left = `${px}px`;
      ripple.style.top = `${py}px`;
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 700);
    }, [x, y]);
    await wait(options.after ?? 200);
  }
  async function scroll(deltaY, steps = 10) {
    for (let index = 0; index < steps; index++) {
      await page.mouse.wheel(0, deltaY / steps);
      await wait(28);
    }
  }
  const mark = name => { marks[name] = (Date.now() - startedAt) / 1000; };
  return { wait, glide, point, click, tap, scroll, type, mark, marks, place: async (px, py) => { x = px; y = py; await page.mouse.move(px, py); } };
}

const scenes = {
  // Escena 2: ingreso por WhatsApp hasta entrar al Inicio. Entrada real del SPA (main.tsx) con OIDC simulado.
  async login(page, d) {
    await page.goto(`${origin}/login`);
    await page.getByRole("button", { name: "WhatsApp", exact: true }).waitFor();
    await page.waitForTimeout(700);
    await d.place(900, 520);
    d.mark("start");
    await d.wait(300);
    await d.click(page.getByRole("button", { name: "WhatsApp", exact: true }), { duration: 420 });
    await d.click(page.getByRole("textbox", { name: "Número de WhatsApp" }), { duration: 420 });
    await d.type("11 5555-0123", 40);
    await d.wait(200);
    await d.click(page.getByRole("button", { name: "Enviar código" }), { after: 350, duration: 420 });
    await page.getByText("Revisá tu WhatsApp").waitFor();
    d.mark("code");
    await d.click(page.getByRole("textbox").first(), { after: 120 });
    await d.type("482913", 65);
    await d.wait(200);
    d.mark("verify");
    await d.click(page.getByRole("button", { name: "Verificar" }), { after: 100, duration: 420 });
    await page.getByRole("textbox", { name: "Tu pregunta" }).waitFor({ timeout: 15000 });
    d.mark("home");
    await d.wait(1500);
    d.mark("end");
  },

  // Escena 3: el asistente responde con la información del negocio y del equipo.
  async assistant(page, d) {
    await page.goto(`${origin}${session("/")}`);
    await page.getByRole("textbox", { name: "Tu pregunta" }).waitFor();
    await page.waitForTimeout(800);
    await d.place(980, 300);
    d.mark("start");
    await d.wait(400);
    await d.click(page.getByRole("textbox", { name: "Tu pregunta" }), { dx: 0.3 });
    await d.type("¿Quién atiende WhatsApp y qué horario tenemos el sábado?", 30, 2);
    await d.wait(250);
    await d.click(page.getByRole("button", { name: "Enviar" }), { after: 200 });
    d.mark("sent");
    await page.getByText("Atienden WhatsApp 3 personas", { exact: false }).waitFor({ timeout: 20000 });
    d.mark("answer");
    await d.wait(500);
    await d.glide(1000, 380, 600);
    await d.scroll(-900, 16);
    await d.wait(3000);
    d.mark("end");
  },

  // Escena 4: el equipo, filtrado por rol.
  async users(page, d) {
    await page.goto(`${origin}${session("/usuarios")}`);
    await page.getByRole("cell", { name: "Bruno Castro" }).waitFor();
    await page.waitForTimeout(800);
    await d.place(820, 420);
    d.mark("start");
    await d.wait(700);
    await d.click(page.getByRole("button", { name: "Filtrar por rol" }), { after: 500 });
    await d.click(page.getByRole("menuitem", { name: /Ventas/ }), { after: 700 });
    await page.keyboard.press("Escape").catch(() => {});
    d.mark("filtered");
    await d.glide(760, 420, 600);
    await d.wait(900);
    await d.click(page.getByRole("searchbox", { name: "Buscar por correo, nombre o número" }), { dx: 0.3 });
    await d.type("sof", 90);
    await d.wait(1500);
    d.mark("end");
  },

  // Escena 5: un rol con sus permisos agrupados.
  async roles(page, d) {
    await page.goto(`${origin}${session("/roles")}`);
    await page.getByText("Atención al cliente").first().waitFor();
    await page.waitForTimeout(800);
    await d.place(820, 300);
    d.mark("start");
    await d.wait(700);
    await d.click(page.getByRole("link", { name: "Atención al cliente" }).or(page.getByRole("button", { name: /Atención al cliente/ })).first(), { after: 600 });
    await page.getByRole("checkbox", { name: "Cambiar modo de atención" }).waitFor();
    d.mark("editor");
    await d.wait(500);
    await d.click(page.getByRole("checkbox", { name: "Cambiar modo de atención" }), { after: 700 });
    await d.click(page.getByRole("checkbox", { name: "Ver usuarios" }).or(page.getByRole("button", { name: /^Usuarios/ })).first(), { after: 700 });
    await d.glide(1180, 70, 800);
    await d.wait(1200);
    d.mark("end");
  },

  // Escena 6: responder un WhatsApp desde el sistema.
  async chat(page, d) {
    await page.goto(`${origin}${session("/whatsapp/chat")}`);
    await page.getByRole("button", { name: "Sofía Herrera" }).waitFor();
    await page.waitForTimeout(800);
    await d.place(760, 420);
    d.mark("start");
    await d.wait(500);
    await d.click(page.getByRole("button", { name: "Sofía Herrera" }), { after: 700 });
    const composer = page.getByRole("textbox").last();
    await d.click(composer, { dx: 0.3 });
    await d.type("¡Hola Sofía! Sí, el sábado a las 10 h tenemos lugar. ¿Te lo reservo?", 30, 3);
    await d.wait(200);
    await d.click(page.getByRole("button", { name: "Enviar", exact: true }), { after: 100, duration: 420 });
    d.mark("sent");
    await page.getByText("¡Sí, por favor! 🙌").last().waitFor({ timeout: 20000 });
    d.mark("reply");
    await d.wait(2200);
    d.mark("end");
  },

  // Escena 7: los colores de la marca.
  async appearance(page, d) {
    await page.goto(`${origin}${session("/configuracion/apariencia")}`);
    await page.getByRole("textbox", { name: "Botones y enlaces" }).waitFor();
    await page.waitForTimeout(800);
    await d.place(900, 300);
    d.mark("start");
    await d.wait(400);
    const palette = [["Botones y enlaces", "#b4532a"], ["Menú lateral", "#3a2a22"], ["Encabezados de secciones y tablas", "#f3e3d8"]];
    for (const [label, value] of palette) {
      const field = page.getByRole("textbox", { name: label });
      await d.tap(field, { dx: 0.5, after: 150, duration: 420 });
      await field.fill(value);
      await d.wait(500);
    }
    await d.click(page.getByRole("button", { name: "Guardar cambios" }), { after: 300 });
    d.mark("saved");
    await d.glide(640, 520, 900);
    await d.wait(2200);
    d.mark("end");
  },
};

(async () => {
  const names = (process.argv[2] ?? Object.keys(scenes).join(",")).split(",");
  const browser = await chromium.launch();
  for (const name of names) {
    // Screencast de Chromium a 2x, cuadro por cuadro: más nítido que el video de Playwright (VP8 a ~0,5 Mbps).
    const dir = path.join(out, name);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const context = await browser.newContext({
      viewport: size, deviceScaleFactor: 2, ignoreHTTPSErrors: true, locale: "es-AR", timezoneId: "America/Argentina/Buenos_Aires",
    });
    await context.addInitScript(cursorScript);
    const page = await context.newPage();
    const { unexpected } = await installMarketingRoutes(page, origin, { customerReply: "¡Sí, por favor! 🙌" });
    const cdp = await context.newCDPSession(page);
    const frames = [];
    let pending = Promise.resolve();
    cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
      const file = `${String(frames.length).padStart(5, "0")}.jpg`;
      frames.push({ file, t: metadata.timestamp });
      pending = pending.then(() => fs.promises.writeFile(path.join(dir, file), Buffer.from(data, "base64")));
      cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
    });
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: size.width * 2, maxHeight: size.height * 2, everyNthFrame: 1 });
    const startedAt = Date.now();
    const errors = [];
    page.on("pageerror", error => errors.push(String(error)));
    const d = director(page, startedAt);
    try {
      await scenes[name](page, d);
    } catch (error) {
      await page.screenshot({ path: path.join(out, `${name}-error.png`) });
      errors.push(`scene failed: ${error.message.split("\n")[0]}`);
    }
    const stoppedAt = Date.now() / 1000;
    await cdp.send("Page.stopScreencast").catch(() => {});
    await pending;
    await context.close();
    fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify({ startedAt: startedAt / 1000, stoppedAt, marks: d.marks, frames, unexpected, errors }, null, 2));
    console.log(name, JSON.stringify(d.marks), `frames: ${frames.length}`, unexpected.length ? `unexpected: ${unexpected.join(", ")}` : "", errors.join(" | "));
  }
  await browser.close();
})();
