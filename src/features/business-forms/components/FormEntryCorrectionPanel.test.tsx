import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { notify } from "@/shared/ui/notifications";
import { currentUser } from "@/test/mocks/handlers";
import { responseDetailFixture, responseFormId, responseRecordId, responseSheetFixture, responseWorkflowFixture } from "@/test/responseFixtures";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import type { FormEntryCorrection } from "../api/entries";
import type { ResponseDetail } from "../api/responses";
import type { ResponseWorkflow } from "../api/workflow";

vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"),
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
vi.mock("@/shared/ui/notifications", async () => ({ ...await vi.importActual<typeof import("@/shared/ui/notifications")>("@/shared/ui/notifications"), notify: vi.fn() }));

const id = (value: number) => "0199a0c0-0000-7000-8000-" + String(value).padStart(12, "0");
const sheet = "/formularios/" + responseFormId + "/respuestas";
const corrected = id(501);
// Synthetic behavior DTO; the bodies exported by the backend qualify the contract in the entries contract tests.
const correction: FormEntryCorrection = {
  entry: { definitionId: responseFormId, versionId: id(402), versionNumber: 2, prefix: "TEST", name: "Formulario publicado", culture: "es",
    submitLabel: "Enviar", maxFileSizeMiB: 25, questions: [
      { fieldId: id(30), type: "decimal", label: "Importe", help: null, required: true, maxLength: null, options: null, selection: null, files: null, catalog: null },
      { fieldId: id(32), type: "photo", label: "Fotos", help: null, required: false, maxLength: null, options: null, selection: null,
        files: { minFiles: 0, maxFiles: 2, photoSource: "cameraOrGallery" }, catalog: null },
    ] },
  recordId: responseRecordId, number: "TEST-000002",
  answers: [{ fieldId: id(30), value: "12.5", choiceIds: null, options: null }],
  files: [{ fileId: id(70), fieldId: id(32), name: "lote.jpg", contentType: "image/jpeg", size: 2048, hasThumbnail: true }],
};

function setup(canAmend = true) {
  const sends: FormData[] = [];
  const voids: unknown[] = [];
  server.use(
    http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formrecords.read", "formrecords.create"] })),
    http.post("/api/forms/definitions/:id/records/search", () => HttpResponse.json(responseSheetFixture())),
    http.post("/api/forms/definitions/:id/records/:recordId/navigation", ({ params }) => HttpResponse.json({ recordId: params.recordId, previousId: null, nextId: null, position: 1, totalCount: 2 })),
    http.get("/api/forms/records/:id", ({ params }) => HttpResponse.json({ ...responseDetailFixture(String(params.id)), ...canAmend ? { canAmend: true } : {} })),
    http.get("/api/forms/records/:id/workflow", ({ params }) => HttpResponse.json(responseWorkflowFixture(String(params.id)))),
    http.get("/api/forms/entries/:formId/records/:recordId", () => HttpResponse.json(correction)),
    http.post("/api/forms/entries/:formId/records/:recordId", async ({ request }) => {
      sends.push(await request.formData());
      return HttpResponse.json({ recordId: corrected, number: "TEST-000002", state: "Received", submittedAtUtc: "2026-10-16T12:00:00Z" });
    }),
    http.post("/api/forms/definitions/:formId/records/:recordId/void", async ({ request }) => { voids.push(await request.json()); return new HttpResponse(null, { status: 204 }); }),
  );
  return { sends, voids };
}

beforeEach(() => { queryClient.clear(); vi.mocked(notify).mockClear(); });
afterEach(() => vi.restoreAllMocks());

