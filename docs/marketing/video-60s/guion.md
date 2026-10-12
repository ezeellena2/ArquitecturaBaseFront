# Video de 60 s: ArquitecturaBase para dueños de negocio

Pieza de marketing corta, en español rioplatense, con textos en pantalla y música original sintetizada.
Archivo final: [`arquitecturabase-60s.mp4`](arquitecturabase-60s.mp4) (1920×1080, 30 fps, H.264 + AAC, 60 s,
−15 LUFS). Producido el 2026-10-10.

## Guion

| # | Tiempo | Pantalla y acción | Texto en pantalla |
|---|---|---|---|
| 1 | 0:00–0:05 | Placa de apertura: la marca se arma y entra el nombre | «ArquitecturaBase. La base para tu próximo sistema.» |
| 2 | 0:05–0:13 | Ingreso: elige WhatsApp, escribe el número, recibe el código y entra al Inicio | Ingreso · «Entrá con un código. Sin contraseñas.» |
| 3 | 0:12–0:23 | Inicio: pregunta al asistente quién atiende WhatsApp y el horario del sábado; responde con fuentes verificadas | Asistente con IA · «Preguntale a tu negocio. El asistente responde con tu información.» |
| 4 | 0:22–0:30 | Usuarios: filtra por el rol Ventas y busca una persona | Usuarios · «Gestioná tu equipo.» |
| 5 | 0:30–0:38 | Roles y permisos: abre Atención al cliente y marca permisos por área | Roles y permisos · «Cada uno ve solo lo que le corresponde.» |
| 6 | 0:37–0:47 | Chat de WhatsApp: responde a una clienta; el mensaje queda leído y llega la respuesta | WhatsApp · «Atendé a tus clientes por WhatsApp, desde el mismo lugar.» |
| 7 | 0:47–0:55 | Apariencia: cambia tres colores, guarda y todo el sistema toma la marca nueva | Apariencia · «Con tu marca y tus colores.» |
| 8 | 0:54–1:00 | Placa de cierre: marca, tecnologías y llamada a la acción | «.NET 10 · Aspire · PostgreSQL · React» · «Pedí una demo» |

Entre escenas hay fundidos de 0,5 s; por eso los tiempos se superponen medio segundo.

## Datos de ejemplo

Todo es ficticio: el negocio «Taller Rueda Libre» (bicicletería), su equipo (Valeria Ortiz, Martín Sosa, Lucía
Fernández y otros), correos `@example.com`, teléfonos `+54 9 11 5555-01xx`, chats y respuestas del asistente.
No aparecen cuentas, datos ni secretos reales, y no se escribió nada en la base de desarrollo.

## Cómo se hizo

- La app se levantó con `aspire run` (AppHost `src/ArquitecturaBase.AppHost`) y se grabó el front que sirve
  Aspire en `https://localhost:5173`, con sus pantallas, componentes y estilos reales.
- Playwright respondió todas las llamadas al servidor (`/api`, `/account`, `/connect`, `/.well-known`) con los datos de
  [`produccion/fixtures.cjs`](produccion/fixtures.cjs) y cortó cualquier otra: ninguna llegó a la Api real. El ingreso
  usa la entrada normal del SPA con el OIDC simulado como `src/test/visual/session.spec.ts`; las demás escenas parten
  de `src/test/visual/session.html`, que monta las mismas rutas con una sesión ficticia.
- Captura por screencast de Chromium a 2x, con un cursor dibujado en la página; ffmpeg compone la ventana, los textos
  y los fundidos. La espera de la respuesta de la clienta se acelera, la redirección del ingreso se corta y el resto va entre 1,1 y 1,4x.
- La música la genera [`produccion/music.cjs`](produccion/music.cjs) desde cero (96 BPM, sin muestras ni pistas de
  terceros), con el desarrollo entre los 5 y los 55 s y el acorde final sobre la placa de cierre.
- La marca de las placas es la provisoria del favicon (capas apiladas), con los colores Campo y Public Sans.

## Para regenerarlo

Con `aspire run` levantado desde la raíz del backend, ffmpeg en el PATH y desde esta carpeta:

```bash
node produccion/record.cjs
```

```bash
node produccion/cards.cjs
```

```bash
node produccion/music.cjs
```

```bash
node produccion/compose.cjs
```

Los cuadros y clips intermedios van a `%TEMP%/arquitecturabase-video` (o a `WORK`), y `compose.cjs` reemplaza
`arquitecturabase-60s.mp4`. Textos y duraciones: [`produccion/storyboard.cjs`](produccion/storyboard.cjs); acciones
de cada escena: [`produccion/record.cjs`](produccion/record.cjs). Al terminar, `aspire stop`.

## Pendiente de definir

- La llamada a la acción dice «Pedí una demo» sin contacto: falta el sitio, correo o WhatsApp a mostrar.
- La marca es la provisoria de la plantilla; si el producto sale con otro nombre o logo, se cambian en `cards.cjs`.
- Formularios queda afuera porque todavía está en desarrollo.
