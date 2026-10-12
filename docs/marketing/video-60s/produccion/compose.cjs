// Edición final con ffmpeg: clips de la app desde los cuadros del screencast, composición con fondo y textos,
// fundidos entre tramos y música. Uso: node compose.cjs salida.mp4
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const { fps, crossfade, layout, segments, introSeconds, outroSeconds } = require("./storyboard.cjs");

const work = process.env.WORK ?? path.join(os.tmpdir(), "arquitecturabase-video");
const raw = path.join(work, "raw");
const cards = path.join(work, "cards");
const build = path.join(work, "build");
fs.mkdirSync(build, { recursive: true });
const output = path.resolve(process.argv[2] ?? path.join(__dirname, "..", "arquitecturabase-60s.mp4"));
const total = 60;
const { window: win } = layout;
const ff = args => execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: "inherit" });
const x264 = ["-c:v", "libx264", "-preset", "medium", "-crf", "12", "-pix_fmt", "yuv420p", "-r", String(fps)];

// Una marca es un nombre ("sent") o un nombre con desplazamiento ("sent+1.6").
function at(marks, expression) {
  const [, name, sign, amount] = expression.match(/^(\w+)(?:([+-])([\d.]+))?$/);
  if (!(name in marks)) throw new Error(`Missing mark ${name}`);
  return marks[name] + (sign ? (sign === "+" ? 1 : -1) * Number(amount) : 0);
}

// Duración natural de una escena con las velocidades de sus tramos.
const scenes = segments.filter(segment => segment.scene).map(segment => {
  const take = JSON.parse(fs.readFileSync(path.join(raw, `${segment.scene}.json`), "utf8"));
  const parts = segment.parts.map(([from, to, speed]) => ({ from: at(take.marks, from), to: at(take.marks, to), speed }));
  return { ...segment, take, parts, natural: parts.reduce((sum, part) => sum + (part.to - part.from) / part.speed, 0) };
});
const sceneBudget = total + crossfade * (segments.length - 1) - introSeconds - outroSeconds;
const factor = scenes.reduce((sum, scene) => sum + scene.natural, 0) / sceneBudget;
console.log(`global speed factor ${factor.toFixed(3)}`);

// Clip de la app: cada cuadro dura hasta el siguiente, dividido por la velocidad del tramo en que cae.
function appClip(scene) {
  const { take } = scene;
  const frames = take.frames.map(frame => ({ ...frame, t: frame.t - take.startedAt }));
  const lines = [];
  let length = 0;
  for (const part of scene.parts) {
    const speed = part.speed * factor;
    let current = frames.filter(frame => frame.t <= part.from).at(-1) ?? frames[0];
    for (const next of frames.filter(frame => frame.t > part.from && frame.t < part.to).concat([{ t: part.to }])) {
      const seconds = (next.t - Math.max(current.t, part.from)) / speed;
      if (seconds > 0) {
        lines.push(`file '${path.join(raw, scene.scene, current.file).replace(/\\/g, "/")}'`, `duration ${seconds.toFixed(5)}`);
        length += seconds;
      }
      if (next.file) current = next;
    }
  }
  lines.push(lines.at(-2));
  const list = path.join(build, `${scene.name}.txt`);
  fs.writeFileSync(list, lines.join("\n"));
  const clip = path.join(build, `${scene.name}-app.mp4`);
  ff(["-f", "concat", "-safe", "0", "-i", list, "-vf", `fps=${fps},scale=${win.width}:${win.height}:flags=lanczos`, "-t", length.toFixed(3), ...x264, clip]);
  return { clip, length };
}

// Tramo compuesto: fondo con la ventana, la app con las esquinas de abajo redondeadas y el texto que entra.
function composeScene(scene) {
  const { clip, length } = appClip(scene);
  const out = path.join(build, `${scene.name}.mp4`);
  const filter = [
    `[1:v]pad=1920:1080:${win.x}:${win.y}:color=black,format=rgba[app]`,
    "[2:v]format=gray[mask]", "[app][mask]alphamerge[framed]", "[0:v][framed]overlay=0:0[base]",
    "[3:v]format=rgba,fade=t=in:st=0.3:d=0.6:alpha=1[caption]",
    "[base][caption]overlay=x=0:y='26*pow(1-min(1\\,max(0\\,(t-0.3)/0.6))\\,2)':eval=frame,format=yuv420p[v]",
  ].join(";");
  ff(["-loop", "1", "-framerate", String(fps), "-i", path.join(cards, "background.png"), "-i", clip,
    "-loop", "1", "-framerate", String(fps), "-i", path.join(cards, "mask.png"),
    "-loop", "1", "-framerate", String(fps), "-i", path.join(cards, `caption-${scene.name}.png`),
    "-filter_complex", filter, "-map", "[v]", "-t", length.toFixed(3), ...x264, out]);
  return { file: out, seconds: length };
}

function cardSegment(name) {
  const out = path.join(build, `${name}.mp4`);
  ff(["-framerate", String(fps), "-i", path.join(cards, name, "%04d.png"), ...x264, out]);
  return { file: out, seconds: fs.readdirSync(path.join(cards, name)).length / fps };
}

const pieces = segments.map(segment => (segment.scene ? composeScene(scenes.find(scene => scene.name === segment.name)) : cardSegment(segment.name)));
pieces.forEach((piece, index) => console.log(segments[index].name, piece.seconds.toFixed(2)));

// Fundidos encadenados y música normalizada.
const inputs = pieces.flatMap(piece => ["-i", piece.file]);
const chain = [];
let previous = "[0:v]", offset = 0;
for (let index = 1; index < pieces.length; index++) {
  offset += pieces[index - 1].seconds - crossfade;
  const label = index === pieces.length - 1 ? "[video]" : `[x${index}]`;
  chain.push(`${previous}[${index}:v]xfade=transition=fade:duration=${crossfade}:offset=${offset.toFixed(3)}${label}`);
  previous = label;
}
const music = pieces.length;
chain.push(`[${music}:a]atrim=0:${total},afade=t=in:d=0.2,afade=t=out:st=${total - 2.5}:d=2.5,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[audio]`);
ff([...inputs, "-i", path.join(work, "music.wav"), "-filter_complex", chain.join(";"), "-map", "[video]", "-map", "[audio]",
  "-t", String(total), "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(fps), "-profile:v", "high",
  "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", output]);
console.log("video ready", output);
