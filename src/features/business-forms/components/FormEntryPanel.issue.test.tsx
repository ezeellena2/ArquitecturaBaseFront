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
import type { FormEntry, FormIssuePreview } from "../api/entries";

vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"),
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
vi.mock("@/shared/ui/notifications", async () => ({ ...await vi.importActual<typeof import("@/shared/ui/notifications")>("@/shared/ui/notifications"), notify: vi.fn() }));

const id = (value: number) => "0199a0c0-0000-7000-8000-" + String(value).padStart(12, "0");
const sheet = "/formularios/" + responseFormId + "/respuestas";
const amount = id(60);
// Synthetic behavior DTOs: a form that issues on sending (EM2-A) with one required amount.
const entry: FormEntry = { definitionId: responseFormId, versionId: id(602), versionNumber: 1, prefix: "FAC", name: "Factura", culture: "es",
  submitLabel: "Enviar", maxFileSizeMiB: 25, issuePreview: true,
  questions: [{ fieldId: amount, type: "decimal", label: "Importe", help: null, required: true, maxLength: null, options: null, selection: null, files: null, catalog: null }] };
const invoice: FormIssuePreview = { document: { es: "Factura C", en: "Invoice C" }, receiver: "Juana Pérez", total: "1210", failureCode: null, failureMessage: null,
  amounts: [{ label: { es: "Importe neto gravado", en: "Taxed net amount" }, value: "1000" }] };
const unavailable: FormIssuePreview = { document: null, receiver: null, total: null, failureCode: "Arca.Connection.Unavailable", failureMessage: "ARCA no responde." };

function setup(previews: (() => Response | Promise<Response>)[]) {
  const asked: unknown[] = [];
  server.use(
    http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formrecords.read", "formrecords.create"] })),
    http.post("/api/forms/definitions/:id/records/search", () => HttpResponse.json(responseSheetFixture())),
    http.get("/api/forms/entries/:formId", () => HttpResponse.json(entry)),
    http.post("/api/forms/entries/:formId/issue-preview", async ({ request }) => {
      asked.push(await request.json());
      return (previews.length > 1 ? previews.shift()! : previews[0]!)();
    }),
  );
  return { asked };
}
async function open() {
  renderRouteWithProviders(sheet + "/nueva");
  // The first test of a file pays the screen's lazy load: with other suites running it takes longer than the usual second.
  return screen.findByRole("region", { name: "Nueva respuesta de Factura" }, { timeout: 15000 });
}

beforeEach(() => { queryClient.clear(); vi.mocked(notify).mockClear(); });
afterEach(() => vi.restoreAllMocks());

describe("«¿Emitimos la factura?» from the panel", () => {
  // 5.6: while it asks what would be issued, «Enviar» says what it does, with its gerund.
  it("says «Preparando…» while it asks what would be issued, then opens the summary", async () => {
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    setup([async () => { await held; return HttpResponse.json(invoice); }]);
    const user = userEvent.setup({ delay: null });
    const panel = await open();
    await user.type(within(panel).getByLabelText(/^Importe/), "1000");
    await user.click(within(panel).getByRole("button", { name: "Enviar" }));
    expect(await within(panel).findByRole("button", { name: "Preparando…" })).toBeInTheDocument();
    release();
    expect(await screen.findByRole("dialog", { name: "¿Emitimos la factura?" })).toBeInTheDocument();
  }, 30000);

  // 4.7: «Volver a probar» reads a failure as «Enviar» does: a 429 turns it off with the seconds left, without a notice.
  it("turns «Volver a probar» off after a 429, without a notice", async () => {
    setup([() => HttpResponse.json(unavailable),
      () => HttpResponse.json({ title: "Too many requests", status: 429, retryAfter: 30 }, { status: 429, headers: { "Retry-After": "30" } })]);
    const user = userEvent.setup({ delay: null });
    const panel = await open();
    await user.type(within(panel).getByLabelText(/^Importe/), "1000");
    await user.click(within(panel).getByRole("button", { name: "Enviar" }));
    const dialog = await screen.findByRole("dialog", { name: "¿Emitimos la factura?" });
    await user.click(within(dialog).getByRole("button", { name: "Volver a probar" }));
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Volver a probar" })).toHaveAttribute("aria-disabled", "true"));
    expect(within(dialog).getByRole("button", { name: "Volver a probar" })).toHaveAccessibleDescription(/^Esperá \d+ segundos para volver a intentar\.$/);
    expect(notify).not.toHaveBeenCalledWith(expect.objectContaining({ kind: "error" }));
  }, 30000);

  // 4.7: another failure of «Volver a probar» has its own text, not «No se pudo enviar», since nothing was sent.
  it("tells a failure of «Volver a probar» with its own text", async () => {
    setup([() => HttpResponse.json(unavailable), () => HttpResponse.json({ title: "Error", status: 500 }, { status: 500 })]);
    const user = userEvent.setup({ delay: null });
    const panel = await open();
    await user.type(within(panel).getByLabelText(/^Importe/), "1000");
    await user.click(within(panel).getByRole("button", { name: "Enviar" }));
    const dialog = await screen.findByRole("dialog", { name: "¿Emitimos la factura?" });
    await user.click(within(dialog).getByRole("button", { name: "Volver a probar" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "error", message: "No se pudo volver a probar",
      description: "Revisá la conexión y volvé a probar." })));
    expect(screen.getByRole("dialog", { name: "¿Emitimos la factura?" })).toBeInTheDocument();
  }, 30000);
});

describe("the itemized total while loading (IV1-A)", () => {
  // 4.6: a total that could not be worked out says so, with «Volver a probar», instead of going away without a word.
  it("says the total could not be worked out and tries again", async () => {
    const { asked } = setup([() => HttpResponse.json({ title: "Error", status: 500 }, { status: 500 }), () => HttpResponse.json(invoice)]);
    const user = userEvent.setup({ delay: null });
    const panel = await open();
    await user.type(within(panel).getByLabelText(/^Importe/), "1000");
    const notice = await within(panel).findByText("No pudimos calcular el total. Al enviar se calcula igual.", undefined, { timeout: 5000 });
    expect(asked).toHaveLength(1);
    await user.click(within(notice.closest("[role=status]")!).getByRole("button", { name: "Volver a probar" }));
    expect(await within(panel).findByText("$ 1210", undefined, { timeout: 5000 })).toBeInTheDocument();
    expect(asked).toHaveLength(2);
  }, 30000);
});
