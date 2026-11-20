import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeAll, beforeEach, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { initialAppearance } from "@/shared/lib/appearance";
import { notify } from "@/shared/ui/notifications";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { readingDefinition, readingIds, transferReceiptStandard } from "@/test/visual/documentReadingFixtures";
import { createFormFixtureStore, fixtureFormId } from "@/test/visual/formFixtures";
vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
vi.mock("@/shared/ui/notifications", async () => ({ ...await vi.importActual<typeof import("@/shared/ui/notifications")>("@/shared/ui/notifications"), notify: vi.fn() }));

// DOC1: «Lectura de documentos» in the editor of «Pagos de clientes», a copy of «Comprobante de transferencia». It is saved with the
// draft, its problems go under its controls and it does not show where WhatsApp does not complete the form nor without the AI.
// The first test of a file pays the editor's lazy route; loading it beforehand keeps that wait out of the tests under load.
beforeAll(async () => { await import("./FormEditorPage"); }, 60000);
let store: ReturnType<typeof createFormFixtureStore>;
const presentation = (installedFeatures: string[]) => http.get("/api/settings/presentation", () => HttpResponse.json({ appearance: initialAppearance, defaultCulture: "es",
  defaultTimeZoneId: "America/Argentina/Buenos_Aires", defaultPageSize: 20, installedFeatures }));
beforeEach(() => {
  queryClient.clear();
  vi.mocked(notify).mockClear();
  store = createFormFixtureStore("es", "forms-library-reading");
  server.use(
    http.get("/api/forms/library", () => HttpResponse.json({ standards: [transferReceiptStandard("es")] })),
    http.all("/api/forms/*", ({ request }) => store.handle(request)),
    http.get("/api/me", () => HttpResponse.json({ id: "actor", displayName: "Ana", email: "ana@example.com", emailConfirmed: true, phoneNumber: null, formattedPhoneNumber: null, maskedPhoneNumber: null, phoneNumberConfirmed: false, hasGoogleLogin: false, culture: "es", timeZoneId: "America/Argentina/Buenos_Aires", lastLoginAtUtc: null, roles: [],
      permissions: ["formtemplates.read", "formtemplates.manage", "formtemplates.publish", "formcatalogs.read", "formrecords.read"] })),
    presentation(["assistant", "forms", "form-channels"]));
});
const zone = async () => { await userEvent.click(await screen.findByRole("button", { name: "Expandir «Lectura de documentos»" }, { timeout: 10_000 })); };
const save = () => act(async () => { await userEvent.click(screen.getByRole("button", { name: "Guardar borrador" })); });
const saved = () => readingDefinition("es").draft.documentReading!;
// The real texts of the server: a value of the draft it rejects, and a lookup whose field no longer compares when publishing.
const contentInvalid = "Revisá el valor y los límites de autoría del borrador.";
const lookupInvalid = "Revisá el cruce con el catálogo de la lectura de documentos: el campo ya no está o no se puede comparar con esa pregunta.";

