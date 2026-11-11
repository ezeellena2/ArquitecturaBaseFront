import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { notify } from "@/shared/ui/notifications";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import type { FormEntry, FormEntryCorrection } from "../api/entries";

vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"),
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
vi.mock("@/shared/ui/notifications", async () => ({ ...await vi.importActual<typeof import("@/shared/ui/notifications")>("@/shared/ui/notifications"), notify: vi.fn() }));

const id = (value: number) => "0199a0c0-0000-7000-8000-" + String(value).padStart(12, "0");
const formId = id(601), recordId = id(651);
const fields = { supplier: id(611), block: id(612), article: id(613), quantity: id(614), unit: id(615), state: id(616) };
const articles = [{ id: id(621), title: "GLIFOSATO 64%", description: null }, { id: id(622), title: "ATRAZINA 50%", description: null }];
const liters = id(631);

// Synthetic behavior DTO; the bodies exported by the backend qualify the contract in entriesRowsHttpContract.
const entry: FormEntry = { definitionId: formId, versionId: id(602), versionNumber: 2, prefix: "INS", name: "Recepción de insumos", culture: "es", submitLabel: "Enviar",
  maxFileSizeMiB: 25, questions: [
    { fieldId: fields.supplier, type: "shortText", label: "Proveedor", help: null, required: true, maxLength: 80, options: null, selection: null, files: null, catalog: null },
    { fieldId: fields.block, type: "group", label: "Artículos", help: null, required: true, maxLength: null, options: null, selection: null, files: null, catalog: null, rows: { minRows: 1, maxRows: 3 } },
    { fieldId: fields.article, type: "choice", label: "Artículo", help: null, required: true, maxLength: null, options: null, selection: null, files: null,
      catalog: { onlyOption: null, issue: null, missingData: null }, repeated: true },
    { fieldId: fields.quantity, type: "decimal", label: "Cantidad", help: null, required: true, maxLength: null, options: null, selection: null, files: null, catalog: null, repeated: true },
    { fieldId: fields.unit, type: "choice", label: "Unidad", help: null, required: false, maxLength: null, options: [{ id: liters, label: "Litros" }, { id: id(632), label: "Kilos" }],
      selection: null, files: null, catalog: null, repeated: true },
    { fieldId: fields.state, type: "boolean", label: "¿Llegó en buen estado?", help: null, required: false, maxLength: null, options: null, selection: null, files: null, catalog: null, repeated: true },
  ] };
const saved = { recordId: id(641), number: "INS-000005", state: "Received", submittedAtUtc: "2026-11-07T13:05:00Z" };
const correction: FormEntryCorrection = { entry, recordId, number: "INS-000005", files: [], answers: [
  { fieldId: fields.supplier, value: "Agro Norte", choiceIds: null, options: null },
  { fieldId: fields.block, value: null, choiceIds: null, options: null, rows: [
    [{ fieldId: fields.article, value: articles[1].id, choiceIds: null, options: [articles[1]] }, { fieldId: fields.quantity, value: "100", choiceIds: null, options: null }],
    [{ fieldId: fields.article, value: articles[0].id, choiceIds: null, options: [articles[0]] }, { fieldId: fields.quantity, value: "200.5", choiceIds: null, options: null },
      { fieldId: fields.unit, value: liters, choiceIds: null, options: null }, { fieldId: fields.state, value: "true", choiceIds: null, options: null }],
  ] },
] };

function setup(submit: (() => Response)[] = []) {
  const sends: FormData[] = [];
  const reply = async ({ request }: { request: Request }) => { sends.push(await request.formData()); return submit.shift()?.() ?? HttpResponse.json(saved); };
  server.use(
    http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formrecords.create", "formrecords.amend"] })),
    http.get("/api/forms/entries/:formId", () => HttpResponse.json(entry)),
    http.get("/api/forms/entries/:formId/versions/:versionId/questions/:fieldId/options", () =>
      HttpResponse.json({ items: articles, page: 1, pageSize: 50, totalCount: 2, totalPages: 1, hasPrevious: false, hasNext: false })),
    http.get("/api/forms/entries/:formId/records/:recordId/versions/:versionId/questions/:fieldId/options", () =>
      HttpResponse.json({ items: articles, page: 1, pageSize: 50, totalCount: 2, totalPages: 1, hasPrevious: false, hasNext: false })),
    http.get("/api/forms/entries/:formId/records/:recordId", () => HttpResponse.json(correction)),
    http.post("/api/forms/entries/:formId", reply),
    http.post("/api/forms/entries/:formId/records/:recordId", reply),
  );
  return { sends };
}
const answers = (body: FormData) => JSON.parse(String(body.get("answers"))) as unknown[];
const table = () => screen.getByRole("region", { name: "Artículos" });
const rows = () => within(table()).getAllByRole("row").slice(1);

async function choose(user: ReturnType<typeof userEvent.setup>, item: number, title: string) {
  await user.click(screen.getByRole("combobox", { name: `Ítem ${item} · Artículo` }));
  await user.click(await screen.findByRole("option", { name: new RegExp("^" + title) }));
}

