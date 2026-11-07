import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { notify } from "@/shared/ui/notifications";
import { currentUser } from "@/test/mocks/handlers";
import { responseFormId, responseSheetFixture } from "@/test/responseFixtures";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import type { FormEntry } from "../api/entries";

vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"),
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
vi.mock("@/shared/ui/notifications", async () => ({ ...await vi.importActual<typeof import("@/shared/ui/notifications")>("@/shared/ui/notifications"), notify: vi.fn() }));

const id = (value: number) => "0199a0c0-0000-7000-8000-" + String(value).padStart(12, "0");
const sheet = "/formularios/" + responseFormId + "/respuestas";
const fields = { block: id(40), quantity: id(41), notes: id(42) };
// Synthetic behavior DTO; the bodies exported by the backend qualify the contract in entriesRowsHttpContract.
const entry: FormEntry = { definitionId: responseFormId, versionId: id(402), versionNumber: 2, prefix: "TEST", name: "Formulario publicado", culture: "es",
  submitLabel: "Enviar", maxFileSizeMiB: 25, questions: [
    { fieldId: fields.block, type: "group", label: "Artículos", help: null, required: true, maxLength: null, options: null, selection: null, files: null, catalog: null,
      rows: { minRows: 1, maxRows: 2 } },
    { fieldId: fields.quantity, type: "decimal", label: "Cantidad", help: null, required: true, maxLength: null, options: null, selection: null, files: null, catalog: null, repeated: true },
    { fieldId: fields.notes, type: "longText", label: "Observaciones", help: null, required: false, maxLength: 600, options: null, selection: null, files: null, catalog: null, repeated: true },
  ] };

function setup() {
  const sends: FormData[] = [];
  server.use(
    http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formrecords.read", "formrecords.create"] })),
    http.post("/api/forms/definitions/:id/records/search", () => HttpResponse.json(responseSheetFixture())),
    http.get("/api/forms/entries/:formId", () => HttpResponse.json(entry)),
    http.post("/api/forms/entries/:formId", async ({ request }) => {
      sends.push(await request.formData());
      return HttpResponse.json({ recordId: id(431), number: "TEST-000003", state: "Received", submittedAtUtc: "2026-11-07T13:05:00Z" });
    }),
  );
  return { sends };
}

beforeEach(() => { queryClient.clear(); vi.mocked(notify).mockClear(); });
afterEach(() => vi.restoreAllMocks());

describe("loading the items of a block next to the sheet (RG2-A)", () => {
  it("puts each item in its box with its questions one under the other, and sends them in their order", async () => {
    const { sends } = setup();
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders(sheet + "/nueva");
    const panel = await screen.findByRole("region", { name: "Nueva respuesta de Formulario publicado" });

    const first = await within(panel).findByRole("region", { name: "Ítem 1" });
    expect(within(panel).queryByRole("region", { name: "Artículos" })).not.toBeInTheDocument();
    await user.type(within(first).getByLabelText(/^Cantidad/), "3");
    await user.click(within(panel).getByRole("button", { name: "Agregar ítem" }));
    const second = within(panel).getByRole("region", { name: "Ítem 2" });
    await waitFor(() => expect(within(second).getByLabelText(/^Cantidad/)).toHaveFocus());
    await user.type(within(second).getByLabelText(/^Cantidad/), "4");
    expect(within(panel).getByRole("button", { name: "Agregar ítem" })).toHaveAccessibleDescription("Hasta 2 ítems.");
    await user.click(within(first).getByRole("button", { name: "Bajar el ítem 1" }));

    await user.click(within(panel).getByRole("button", { name: "Enviar" }));

    await waitFor(() => expect(sends).toHaveLength(1));
    expect(JSON.parse(String(sends[0]!.get("answers")))).toEqual([
      { fieldId: fields.block, rows: [[{ fieldId: fields.quantity, value: "4" }], [{ fieldId: fields.quantity, value: "3" }]] },
    ]);
  });

  it("says each problem under its question, in its box, and focuses the first", async () => {
    const { sends } = setup();
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders(sheet + "/nueva");
    const panel = await screen.findByRole("region", { name: "Nueva respuesta de Formulario publicado" });
    const first = await within(panel).findByRole("region", { name: "Ítem 1" });

    await user.click(within(panel).getByRole("button", { name: "Enviar" }));

    expect(within(first).getByText("Completá esta respuesta.")).toBeVisible();
    await waitFor(() => expect(within(first).getByLabelText(/^Cantidad/)).toHaveFocus());
    expect(sends).toHaveLength(0);
  });
});