it("goes after «Preguntas» and is saved with the draft: turned off, it keeps what was written", { timeout: 20_000 }, async () => {
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  await zone();
  const questions = screen.getByRole("region", { name: "Preguntas" });
  const reading = screen.getByRole("region", { name: "Lectura de documentos" });
  expect(questions.compareDocumentPosition(reading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByRole("button", { name: "Guardar borrador" })).toBeDisabled();

  await userEvent.click(within(reading).getByRole("checkbox", { name: "Leer los documentos que lleguen por WhatsApp" }));
  await save();
  expect(store.writes.at(-1)?.draft.documentReading).toEqual({ ...saved(), enabled: false });
  // The bound questions go back with their fixed validation.
  expect(store.writes.at(-1)?.draft.fields.find(question => question.fieldId === readingIds.sourceAccount)).toMatchObject({ validation: "bankAccount" });
});

it("keeps its controls while a save is in flight, off until it answers: it is not read only", { timeout: 20_000 }, async () => {
  let release: () => void = () => {};
  server.use(http.put("/api/forms/definitions/:id/draft", async ({ request }) => { await new Promise<void>(resolve => { release = resolve; }); return store.handle(request); }));
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  await zone();
  await userEvent.type(screen.getByRole("textbox", { name: /^Cómo reconocerlo/ }), " Banco Sur.");
  await save();
  // Nothing goes away nor changes place: «Agregar cruce», the lookup with its trash and the switch stay, off.
  expect(screen.getByRole("button", { name: "Agregar cruce" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Quitar el cruce 1" })).toBeDisabled();
  expect(screen.getByRole("button", { name: /^Cruce 1 · Dato leído / })).toBeDisabled();
  expect(screen.getByRole("checkbox", { name: "Leer los documentos que lleguen por WhatsApp" })).toBeDisabled();
  expect(screen.getByRole("textbox", { name: /^Cómo reconocerlo/ })).toHaveAttribute("readonly");
  await act(async () => { release(); });
  await waitFor(() => expect(screen.getByRole("button", { name: "Agregar cruce" })).toBeEnabled());
  expect(screen.getByRole("button", { name: /^Cruce 1 · Dato leído / })).toBeEnabled();
  expect(screen.getByRole("textbox", { name: /^Cómo reconocerlo/ })).not.toHaveAttribute("readonly");
});

it("turned off, a lookup left half chosen goes: saving does not stop on what it no longer shows", { timeout: 20_000 }, async () => {
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  await zone();
  await userEvent.click(screen.getByRole("button", { name: "Agregar cruce" }));
  await userEvent.click(screen.getByRole("checkbox", { name: "Leer los documentos que lleguen por WhatsApp" }));
  await save();
  expect(store.writes.at(-1)?.draft.documentReading).toEqual({ ...saved(), enabled: false });
});

it("does not save without «Cómo reconocerlo» while it is on: it says so under it, with the focus there and without the common notice", { timeout: 20_000 }, async () => {
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  await zone();
  const recognition = screen.getByRole("textbox", { name: /^Cómo reconocerlo/ });
  await userEvent.clear(recognition);
  await save();
  expect(store.writes).toHaveLength(0);
  expect(await screen.findByText("Escribí cómo reconocer el documento.")).toBeInTheDocument();
  await waitFor(() => expect(recognition).toHaveFocus());
  expect(vi.mocked(notify).mock.calls.filter(([notice]) => notice.kind === "error")).toHaveLength(0);
});

it("shows under its lookup the problem the server found when saving, with the focus there and without the common notice", { timeout: 20_000 }, async () => {
  server.use(http.put("/api/forms/definitions/:id/draft", () => HttpResponse.json({ code: "Validation.Failed", errors: { "draft.documentReading.lookups[0].field": [contentInvalid] } }, { status: 400 })));
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  await zone();
  await userEvent.type(screen.getByRole("textbox", { name: /^Cómo reconocerlo/ }), " Banco Sur.");
  await save();
  expect(await screen.findByText("Se busca por: revisá el valor y los límites de autoría del borrador.")).toBeInTheDocument();
  const field = screen.getByRole("button", { name: /^Cruce 1 · Se busca por / });
  expect(field).toHaveAttribute("aria-invalid", "true");
  await waitFor(() => expect(field).toHaveFocus());
  expect(vi.mocked(notify).mock.calls.filter(([notice]) => notice.kind === "error")).toHaveLength(0);
});

it("does not save a lookup still to complete: it opens the zone and takes the focus to what it lacks", { timeout: 20_000 }, async () => {
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  await zone();
  await userEvent.click(screen.getByRole("button", { name: "Agregar cruce" }));
  await userEvent.click(screen.getByRole("button", { name: "Plegar «Lectura de documentos»" }));
  await save();
  expect(store.writes).toHaveLength(0);
  await waitFor(() => expect(screen.getByRole("button", { name: /^Cruce 2 · Dato leído / })).toHaveFocus());
  expect(screen.getByText("Elegí el dato leído, la pregunta que completa y por qué se busca.")).toBeInTheDocument();
});

it("names a new question by its local identity, and once saved by the field identity the server gave it", { timeout: 30_000 }, async () => {
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  await userEvent.click(await screen.findByRole("button", { name: "Agregar pregunta" }, { timeout: 10_000 }));
  const added = [...document.querySelectorAll<HTMLElement>("[data-question-local-id]")].at(-1)!;
  await userEvent.type(within(added).getByRole("textbox", { name: "Pregunta" }), "Referencia");
  await zone();
  await userEvent.click(screen.getByRole("button", { name: "Agregar cruce" }));
  await pick(/^Cruce 2 · Dato leído /, /^Referencia \(pregunta \d+\)$/);
  await pick(/^Cruce 2 · Completa /, /^Banco o billetera de origen/);
  await pick(/^Cruce 2 · Se busca por /, "Código");
  await save();
  const sent = store.writes.at(-1)!;
  const localId = sent.draft.fields.find(question => question.label.es === "Referencia")!.localId;
  expect(sent.draft.documentReading?.lookups[1]).toEqual({ questionId: readingIds.sourceBank, sourceQuestionId: localId, field: "code" });
  const fieldId = store.definitions.get(fixtureFormId)!.draft.fields.find(question => question.label.es === "Referencia")!.fieldId;
  expect(fieldId).not.toBe(localId);
  if (screen.queryByRole("button", { name: "Expandir «Lectura de documentos»" })) await zone();
  await waitFor(() => expect(screen.getByRole("button", { name: /^Cruce 2 · Dato leído Referencia \(pregunta \d+\)$/ })).toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Guardar borrador" })).toBeDisabled();
});

it("takes away the lookup of a question that is removed, also from what is saved", { timeout: 20_000 }, async () => {
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  await userEvent.click(await screen.findByRole("button", { name: "Quitar Cliente" }, { timeout: 10_000 }));
  await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Quitar pregunta" }));
  await zone();
  expect(screen.queryByRole("button", { name: /^Cruce 1 · Dato leído / })).not.toBeInTheDocument();
  await save();
  expect(store.writes.at(-1)?.draft.documentReading).toEqual({ ...saved(), lookups: [] });
});

it("keeps the reading written here after a conflict with «Conservar mis cambios»", { timeout: 30_000 }, async () => {
  let conflicted = false;
  server.use(http.put("/api/forms/definitions/:id/draft", ({ request }) => {
    if (conflicted) return store.handle(request);
    // Meanwhile someone else renamed the form.
    conflicted = true;
    const previous = store.definitions.get(fixtureFormId)!;
    store.definitions.set(fixtureFormId, { ...previous, revision: previous.revision + 1, name: { ...previous.name, es: "Pagos recibidos" } });
    return HttpResponse.json({ code: "Forms.Draft.RevisionConflict" }, { status: 409 });
  }));
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  await zone();
  const recognition = screen.getByRole("textbox", { name: /^Cómo reconocerlo/ });
  await userEvent.clear(recognition);
  await userEvent.type(recognition, "Comprobante de Banco Sur.");
  await save();
  await userEvent.click(await screen.findByRole("button", { name: "Revisar" }));
  const review = await screen.findByRole("dialog", { name: "Revisión del borrador" });
  // One change, with what differs: «Cómo reconocerlo».
  expect(within(review).getByRole("rowheader", { name: "Lectura de documentos" })).toBeInTheDocument();
  expect(within(review).getByRole("cell", { name: "Comprobante de Banco Sur." })).toBeInTheDocument();
  await userEvent.click(within(review).getByRole("button", { name: "Conservar mis cambios" }));
  await save();
  await waitFor(() => expect(store.definitions.get(fixtureFormId)?.revision).toBe(3));
  expect(store.definitions.get(fixtureFormId)?.draft.documentReading).toEqual({ ...saved(), recognition: "Comprobante de Banco Sur." });
});

it("does not show where WhatsApp does not complete the form: what was saved stays, and a lookup left half chosen goes", { timeout: 20_000 }, async () => {
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  await zone();
  await userEvent.click(screen.getByRole("button", { name: "Agregar cruce" }));
  await userEvent.click(within(screen.getByRole("group", { name: "Dónde se completa" })).getByRole("button", { name: "Sólo en la app" }));
  expect(screen.queryByRole("region", { name: "Lectura de documentos" })).not.toBeInTheDocument();
  await save();
  expect(store.writes.at(-1)?.draft.appOnly).toBe(true);
  expect(store.writes.at(-1)?.draft.documentReading).toEqual(saved());
});

it("does not show without the AI that reads, and what was saved stays", { timeout: 20_000 }, async () => {
  server.use(presentation(["forms", "form-channels"]));
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  await screen.findByRole("region", { name: "Preguntas" }, { timeout: 10_000 });
  await waitFor(() => expect(screen.queryByRole("region", { name: "Lectura de documentos" })).not.toBeInTheDocument());
  await userEvent.type(screen.getByLabelText("Nombre"), " 2");
  await save();
  expect(store.writes.at(-1)?.draft.documentReading).toEqual(saved());
});

it("takes a problem of a lookup found when publishing to the lookup, with «Ir al cruce»", { timeout: 20_000 }, async () => {
  const issue = { channelId: null, fieldId: readingIds.client, choiceId: null, path: "draft.documentReading.lookups[0].field", code: "Forms.Publication.DocumentLookupInvalid",
    message: lookupInvalid, limit: null, culture: null };
  server.use(http.post("/api/forms/definitions/:id/publication-checks", () => HttpResponse.json({ definitionId: fixtureFormId, draftRevision: 1, nextVersionNumber: 1,
    compatibility: "Blocked", canAccept: false, acceptanceAvailability: "Available", checkToken: null, checkExpiresAtUtc: null, channels: [], issues: [issue], warnings: [],
    cultures: [{ culture: "es", isOriginal: true, isComplete: true, missing: [] }], diff: { baseVersionId: null, added: [], changed: [], removed: [], addedCultures: [], removedCultures: [] } })));
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  await userEvent.click(await screen.findByRole("button", { name: "Publicar en WhatsApp" }, { timeout: 10_000 }));
  const dialog = await screen.findByRole("dialog");
  await userEvent.click(await within(dialog).findByRole("button", { name: "Ir al cruce" }));
  const field = await screen.findByRole("button", { name: /^Cruce 1 · Se busca por / });
  await waitFor(() => expect(field).toHaveFocus());
  expect(field).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByText("Se busca por: " + lookupInvalid.charAt(0).toLowerCase() + lookupInvalid.slice(1))).toBeInTheDocument();
});

// The Picker opens with the keyboard, like the other Radix lists in the tests; its button says the label and the chosen one.
async function openList(trigger: string | RegExp | HTMLElement) {
  const button = trigger instanceof HTMLElement ? trigger : screen.getByRole("button", { name: trigger });
  await act(async () => { button.focus(); });
  await userEvent.keyboard("{Enter}");
  return screen.findByRole("listbox");
}
async function pick(trigger: string | RegExp | HTMLElement, option: string | RegExp) {
  await userEvent.click(within(await openList(trigger)).getByRole("option", { name: option }));
}
