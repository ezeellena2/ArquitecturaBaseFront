// Música original, sintetizada acá mismo (sin muestras ni pistas de terceros): 96 BPM, compás de 2,5 s.
// Apertura 0–5 s, desarrollo 5–55 s, acorde final a los 55 s. Uso: node music.cjs [salida.wav]
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const sr = 44100;
const seconds = 62;
const N = sr * seconds;
const beat = 60 / 96;
const bar = beat * 4;
const L = new Float32Array(N), R = new Float32Array(N);
const sendL = new Float32Array(N), sendR = new Float32Array(N);
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
let seed = 7;
const noise = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2147483648 - 1; };

const chords = {
  F: { pad: [53, 57, 60, 64], bass: 41, melody: [[0, 72, 1.5], [1.5, 69, 1], [2.5, 72, 0.5], [3, 76, 1]] },
  G: { pad: [55, 59, 62, 64], bass: 43, melody: [[0, 74, 1.5], [1.5, 71, 1], [2.5, 74, 0.5], [3, 79, 1]] },
  Em: { pad: [52, 55, 59, 62], bass: 40, melody: [[0, 71, 1.5], [1.5, 67, 1], [2.5, 71, 0.5], [3, 74, 1]] },
  Am: { pad: [57, 60, 64, 67], bass: 45, melody: [[0, 72, 1.5], [1.5, 76, 1], [2.5, 74, 0.5], [3, 72, 1]] },
  C: { pad: [48, 55, 59, 62, 64], bass: 36, melody: [] },
};
const progression = ["F", "G", "Em", "Am"];
const finalBar = 22; // 55 s
const chordAt = index => (index >= finalBar ? chords.C : chords[progression[index % 4]]);
const mainFrom = 2 * bar, mainTo = finalBar * bar;
const isMain = t => t >= mainFrom && t < mainTo;

function add(i, l, r, send = 0) {
  if (i < 0 || i >= N) return;
  L[i] += l; R[i] += r;
  if (send) { sendL[i] += l * send; sendR[i] += r * send; }
}

// Pad: onda diente de sierra suave (tabla de 10 armónicos), dos osciladores desafinados a los costados.
const table = new Float32Array(4096);
for (let i = 0; i < table.length; i++) {
  let v = 0;
  for (let h = 1; h <= 10; h++) v += Math.sin((2 * Math.PI * h * i) / table.length) / (h * (1 + h * 0.08));
  table[i] = v * 0.55;
}
const padL = new Float32Array(N), padR = new Float32Array(N);
for (let index = 0; index <= finalBar; index++) {
  const chord = chordAt(index);
  const start = index * bar;
  const length = index === finalBar ? seconds - start : bar + 0.45;
  const attack = index < 2 ? 1.2 : index === finalBar ? 0.05 : 0.12;
  const release = index === finalBar ? 4.5 : 0.45;
  for (const note of chord.pad) {
    const f = mtof(note);
    for (const [detune, side] of [[1.0035, 0], [0.9965, 1]]) {
      let phase = Math.random() * table.length;
      const step = (f * detune * table.length) / sr;
      const from = Math.floor(start * sr), to = Math.min(N, Math.floor((start + length) * sr));
      for (let i = from; i < to; i++) {
        const t = i / sr - start;
        const env = Math.min(1, t / attack) * (t > length - release ? Math.max(0, (length - t) / release) : 1);
        const v = table[Math.floor(phase) & 4095] * env * 0.07;
        phase += step;
        if (side === 0) { padL[i] += v; padR[i] += v * 0.35; } else { padR[i] += v; padL[i] += v * 0.35; }
      }
    }
  }
}
// Filtro pasabajos que se abre en la apertura, y bombeo con el bombo en el desarrollo.
let lpL = 0, lpR = 0;
for (let i = 0; i < N; i++) {
  const t = i / sr;
  const cutoff = t < mainFrom ? 500 + (2400 - 500) * (t / mainFrom) ** 1.5 : 2400;
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / sr);
  lpL += a * (padL[i] - lpL); lpR += a * (padR[i] - lpR);
  const sinceBeat = (t - mainFrom) % beat;
  const pump = isMain(t) ? 1 - 0.45 * Math.exp(-sinceBeat / 0.11) : 1;
  add(i, lpL * pump, lpR * pump, 0.3);
}

