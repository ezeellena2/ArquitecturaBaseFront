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
import type { FormEntry, FormEntryQuestion } from "../api/entries";

vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"),
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
vi.mock("@/shared/ui/notifications", async () => ({ ...await vi.importActual<typeof import("@/shared/ui/notifications")>("@/shared/ui/notifications"), notify: vi.fn() }));

const id = (value: number) => "0199a0c0-0000-7000-8000-" + String(value).padStart(12, "0");
const sheet = "/formularios/" + responseFormId + "/respuestas";
const fields = { concept: id(50), goods: id(51), services: id(52), period: id(53), block: id(54), quantity: id(55), price: id(56), amount: id(57), total: id(58) };
const question = (fieldId: string, type: FormEntryQuestion["type"], label: string, extra: Partial<FormEntryQuestion> = {}): FormEntryQuestion =>
  ({ fieldId, type, label, help: null, required: true, maxLength: null, options: null, selection: null, files: null, catalog: null, ...extra });
// Synthetic behavior DTO; the bodies the backend exports qualify the contract (CA1-A, CO1-A).
const entry: FormEntry = { definitionId: responseFormId, versionId: id(502), versionNumber: 3, prefix: "TEST", name: "Formulario publicado", culture: "es",
  submitLabel: "Enviar", maxFileSizeMiB: 25, questions: [
    question(fields.concept, "choice", "Concepto", { options: [{ id: fields.goods, label: "Productos" }, { id: fields.services, label: "Servicios" }] }),
    question(fields.period, "shortText", "Período", { maxLength: 80, showWhen: { questionId: fields.concept, values: [fields.services] } }),
    question(fields.block, "group", "Artículos", { rows: { minRows: 1, maxRows: 2 } }),
    question(fields.quantity, "decimal", "Cantidad", { repeated: true }),
    question(fields.price, "decimal", "Precio unitario", { repeated: true }),
    question(fields.amount, "decimal", "Importe", { repeated: true, required: false, calculation: { operation: "multiply", operands: [fields.quantity, fields.price] } }),
    question(fields.total, "decimal", "Total", { required: false, calculation: { operation: "sum", operands: [fields.amount] } }),
  ] };

function setup() {
  const sends: FormData[] = [];
  server.use(
    http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formrecords.read", "formrecords.create"] })),
    http.post("/api/forms/definitions/:id/records/search", () => HttpResponse.json(responseSheetFixture())),
    http.get("/api/forms/entries/:formId", () => HttpResponse.json(entry)),
    http.post("/api/forms/entries/:formId", async ({ request }) => {
      sends.push(await request.formData());
      return HttpResponse.json({ recordId: id(531), number: "TEST-000004", state: "Received", submittedAtUtc: "2026-11-11T13:05:00Z" });
    }),
  );
  return { sends };
}

beforeEach(() => { queryClient.clear(); vi.mocked(notify).mockClear(); });
afterEach(() => vi.restoreAllMocks());

describe("loading a form with calculations and conditions next to the sheet (CA1-A, CO1-A)", () => {
  it("shows the calculations greyed as they are typed, hides what does not apply and sends neither", async () => {
    const { sends } = setup();
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders(sheet + "/nueva");
    // The first test of a file pays the screen's lazy load: with other suites running it takes longer than the usual second.
    const panel = await screen.findByRole("region", { name: "Nueva respuesta de Formulario publicado" }, { timeout: 15000 });
    const item = await within(panel).findByRole("region", { name: "Ítem 1" });

    expect(within(panel).queryByLabelText(/^Período/)).not.toBeInTheDocument();
    await user.click(within(panel).getByRole("radio", { name: "Servicios" }));
    await user.type(await within(panel).findByLabelText(/^Período/), "Noviembre");
    await user.click(within(panel).getByRole("radio", { name: "Productos" }));
    expect(within(panel).queryByLabelText(/^Período/)).not.toBeInTheDocument();

    const amount = within(item).getByLabelText("Importe");
    expect(amount).toHaveAttribute("readonly");
    expect(amount).toHaveAccessibleDescription("Cantidad por Precio unitario");
    await user.type(within(item).getByLabelText(/^Cantidad/), "12");
    await user.type(within(item).getByLabelText(/^Precio unitario/), "850,00");
    expect(amount).toHaveValue("10.200,00");
    const total = within(panel).getByLabelText("Total");
    expect(total).toHaveValue("10.200,00");
    expect(total).toHaveAccessibleDescription("Suma de Importe de todos los ítems");

    await user.click(within(panel).getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(sends).toHaveLength(1));
    expect(JSON.parse(String(sends[0]!.get("answers")))).toEqual([
      { fieldId: fields.concept, value: fields.goods },
      { fieldId: fields.block, rows: [[{ fieldId: fields.quantity, value: "12" }, { fieldId: fields.price, value: "850.00" }]] },
    ]);
  }, 30000);

  it("asks for a required question only while it shows", async () => {
    const { sends } = setup();
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders(sheet + "/nueva");
    // The first test of a file pays the screen's lazy load: with other suites running it takes longer than the usual second.
    const panel = await screen.findByRole("region", { name: "Nueva respuesta de Formulario publicado" }, { timeout: 15000 });
    const item = await within(panel).findByRole("region", { name: "Ítem 1" });
    await user.type(within(item).getByLabelText(/^Cantidad/), "1");
    await user.type(within(item).getByLabelText(/^Precio unitario/), "2");
    await user.click(within(panel).getByRole("radio", { name: "Servicios" }));

    await user.click(within(panel).getByRole("button", { name: "Enviar" }));
    expect(await within(panel).findByText("Completá esta respuesta.")).toBeVisible();
    expect(sends).toHaveLength(0);
  }, 30000);
});
