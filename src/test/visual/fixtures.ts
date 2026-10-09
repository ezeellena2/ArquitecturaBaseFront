import { createAssistantVisualFixtures } from "./assistantFixtures";
import { initialAppearance } from "@/shared/lib/appearance";
import type { CurrentUser } from "@/auth/useCurrentUser";
import type { UserDetail, UserFilterCounts, UserListItem } from "@/features/users/api/users";
import type { PermissionGroup } from "@/features/roles/api/roles";
import type { RoleListItem } from "@/shared/api/roles";
import type { SystemSettings } from "@/features/settings/api/settings";
import type { Chat, ChatMessage, Outgoing } from "@/features/whatsapp/api/chat";
import type { AiConnection, AiSaveRequest } from "@/features/artificial-intelligence/api/aiConnection";
import type { BusinessInformation, BusinessSaveRequest, BusinessChange } from "@/features/artificial-intelligence/api/businessInformation";
import { emptyBusinessDetails } from "@/features/artificial-intelligence/businessDetailsModel";

// Datos ficticios estables, con los tipos de los contratos reales.
export function installVisualFixtures(language: "es" | "en", scenario: string | null) {
  const english = language === "en";
  const assistantScenario = scenario?.startsWith("assistant-") ?? false;
  const assistantFixture = assistantScenario ? createAssistantVisualFixtures(language, scenario!) : undefined;
  const roleGroupsScenario = scenario === "role-groups";
  const chatScenario = scenario === "chat" || scenario === "chat-states" || scenario === "chat-history" || scenario === "chat-access" || scenario === "chat-legacy" || roleGroupsScenario;
  const aiScenario = scenario?.startsWith("ai-") ?? false;
  const businessScenario = (scenario?.startsWith("business-") ?? false) || roleGroupsScenario;
  const profile: CurrentUser = {
    id: "visual-test", displayName: "Ana Pérez", email: "ana@example.com", emailConfirmed: true,
    phoneNumber: null, formattedPhoneNumber: null, maskedPhoneNumber: null, phoneNumberConfirmed: false,
    hasGoogleLogin: false, culture: language, timeZoneId: "America/Argentina/Buenos_Aires",
    lastLoginAtUtc: "2026-09-18T12:00:00Z", roles: ["Admin"],
    permissions: [...(assistantScenario && scenario !== "assistant-denied" ? ["ai.assistant.use", "ai.read", "ai.business.read"] : []), "users.read", "users.manage", "roles.read", "roles.manage", "settings.manage", ...(chatScenario ? ["whatsapp.read", "whatsapp.send", "whatsapp.manage"] : []), ...(aiScenario ? scenario === "ai-read" ? ["ai.read"] : ["ai.read", "ai.manage"] : []),
      ...(businessScenario && scenario !== "business-denied" ? scenario === "business-read" ? ["ai.business.read"] : ["ai.business.read", "ai.business.manage"] : []),
      ...(scenario === "business-roles" || roleGroupsScenario ? ["ai.read", "ai.manage"] : [])],
  };
  const users: UserListItem[] = ["Ana Pérez", "Juan Gómez", "Laura Ríos", "Carla Paz"].map((name, index) => ({
    id: `user-${index}`, displayName: name, email: ["ana", "juan", "laura", "carla"][index] + "@example.com",
    phoneNumber: null, formattedPhoneNumber: null, phoneNumberConfirmed: false, isActive: index !== 2,
    createdAtUtc: "2026-09-18T12:00:00Z", roles: index === 0 ? ["Admin"] : ["User"],
  }));
  const roles: RoleListItem[] = [
    { id: "admin", name: "Admin", description: english ? "Full administration." : "Administra todo el sistema.", isSystemRole: true, userCount: 1, permissions: profile.permissions },
    { id: "user", name: "User", description: english ? "Default account permissions." : "Permisos de una cuenta nueva.", isSystemRole: true, userCount: 3, permissions: [] },
    { id: "support", name: "Soporte", description: english ? "Reviews accounts." : "Consulta las cuentas y su estado.", isSystemRole: false, userCount: 2, permissions: [...(assistantScenario && scenario !== "assistant-denied" ? ["ai.assistant.use", "ai.read", "ai.business.read"] : []), "users.read", "roles.read"] },
  ];
  const permissions: PermissionGroup[] = [
    { area: "users", name: english ? "Users" : "Usuarios", permissions: [
      { code: "users.read", name: english ? "View users" : "Ver usuarios", description: english ? "Account lists and details." : "El listado y el detalle de cada cuenta." },
      { code: "users.manage", name: english ? "Manage users" : "Administrar usuarios", description: english ? "Create, edit and deactivate accounts." : "Dar de alta, editar, desactivar y eliminar cuentas." },
    ] },
    { area: "roles", name: english ? "Roles" : "Roles", permissions: [
      { code: "roles.read", name: english ? "View roles" : "Ver roles", description: english ? "Roles and assigned permissions." : "Los roles y los permisos que da cada uno." },
      { code: "roles.manage", name: english ? "Manage roles" : "Administrar roles", description: english ? "Create, edit and delete roles." : "Crear, editar y eliminar roles." },
    ] },
    { area: "settings", name: english ? "Settings" : "Configuración", permissions: [
      { code: "settings.manage", name: english ? "Manage settings" : "Administrar la configuración", description: english ? "Registration and general preferences." : "El modo de registro y los ajustes generales." },
    ] },
  ];
  const counts: UserFilterCounts = { status: { all: 4, active: 3, inactive: 1 }, roles: [{ name: "Admin", count: 1 }, { name: "User", count: 3 }], createdWithin: [{ days: 7, count: 0 }, { days: 30, count: 4 }] };
  let settings: SystemSettings = { appearance: scenario === "dark-palette" ? { primaryColor: "#FFFF00", menuColor: "#FFFFFF", headerColor: "#000000", alternateRowColor: "#000000" } : initialAppearance, defaultCulture: language, defaultTimeZoneId: "America/Argentina/Buenos_Aires", defaultPageSize: 20, registrationMode: "InviteOnly", revision: 1 };
  const nativeFetch = globalThis.fetch;
  let ai: AiConnection = { provider: "OpenAI", model: scenario === "ai-empty" ? "" : "fictional-model", hasCredential: scenario !== "ai-empty", enabled: scenario !== "ai-empty", revision: 1, providers: ["OpenAI", "Anthropic"] };
  const aiReceipts = new Map<string, { requestId: string; connection: AiConnection }>();
  if (roleGroupsScenario) permissions.push({ area: "whatsapp", name: "WhatsApp", permissions: [
    { code: "whatsapp.read", name: english ? "View chats" : "Ver chats", description: english ? "Read business conversations." : "Leer las conversaciones del negocio." },
    { code: "whatsapp.send", name: english ? "Reply to chats" : "Responder chats", description: english ? "Send manual replies." : "Enviar respuestas manuales." },
    { code: "whatsapp.manage", name: english ? "Change service mode" : "Cambiar modo de atención", description: english ? "Manage the shared service mode." : "Administrar el modo de atención compartido." },
  ] });
  if (businessScenario) permissions.push({ area: "ai", name: english ? "Artificial intelligence" : "Inteligencia artificial", permissions: [
    { code: "ai.read", name: english ? "View connection" : "Ver conexión", description: english ? "Read AI connection settings." : "Consultar la configuración de IA sin ver su clave." },
    { code: "ai.manage", name: english ? "Manage connection" : "Administrar conexión", description: english ? "Configure and test the AI provider." : "Configurar la conexión y probar el proveedor de IA." },
    { code: "ai.business.read", name: english ? "View business information" : "Ver información del negocio", description: english ? "Read the business facts without changing them." : "Consultar los datos del negocio sin modificarlos." },
    { code: "ai.business.manage", name: english ? "Manage business information" : "Administrar información del negocio", description: english ? "Edit and save the business facts." : "Editar y guardar los datos del negocio." },
  ] });
  let business: BusinessInformation = { name: english ? "Your business" : "Tu negocio", description: english ? "Bicycle repairs." : "Reparación de bicicletas.",
    hours: "9–18", location: english ? "In-store service" : "Atención en el local", services: english ? "Maintenance and accessories." : "Mantenimiento y accesorios.",
    policies: english ? "Quotes confirmed after inspection." : "Presupuestos después de revisar el producto.", faq: "", revision: 1 };
  if (scenario === "business-empty") business = { name: "", description: "", hours: "", location: "", services: "", policies: "", faq: "", revision: 0 };
  if (scenario === "business-guided") {
    const details = emptyBusinessDetails("America/Argentina/Buenos_Aires");
    details.location = { mode: "both", address: english ? "123 Example Avenue" : "Av. Ejemplo 123", reference: "", area: "", latitude: null, longitude: null };
    details.openingHours.days = details.openingHours.days.map(day => ({ ...day, status: day.weekday === 6 ? "closed" : "open", periods: day.weekday === 6 ? [] : [{ start: "09:00", end: day.weekday === 5 ? "13:00" : "18:00", nextDay: false }] }));
    business = { ...business, hours: "", location: "", details };
  }
  const businessReceipts = new Map<string, BusinessChange>();
  let businessConflict = false;
  const chatContact: Chat = { id: "chat-ana", profileName: "Ana Martínez", phoneNumber: "+54 9 351 555-1234", mode: "Manual", modeRevision: 1,
    lastInboundAtUtc: "2026-10-02T12:00:00Z", lastInboundSequence: 1, unreadCount: 1, preview: "¿Podemos coordinar el pedido para mañana?" };
  let chatMessages: ChatMessage[] = [
    { id: "chat-message-1", direction: "Inbound", kind: "Text", body: chatContact.preview, occurredAtUtc: "2026-10-02T12:00:00Z", inboundSequence: 1, operatorUserId: null, status: null, errorCode: null },
    { id: "chat-message-2", direction: "Outbound", kind: "Text", body: "Hola Ana, sí. Decime qué horario te queda cómodo.", occurredAtUtc: "2026-10-02T12:02:00Z", inboundSequence: 0, operatorUserId: profile.id, status: "Delivered", errorCode: null },
  ];
  const earlierMessages: ChatMessage[] = [];
  const chatOutgoing: Outgoing[] = [];
  if (scenario === "chat-access" || scenario === "chat-legacy") {
    if (scenario === "chat-legacy") chatContact.mode = "Bot";
    chatContact.previewPurpose = "Access";
    chatContact.previewAccessEventKind = "AccessInstructions";
    chatContact.preview = "legacy-secret-do-not-render";
    for (const [index, accessEventKind] of (["Invitation", "AccessRequested", "AccessInstructions", "VerifyPhoneCode", "SignInCode"] as const).entries()) chatMessages.push({
      ...chatMessages[1], id: `access-${index}`, purpose: "Access", accessEventKind, body: "123456 https://ejemplo.invalid/#t=secret",
      direction: accessEventKind === "AccessRequested" ? "Inbound" : "Outbound", operatorUserId: null,
      status: index === 0 ? "Read" : index === 4 ? "Failed" : null, occurredAtUtc: `2026-10-02T12:0${index + 3}:00Z`,
    });
  }
  if (scenario === "chat-states") {
    chatMessages.unshift({ ...chatMessages[0], id: "previous-day", body: english ? "Yesterday's question." : "La consulta de ayer.", occurredAtUtc: "2026-10-01T17:00:00Z", inboundSequence: 0 });
    for (const [index, status] of ["Read", "Failed", null].entries()) chatMessages.push({
      ...chatMessages[1], id: `status-${index}`, direction: "Outbound", inboundSequence: 0, status, operatorUserId: index === 0 ? null : profile.id,
      body: english ? `Reply ${index + 1}` : `Respuesta ${index + 1}`, occurredAtUtc: `2026-10-02T12:0${index + 3}:00Z`,
    });
    chatMessages.push({ ...chatMessages[0], id: "long-text", body: "https://ejemplo.invalid/" + "a".repeat(180), occurredAtUtc: "2026-10-02T12:06:00Z" });
    for (const [index, state] of (["Reviewed", "Failed", "Uncertain"] as const).entries()) chatOutgoing.push({
      id: `outgoing-${index}`, requestId: `request-${index}`, operatorUserId: profile.id, state,
      body: english ? `Earlier request ${index + 1}` : `Pedido anterior ${index + 1}`, requestedAtUtc: `2026-10-02T12:0${index + 7}:00Z`, waMessageId: null,
    });
  }
  if (scenario === "chat-history") {
    const item = (index: number, earlier: boolean): ChatMessage => ({
      ...chatMessages[0], id: `${earlier ? "older" : "recent"}-${index}`, body: `${english ? "Message" : "Mensaje"} ${earlier ? index : index + 10}`,
      occurredAtUtc: new Date(Date.UTC(2026, 9, earlier ? 1 : 2, 11, index)).toISOString(), inboundSequence: earlier ? index + 1 : index + 11,
    });
    earlierMessages.push(...Array.from({ length: 10 }, (_, index) => item(index, true)));
    chatMessages = Array.from({ length: 40 }, (_, index) => item(index, false));
    chatContact.lastInboundSequence = 50;
  }
  if (scenario === "tall") {
    for (let index = 1; index <= 25; index++) {
      permissions.push({ area: `area-${index}`, name: `Área ${index}`, permissions: [{ code: `area-${index}.read`, name: "Consultar", description: "Consultar los datos de esta sección." }] });
    }
  }
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
  const pageOf = (items: readonly unknown[]) => ({ items, page: 1, pageSize: 20, totalCount: items.length, totalPages: items.length ? 1 : 0, hasPrevious: false, hasNext: false });
  globalThis.fetch = async (input, init) => {
    const request = new Request(input instanceof Request ? input : new URL(String(input), location.origin), init);
    const requestUrl = new URL(request.url);
    const path = requestUrl.pathname;
    const assistantResponse = await assistantFixture?.(request);
    if (assistantResponse) return assistantResponse;
    if (businessScenario && path.startsWith("/api/ai/business-information")) {
      if (scenario === "business-denied") return json({ code: "Authorization.Forbidden" }, 403);
      if (path === "/api/ai/business-information/places/search") return json({ places: [
        { placeId: "ChIJ_fictionalClinic", label: english ? "Example Clinic, Example City" : "Sanatorio de ejemplo, Ciudad de ejemplo" },
        { placeId: "ChIJ_otherClinic", label: english ? "Other Clinic, Other City" : "Otro sanatorio, Otra ciudad" },
      ] });
      if (request.method === "PUT") {
        const data = await request.json() as BusinessSaveRequest;
        if (scenario === "business-conflict" && !businessConflict) {
          business = { ...business, hours: "10–17", revision: business.revision + 1 }; businessConflict = true;
          return json({ code: "Ai.BusinessInformation.RevisionConflict" }, 409);
        }
        if (scenario === "business-missing") throw new TypeError("Simulated unconfirmed save");
        if (!businessReceipts.has(data.requestId)) {
          const { requestId, expectedRevision, ...facts } = data;
          if (expectedRevision !== business.revision) return json({ code: "Ai.BusinessInformation.RevisionConflict" }, 409);
          business = { ...facts, revision: business.revision + 1 };
          businessReceipts.set(requestId, { requestId, revision: business.revision });
        }
        if (scenario === "business-uncertain") throw new TypeError("Simulated lost response");
        return json(businessReceipts.get(data.requestId));
      }
      if (path.includes("/changes/")) {
        const receipt = businessReceipts.get(path.split("/").at(-1)!);
        return receipt ? json(receipt) : json({ code: "Ai.BusinessInformation.ChangeNotFound" }, 404);
      }
      return json(business);
    }
    if (aiScenario && path.startsWith("/api/ai/connection")) {
      if (request.method === "POST" && path.endsWith("/models")) {
        const data = await request.json() as { provider: string };
        return json({ provider: data.provider, revision: ai.revision, models: [
          { id: "fictional-model", displayName: "Fictional model" },
          { id: "fictional-next-model", displayName: "Fictional next model" },
        ] });
      }
      if (request.method === "PUT") {
        const data = await request.json() as AiSaveRequest;
        if (scenario === "ai-conflict") return json({ code: "Ai.Connection.RevisionConflict", detail: "fictional conflict" }, 409);
        if (!aiReceipts.has(data.requestId)) {
          ai = { ...ai, provider: data.provider, model: data.model, enabled: data.enabled, hasCredential: data.credentialChange === "Replace" || (data.credentialChange === "Keep" && ai.hasCredential), revision: ai.revision + 1 };
          aiReceipts.set(data.requestId, { requestId: data.requestId, connection: ai });
        }
        if (scenario === "ai-uncertain") throw new TypeError("Simulated lost response");
        return json(aiReceipts.get(data.requestId));
      }
      if (request.method === "POST") return scenario === "ai-test-error" ? json({ code: "Ai.Provider.CredentialInvalid" }, 400) : json({ revision: ai.revision, inputTokens: 4, outputTokens: 1 });
      if (path.includes("/changes/")) {
        const receipt = aiReceipts.get(path.split("/").at(-1)!);
        return receipt ? json(receipt) : json({ code: "Ai.Connection.ChangeNotFound" }, 404);
      }
      return json(ai);
    }
    if (chatScenario && path.startsWith("/api/whatsapp/chats")) {
      if (request.method === "POST" && path.endsWith("/messages")) {
        const data = await request.json() as { requestId: string; body: string };
        const outgoing: Outgoing = { id: data.requestId, requestId: data.requestId, body: data.body, operatorUserId: profile.id,
          state: "Pending", waMessageId: null, requestedAtUtc: "2026-10-02T12:10:00Z" };
        chatOutgoing.push(outgoing);
        return json(outgoing, 202);
      }
      if (request.method === "POST" && path.endsWith("/review")) {
        const outgoing = chatOutgoing.find(item => path.endsWith(`/${item.requestId}/review`));
        if (outgoing) outgoing.state = "Reviewed";
        return new Response(null, { status: 204 });
      }
      if (request.method === "PUT" && path.endsWith("/mode")) {
        const data = await request.json() as { mode: Chat["mode"] };
        chatContact.mode = data.mode;
        chatContact.modeRevision++;
        return new Response(null, { status: 204 });
      }
      if (request.method !== "GET") return new Response(null, { status: 204 });
      if (path === "/api/whatsapp/chats") return json({ page: pageOf([chatContact, { ...chatContact, id: "chat-luis", profileName: "Luis Pérez", preview: "Gracias por la información", unreadCount: 0 }]), allCount: 2, unreadCount: 1 });
      if (path.includes("/outgoing/")) {
        const outgoing = chatOutgoing.find(item => path.endsWith(`/${item.requestId}`));
        return outgoing ? json(outgoing) : json({ code: "Request.NotFound" }, 404);
      }
      const earlier = requestUrl.searchParams.has("beforeId");
      return json({ contact: chatContact, messages: earlier ? earlierMessages : chatMessages, outgoing: chatOutgoing,
        beforeAtUtc: scenario === "chat-history" && !earlier ? chatMessages[0].occurredAtUtc : null,
        beforeId: scenario === "chat-history" && !earlier ? chatMessages[0].id : null });
    }
    if (!/^\/(api|account|connect|\.well-known)(\/|$)/.test(path)) return nativeFetch(input, init);
    if (request.method !== "GET") {
      if (scenario === "dialog-error" && path === "/api/users" && request.method === "POST") return json({ status: 500, traceId: "dialog-test" }, 500);
      if (path === "/api/settings" && request.method === "PATCH") {
        if (scenario === "conflict") {
          settings = { ...settings, defaultPageSize: 50, revision: 2 };
          return json({ status: 409, code: "Settings.System.RevisionConflict", detail: english ? "Another person changed this setting." : "Otra persona cambió este ajuste." }, 409);
        }
        settings = { ...settings, ...await request.json(), revision: settings.revision + 1 };
      }
      return request.method === "POST" ? json("visual-created", 201) : new Response(null, { status: 204 });
    }
    if (path === "/api/me") return json(profile);
    if (path === "/account/login-methods") return json({ registrationOpen: scenario !== "landing", google: true, whatsapp: true, whatsappCountries: ["AR", "UY"], whatsappNumber: "15551632662" });
    if (path === "/api/settings/presentation") return json({ ...settings, installedFeatures: assistantScenario ? ["assistant"] : [] });
    if (path === "/api/settings") return json(settings);
    if (path === "/api/roles/paged") return json(pageOf(roles));
    if (path === "/api/roles") return json(roles);
    if (path.startsWith("/api/roles/")) return json(roles.find(role => role.id === path.split("/").at(-1)) ?? null);
    if (path === "/api/permissions") return json(permissions);
    if (path === "/api/users/filter-counts") return json(counts);
    if (path === "/api/users") {
      if (scenario === "loading") return new Promise<Response>(() => {});
      if (scenario === "error") return json({ status: 500, detail: "No pudimos cargar los usuarios.", traceId: "visual-trace" }, 500);
      return json(pageOf(scenario === "empty" ? [] : users));
    }
    if (path.startsWith("/api/users/")) {
      const row = users.find(user => user.id === path.split("/").at(-1));
      const detail: UserDetail | undefined = row ? { ...row, emailConfirmed: true, lastInvitation: null } : undefined;
      return json(detail);
    }
    if (path === "/.well-known/openid-configuration") return json({ issuer: location.origin, authorization_endpoint: `${location.origin}/connect/authorize` });
    throw new Error(`Missing visual fixture for ${request.method} ${path}`);
  };
}

