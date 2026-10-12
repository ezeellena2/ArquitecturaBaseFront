// Datos ficticios para el video de marketing: un negocio inventado ("Taller Rueda Libre"), sin personas,
// correos ni teléfonos reales. Playwright responde todas las llamadas al servidor (api, account, connect y
// .well-known): nada llega a la Api real ni se escribe en la base. Un pedido sin respuesta prevista se corta.

const backend = /^https?:\/\/[^/]+\/(api|account|connect|\.well-known)(\/|\?|$)/;

// Los horarios de chats y del asistente son relativos al momento de grabar: WhatsApp solo deja responder dentro
// de las 24 horas del último mensaje del cliente, y con fechas fijas el envío quedaría bloqueado otro día.
const ago = minutes => new Date(Date.now() - minutes * 60000).toISOString();

const appearance = { primaryColor: "#285A3D", menuColor: "#24352B", headerColor: "#DFE8D9", alternateRowColor: "#F4F6F0" };

const allPermissions = [
  "users.read", "users.manage", "roles.read", "roles.manage", "settings.manage",
  "whatsapp.read", "whatsapp.send", "whatsapp.manage",
  "ai.read", "ai.manage", "ai.business.read", "ai.business.manage", "ai.assistant.use",
];

const profile = {
  id: "owner", displayName: "Valeria Ortiz", email: "valeria@example.com", emailConfirmed: true,
  phoneNumber: null, formattedPhoneNumber: null, maskedPhoneNumber: null, phoneNumberConfirmed: false,
  hasGoogleLogin: false, culture: "es", timeZoneId: "America/Argentina/Buenos_Aires",
  lastLoginAtUtc: "2026-10-09T12:00:00Z", roles: ["Admin"], permissions: allPermissions,
};

const people = [
  ["Valeria Ortiz", "valeria", ["Admin"], true, "2026-08-03"],
  ["Martín Sosa", "martin", ["Ventas"], true, "2026-08-05"],
  ["Lucía Fernández", "lucia", ["Taller"], true, "2026-08-11"],
  ["Diego Romero", "diego", ["Atención al cliente"], true, "2026-08-19"],
  ["Sofía Méndez", "sofia", ["Ventas"], true, "2026-09-02"],
  ["Carlos Ibarra", "carlos", ["Taller"], false, "2026-09-06"],
  ["Camila Torres", "camila", ["Atención al cliente"], true, "2026-09-15"],
  ["Julieta Navarro", "julieta", ["Ventas"], true, "2026-09-24"],
  ["Bruno Castro", "bruno", ["Taller"], true, "2026-10-01"],
];
const users = people.map(([displayName, alias, roles, isActive, created], index) => ({
  id: `user-${index}`, displayName, email: `${alias}@example.com`,
  phoneNumber: null, formattedPhoneNumber: null, phoneNumberConfirmed: false,
  isActive, createdAtUtc: `${created}T13:00:00Z`, roles,
}));

const permissionGroups = [
  { area: "users", name: "Usuarios", permissions: [
    { code: "users.read", name: "Ver usuarios", description: "El listado y el detalle de cada cuenta." },
    { code: "users.manage", name: "Administrar usuarios", description: "Dar de alta, editar, desactivar y eliminar cuentas." },
  ] },
  { area: "roles", name: "Roles", permissions: [
    { code: "roles.read", name: "Ver roles", description: "Los roles y qué permisos da cada uno." },
    { code: "roles.manage", name: "Administrar roles", description: "Crear, editar y eliminar roles." },
  ] },
  { area: "settings", name: "Configuración", permissions: [
    { code: "settings.manage", name: "Administrar la configuración", description: "El modo de registro y los ajustes del sistema." },
  ] },
  { area: "whatsapp", name: "WhatsApp", permissions: [
    { code: "whatsapp.read", name: "Ver chats", description: "Leer conversaciones y tus mensajes sin leer." },
    { code: "whatsapp.send", name: "Responder chats", description: "Enviar respuestas manuales en conversaciones autorizadas." },
    { code: "whatsapp.manage", name: "Cambiar modo de atención", description: "Administrar el modo compartido y habilitar atención manual." },
  ] },
  { area: "ai", name: "Inteligencia artificial", permissions: [
    { code: "ai.read", name: "Ver conexión", description: "Consultar la configuración de IA sin ver su clave." },
    { code: "ai.manage", name: "Administrar conexión", description: "Configurar la conexión y probar el proveedor de IA." },
    { code: "ai.business.read", name: "Ver información del negocio", description: "Consultar los datos del negocio sin modificarlos." },
    { code: "ai.business.manage", name: "Administrar información del negocio", description: "Editar y guardar los datos del negocio." },
    { code: "ai.assistant.use", name: "Usar el asistente", description: "Consultar fuentes autorizadas y administrar el historial privado del asistente." },
  ] },
];