// Arpegio: tono de pulsación con tres armónicos y caída exponencial.
function pluck(time, note, gain, pan) {
  const f = mtof(note), from = Math.floor(time * sr), length = Math.floor(0.7 * sr);
  for (let k = 0; k < length; k++) {
    const t = k / sr;
    const env = Math.min(1, t / 0.003) * Math.exp(-t / 0.2);
    const v = env * (Math.sin(2 * Math.PI * f * t) + 0.45 * Math.exp(-t / 0.08) * Math.sin(4 * Math.PI * f * t) + 0.2 * Math.exp(-t / 0.05) * Math.sin(6 * Math.PI * f * t));
    add(from + k, v * gain * (1 - pan), v * gain * (1 + pan), 0.4);
  }
}
const pattern = [0, 2, 4, 2, 1, 3, 4, 3, 0, 2, 4, 2, 1, 3, 2, 1];
for (let index = 0; index < finalBar; index++) {
  const tones = [...chordAt(index).pad.map(note => note + 12), chordAt(index).pad[0] + 24];
  for (let step = 0; step < 16; step++) {
    const time = index * bar + (step * beat) / 4;
    const intro = index < 2 ? 0.55 + 0.45 * (time / mainFrom) : 1;
    pluck(time, tones[pattern[step]], (step % 4 === 0 ? 0.12 : 0.09) * intro, step % 2 ? 0.28 : -0.28);
  }
}

// Bajo: corcheas sobre la fundamental, con algo de saturación.
for (let index = 2; index < finalBar; index++) {
  const f = mtof(chordAt(index).bass);
  for (let eighth = 0; eighth < 8; eighth++) {
    const start = index * bar + (eighth * beat) / 2, from = Math.floor(start * sr), length = Math.floor((beat / 2) * sr);
    for (let k = 0; k < length; k++) {
      const t = k / sr;
      const env = Math.min(1, t / 0.006) * (0.55 + 0.45 * Math.exp(-t / 0.09)) * Math.min(1, (length - k) / (0.01 * sr));
      const v = Math.tanh(1.6 * (Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(4 * Math.PI * f * t))) * env * (eighth % 2 ? 0.14 : 0.09);
      add(from + k, v, v);
    }
  }
}

// Batería: bombo en negras, palmas en 2 y 4, platillos en contratiempo; crash al entrar y al cerrar.
function kick(time, gain) {
  const from = Math.floor(time * sr);
  let phase = 0;
  for (let k = 0; k < 0.45 * sr; k++) {
    const t = k / sr;
    phase += (2 * Math.PI * (46 + 100 * Math.exp(-t / 0.032))) / sr;
    const v = (Math.sin(phase) * Math.exp(-t / 0.26) + (k < 40 ? noise() * 0.3 * (1 - k / 40) : 0)) * gain;
    add(from + k, v, v);
  }
}
function clap(time, gain) {
  const from = Math.floor(time * sr);
  let lp = 0, prev = 0;
  for (let k = 0; k < 0.3 * sr; k++) {
    const t = k / sr;
    const burst = [0, 0.011, 0.022].reduce((sum, at) => sum + (t >= at ? Math.exp(-(t - at) / 0.007) : 0), 0) * (t < 0.03 ? 1 : 0) + Math.exp(-t / 0.12) * 0.6;
    const n = noise();
    const hp = n - prev; prev = n;
    lp += 0.35 * (hp - lp);
    add(from + k, lp * burst * gain * 0.9, lp * burst * gain, 0.35);
  }
}
function hat(time, gain, decay = 0.035) {
  const from = Math.floor(time * sr);
  let prev = 0;
  for (let k = 0; k < decay * 6 * sr; k++) {
    const n = noise();
    const v = (n - prev) * Math.exp(-k / sr / decay) * gain;
    prev = n;
    add(from + k, v * 0.8, v);
  }
}
function crash(time, gain) {
  const from = Math.floor(time * sr);
  let prev = 0;
  for (let k = 0; k < 2.4 * sr; k++) {
    const n = noise();
    const v = (n - prev) * Math.exp(-k / sr / 0.7) * gain;
    prev = n;
    add(from + k, v, v * 0.9, 0.5);
  }
}
for (let index = 2; index < finalBar; index++) {
  for (let b = 0; b < 4; b++) {
    const time = index * bar + b * beat;
    kick(time, 0.42);
    if (b % 2 === 1) clap(time, 0.22);
    hat(time + beat / 2, 0.045);
    if (index >= 10) { hat(time + beat / 4, 0.018, 0.02); hat(time + (3 * beat) / 4, 0.022, 0.02); }
  }
}
crash(mainFrom, 0.08);
crash(mainTo, 0.09);
kick(mainTo, 0.42);

