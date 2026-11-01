import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { notify } from "@/shared/ui/notifications";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import type { FormEntry } from "../api/entries";

vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"),
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
vi.mock("@/shared/ui/notifications", async () => ({ ...await vi.importActual<typeof import("@/shared/ui/notifications")>("@/shared/ui/notifications"), notify: vi.fn() }));

const id = (value: number) => "0199a0c0-0000-7000-8000-" + String(value).padStart(12, "0");
const formId = id(301);
const fields = { lot: id(311), rain: id(312), date: id(313), notes: id(314), photos: id(315) };
const lots = [{ id: id(321), title: "Lote 4", description: "Campo Norte" }, { id: id(322), title: "Lote 7", description: null }];

// Synthetic behavior DTO; the bodies exported by the backend qualify the contract in entriesHttpContract.
function entry(versionNumber = 3): FormEntry {
  return { definitionId: formId, versionId: id(300 + versionNumber), versionNumber, prefix: "LLU", name: "Registro de lluvia", culture: "es", submitLabel: "Enviar", maxFileSizeMiB: 25,
    questions: [
      { fieldId: fields.lot, type: "choice", label: "Lote", help: null, required: true, maxLength: null, options: null, selection: null, files: null, catalog: { onlyOption: null, issue: null, missingData: null } },
      { fieldId: fields.rain, type: "decimal", label: "Milímetros", help: "Lo que marca el pluviómetro.", required: true, maxLength: null, options: null, selection: null, files: null, catalog: null },
      { fieldId: fields.date, type: "date", label: "Fecha", help: null, required: true, maxLength: null, options: null, selection: null, files: null, catalog: null },
      { fieldId: fields.notes, type: "longText", label: "Observaciones", help: null, required: false, maxLength: 500, options: null, selection: null, files: null, catalog: null },
      { fieldId: fields.photos, type: "photo", label: "Fotos del pluviómetro", help: null, required: false, maxLength: null, options: null, selection: null, files: { minFiles: 0, maxFiles: 3, photoSource: "cameraOrGallery" }, catalog: null },
    ] };
}
const saved = { recordId: id(331), number: "LLU-000322", state: "Received", submittedAtUtc: "2026-10-30T13:05:00Z" };

function setup({ permissions = ["formrecords.create"], form = entry() as FormEntry | (() => Response), submit = [] as (() => Response)[] } = {}) {
  const sends: FormData[] = [];
  let current = form;
  let reads = 0;
  server.use(
    http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions })),
    http.get("/api/forms/entries/:formId", () => { reads++; return typeof current === "function" ? current() : HttpResponse.json(current); }),
    http.get("/api/forms/entries/:formId/versions/:versionId/questions/:fieldId/options", () =>
      HttpResponse.json({ items: lots, page: 1, pageSize: 50, totalCount: 2, totalPages: 1, hasPrevious: false, hasNext: false })),
    http.post("/api/forms/entries/:formId", async ({ request }) => {
      sends.push(await request.formData());
      return submit.shift()?.() ?? HttpResponse.json(saved);
    }),
  );
  return { sends, reads: () => reads, replace: (next: FormEntry) => { current = next; } };
}

async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("combobox", { name: "Lote" }));
  await user.click(await screen.findByRole("option", { name: /^Lote 4/ }));
  await user.type(screen.getByLabelText(/^Milímetros/), "12,5");
  fireEvent.change(screen.getByLabelText(/^Fecha/), { target: { value: "2026-10-29" } });
}
const answers = (body: FormData) => JSON.parse(String(body.get("answers"))) as unknown[];
// jsdom cannot hand a File inside FormData to MSW, so a send with files is observed at XMLHttpRequest, as the browser sends it.
function captureUploads() {
  const bodies: FormData[] = [];
  class FakeXhr {
    upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null };
    status = 0; responseText = "";
    onload: (() => void) | null = null; onerror: (() => void) | null = null; onabort: (() => void) | null = null;
    open() {}
    setRequestHeader() {}
    abort() { this.onabort?.(); }
    getAllResponseHeaders() { return "content-type: application/json"; }
    send(body: FormData) {
      bodies.push(body);
      this.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 2 } as ProgressEvent);
      setTimeout(() => { this.status = 200; this.responseText = JSON.stringify(saved); this.onload?.(); }, 100);
    }
  }
  vi.stubGlobal("XMLHttpRequest", FakeXhr);
  return bodies;
}