const countRole = name => users.filter(user => user.roles.includes(name)).length;
const roles = [
  { id: "admin", name: "Admin", description: "Administra todo el sistema.", isSystemRole: true, userCount: countRole("Admin"), permissions: allPermissions },
  { id: "user", name: "User", description: "Permisos de una cuenta nueva.", isSystemRole: true, userCount: 0, permissions: [] },
  { id: "atencion", name: "Atención al cliente", description: "Responde las consultas de los clientes por WhatsApp.", isSystemRole: false, userCount: countRole("Atención al cliente"),
    permissions: ["whatsapp.read", "whatsapp.send", "ai.business.read", "ai.assistant.use"] },
  { id: "ventas", name: "Ventas", description: "Atiende el mostrador y arma los presupuestos.", isSystemRole: false, userCount: countRole("Ventas"),
    permissions: ["users.read", "whatsapp.read", "ai.business.read", "ai.assistant.use"] },
  { id: "taller", name: "Taller", description: "Consulta los trabajos y la información del negocio.", isSystemRole: false, userCount: countRole("Taller"),
    permissions: ["ai.business.read"] },
];

const business = {
  name: "Taller Rueda Libre", description: "Venta, reparación y service de bicicletas.",
  hours: "Lunes a viernes de 9 a 18 h. Sábados de 9 a 13 h.", location: "Atención en el local",
  services: "Service completo, reparaciones, repuestos y accesorios.", policies: "Presupuesto sin cargo, después de revisar la bicicleta.",
  faq: "", revision: 4,
};

function createState() {
  const contacts = [
    { id: "chat-sofia", profileName: "Sofía Herrera", phoneNumber: "+54 9 11 5555-0142", mode: "Manual", modeRevision: 1,
      lastInboundAtUtc: ago(4), lastInboundSequence: 3, unreadCount: 1, preview: "¿Tienen turno para un service el sábado?" },
    { id: "chat-mateo", profileName: "Mateo Díaz", phoneNumber: "+54 9 11 5555-0178", mode: "Manual", modeRevision: 1,
      lastInboundAtUtc: ago(33), lastInboundSequence: 2, unreadCount: 2, preview: "¿Cuánto sale cambiar la cadena?" },
    { id: "chat-julieta", profileName: "Julieta Ramos", phoneNumber: "+54 9 11 5555-0193", mode: "Manual", modeRevision: 1,
      lastInboundAtUtc: ago(95), lastInboundSequence: 4, unreadCount: 0, preview: "¡Gracias! Ya la retiré." },
    { id: "chat-andres", profileName: "Andrés Molina", phoneNumber: "+54 9 11 5555-0127", mode: "Manual", modeRevision: 1,
      lastInboundAtUtc: ago(1070), lastInboundSequence: 2, unreadCount: 0, preview: "Perfecto, paso mañana a la tarde." },
  ];
  const message = (id, direction, body, at, sequence, status = null) => ({
    id, direction, kind: "Text", body, occurredAtUtc: at, inboundSequence: sequence,
    operatorUserId: direction === "Outbound" ? profile.id : null, status, errorCode: null,
  });
  const threads = {
    "chat-sofia": [
      message("s1", "Inbound", "Hola, buen día 👋", ago(7), 1),
      message("s2", "Inbound", "Tengo una bici rodado 29 y los cambios no entran bien.", ago(6), 2),
      message("s3", "Inbound", "¿Tienen turno para un service el sábado?", ago(4), 3),
    ],
    "chat-mateo": [
      message("m1", "Inbound", "Hola, ¿cómo va?", ago(35), 1),
      message("m2", "Inbound", "¿Cuánto sale cambiar la cadena?", ago(33), 2),
    ],
    "chat-julieta": [
      message("j1", "Inbound", "¿Ya está lista mi bici?", ago(110), 1),
      message("j2", "Outbound", "¡Sí! Te esperamos hasta las 18 h.", ago(105), 0, "Read"),
      message("j3", "Inbound", "¡Gracias! Ya la retiré.", ago(95), 4),
    ],
    "chat-andres": [
      message("a1", "Inbound", "¿Hacen envíos de repuestos?", ago(1080), 1),
      message("a2", "Outbound", "Por ahora solo retiro en el local.", ago(1075), 0, "Read"),
      message("a3", "Inbound", "Perfecto, paso mañana a la tarde.", ago(1070), 2),
    ],
  };
  return { contacts, threads, outgoing: {}, sentAt: {}, settings: { appearance: { ...appearance }, defaultCulture: "es",
    defaultTimeZoneId: "America/Argentina/Buenos_Aires", defaultPageSize: 20, registrationMode: "InviteOnly", revision: 3 },
    assistant: { turn: null, polls: 0 } };
}

