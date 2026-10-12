// Guion técnico: disposición de 1920×1080, textos en pantalla y duración de cada tramo.
// Con fundidos de 0,5 s, la suma de duraciones menos los fundidos da 60 s.
const fps = 30;
const crossfade = 0.5;
const introSeconds = 5.5;
const outroSeconds = 5.5;

const layout = {
  window: { x: 584, y: 170, width: 1248, height: 780, bar: 40 },
  column: { x: 88, width: 440 },
};

const captions = {
  login: { eyebrow: "Ingreso", title: "Entrá con un código.", subtitle: "Sin contraseñas." },
  assistant: { eyebrow: "Asistente con IA", title: "Preguntale a tu negocio.", subtitle: "El asistente responde con tu información." },
  users: { eyebrow: "Usuarios", title: "Gestioná tu equipo." },
  roles: { eyebrow: "Roles y permisos", title: "Cada uno ve solo lo que le corresponde." },
  chat: { eyebrow: "WhatsApp", title: "Atendé a tus clientes por WhatsApp,", subtitle: "desde el mismo lugar." },
  appearance: { eyebrow: "Apariencia", title: "Con tu marca y tus colores." },
};

// Orden del video final. `scene` es la grabación de record.cjs; cada tramo de `parts` va de una marca a otra
// ("sent+1.6" admite desplazamiento) con su velocidad; lo que queda entre dos tramos se corta. compose.cjs ajusta
// todas las escenas con un mismo factor para que el total dé 60 s; las esperas van más rápido.
const segments = [
  { name: "intro" },
  // El ingreso corta del clic en Verificar (el cursor llega y aprieta: 0,6 s) al Inicio ya cargado: la redirección
  // del OIDC deja la página en blanco un instante.
  { name: "login", scene: "login", parts: [["start", "code", 1.2], ["code", "verify+0.6", 1.2], ["home", "end", 1]] },
  { name: "assistant", scene: "assistant", parts: [["start", "sent", 1.1], ["sent", "end", 1]] },
  { name: "users", scene: "users", parts: [["start", "end", 1.12]] },
  { name: "roles", scene: "roles", parts: [["start", "end", 1.12]] },
  { name: "chat", scene: "chat", parts: [["start", "sent", 1.15], ["sent", "sent+1.6", 1], ["sent+1.6", "reply-0.5", 3.5], ["reply-0.5", "end", 1]] },
  { name: "appearance", scene: "appearance", parts: [["start", "saved", 1.15], ["saved", "saved+3.2", 1]] },
  { name: "outro" },
];

module.exports = { fps, crossfade, introSeconds, outroSeconds, layout, captions, segments };