beforeEach(() => {
  queryClient.clear();
  vi.mocked(notify).mockClear();
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("loading a response from the app", () => {
  it("marks what is missing and focuses the first question without sending", async () => {
    const { sends } = setup();
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders("/formularios/" + formId + "/cargar");
    expect(await screen.findByRole("heading", { name: "Nueva respuesta", level: 1 })).toBeVisible();
    expect(await screen.findByText("Lo que marca el pluviómetro.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText("Elegí una opción.")).toBeVisible();
    expect(screen.getAllByText("Completá esta respuesta.")).toHaveLength(2);
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Lote" })).toHaveFocus());
    expect(sends).toHaveLength(0);
  });

  it("sends the answers and the photos once and shows what was sent", async () => {
    setup();
    const sends = captureUploads();
    const user = userEvent.setup({ delay: null });
    const { container } = renderRouteWithProviders("/formularios/" + formId + "/cargar");
    await fill(user);
    const picker = container.querySelector<HTMLInputElement>('input[type="file"]:not([capture])')!;
    await user.upload(picker, new File(["rain"], "pluviometro.jpg", { type: "image/jpeg" }));
    expect(await screen.findByRole("img", { name: "pluviometro.jpg" })).toBeVisible();
    expect(screen.getByText("1 de 3")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByRole("button", { name: "Enviando… 50 %" })).toBeDisabled();

    expect(await screen.findByRole("heading", { name: "LLU-000322", level: 1 })).toBeVisible();
    expect(screen.getByText("Enviada")).toBeVisible();
    expect(screen.getByText("Recibida")).toBeVisible();
    expect(screen.getByText("Registro de lluvia, versión 3")).toBeVisible();
    expect(screen.getByText("12,5")).toBeVisible();
    expect(screen.getByText("1 foto")).toBeVisible();
    expect(sends).toHaveLength(1);
    expect(sends[0].get("versionId")).toBe(id(303));
    expect(answers(sends[0])).toEqual([{ fieldId: fields.lot, value: lots[0].id }, { fieldId: fields.rain, value: "12.5" }, { fieldId: fields.date, value: "2026-10-29" }]);
    expect(sends[0].getAll("fileFieldIds")).toEqual([fields.photos]);
    expect((sends[0].getAll("files")[0] as File).name).toBe("pluviometro.jpg");
    // Whoever only completes forms cannot read the saved response: there is no way to the sheet.
    expect(screen.queryByRole("button", { name: "Ver en la planilla" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cargar otra" }));
    expect(await screen.findByRole("heading", { name: "Nueva respuesta", level: 1 })).toBeVisible();
    expect(screen.getByLabelText(/^Milímetros/)).toHaveValue("");
  });

  it("repeats the same request after a cut, so the retry gets the first number", async () => {
    const { sends } = setup({ submit: [() => HttpResponse.error()] });
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders("/formularios/" + formId + "/cargar");
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "error", message: "No se pudo enviar",
      description: "Revisá la conexión y volvé a tocar Enviar." })));
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByRole("heading", { name: "LLU-000322", level: 1 })).toBeVisible();
    expect(sends).toHaveLength(2);
    expect(sends[1].get("requestId")).toBe(sends[0].get("requestId"));
  });

  it("changes the request when the answers change after a rejection", async () => {
    const { sends } = setup({ submit: [() => HttpResponse.json({ title: "No se guardó", status: 400, code: "Forms.Record.CatalogItemInactive",
      errors: { ["answers." + fields.lot]: ["La opción ya no está disponible."] } }, { status: 400 })] });
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders("/formularios/" + formId + "/cargar");
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText("«Lote 4» ya no está disponible. Elegí otro.")).toBeVisible();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "error", message: "No se guardó", description: "Revisá «Lote»." }));
    await user.click(screen.getByRole("combobox", { name: "Lote" }));
    await user.click(await screen.findByRole("option", { name: /^Lote 7/ }));
    expect(screen.queryByText("«Lote 4» ya no está disponible. Elegí otro.")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByRole("heading", { name: "LLU-000322", level: 1 })).toBeVisible();
    expect(sends[1].get("requestId")).not.toBe(sends[0].get("requestId"));
  });

  it("asks to switch to a new version and keeps what was loaded", async () => {
    const setupResult = setup({ submit: [() => HttpResponse.json({ title: "Conflicto", status: 409, code: "Forms.Entry.VersionChanged" }, { status: 409 })] });
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders("/formularios/" + formId + "/cargar");
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText("Registro de lluvia tiene una versión nueva. Pasá a ella para enviar: lo que cargaste se conserva.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
    setupResult.replace(entry(4));
    await user.click(screen.getByRole("button", { name: "Pasar a la versión nueva" }));
    await waitFor(() => expect(screen.queryByText(/tiene una versión nueva/)).not.toBeInTheDocument());
    expect(screen.getByLabelText(/^Milímetros/)).toHaveValue("12,5");
    expect(screen.getByRole("combobox", { name: "Lote" })).toHaveValue("Lote 4");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByRole("heading", { name: "LLU-000322", level: 1 })).toBeVisible();
    expect(setupResult.sends[1].get("versionId")).toBe(id(304));
  });

  it("says why it cannot be sent when the person's datum is missing", async () => {
    const form = entry();
    form.questions[0] = { ...form.questions[0], catalog: { onlyOption: null, issue: "Forms.Record.RecipientDataMissing", missingData: "Zona" } };
    const { sends } = setup({ form });
    renderRouteWithProviders("/formularios/" + formId + "/cargar");
    // Only the state that blocks the send: who to ask is not explained (decision of 2026-10-31).
    expect(await screen.findByText("No podés enviar Registro de lluvia: te falta el dato «Zona».")).toBeVisible();
    expect(screen.queryByText(/Pedíselo/)).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Lote" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
    expect(sends).toHaveLength(0);
  });

  it("says Actualizando… while it switches to the new version", async () => {
    setup({ submit: [() => HttpResponse.json({ title: "Conflicto", status: 409, code: "Forms.Entry.VersionChanged" }, { status: 409 })] });
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders("/formularios/" + formId + "/cargar");
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    await screen.findByText(/tiene una versión nueva/);
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    server.use(http.get("/api/forms/entries/:formId", async () => { await gate; return HttpResponse.json(entry(4)); }));
    await user.click(screen.getByRole("button", { name: "Pasar a la versión nueva" }));
    expect(screen.getByRole("button", { name: "Actualizando…" })).toHaveAttribute("aria-busy", "true");
    await act(async () => release());
    await waitFor(() => expect(screen.queryByText(/tiene una versión nueva/)).not.toBeInTheDocument());
  });

  // An empty state does not explain what to do (decision of 2026-10-31): its title and «Reintentar», which goes back to the wait.
  it("names a form that could not be opened with its title and Reintentar", async () => {
    let reads = 0;
    setup({ form: () => ++reads === 1 ? HttpResponse.json({ code: "Test.Entry", detail: "No se pudo." }, { status: 500 }) : HttpResponse.json(entry()) });
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders("/formularios/" + formId + "/cargar");
    expect(await screen.findByRole("heading", { name: "No se pudo abrir el formulario" })).toBeVisible();
    expect(screen.queryByText(/Revisá la conexión/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByLabelText(/^Milímetros/)).toBeVisible();
  });

  // The limit of a question with several answers is part of its label, as with the photos; no line under the options.
  it("puts the limit of a question of several options in its label", async () => {
    const form = entry();
    form.questions.push({ fieldId: id(316), type: "multiChoice", label: "Plagas", help: null, required: false, maxLength: null,
      options: [{ id: id(341), label: "Chinche" }, { id: id(342), label: "Oruga" }, { id: id(343), label: "Trips" }], selection: { minSelected: 0, maxSelected: 2 }, files: null, catalog: null });
    setup({ form });
    renderRouteWithProviders("/formularios/" + formId + "/cargar");
    expect(await screen.findByRole("group", { name: "Plagas hasta 2" })).toBeVisible();
    expect(screen.queryByText("Elegí hasta 2.")).not.toBeInTheDocument();
  });

  // Formats and size go in the (i) next to the label and describe the button that chooses the files.
  it("tells the formats and size of the photos in the (i) next to their label", async () => {
    setup();
    renderRouteWithProviders("/formularios/" + formId + "/cargar");
    const hint = "JPG o PNG, hasta 25 MB cada una.";
    expect(await screen.findByRole("button", { name: "Más información sobre Fotos del pluviómetro" })).toHaveAccessibleDescription(hint);
    expect(screen.getByRole("button", { name: "Elegir fotos" })).toHaveAccessibleDescription(hint);
    for (const text of screen.getAllByText(hint)) expect(text).not.toBeVisible();
    expect(screen.getByText("Arrastrá las fotos acá o")).toBeVisible();
  });

  it("folds a zone with what was answered and opens it again when a send finds something to correct", async () => {
    const { sends } = setup();
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders("/formularios/" + formId + "/cargar");
    await user.type(await screen.findByLabelText(/^Milímetros/), "12,5");
    await user.click(screen.getByRole("button", { name: "Plegar Datos" }));
    expect(screen.getByText("1 de 4 respondidas")).toBeVisible();
    expect(screen.getByLabelText(/^Milímetros/)).not.toBeVisible();
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Lote" })).toHaveFocus());
    expect(screen.getByRole("button", { name: "Plegar Datos" })).toHaveAttribute("aria-expanded", "true");
    expect(sends).toHaveLength(0);
  });

  it("offers more than five own options in a dropdown list", async () => {
    const form = entry();
    form.questions.splice(1, 0, { fieldId: id(316), type: "choice", label: "Cultivo", help: null, required: true, maxLength: null,
      options: ["Soja 1ª", "Soja 2ª", "Maíz", "Trigo", "Girasol", "Sorgo"].map((label, index) => ({ id: id(340 + index), label })), selection: null, files: null, catalog: null });
    setup({ form });
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders("/formularios/" + formId + "/cargar");
    const crop = await screen.findByRole("combobox", { name: "Cultivo" });
    expect(screen.queryByRole("radio", { name: "Maíz" })).not.toBeInTheDocument();
    await user.selectOptions(crop, "Maíz");
    expect(crop).toHaveValue(id(342));
  });

  it.each([["phone", [1, 1, 1, 1, 1]], ["tablet", [1, 2, 1, 1]], ["computer", [2, 1, 1, 1]]] as const)(
    "builds the rows with the columns of the %s, so every visible row has its line", async (screenSize, questionsPerRow) => {
      const narrow = { phone: ["(width < 640px)", "(width < 1024px)"], tablet: ["(width < 1024px)"], computer: [] as string[] }[screenSize];
      vi.spyOn(globalThis, "matchMedia").mockImplementation(query => ({ matches: narrow.includes(query), media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
      setup();
      const { container } = renderRouteWithProviders("/formularios/" + formId + "/cargar");
      await screen.findByText("Lo que marca el pluviómetro.");
      expect([...container.querySelectorAll("[data-entry-row]")].map(row => row.children.length)).toEqual(questionsPerRow);
    });

  it("chooses the only option the filters leave", async () => {
    const form = entry();
    form.questions[0] = { ...form.questions[0], catalog: { onlyOption: lots[1], issue: null, missingData: null } };
    setup({ form });
    renderRouteWithProviders("/formularios/" + formId + "/cargar");
    expect(await screen.findByRole("combobox", { name: "Lote" })).toHaveValue("Lote 7");
  });

  it("does not let a deactivated form be loaded", async () => {
    setup({ form: () => HttpResponse.json({ title: "Conflicto", status: 409, code: "Forms.Entry.Unavailable" }, { status: 409 }) });
    renderRouteWithProviders("/formularios/" + formId + "/cargar");
    expect(await screen.findByText("Este formulario se dio de baja y ya no se puede cargar.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Enviar" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Volver a Formularios" }).length).toBeGreaterThan(0);
  });

  it("asks before leaving with something loaded", async () => {
    setup();
    const user = userEvent.setup({ delay: null });
    const { router } = renderRouteWithProviders("/formularios/" + formId + "/cargar");
    await user.type(await screen.findByLabelText(/^Milímetros/), "3");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    const dialog = await screen.findByRole("dialog", { name: "¿Salir sin enviar?" });
    expect(within(dialog).getByText("Lo que cargaste en Registro de lluvia se pierde.")).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Seguir cargando" }));
    expect(router.state.location.pathname).toBe("/formularios/" + formId + "/cargar");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Salir sin enviar" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/formularios/respuestas"));
  });

  it("rejects a file of another type or too heavy before sending", async () => {
    setup();
    const user = userEvent.setup({ delay: null, applyAccept: false });
    const { container } = renderRouteWithProviders("/formularios/" + formId + "/cargar");
    await screen.findByText("Fotos del pluviómetro");
    const picker = container.querySelector<HTMLInputElement>('input[type="file"]:not([capture])')!;
    const heavy = new File(["x"], "grande.png", { type: "image/png" });
    Object.defineProperty(heavy, "size", { value: 26 * 1024 * 1024 });
    await user.upload(picker, [new File(["%PDF"], "nota.pdf", { type: "application/pdf" }), heavy]);
    expect(await screen.findByText("nota.pdf no es una foto JPG o PNG.")).toBeVisible();
    expect(screen.getByText("grande.png pesa 26 MB; el máximo es 25 MB.")).toBeVisible();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("is forbidden without «Completar formularios»", async () => {
    setup({ permissions: ["formrecords.read"] });
    renderRouteWithProviders("/formularios/" + formId + "/cargar");
    expect(await screen.findByRole("heading", { name: "No tenés permiso" })).toBeVisible();
  });

  it("on the phone takes a photo with the camera and keeps the send at the foot", async () => {
    vi.spyOn(globalThis, "matchMedia").mockImplementation(query => ({ matches: query === "(width < 640px)", media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
    setup();
    const user = userEvent.setup({ delay: null });
    const { container } = renderRouteWithProviders("/formularios/" + formId + "/cargar");
    expect(await screen.findByRole("button", { name: "Tomar foto" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Elegir de la galería" })).toBeVisible();
    const camera = container.querySelector<HTMLInputElement>('input[type="file"][capture="environment"]')!;
    expect(camera).toHaveAttribute("accept", "image/jpeg,image/png");
    await user.upload(camera, new File(["rain"], "camara.jpg", { type: "image/jpeg" }));
    expect(await screen.findByRole("img", { name: "camara.jpg" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Quitar" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Lote" }));
    const list = await screen.findByRole("dialog", { name: "Lote" });
    await user.click(await within(list).findByRole("option", { name: /^Lote 4/ }));
    expect(screen.queryByRole("dialog", { name: "Lote" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lote" })).toHaveTextContent("Lote 4");
  });
});