const assistantConversationId = "0199a0c0-0000-7000-8000-00000000a001";
const assistantBootstrap = {
  availability: "available", connectionRevision: 2, configurationDestination: "aiConfiguration",
  limits: { questionMaxLength: 4000 },
  suggestions: [
    { id: "business.information", question: "¿Qué horario tenemos cargado?" },
    { id: "users.summary", question: "¿Cuántas personas hay en el equipo?" },
    { id: "roles.list", question: "¿Qué roles hay?" },
    { id: "roles.permissions", question: "¿Qué puede hacer Atención al cliente?" },
  ],
};

function assistantAnswer(question, requestId, base) {
  return {
    ...base, state: "Completed", stage: null, turnRevision: base.turnRevision + 1,
    answer: { kind: "answer", evidenceIds: ["e1", "e2"], text:
      "Atienden WhatsApp 3 personas: Diego Romero y Camila Torres, con el rol Atención al cliente, y Valeria Ortiz, como administradora. " +
      "El sábado el local abre de 9 a 13 h." },
    evidences: [
      { id: "e1", sourceId: "roles.permissions", sourceVersion: 1, observedAtUtc: ago(0), revision: null, destination: "roles",
        requiredPermissions: ["roles.read"], isComplete: true, rows: [
          { id: null, values: [{ label: "Rol", value: "Atención al cliente" }, { label: "Personas", value: "2" }, { label: "Permiso", value: "Responder chats" }] },
        ] },
      { id: "e2", sourceId: "business.information", sourceVersion: 1, observedAtUtc: ago(0), revision: 4, destination: "business.information",
        requiredPermissions: ["ai.business.read"], isComplete: true, rows: [
          { id: null, values: [{ label: "Horario", value: business.hours }] },
        ] },
    ],
    question, requestId,
  };
}

