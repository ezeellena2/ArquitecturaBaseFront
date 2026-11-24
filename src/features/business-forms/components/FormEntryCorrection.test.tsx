import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { notify } from "@/shared/ui/notifications";
import { currentUser } from "@/test/mocks/handlers";
import { responseDetailFixture, responseFormId, responseRecordId, responseSecondId, responseSheetFixture, responseWorkflowFixture } from "@/test/responseFixtures";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import type { FormEntryCorrection, FormEntryQuestion } from "../api/entries";
import type { ResponseDetail } from "../api/responses";
import type { ResponseWorkflow } from "../api/workflow";

vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"),
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
vi.mock("@/shared/ui/notifications", async () => ({ ...await vi.importActual<typeof import("@/shared/ui/notifications")>("@/shared/ui/notifications"), notify: vi.fn() }));

const id = (value: number) => "0199a0c0-0000-7000-8000-" + String(value).padStart(12, "0");
const sheet = "/formularios/" + responseFormId + "/respuestas";
const full = (recordId: string) => sheet + "/" + recordId + "/completa";
const corrected = id(501);
const amount: FormEntryQuestion = { fieldId: id(30), type: "decimal", label: "Importe", help: null, required: true, maxLength: null, options: null, selection: null, files: null, catalog: null };
// Synthetic behavior DTO; the bodies exported by the backend qualify the contract in the entries contract tests. It is the
// version the response was answered with: nothing to tell about versions.
const correction: FormEntryCorrection = {
  entry: { definitionId: responseFormId, versionId: responseDetailFixture().entry!.entry.versionId, versionNumber: 2, prefix: "TEST", name: "Formulario publicado", culture: "es",
    submitLabel: "Enviar", maxFileSizeMiB: 25, questions: [
      amount,
      { fieldId: id(32), type: "photo", label: "Fotos", help: null, required: false, maxLength: null, options: null, selection: null,
        files: { minFiles: 0, maxFiles: 2, photoSource: "cameraOrGallery" }, catalog: null },
    ] },
  recordId: responseRecordId, number: "TEST-000002",
  answers: [{ fieldId: id(30), value: "12.5", choiceIds: null, options: null }],
  files: [{ fileId: id(70), fieldId: id(32), name: "lote.jpg", contentType: "image/jpeg", size: 2048, hasThumbnail: true }],
};
// The detail of any response, also of the correction once saved.
const detail = (recordId: string, canAmend: boolean): ResponseDetail =>
  ({ ...responseDetailFixture(recordId === responseSecondId ? recordId : responseRecordId), id: recordId, ...canAmend ? { canAmend: true as const } : {} });

function setup({ canAmend = true, open = () => HttpResponse.json(correction), save }: { canAmend?: boolean; open?: () => Response; save?: () => Response } = {}) {
  const sends: FormData[] = [];
  const voids: unknown[] = [];
  const reads = { details: 0 };
  server.use(
    http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formrecords.read", "formrecords.create"] })),
    http.post("/api/forms/definitions/:id/records/search", () => HttpResponse.json(responseSheetFixture())),
    // The only one, without neighbors: 1 of 2 without a next one breaks the contract and the page would say «Algo salió mal».
    http.post("/api/forms/definitions/:id/records/:recordId/navigation", ({ params }) => HttpResponse.json({ recordId: params.recordId, previousId: null, nextId: null, position: 1, totalCount: 1 })),
    http.get("/api/forms/records/:id", ({ params }) => { reads.details++; return HttpResponse.json(detail(String(params.id), canAmend)); }),
    http.get("/api/forms/records/:id/workflow", ({ params }) => HttpResponse.json(responseWorkflowFixture(String(params.id)))),
    http.get("/api/forms/entries/:formId/records/:recordId", () => open()),
    http.post("/api/forms/entries/:formId/records/:recordId", async ({ request }) => {
      sends.push(await request.formData());
      return save?.() ?? HttpResponse.json({ recordId: corrected, number: "TEST-000002", state: "Received", submittedAtUtc: "2026-10-16T12:00:00Z" });
    }),
    http.post("/api/forms/definitions/:formId/records/:recordId/void", async ({ request }) => { voids.push(await request.json()); return new HttpResponse(null, { status: 204 }); }),
  );
  return { sends, voids, reads };
}
/** Opens the full page of the response and starts correcting it there. */
async function correctInFull(user: ReturnType<typeof userEvent.setup>) {
  const result = renderRouteWithProviders(full(responseRecordId));
  await screen.findByRole("heading", { name: "TEST-000002", level: 1 }, { timeout: 10_000 });
  await user.click(await enabled("Corregir"));
  await screen.findByRole("heading", { name: "Corregir TEST-000002", level: 1 });
  return result;
}
/** A button of the band once the page stops reading where it stands: until then it is off. */
async function enabled(name: string) {
  await waitFor(() => expect(screen.getByRole("button", { name })).toBeEnabled());
  return screen.getByRole("button", { name });
}

