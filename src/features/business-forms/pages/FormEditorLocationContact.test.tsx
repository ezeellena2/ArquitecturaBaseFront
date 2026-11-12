import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeAll, beforeEach, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { initialAppearance } from "@/shared/lib/appearance";
import { notify } from "@/shared/ui/notifications";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { createFormFixtureStore, fixtureFormId } from "@/test/visual/formFixtures";
import { deliveryDefinition, deliveryIds } from "@/test/visual/locationContactFixtures";
import type { CanonicalQuestion, DraftQuestion } from "../model";
vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
vi.mock("@/shared/ui/notifications", async () => ({ ...await vi.importActual<typeof import("@/shared/ui/notifications")>("@/shared/ui/notifications"), notify: vi.fn() }));

// W3 (UC1-A): «Ubicación y contacto» in the editor of «Registrar entrega». It goes after «Preguntas» and «Lectura de documentos», is
// saved with the draft on each question, goes with a question that is removed or changes its type, and does not show where WhatsApp
// does not complete the form, keeping what was saved.
// The first test of a file pays the editor's lazy route; loading it beforehand keeps that wait out of the tests under load.
beforeAll(async () => { await import("./FormEditorPage"); }, 60000);
let store: ReturnType<typeof createFormFixtureStore>;
const ids = deliveryIds;
const me = (permissions = ["formtemplates.read", "formtemplates.manage", "formtemplates.publish"]) => http.get("/api/me", () => HttpResponse.json({ id: "actor", displayName: "Ana",
  email: "ana@example.com", emailConfirmed: true, phoneNumber: null, formattedPhoneNumber: null, maskedPhoneNumber: null, phoneNumberConfirmed: false, hasGoogleLogin: false, culture: "es",
  timeZoneId: "America/Argentina/Buenos_Aires", lastLoginAtUtc: null, roles: [], permissions }));
const presentation = (installedFeatures: string[]) => http.get("/api/settings/presentation", () => HttpResponse.json({ appearance: initialAppearance, defaultCulture: "es",
  defaultTimeZoneId: "America/Argentina/Buenos_Aires", defaultPageSize: 20, installedFeatures }));
beforeEach(() => {
  queryClient.clear();
  vi.mocked(notify).mockClear();
  store = createFormFixtureStore("es", "forms-location-contact");
  server.use(http.all("/api/forms/*", ({ request }) => store.handle(request)), me(), presentation(["assistant", "forms", "form-channels"]));
});
const zone = () => screen.findByRole("region", { name: "Ubicación y contacto" }, { timeout: 10_000 });
const save = () => act(async () => { await userEvent.click(screen.getByRole("button", { name: "Guardar borrador" })); });
const received = (fields: readonly DraftQuestion[] | undefined) => fields?.flatMap(question => "receives" in question && question.receives ? [[question.fieldId ?? question.localId, question.receives]] : []);
const sent = () => received(store.writes.at(-1)?.draft.fields);
const stored = () => received(openedFields());
const openedFields = () => store.definitions.get(fixtureFormId)?.draft.fields.map(question => ({ ...question, localId: question.fieldId, replacesFieldId: null }) as DraftQuestion);
const all = [[ids.address, "location"], [ids.receiver, "contactName"], [ids.phone, "contactPhone"]];