/// Instala las respuestas ficticias. `origin` es el del front (el issuer del OIDC simulado).
async function installMarketingRoutes(page, origin, options = {}) {
  const state = createState();
  const unexpected = [];
  let nonce = null;
  await page.route(backend, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    const empty = (status = 204) => route.fulfill({ status, body: "" });
    const pageOf = items => ({ items, page: 1, pageSize: 20, totalCount: items.length, totalPages: items.length ? 1 : 0, hasPrevious: false, hasNext: false });

    // Acceso y OIDC simulados (mismo patrón que src/test/visual/session.spec.ts).
    if (path === "/.well-known/openid-configuration") return json({
      issuer: origin, authorization_endpoint: `${origin}/connect/authorize`, token_endpoint: `${origin}/connect/token`,
      end_session_endpoint: `${origin}/connect/logout`, userinfo_endpoint: `${origin}/connect/userinfo`,
    });
    if (path === "/account/login-methods") return json({ registrationOpen: false, google: true, whatsapp: true, whatsappCountries: ["AR"], whatsappNumber: "5491155550100" });
    if (path === "/account/login-code/whatsapp") return json({ resendAfterSeconds: 60, phone: "+5491155550123", maskedPhone: "+54 9 11 •••• 0123" }, 202);
    if (path === "/account/login-code") return json({ resendAfterSeconds: 60 }, 202);
    if (path === "/account/login-code/verify") return json({ returnUrl: request.postDataJSON().returnUrl });
    if (path === "/connect/authorize") {
      nonce = url.searchParams.get("nonce");
      const callback = new URL(url.searchParams.get("redirect_uri"));
      callback.searchParams.set("code", "marketing-code");
      callback.searchParams.set("state", url.searchParams.get("state"));
      return route.fulfill({ status: 302, headers: { location: callback.href } });
    }
    if (path === "/connect/token") {
      const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
      const idToken = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
        sub: profile.id, iss: origin, aud: "web", exp: 4102444800, iat: Math.floor(Date.now() / 1000), ...(nonce ? { nonce } : {}),
      })}.marketing-signature`;
      return json({ access_token: "marketing-only", id_token: idToken, token_type: "Bearer", expires_in: 3600, scope: "openid profile email roles offline_access api" });
    }
    if (path === "/connect/userinfo") return json({ sub: profile.id });

    if (path === "/api/me") return json(profile);
    if (path === "/api/settings/presentation") return json({ ...state.settings, installedFeatures: ["assistant"] });
    if (path === "/api/settings" && method === "GET") return json(state.settings);
    if (path === "/api/settings" && method === "PATCH") {
      state.settings = { ...state.settings, ...request.postDataJSON(), revision: state.settings.revision + 1 };
      return empty();
    }

    if (path === "/api/users/filter-counts") return json({
      status: { all: users.length, active: users.filter(user => user.isActive).length, inactive: users.filter(user => !user.isActive).length },
      roles: ["Admin", "Atención al cliente", "Taller", "Ventas"].map(name => ({ name, count: countRole(name) })),
      createdWithin: [{ days: 7, count: 1 }, { days: 30, count: 4 }],
    });
    if (path === "/api/users" && method === "GET") {
      const search = (url.searchParams.get("search") ?? "").toLocaleLowerCase("es");
      const role = url.searchParams.get("role");
      const active = url.searchParams.get("isActive");
      const rows = users.filter(user => (!search || `${user.displayName} ${user.email}`.toLocaleLowerCase("es").includes(search))
        && (!role || user.roles.includes(role)) && (active === null || String(user.isActive) === active));
      return json(pageOf(rows));
    }
    if (path.startsWith("/api/users/") && method === "GET") {
      const row = users.find(user => user.id === path.split("/").at(-1));
      return row ? json({ ...row, emailConfirmed: true, lastInvitation: null }) : json({ code: "Request.NotFound" }, 404);
    }

    if (path === "/api/roles/paged") return json(pageOf(roles));
    if (path === "/api/roles") return json(roles);
    if (path.startsWith("/api/roles/") && method === "GET") return json(roles.find(role => role.id === path.split("/").at(-1)) ?? null);
    if (path === "/api/permissions") return json(permissionGroups);

    if (path === "/api/ai/business-information") return json(business);
    if (path === "/api/ai/connection") return json({ provider: "OpenAI", model: "modelo-de-ejemplo", hasCredential: true, enabled: true, revision: 2, providers: ["OpenAI", "Anthropic"] });

    if (path.startsWith("/api/ai/assistant")) {
      const assistant = state.assistant;
      if (path.endsWith("/bootstrap")) return json(assistantBootstrap);
      if (path.endsWith("/conversations") && method === "GET") return json(pageOf(assistant.turn ? [{
        conversationId: assistantConversationId, revision: assistant.turn.conversationRevision, title: assistant.turn.question,
        contentAccess: "allowed", lastActivityAtUtc: ago(0) }] : []));
      if (path.endsWith("/turns") && method === "POST") {
        const body = request.postDataJSON();
        assistant.polls = 0;
        assistant.turn = {
          turnId: "0199a0c0-0000-7000-8000-00000000a002", requestId: body.requestId, conversationId: assistantConversationId,
          ordinal: 1, conversationRevision: 1, turnRevision: 1, state: "Running", stage: "consulting", cancelRequestedAtUtc: null,
          contentAccess: "allowed", question: body.question, answer: null, evidences: [], failure: null, culture: "es",
          timeZoneId: "America/Argentina/Buenos_Aires", submittedAtUtc: ago(0), serverNowUtc: ago(0), pollingAfterSeconds: 1,
        };
        return json(assistant.turn, 202);
      }
      if (path.includes("/turns/") && method === "GET") {
        if (assistant.turn && assistant.turn.state === "Running" && ++assistant.polls >= (options.assistantPolls ?? 2))
          assistant.turn = assistantAnswer(assistant.turn.question, assistant.turn.requestId, assistant.turn);
        return assistant.turn ? json(assistant.turn) : json({}, 404);
      }
      if (path.includes("/conversations/") && path.endsWith("/turns")) return json(pageOf(assistant.turn ? [assistant.turn] : []));
      if (path.includes("/conversations/")) return assistant.turn ? json({ conversationId: assistantConversationId, revision: assistant.turn.conversationRevision,
        title: assistant.turn.question, contentAccess: "allowed", activeRequestId: assistant.turn.state === "Running" ? assistant.turn.requestId : null,
        lastActivityAtUtc: ago(0) }) : json({}, 404);
    }

    if (path.startsWith("/api/whatsapp/chats")) {
      const parts = path.split("/");
      const id = parts[4];
      if (path === "/api/whatsapp/chats") {
        const unreadOnly = url.searchParams.get("unreadOnly") === "true";
        const items = state.contacts.filter(contact => !unreadOnly || contact.unreadCount > 0);
        return json({ page: { items, totalCount: items.length, page: 1, pageSize: 20, totalPages: 1 }, allCount: state.contacts.length,
          unreadCount: state.contacts.filter(contact => contact.unreadCount > 0).length });
      }
      const contact = state.contacts.find(item => item.id === id);
      if (!contact) return json({ code: "Request.NotFound" }, 404);
      const outgoing = state.outgoing[id] ??= [];
      if (method === "PUT" && path.endsWith("/read")) { contact.unreadCount = 0; return empty(); }
      if (method === "PUT" && path.endsWith("/mode")) { contact.mode = request.postDataJSON().mode; contact.modeRevision++; return empty(); }
      if (method === "POST" && path.endsWith("/messages")) {
        const body = request.postDataJSON();
        const item = { id: body.requestId, requestId: body.requestId, body: body.body, operatorUserId: profile.id,
          state: "Pending", waMessageId: null, requestedAtUtc: ago(0) };
        outgoing.push(item);
        state.sentAt[body.requestId] = Date.now();
        return json(item, 202);
      }
      if (method === "GET" && path.includes("/outgoing/")) {
        const item = outgoing.find(entry => path.endsWith(`/${entry.requestId}`));
        return item ? json(item) : json({ code: "Request.NotFound" }, 404);
      }
      if (method === "GET" && path.endsWith("/messages")) {
        // Un envío se confirma al rato: pasa de la cola al historial como entregado y después leído, y el cliente contesta.
        for (const item of [...outgoing]) {
          const elapsed = Date.now() - state.sentAt[item.requestId];
          if (elapsed > 1200) {
            outgoing.splice(outgoing.indexOf(item), 1);
            state.threads[id].push({ id: `sent-${item.requestId}`, direction: "Outbound", kind: "Text", body: item.body,
              occurredAtUtc: item.requestedAtUtc, inboundSequence: 0, operatorUserId: profile.id, status: "Delivered", errorCode: null, sentKey: item.requestId });
          }
        }
        for (const message of state.threads[id]) {
          if (message.sentKey && Date.now() - state.sentAt[message.sentKey] > 2000) message.status = "Read";
          if (message.sentKey && options.customerReply && Date.now() - state.sentAt[message.sentKey] > 2500
            && !state.threads[id].some(entry => entry.id === "reply")) {
            state.threads[id].push({ id: "reply", direction: "Inbound", kind: "Text", body: options.customerReply,
              occurredAtUtc: ago(0), inboundSequence: contact.lastInboundSequence + 1, operatorUserId: null, status: null, errorCode: null });
            contact.lastInboundSequence++;
            contact.preview = options.customerReply;
          }
        }
        const messages = state.threads[id].map(({ sentKey: _sentKey, ...message }) => message);
        return json({ contact, messages, outgoing, beforeAtUtc: null, beforeId: null });
      }
    }

    unexpected.push(`${method} ${path}`);
    return route.abort();
  });
  return { state, unexpected };
}

module.exports = { installMarketingRoutes, profile, users, roles };