// Barrido de ruido que sube hacia la entrada del desarrollo (2,5–5 s).
{
  let lp = 0;
  const from = Math.floor(bar * sr), to = Math.floor(mainFrom * sr);
  for (let i = from; i < to; i++) {
    const p = (i - from) / (to - from);
    const a = 1 - Math.exp((-2 * Math.PI * (300 + 7000 * p * p)) / sr);
    lp += a * (noise() - lp);
    add(i, lp * 0.1 * p * p, lp * 0.1 * p * p, 0.3);
  }
}

// Campana: melodía a partir del compás 10 (25 s).
function bell(time, note, length, gain) {
  const f = mtof(note), from = Math.floor(time * sr), samples = Math.floor((length + 1.2) * sr);
  for (let k = 0; k < samples; k++) {
    const t = k / sr;
    const env = Math.min(1, t / 0.004) * Math.exp(-t / 0.55);
    const v = env * (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.exp(-t / 0.2) * Math.sin(2 * Math.PI * f * 2.0 * t) + 0.12 * Math.exp(-t / 0.1) * Math.sin(2 * Math.PI * f * 3.01 * t)) * gain;
    add(from + k, v * 0.85, v, 0.5);
  }
}
for (let index = 10; index < finalBar; index++) for (const [at, note, length] of chordAt(index).melody) bell(index * bar + at * beat, note, length * beat, 0.13);
bell(mainTo, 76, 3, 0.14);
bell(mainTo + 0.02, 72, 3, 0.1);

// Reverberación tipo Schroeder sobre el envío.
function reverb(input, offset) {
  const out = new Float32Array(N);
  const combs = [1557, 1617, 1491, 1422, 1277, 1356].map(d => ({ buf: new Float32Array(d + offset), i: 0, store: 0 }));
  const allpasses = [556, 441].map(d => ({ buf: new Float32Array(d + offset), i: 0 }));
  for (let n = 0; n < N; n++) {
    let sum = 0;
    for (const c of combs) {
      const y = c.buf[c.i];
      c.store = y * 0.8 + c.store * 0.2;
      c.buf[c.i] = input[n] + c.store * 0.84;
      c.i = (c.i + 1) % c.buf.length;
      sum += y;
    }
    let y = sum / combs.length;
    for (const a of allpasses) {
      const b = a.buf[a.i];
      a.buf[a.i] = y + b * 0.5;
      y = b - y * 0.5;
      a.i = (a.i + 1) % a.buf.length;
    }
    out[n] = y;
  }
  return out;
}
const wetL = reverb(sendL, 0), wetR = reverb(sendR, 23);

// Mezcla final: reverberación, saturación suave, normalización y fundido de salida.
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / sr;
  const fade = t > 58 ? Math.max(0, 1 - (t - 58) / 2.5) : 1;
  L[i] = Math.tanh((L[i] + wetL[i] * 0.9) * 1.1) * fade;
  R[i] = Math.tanh((R[i] + wetR[i] * 0.9) * 1.1) * fade;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const gain = 0.89 / peak;
const data = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * gain)) * 32767), i * 4);
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * gain)) * 32767), i * 4 + 2);
}
const header = Buffer.alloc(44);
header.write("RIFF", 0); header.writeUInt32LE(36 + data.length, 4); header.write("WAVE", 8); header.write("fmt ", 12);
header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(2, 22); header.writeUInt32LE(sr, 24);
header.writeUInt32LE(sr * 4, 28); header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34); header.write("data", 36); header.writeUInt32LE(data.length, 40);
const target = process.argv[2] ?? path.join(process.env.WORK ?? path.join(os.tmpdir(), "arquitecturabase-video"), "music.wav");
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, Buffer.concat([header, data]));
console.log("music ready", target);