beforeEach(() => { queryClient.clear(); vi.mocked(notify).mockClear(); });
afterEach(() => vi.restoreAllMocks());

describe("correcting a response in the quick view (VF1-A, decision 5)", () => {
  it("corrects in the same panel from the pencil, says what changed had before and saves only with a reason", { timeout: 20_000 }, async () => {
    const { sends } = setup();
    const user = userEvent.setup({ delay: null });
    const { router } = renderRouteWithProviders(sheet + "/" + responseRecordId);
    // The first case of the file pays the lazy load of the sheet; findBy's second is not enough under load.
    const quick = await screen.findByRole("region", { name: "Detalle de la respuesta" }, { timeout: 10_000 });
    await user.click(await within(quick).findByRole("button", { name: "Corregir" }));
    const panel = await screen.findByRole("region", { name: "Corregir TEST-000002 de Formulario publicado" });
    expect(router.state.location.pathname).toBe(sheet + "/" + responseRecordId);
    expect(screen.queryByRole("region", { name: "Detalle de la respuesta" })).not.toBeInTheDocument();
    const value = await within(panel).findByLabelText(/^Importe/);
    expect(value).toHaveValue("12,5");
    expect(within(panel).getByText("lote.jpg")).toBeInTheDocument();
    expect(within(panel).queryByText(/^Antes:/)).not.toBeInTheDocument();

    await user.clear(value);
    await user.type(value, "13");
    expect(within(panel).getByText("Antes: 12,5")).toBeInTheDocument();
    await user.click(within(panel).getByRole("button", { name: "Guardar corrección" }));
    expect(await within(panel).findByText("Escribí el motivo.")).toBeInTheDocument();
    expect(sends).toHaveLength(0);

    await user.type(within(panel).getByLabelText(/^Motivo de la corrección/), "El importe era 13.");
    await user.click(within(panel).getByRole("button", { name: "Guardar corrección" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "success", message: "Se corrigió TEST-000002" })));
    expect(JSON.parse(String(sends[0].get("answers")))).toEqual([{ fieldId: id(30), value: "13" }]);
    expect(sends[0].get("reason")).toBe("El importe era 13.");
    expect(sends[0].getAll("keptFileIds")).toEqual([id(70)]);
    await waitFor(() => expect(router.state.location.pathname).toBe(sheet + "/" + corrected));
    expect(await screen.findByRole("region", { name: "Detalle de la respuesta" })).toBeInTheDocument();
  });

  it("reads the response again when the panel closes without changes", async () => {
    setup();
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders(sheet + "/" + responseRecordId);
    await user.click(await within(await screen.findByRole("region", { name: "Detalle de la respuesta" })).findByRole("button", { name: "Corregir" }));
    const panel = await screen.findByRole("region", { name: "Corregir TEST-000002 de Formulario publicado" });
    await within(panel).findByLabelText(/^Importe/);
    await user.click(within(panel).getByRole("button", { name: "Cancelar" }));
    const quick = await screen.findByRole("region", { name: "Detalle de la respuesta" });
    expect(within(quick).getByRole("button", { name: "Corregir" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "¿Descartar la corrección?" })).not.toBeInTheDocument();
  });

  it("asks before closing with changes and keeps them to go on correcting", async () => {
    setup();
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders(sheet + "/" + responseRecordId);
    await user.click(await within(await screen.findByRole("region", { name: "Detalle de la respuesta" })).findByRole("button", { name: "Corregir" }));
    const panel = await screen.findByRole("region", { name: "Corregir TEST-000002 de Formulario publicado" });
    const value = await within(panel).findByLabelText(/^Importe/);
    await user.clear(value);
    await user.type(value, "13");
    await user.click(within(panel).getByRole("button", { name: "Cancelar" }));
    const ask = await screen.findByRole("dialog", { name: "¿Descartar la corrección?" });
    await user.click(within(ask).getByRole("button", { name: "Seguir corrigiendo" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "¿Descartar la corrección?" })).not.toBeInTheDocument());
    expect(within(panel).getByLabelText(/^Importe/)).toHaveValue("13");
  });

  it("goes back to the quick view when saving finds the response changed meanwhile and says so on top (O52)", { timeout: 20_000 }, async () => {
    const { reads } = setup({ save: () => HttpResponse.json({ title: "Conflict", status: 409, code: "Forms.Record.AmendUnavailable" }, { status: 409 }) });
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders(sheet + "/" + responseRecordId);
    await user.click(await within(await screen.findByRole("region", { name: "Detalle de la respuesta" }, { timeout: 10_000 })).findByRole("button", { name: "Corregir" }));
    const panel = await screen.findByRole("region", { name: "Corregir TEST-000002 de Formulario publicado" });
    await user.type(await within(panel).findByLabelText(/^Motivo de la corrección/), "El importe era 13.");
    await user.click(within(panel).getByRole("button", { name: "Guardar corrección" }));

    const quick = await screen.findByRole("region", { name: "Detalle de la respuesta" });
    expect(within(quick).getByText("Esta respuesta ya no se puede corregir.")).toBeInTheDocument();
    expect(notify).not.toHaveBeenCalledWith(expect.objectContaining({ kind: "error" }));
    const before = reads.details;
    await user.click(within(quick).getByRole("button", { name: "Ver la actual" }));
    await waitFor(() => expect(reads.details).toBeGreaterThan(before));
    expect(within(quick).queryByText("Esta respuesta ya no se puede corregir.")).not.toBeInTheDocument();
  });

  it("offers nothing to whoever may not change the response", async () => {
    setup({ canAmend: false });
    renderRouteWithProviders(sheet + "/" + responseRecordId);
    expect(await screen.findByRole("heading", { name: "TEST-000002" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Corregir" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Más acciones" })).not.toBeInTheDocument();
  });
});

