import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { assistedResponseFixture } from "@/test/responseAssistanceFixture";
import { responseDetailFixture, responseSheetFixture, responseWorkflowFixture, responseFormId, responseRecordId, responseSecondId } from "@/test/responseFixtures";
vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
beforeEach(() => queryClient.clear());
function setup() {
 let forbidden = false; let detailReads = 0;
 server.use(
  http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formrecords.read"] })),
  http.post("/api/forms/definitions/:id/records/search", () => HttpResponse.json(responseSheetFixture())),
  http.get("/api/forms/records/:id", () => { detailReads++; return forbidden ? HttpResponse.json({ code: "Authorization.Forbidden" }, { status: 403 }) : HttpResponse.json(assistedResponseFixture()); }),
  http.get("/api/forms/records/:id/workflow", () => HttpResponse.json(responseWorkflowFixture())),
 );
 return { forbid: () => { forbidden = true; }, reads: () => detailReads };
}
it("presents historical mapping, changed and excluded data with the recorded suggestion mode in the existing answer tab", async () => {
 const api = setup(); renderRouteWithProviders(`/formularios/${responseFormId}/respuestas/${responseRecordId}`);
 const panel = within(await screen.findByRole("region", { name: "Detalle de la respuesta" }));
 expect((await panel.findAllByText("De Entrega histórica")).length).toBeGreaterThan(0);
 expect(panel.getByText("Corregido al completar")).toBeVisible();
 expect(panel.getByText("Preguntar siempre · Sin IA")).toBeVisible();
 await userEvent.click(panel.getByRole("button", { name: "Ver datos propuestos" }));
 const proposed = within(panel.getByRole("region", { name: "Datos propuestos" }));
 expect(proposed.getByText("7")).toBeVisible();
 expect(proposed.getByText("Texto propuesto histórico")).toBeVisible();
 expect(proposed.getByText("No incluido")).toBeVisible();
 expect(proposed.getByText("Opción histórica")).toBeVisible();
 expect(panel.getByText("Luz Operadora")).toBeVisible();
 expect(panel.getByText("Se informó una entrega y quedó pendiente su cobro.")).toBeVisible();
 expect(panel.getByRole("link", { name: "TEST-000001 · Entrega histórica" })).toHaveAttribute("href", `/formularios/${responseFormId}/respuestas/${responseSecondId}`);
 expect(panel.queryByRole("link", { name: /TEST-000002/ })).not.toBeInTheDocument();
 expect(api.reads()).toBe(1);
});
it("withdraws captured reasons and the complete chain when response reading is revoked", async () => {
 const api = setup(); renderRouteWithProviders(`/formularios/${responseFormId}/respuestas/${responseRecordId}`);
 await screen.findByText("Se informó una entrega y quedó pendiente su cobro.");
 api.forbid(); await act(async () => { await queryClient.invalidateQueries(); });
 await waitFor(() => expect(screen.queryByText("Se informó una entrega y quedó pendiente su cobro.")).not.toBeInTheDocument());
 expect(screen.queryByRole("link", { name: "TEST-000001 · Entrega histórica" })).not.toBeInTheDocument();
 expect(screen.queryByText("Luz Operadora")).not.toBeInTheDocument();
});
// DOC5-A: a response passed from «Documentos recibidos» says which document it came from and who passed it, with the way to it; the server
// names the document only to whoever sees the inbox, and without it nothing is said.
it.each([[true], [false]] as const)("names the document a response came from when the server names it (%s)", async named => {
 const record = responseDetailFixture(); const document = { id: "0199b0c0-0000-7000-8000-000000000005", name: "comprobante.jpg" };
 const origin = { ...record.origin, channelId: "documents", senderName: "Ana Pérez", conversationId: null, maskedAddress: null, ...named ? { document } : {} };
 server.use(
  http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: named ? ["formrecords.read", "formdocuments.read"] : ["formrecords.read"] })),
  http.post("/api/forms/definitions/:id/records/search", () => HttpResponse.json(responseSheetFixture())),
  http.get("/api/forms/records/:id", () => HttpResponse.json({ ...record, channel: "documents", origin })),
  http.get("/api/forms/records/:id/workflow", () => HttpResponse.json(responseWorkflowFixture())),
 );
 renderRouteWithProviders(`/formularios/${responseFormId}/respuestas/${responseRecordId}`);
 const panel = within(await screen.findByRole("region", { name: "Detalle de la respuesta" }, { timeout: 10_000 }));
 if (!named) { expect((await panel.findAllByText(record.values[0]!.label, {}, { timeout: 10_000 })).length).toBeGreaterThan(0); expect(panel.queryByRole("region", { name: "Cómo empezó" })).not.toBeInTheDocument(); return; }
 const section = within(await panel.findByRole("region", { name: "Cómo empezó" }, { timeout: 10_000 }));
 expect(section.getByText("Salió de un documento · comprobante.jpg")).toBeVisible();
 expect(section.getByText("La pasó al formulario Ana Pérez")).toBeVisible();
 expect(section.getByRole("link", { name: "Ver en Documentos recibidos" })).toHaveAttribute("href", "/formularios/documentos/" + document.id);
}, 20_000);