describe("correcting a response next to the sheet (CW10-A)", () => {
  it("opens where D2 was, says what changed had before and saves only with a reason", { timeout: 20_000 }, async () => {
    const { sends } = setup();
    const user = userEvent.setup({ delay: null });
    const { router } = renderRouteWithProviders(sheet + "/" + responseRecordId);
    await user.click(await screen.findByRole("button", { name: "Corregir" }));
    const panel = await screen.findByRole("region", { name: "Corregir TEST-000002 de Formulario publicado" });
    const amount = await within(panel).findByLabelText(/^Importe/);
    expect(amount).toHaveValue("12,5");
    expect(within(panel).getByText("lote.jpg")).toBeInTheDocument();
    expect(within(panel).queryByText(/^Antes:/)).not.toBeInTheDocument();

    await user.clear(amount);
    await user.type(amount, "13");
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
  });

  it("keeps the response as it was when the panel closes without changes", async () => {
    setup();
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders(sheet + "/" + responseRecordId);
    await user.click(await screen.findByRole("button", { name: "Corregir" }));
    const panel = await screen.findByRole("region", { name: "Corregir TEST-000002 de Formulario publicado" });
    await within(panel).findByLabelText(/^Importe/);
    await user.click(within(panel).getByRole("button", { name: "Cancelar" }));
    expect(await screen.findByRole("button", { name: "Corregir" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "¿Descartar la corrección?" })).not.toBeInTheDocument();
  });

  it("asks before closing with changes and keeps them to go on correcting", async () => {
    setup();
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders(sheet + "/" + responseRecordId);
    await user.click(await screen.findByRole("button", { name: "Corregir" }));
    const panel = await screen.findByRole("region", { name: "Corregir TEST-000002 de Formulario publicado" });
    const amount = await within(panel).findByLabelText(/^Importe/);
    await user.clear(amount);
    await user.type(amount, "13");
    await user.click(within(panel).getByRole("button", { name: "Cancelar" }));
    const ask = await screen.findByRole("dialog", { name: "¿Descartar la corrección?" });
    await user.click(within(ask).getByRole("button", { name: "Seguir corrigiendo" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "¿Descartar la corrección?" })).not.toBeInTheDocument());
    expect(within(panel).getByLabelText(/^Importe/)).toHaveValue("13");
  });

  it("offers nothing to whoever may not change the response", async () => {
    setup(false);
    renderRouteWithProviders(sheet + "/" + responseRecordId);
    expect(await screen.findByRole("heading", { name: "TEST-000002" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Corregir" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Más acciones" })).not.toBeInTheDocument();
  });
});

describe("voiding a response (CW11-A)", () => {
  it("asks for the reason, voids it, says so and closes the detail", async () => {
    const { voids } = setup();
    const user = userEvent.setup({ delay: null });
    const { router } = renderRouteWithProviders(sheet + "/" + responseRecordId);
    await user.click(await screen.findByRole("button", { name: "Más acciones" }));
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
});

describe("reading what a correction or a void left (CW10-A, CW11-A)", () => {
  const juan = { userId: id(377), displayName: "Juan Gómez" };
  function read(detail: Partial<ResponseDetail>, workflow: Partial<ResponseWorkflow>) {
    server.use(
      http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formrecords.read"] })),
      http.post("/api/forms/definitions/:id/records/search", () => HttpResponse.json(responseSheetFixture())),
      http.post("/api/forms/definitions/:id/records/:recordId/navigation", ({ params }) => HttpResponse.json({ recordId: params.recordId, previousId: null, nextId: null, position: 1, totalCount: 2 })),
      http.get("/api/forms/records/:id", ({ params }) => HttpResponse.json({ ...responseDetailFixture(String(params.id)), ...detail })),
      http.get("/api/forms/records/:id/workflow", ({ params }) => HttpResponse.json({ ...responseWorkflowFixture(String(params.id)), ...workflow })),
    );
  }

  it("says «Anulada» with who voided it, when and why, and offers nothing else", async () => {
    read({ void: { atUtc: "2026-10-16T14:25:00Z", by: juan, reason: "Cargada dos veces." } }, { recordState: "Voided" });
    renderRouteWithProviders(sheet + "/" + responseRecordId);
    expect(await screen.findByRole("heading", { name: "Anulada", level: 3 })).toBeInTheDocument();
    expect(screen.getByText("Juan Gómez · «Cargada dos veces.»")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Corregir" })).not.toBeInTheDocument();
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