describe("correcting a response in the full page (VF1-A, decision 5)", () => {
  it("unlocks the controls on the same page, with «Cancelar» and «Guardar corrección» and without ⋮, ↑ ↓ nor the activity", { timeout: 20_000 }, async () => {
    setup();
    const user = userEvent.setup({ delay: null });
    const { router } = renderRouteWithProviders(full(responseRecordId));
    await screen.findByRole("heading", { name: "TEST-000002", level: 1 }, { timeout: 10_000 });
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Actividad" })).toBeInTheDocument();

    await user.click(await enabled("Corregir"));
    expect(await screen.findByRole("heading", { name: "Corregir TEST-000002", level: 1 })).toBeInTheDocument();
    expect(await screen.findByLabelText(/^Importe/)).toHaveValue("12,5");
    expect(router.state.location.pathname).toBe(full(responseRecordId));
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar corrección" })).toBeInTheDocument();
    for (const name of ["Corregir", "Más acciones", "Anterior", "Siguiente"]) expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Actividad" })).not.toBeInTheDocument();
    // The version it is corrected with is the one it was answered with: nothing to tell.
    expect(screen.queryByText(/^Se corrige con la versión/)).not.toBeInTheDocument();

    // Without changes, «Cancelar» reads it again.
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(await screen.findByRole("heading", { name: "TEST-000002", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Corregir" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "¿Descartar la corrección?" })).not.toBeInTheDocument();
  });

  it("asks before cancelling with changes, and saving reads the new response at its full route", { timeout: 20_000 }, async () => {
    const { sends } = setup();
    const user = userEvent.setup({ delay: null });
    const { router } = await correctInFull(user);
    const value = await screen.findByLabelText(/^Importe/);
    await user.clear(value);
    await user.type(value, "13");
    expect(screen.getByText("Antes: 12,5")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await user.click(within(await screen.findByRole("dialog", { name: "¿Descartar la corrección?" })).getByRole("button", { name: "Seguir corrigiendo" }));
    expect(screen.getByLabelText(/^Importe/)).toHaveValue("13");

    await user.type(screen.getByLabelText(/^Motivo de la corrección/), "El importe era 13.");
    await user.click(screen.getByRole("button", { name: "Guardar corrección" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "success", message: "Se corrigió TEST-000002" })));
    expect(JSON.parse(String(sends[0].get("answers")))).toEqual([{ fieldId: id(30), value: "13" }]);
    await waitFor(() => expect(router.state.location.pathname).toBe(full(corrected)));
    expect(await screen.findByRole("heading", { name: "TEST-000002", level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar corrección" })).not.toBeInTheDocument();
  });

  it("on the phone keeps «Cancelar» in the band and «Guardar corrección» fixed at the foot, after the reason", async () => {
    vi.spyOn(globalThis, "matchMedia").mockImplementation(query => ({ matches: query === "(width < 640px)", media: query, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
    setup();
    const user = userEvent.setup({ delay: null });
    await correctInFull(user);
    const reason = await screen.findByLabelText(/^Motivo de la corrección/);
    const [save, ...others] = screen.getAllByRole("button", { name: "Guardar corrección" });
    expect(others).toHaveLength(0);
    expect(reason.compareDocumentPosition(save!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancelar" }).compareDocumentPosition(reason) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("says when the response can no longer be corrected and reads the current one again", async () => {
    const { reads } = setup({ open: () => HttpResponse.json({ title: "Conflict", status: 409, code: "Forms.Record.AmendUnavailable" }, { status: 409 }) });
    const user = userEvent.setup({ delay: null });
    await correctInFull(user);
    expect(await screen.findByText("Esta respuesta ya no se puede corregir.")).toBeInTheDocument();
    const before = reads.details;
    await user.click(screen.getByRole("button", { name: "Ver la actual" }));
    expect(await screen.findByRole("heading", { name: "TEST-000002", level: 1 })).toBeInTheDocument();
    await waitFor(() => expect(reads.details).toBeGreaterThan(before));
  });

  // Board «VF · A completa»: corrected by someone else, decided or voided while it was corrected, the save comes back with a 409;
  // a 403 is the same for whoever stopped being able to change it.
  it.each([
    { reply: "409", body: { title: "Conflict", status: 409, code: "Forms.Record.AmendUnavailable", detail: "La respuesta cambió y ya no se puede corregir ni anular. Recargá para ver cómo quedó." } },
    { reply: "403", body: { title: "Forbidden", status: 403 } },
  ])("goes back to reading when saving answers $reply, says so on top and «Ver la actual» reads it again (O52)", { timeout: 20_000 }, async ({ body }) => {
    const { reads } = setup({ save: () => HttpResponse.json(body, { status: body.status }) });
    const user = userEvent.setup({ delay: null });
    await correctInFull(user);
    await user.type(await screen.findByLabelText(/^Motivo de la corrección/), "El importe era 13.");
    await user.click(screen.getByRole("button", { name: "Guardar corrección" }));

    expect(await screen.findByRole("heading", { name: "TEST-000002", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Esta respuesta ya no se puede corregir.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar corrección" })).not.toBeInTheDocument();
    expect(notify).not.toHaveBeenCalledWith(expect.objectContaining({ kind: "error" }));
    const before = reads.details;
    await user.click(screen.getByRole("button", { name: "Ver la actual" }));
    await waitFor(() => expect(reads.details).toBeGreaterThan(before));
    expect(screen.queryByText("Esta respuesta ya no se puede corregir.")).not.toBeInTheDocument();
  });

  it("offers «Reintentar» when the correction could not be opened", async () => {
    let attempts = 0;
    setup({ open: () => ++attempts === 1 ? new HttpResponse(null, { status: 500 }) : HttpResponse.json(correction) });
    const user = userEvent.setup({ delay: null });
    await correctInFull(user);
    expect(await screen.findByText("No se pudo abrir la respuesta para corregirla.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByLabelText(/^Importe/)).toHaveValue("12,5");
  });

  it("waits out a 429 with the wait as the reason of «Guardar corrección»", async () => {
    setup({ save: () => HttpResponse.json({ title: "Too many requests", status: 429, retryAfter: 30 }, { status: 429 }) });
    const user = userEvent.setup({ delay: null });
    await correctInFull(user);
    await user.type(await screen.findByLabelText(/^Motivo de la corrección/), "El importe era 13.");
    await user.click(screen.getByRole("button", { name: "Guardar corrección" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Guardar corrección" })).toHaveAttribute("aria-disabled", "true"));
    expect(screen.getByRole("button", { name: "Guardar corrección" })).toHaveAccessibleDescription(/^Esperá \d+ segundos para volver a intentar\.$/);
  });
});

describe("the version a response is corrected with (VF1-A, decision 6)", () => {
  const notes: FormEntryQuestion = { ...amount, fieldId: id(31), type: "longText", label: "Observaciones", required: false, maxLength: 600 };
  const recipe: FormEntryQuestion = { ...amount, fieldId: id(36), type: "document", label: "Receta agronómica", required: false, files: { minFiles: 0, maxFiles: 1, photoSource: null } };
  const active = (questions: FormEntryQuestion[]): FormEntryCorrection =>
    ({ ...correction, entry: { ...correction.entry, versionId: id(403), versionNumber: 3, questions }, files: [] });

  it("says on top that it is corrected with the active version and what answered starts empty", async () => {
    setup({ open: () => HttpResponse.json(active([amount, recipe])) });
    const user = userEvent.setup({ delay: null });
    await correctInFull(user);
    expect(await screen.findByText("Se corrige con la versión 3 del formulario, la activa: «Receta agronómica» arranca vacía.")).toBeInTheDocument();
  });

  it("names several questions as a list, and only the version when everything comes along", async () => {
    let questions = [amount, notes, recipe];
    setup({ open: () => HttpResponse.json(active(questions)) });
    const user = userEvent.setup({ delay: null });
    await correctInFull(user);
    // «Observaciones» was answered in version 2 and its answer does not come along; «Detalle opcional» was left empty.
    expect(await screen.findByText("Se corrige con la versión 3 del formulario, la activa: «Observaciones» y «Receta agronómica» arrancan vacías.")).toBeInTheDocument();

    questions = [amount];
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await screen.findByRole("heading", { name: "TEST-000002", level: 1 });
    await user.click(await enabled("Corregir"));
    expect(await screen.findByText("Se corrige con la versión 3 del formulario, la activa.")).toBeInTheDocument();
  });
});

describe("/corregir (VF1-A, decision 5)", () => {
  it("leads to the full page of the same response, reading, in place of /corregir", async () => {
    setup();
    const { router } = renderRouteWithProviders(sheet + "/" + responseRecordId + "/corregir");
    expect(await screen.findByRole("heading", { name: "TEST-000002", level: 1 }, { timeout: 10_000 })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(full(responseRecordId));
    expect(router.state.historyAction).toBe("REPLACE");
    expect(screen.queryByRole("button", { name: "Guardar corrección" })).not.toBeInTheDocument();
  });
});

describe("voiding a response (CW11-A)", () => {
  it("asks for the reason, voids it, says so and closes the detail", async () => {
    const { voids } = setup();
    const user = userEvent.setup({ delay: null });
    const { router } = renderRouteWithProviders(sheet + "/" + responseRecordId);
    await user.click(await screen.findByRole("button", { name: "Más acciones" }, { timeout: 10_000 }));
    await user.click(await screen.findByRole("menuitem", { name: "Anular" }));
    const dialog = await screen.findByRole("dialog", { name: "¿Anular TEST-000002?" });
    expect(within(dialog).getByText("TEST-000002 queda en la planilla como anulada, con su número; deja de contar y no sale en el Excel.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Anular respuesta" }));
    expect(await within(dialog).findByText("Escribí el motivo.")).toBeInTheDocument();
    expect(voids).toHaveLength(0);

    await user.type(within(dialog).getByLabelText(/^Motivo/), "Cargada dos veces.");
    await user.click(within(dialog).getByRole("button", { name: "Anular respuesta" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "success", message: "Se anuló TEST-000002" })));
    expect(voids).toEqual([{ reason: "Cargada dos veces." }]);
    await waitFor(() => expect(router.state.location.pathname).toBe(sheet));
  });

  // CW11-A: «Anular» lives in ⋮, after the icons; the keyboard reaches it and the focus comes back to ⋮.
  it("reaches «Anular» in ⋮ with the keyboard, and the focus goes back to ⋮ when the menu closes", async () => {
    setup();
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders(sheet + "/" + responseRecordId);
    const more = await screen.findByRole("button", { name: "Más acciones" });
    act(() => more.focus());
    await user.keyboard("{Enter}");
    let menu = await screen.findByRole("menu");

    expect(within(menu).getAllByRole("menuitem").map(item => item.textContent)).toEqual(["Anular"]);
    await waitFor(() => expect(within(menu).getByRole("menuitem", { name: "Anular" })).toHaveFocus());
    await user.keyboard("{Escape}");
    await waitFor(() => expect(more).toHaveFocus());
    await user.keyboard("{Enter}");
    menu = await screen.findByRole("menu");
    await waitFor(() => expect(within(menu).getByRole("menuitem", { name: "Anular" })).toHaveFocus());
    await user.keyboard("{Enter}");

    expect(await screen.findByRole("dialog", { name: "¿Anular TEST-000002?" })).toBeInTheDocument();
  });
});

describe("reading what a correction or a void left (CW10-A, CW11-A)", () => {
  const juan = { userId: id(377), displayName: "Juan Gómez" };
  function read(changes: Partial<ResponseDetail>, workflow: Partial<ResponseWorkflow>) {
    server.use(
      http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formrecords.read"] })),
      http.post("/api/forms/definitions/:id/records/search", () => HttpResponse.json(responseSheetFixture())),
      http.post("/api/forms/definitions/:id/records/:recordId/navigation", ({ params }) => HttpResponse.json({ recordId: params.recordId, previousId: null, nextId: null, position: 1, totalCount: 1 })),
      http.get("/api/forms/records/:id", ({ params }) => HttpResponse.json({ ...responseDetailFixture(String(params.id)), ...changes })),
      http.get("/api/forms/records/:id/workflow", ({ params }) => HttpResponse.json({ ...responseWorkflowFixture(String(params.id)), ...workflow })),
    );
  }

  it("says «Anulada» with who voided it, when and why, and offers nothing else", async () => {
    read({ void: { atUtc: "2026-10-16T14:25:00Z", by: juan, reason: "Cargada dos veces." } }, { recordState: "Voided" });
    renderRouteWithProviders(sheet + "/" + responseRecordId);
    expect(await screen.findByRole("heading", { name: "Anulada", level: 3 })).toBeInTheDocument();
    expect(screen.getByText("Juan Gómez · «Cargada dos veces.»")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Corregir" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Más acciones" })).not.toBeInTheDocument();
  });

  it("tells how an approved response ended, who corrected it and why, and that it is to approve again", async () => {
    read({ correction: { previousRecordId: id(499), atUtc: "2026-10-16T14:20:00Z", by: juan, reason: "Importe equivocado.", previousState: "Approved",
      previousDecidedAtUtc: "2026-10-16T13:10:00Z", previousDecidedBy: { userId: id(378), displayName: "Laura Ríos" }, previousPdfAtUtc: "2026-10-16T13:11:00Z" } },
    { recordState: "PendingApproval", task: { id: id(371), roleId: id(375), roleName: "Supervisión", requestedAtUtc: "2026-10-16T14:20:00Z", state: "Open", revision: 1,
      decidedAtUtc: null, decidedBy: null, reason: null } });
    renderRouteWithProviders(sheet + "/" + responseRecordId);
    expect(await screen.findByRole("heading", { name: "Corregida", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Aprobada", level: 3 })).toBeInTheDocument();
    expect(screen.getByText(/^Laura Ríos · PDF del /)).toBeInTheDocument();
    expect(screen.getByText("Juan Gómez · «Importe equivocado.»")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver la versión anterior y su PDF" })).toHaveAttribute("href", "/formularios/" + responseFormId + "/respuestas/" + id(499) + "/completa");
    expect(await screen.findByRole("heading", { name: "Por aprobar otra vez", level: 3 })).toBeInTheDocument();
    expect(screen.getByText("el PDF nuevo sale al aprobarla")).toBeInTheDocument();
  });
});