beforeEach(() => { queryClient.clear(); vi.mocked(notify).mockClear(); });
afterEach(() => vi.restoreAllMocks());

describe("loading the items of a block from the page (RG2-A)", () => {
  // The longest ones choose options in several items: with the machine busy they pass the default five seconds.
  it("draws the block as a table that starts with its minimum and adds items up to its maximum", { timeout: 20_000 }, async () => {
    setup();
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders("/formularios/" + formId + "/cargar");

    expect(await screen.findByRole("region", { name: "Artículos" })).toBeVisible();
    expect(rows()).toHaveLength(1);
    expect(within(table()).getAllByRole("columnheader").map(header => header.textContent))
      .toEqual(["Ítem", "Artículo *", "Cantidad *", "Unidad", "¿Llegó en buen estado?", "Acciones"]);
    await user.click(screen.getByRole("button", { name: "Agregar ítem" }));
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Ítem 2 · Artículo" })).toHaveFocus());
    await user.click(screen.getByRole("button", { name: "Agregar ítem" }));
    expect(rows()).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Agregar ítem" })).toHaveAccessibleDescription("Hasta 3 ítems.");
  });

  // IV1-A: the help of a question of the block, like «Sin IVA: …» of «Precio unitario», is the (i) of its column, not a note.
  it("puts the help of a question of the block in the (i) of its column", { timeout: 20_000 }, async () => {
    setup();
    const help = "Sin IVA: la factura le suma el de su alícuota.";
    server.use(http.get("/api/forms/entries/:formId", () => HttpResponse.json({ ...entry,
      questions: entry.questions.map(question => question.fieldId === fields.quantity ? { ...question, help } : question) })));
    renderRouteWithProviders("/formularios/" + formId + "/cargar");

    expect(await screen.findByRole("region", { name: "Artículos" })).toBeVisible();
    for (const text of screen.queryAllByText(help)) expect(text).not.toBeVisible();
    await userEvent.hover(within(table()).getByRole("button", { name: "Más información sobre Cantidad" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent(help);
  });

  it("marks each cell to correct under its row and focuses the first, without sending", async () => {
    const { sends } = setup();
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders("/formularios/" + formId + "/cargar");
    await user.type(await screen.findByLabelText(/^Proveedor/), "Agro Norte");

    await user.click(screen.getByRole("button", { name: "Enviar" }));

    expect(within(rows()[1]!).getAllByRole("alert").map(line => line.textContent)).toEqual(["Artículo: elegí una opción.", "Cantidad: completá esta respuesta."]);
    expect(screen.getByRole("textbox", { name: "Ítem 1 · Cantidad" })).toHaveAccessibleDescription("Cantidad: completá esta respuesta.");
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Ítem 1 · Artículo" })).toHaveFocus());
    expect(sends).toHaveLength(0);
  });

  it("sends the items in their order with their answers and shows the block in «Enviada»", { timeout: 20_000 }, async () => {
    const { sends } = setup();
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders("/formularios/" + formId + "/cargar");
    await user.type(await screen.findByLabelText(/^Proveedor/), "Agro Norte");
    await choose(user, 1, "GLIFOSATO");
    await user.type(screen.getByRole("textbox", { name: "Ítem 1 · Cantidad" }), "200,5");
    await user.selectOptions(screen.getByRole("combobox", { name: "Ítem 1 · Unidad" }), "Litros");
    await user.click(within(screen.getByRole("group", { name: "Ítem 1 · ¿Llegó en buen estado?" })).getByRole("button", { name: "Sí" }));
    await user.click(screen.getByRole("button", { name: "Agregar ítem" }));
    await choose(user, 2, "ATRAZINA");
    await user.type(screen.getByRole("textbox", { name: "Ítem 2 · Cantidad" }), "100");
    await user.click(screen.getByRole("button", { name: "Subir el ítem 2" }));

    await user.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByRole("heading", { name: "INS-000005", level: 1 })).toBeVisible();
    expect(answers(sends[0]!)).toEqual([
      { fieldId: fields.supplier, value: "Agro Norte" },
      { fieldId: fields.block, rows: [
        [{ fieldId: fields.article, value: articles[1].id }, { fieldId: fields.quantity, value: "100" }],
        [{ fieldId: fields.article, value: articles[0].id }, { fieldId: fields.quantity, value: "200.5" }, { fieldId: fields.unit, value: liters }, { fieldId: fields.state, value: "true" }],
      ] },
    ]);
    // «Enviada» reads the block as the sheet does: how many items and the first answer of each.
    const sent = screen.getByText("Artículos").closest("div")!;
    expect(within(sent).getByRole("definition")).toHaveTextContent("2 · ATRAZINA 50%, GLIFOSATO 64%");
    expect(screen.queryByText("Cantidad")).not.toBeInTheDocument();
  });

  it("takes an error of the server to the cell of its item and names it in the notice", { timeout: 20_000 }, async () => {
    setup([() => HttpResponse.json({ title: "No se guardó", status: 400, code: "Forms.Record.CatalogItemInactive",
      errors: { [`answers.${fields.block}.1.${fields.article}`]: ["La opción ya no está disponible."] } }, { status: 400 })]);
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders("/formularios/" + formId + "/cargar");
    await user.type(await screen.findByLabelText(/^Proveedor/), "Agro Norte");
    await choose(user, 1, "GLIFOSATO");
    await user.type(screen.getByRole("textbox", { name: "Ítem 1 · Cantidad" }), "1");
    await user.click(screen.getByRole("button", { name: "Agregar ítem" }));
    await choose(user, 2, "ATRAZINA");
    await user.type(screen.getByRole("textbox", { name: "Ítem 2 · Cantidad" }), "2");

    await user.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await within(table()).findByText("Artículo: «ATRAZINA 50%» ya no está disponible. Elegí otro.")).toBeVisible();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "error", message: "No se guardó", description: "Revisá «Artículos · Ítem 2 · Artículo»." }));
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Ítem 2 · Artículo" })).toHaveFocus());
    // Another option in that cell is a new send: its error no longer applies.
    await choose(user, 2, "GLIFOSATO");
    expect(within(table()).queryByText(/ya no está disponible/)).not.toBeInTheDocument();
  });

  it("keeps the items for the next one when asked", async () => {
    const { sends } = setup();
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders("/formularios/" + formId + "/cargar");
    await user.type(await screen.findByLabelText(/^Proveedor/), "Agro Norte");
    await choose(user, 1, "GLIFOSATO");
    await user.type(screen.getByRole("textbox", { name: "Ítem 1 · Cantidad" }), "200");
    await user.click(screen.getByRole("checkbox", { name: "Mantener las respuestas para la siguiente" }));
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "success", message: "Se guardó INS-000005" })));

    expect(screen.getByRole("textbox", { name: "Ítem 1 · Cantidad" })).toHaveValue("200");
    expect(screen.getByRole("combobox", { name: "Ítem 1 · Artículo" })).toHaveValue("GLIFOSATO 64%");
    expect(sends).toHaveLength(1);
  });

  it("asks before leaving with only an item loaded", async () => {
    setup();
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders("/formularios/" + formId + "/cargar");
    await user.type(await screen.findByRole("textbox", { name: "Ítem 1 · Cantidad" }), "3");

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(await screen.findByRole("dialog", { name: "¿Salir sin enviar?" })).toBeVisible();
  });

  it("on the phone puts each item in its box, with «Agregar ítem» at the foot of the boxes and Enviar below", async () => {
    vi.spyOn(globalThis, "matchMedia").mockImplementation(query => ({ matches: query === "(width < 640px)" || query === "(width < 1024px)", media: query, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
    setup();
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders("/formularios/" + formId + "/cargar");

    const first = await screen.findByRole("region", { name: "Ítem 1" });
    expect(screen.queryByRole("region", { name: "Artículos" })).not.toBeInTheDocument();
    expect(within(first).getByLabelText(/^Cantidad/)).toBeVisible();
    const add = screen.getByRole("button", { name: "Agregar ítem" });
    expect(first.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(add.compareDocumentPosition(screen.getByRole("button", { name: "Enviar" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.click(add);
    await waitFor(() => expect(within(screen.getByRole("region", { name: "Ítem 2" })).getByRole("button", { name: /Artículo/ })).toHaveFocus());
  });

  it("opens a correction with its items in their order and sends them corrected", async () => {
    const { sends } = setup();
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders(`/formularios/${formId}/respuestas/${recordId}/corregir`);

    expect(await screen.findByRole("combobox", { name: "Ítem 1 · Artículo" })).toHaveValue("ATRAZINA 50%");
    expect(screen.getByRole("textbox", { name: "Ítem 2 · Cantidad" })).toHaveValue("200,5");
    expect(screen.getByRole("combobox", { name: "Ítem 2 · Unidad" })).toHaveValue(liters);
    await user.clear(screen.getByRole("textbox", { name: "Ítem 1 · Cantidad" }));
    await user.type(screen.getByRole("textbox", { name: "Ítem 1 · Cantidad" }), "120");
    await user.type(screen.getByLabelText(/^Motivo/), "Llegaron 120 litros.");
    await user.click(screen.getByRole("button", { name: "Guardar corrección" }));

    await waitFor(() => expect(sends).toHaveLength(1));
    expect(answers(sends[0]!)).toEqual([
      { fieldId: fields.supplier, value: "Agro Norte" },
      { fieldId: fields.block, rows: [
        [{ fieldId: fields.article, value: articles[1].id }, { fieldId: fields.quantity, value: "120" }],
        [{ fieldId: fields.article, value: articles[0].id }, { fieldId: fields.quantity, value: "200.5" }, { fieldId: fields.unit, value: liters }, { fieldId: fields.state, value: "true" }],
      ] },
    ]);
  });
});