it("goes after «Preguntas» and «Lectura de documentos» and is saved with the draft, on each question", { timeout: 20_000 }, async () => {
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  const contact = await zone();
  const questions = screen.getByRole("region", { name: "Preguntas" });
  const reading = screen.getByRole("region", { name: "Lectura de documentos" });
  expect(questions.compareDocumentPosition(reading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(reading.compareDocumentPosition(contact) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByRole("button", { name: "Guardar borrador" })).toBeDisabled();

  await userEvent.selectOptions(within(contact).getByRole("combobox", { name: "Ubicación" }), ids.notes);
  await save();
  expect(sent()).toEqual([[ids.receiver, "contactName"], [ids.phone, "contactPhone"], [ids.notes, "location"]]);
  // Saved, the zone shows what the server kept and there is nothing left to save.
  await waitFor(() => expect(screen.getByRole("button", { name: "Guardar borrador" })).toBeDisabled());
  expect(within(contact).getByRole("combobox", { name: "Ubicación" })).toHaveDisplayValue("Observaciones (pregunta 5)");
});

it("keeps its three lists while a save is in flight, off until it answers: it is not read only", { timeout: 20_000 }, async () => {
  let release: () => void = () => {};
  server.use(http.put("/api/forms/definitions/:id/draft", async ({ request }) => { await new Promise<void>(resolve => { release = resolve; }); return store.handle(request); }));
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  const contact = await zone();
  await userEvent.selectOptions(within(contact).getByRole("combobox", { name: "Ubicación" }), ids.notes);
  await save();
  const lists = within(contact).getAllByRole("combobox");
  expect(lists).toHaveLength(3);
  for (const list of lists) expect(list).toBeDisabled();
  expect(within(contact).queryAllByRole("term")).toHaveLength(0);
  await act(async () => { release(); });
  await waitFor(() => expect(within(contact).getByRole("combobox", { name: "Ubicación" })).toBeEnabled());
  expect(within(contact).getByRole("combobox", { name: "Ubicación" })).toHaveDisplayValue("Observaciones (pregunta 5)");
});

it("gives a datum to a new question, still unsaved, by its local identity, and keeps it once the server names it", { timeout: 30_000 }, async () => {
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  const contact = await zone();
  await userEvent.click(screen.getByRole("button", { name: "Agregar pregunta" }));
  const added = [...document.querySelectorAll<HTMLElement>("[data-question-local-id]")].at(-1)!;
  await userEvent.type(within(added).getByRole("textbox", { name: "Pregunta" }), "Referencia");
  const phone = within(contact).getByRole("combobox", { name: "Teléfono del contacto" });
  await userEvent.selectOptions(phone, within(phone).getByRole("option", { name: "Referencia (pregunta 6)" }));
  await save();
  const localId = added.dataset.questionLocalId!;
  expect(sent()).toEqual([[ids.address, "location"], [ids.receiver, "contactName"], [localId, "contactPhone"]]);
  // Saved, the question has the field identity the server gave it, and the zone keeps it chosen.
  await waitFor(() => expect(screen.getByRole("button", { name: "Guardar borrador" })).toBeDisabled());
  const fieldId = store.definitions.get(fixtureFormId)!.draft.fields.find(question => question.label.es === "Referencia")!.fieldId;
  expect(fieldId).not.toBe(localId);
  expect(stored()).toEqual([[ids.address, "location"], [ids.receiver, "contactName"], [fieldId, "contactPhone"]]);
  expect(within(contact).getByRole("combobox", { name: "Teléfono del contacto" })).toHaveDisplayValue("Referencia (pregunta 6)");
});

it("takes the choice away with the question removed or whose type changes, and keeps it when it is renamed", { timeout: 30_000 }, async () => {
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  const contact = await zone();
  await userEvent.click(screen.getByRole("button", { name: "Quitar Recibió" }));
  await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Quitar pregunta" }));
  expect(within(contact).getByRole("combobox", { name: "Nombre del contacto" })).toHaveDisplayValue("Ninguna");

  // A long text is another question for the server: its row goes back to «Ninguna».
  await userEvent.click(screen.getByRole("button", { name: "Editar Teléfono de quien recibe" }));
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Tipo de respuesta" }), "longText");
  await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Cambiar tipo" }));
  await waitFor(() => expect(within(contact).getByRole("combobox", { name: "Teléfono del contacto" })).toHaveDisplayValue("Ninguna"));

  await userEvent.click(screen.getByRole("button", { name: "Editar Dirección de entrega" }));
  const label = screen.getByRole("textbox", { name: "Pregunta" });
  await userEvent.clear(label);
  await userEvent.type(label, "Domicilio de entrega");
  expect(within(contact).getByRole("combobox", { name: "Ubicación" })).toHaveDisplayValue("Domicilio de entrega (pregunta 1)");
  await save();
  expect(sent()).toEqual([[ids.address, "location"]]);
});

it("takes the choice away from a question that gets a condition, which WhatsApp does not prefill, and «Siempre» does not bring it back", { timeout: 30_000 }, async () => {
  // «¿Llegó completo?» goes first, so «Recibió» can show by its answer (CO1-A).
  const saved = deliveryDefinition("es");
  const delivered = { fieldId: "01990000-0000-7000-8000-000000000986", key: "field_01990000000070008000000000000986", type: "boolean", label: { es: "¿Llegó completo?", en: "Did it arrive complete?" },
    help: null, required: true } as CanonicalQuestion;
  store.definitions.set(fixtureFormId, { ...saved, draft: { ...saved.draft, fields: [delivered, ...saved.draft.fields] } });
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  const contact = await zone();
  const name = within(contact).getByRole("combobox", { name: "Nombre del contacto" });
  expect(name).toHaveDisplayValue("Recibió (pregunta 3)");
  await userEvent.click(screen.getByRole("button", { name: "Editar Recibió" }));
  const shows = screen.getByRole("group", { name: "Se muestra" });
  await userEvent.click(within(shows).getByRole("button", { name: "Según otra respuesta" }));
  await waitFor(() => expect(name).toHaveDisplayValue("Ninguna"));
  expect(within(name).queryByRole("option", { name: /^Recibió/ })).not.toBeInTheDocument();

  // Shown always again, it can be chosen, but the choice went with the condition.
  await userEvent.click(within(shows).getByRole("button", { name: "Siempre" }));
  expect(within(name).getByRole("option", { name: "Recibió (pregunta 3)" })).toBeEnabled();
  expect(name).toHaveDisplayValue("Ninguna");
  await save();
  expect(sent()).toEqual([[ids.address, "location"], [ids.phone, "contactPhone"]]);
});

it("with a question «Ubicación», leaves the location row off with its reason and the location goes to no text", { timeout: 30_000 }, async () => {
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  const contact = await zone();
  // «Observaciones» becomes the question «Ubicación»: the location goes there, by W1-A.
  await userEvent.click(screen.getByRole("button", { name: "Editar Observaciones" }));
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Tipo de respuesta" }), "location");
  await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Cambiar tipo" }));
  const location = await within(contact).findByRole("combobox", { name: "Ubicación" });
  await waitFor(() => expect(location).toBeDisabled());
  expect(location).toHaveDisplayValue("Observaciones (pregunta 5)");
  expect(location).toHaveAccessibleDescription("La ubicación va a la pregunta «Observaciones», que se pide antes de mandar el formulario.");
  await save();
  expect(sent()).toEqual([[ids.receiver, "contactName"], [ids.phone, "contactPhone"]]);
});

it("does not show with «Sólo en la app», and what was chosen stays saved", { timeout: 20_000 }, async () => {
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  await zone();
  await userEvent.click(within(screen.getByRole("group", { name: "Dónde se completa" })).getByRole("button", { name: "Sólo en la app" }));
  expect(screen.queryByRole("region", { name: "Ubicación y contacto" })).not.toBeInTheDocument();
  await save();
  expect(store.writes.at(-1)?.draft.appOnly).toBe(true);
  expect(sent()).toEqual(all);
});

it("does not show without a WhatsApp channel, and what was chosen stays saved", { timeout: 20_000 }, async () => {
  server.use(presentation(["forms"]));
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  await screen.findByRole("region", { name: "Preguntas" }, { timeout: 10_000 });
  await waitFor(() => expect(screen.queryByRole("region", { name: "Ubicación y contacto" })).not.toBeInTheDocument());
  await userEvent.type(screen.getByLabelText("Nombre"), " 2");
  await save();
  expect(sent()).toEqual(all);
});

it("is read without «Diseñar formularios»: each row says its question, without lists", { timeout: 20_000 }, async () => {
  server.use(me(["formtemplates.read"]));
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  const contact = await zone();
  expect(within(contact).queryAllByRole("combobox")).toHaveLength(0);
  expect(within(contact).getAllByRole("definition").map(value => value.textContent)).toEqual(["Dirección de entrega (pregunta 1)", "Recibió (pregunta 2)", "Teléfono de quien recibe (pregunta 3)"]);
});

it("keeps the questions chosen here after a conflict with «Conservar mis cambios»", { timeout: 30_000 }, async () => {
  let conflicted = false;
  server.use(http.put("/api/forms/definitions/:id/draft", ({ request }) => {
    if (conflicted) return store.handle(request);
    // Meanwhile someone else renamed the form.
    conflicted = true;
    const previous = store.definitions.get(fixtureFormId)!;
    store.definitions.set(fixtureFormId, { ...previous, revision: previous.revision + 1, name: { ...previous.name, es: "Entregas" } });
    return HttpResponse.json({ code: "Forms.Draft.RevisionConflict" }, { status: 409 });
  }));
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  const contact = await zone();
  await userEvent.selectOptions(within(contact).getByRole("combobox", { name: "Teléfono del contacto" }), "");
  await save();
  // While the review is pending, the lists stay where they were, off.
  const revise = await screen.findByRole("button", { name: "Revisar" });
  expect(within(contact).getAllByRole("combobox")).toHaveLength(3);
  for (const list of within(contact).getAllByRole("combobox")) expect(list).toBeDisabled();
  await userEvent.click(revise);
  const review = await screen.findByRole("dialog", { name: "Revisión del borrador" });
  // One change, with what differs: the phone, which goes to no question here; each question named as in the zone.
  expect(within(review).getByRole("rowheader", { name: "Ubicación y contacto" })).toBeInTheDocument();
  expect(within(review).getByRole("cell", { name: "Teléfono de quien recibe (pregunta 3)" })).toBeInTheDocument();
  expect(within(review).getByRole("cell", { name: "Ninguna" })).toBeInTheDocument();
  await userEvent.click(within(review).getByRole("button", { name: "Conservar mis cambios" }));
  await save();
  await waitFor(() => expect(store.definitions.get(fixtureFormId)?.revision).toBe(3));
  expect(stored()).toEqual([[ids.address, "location"], [ids.receiver, "contactName"]]);
});
