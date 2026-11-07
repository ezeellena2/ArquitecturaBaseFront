import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { expect, it, vi } from "vitest";
import { server } from "@/test/mocks/server";
import { currentUser } from "@/test/mocks/handlers";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { responseDetailFixture, responseFormId, responseSheetFixture, responseWorkflowFixture } from "@/test/responseFixtures";
vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"),
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));

const blockId = "0199a0c0-0000-7000-8000-000000000960";
const itemId = "0199a0c0-0000-7000-8000-000000000961";
const quantityId = "0199a0c0-0000-7000-8000-000000000962";
const cell = (fieldId: string, type: "choice" | "decimal", state: "Answered" | "Unanswered", value: unknown) => ({ fieldId, type, state, value }) as never;
const item = (label: string | null, quantity: string) => ({ cells: [
  label === null ? cell(itemId, "choice", "Unanswered", null) : cell(itemId, "choice", "Answered", { choiceId: "0199a0c0-0000-7000-8000-000000000970", label }),
  cell(quantityId, "decimal", "Answered", quantity)] });

// Board RG4-A: one row per response, and the block says how many items and the first value of each, in one line.
it("shows the block as its amount of items and their first values, without sorting by it", async () => {
  const sheet = responseSheetFixture();
  sheet.columns = [...sheet.columns, { fieldId: blockId, type: "group", label: "Artículos", introducedInVersion: 1, options: [], questions: [
    { fieldId: itemId, type: "choice", label: "Artículo", introducedInVersion: 1, options: [] },
    { fieldId: quantityId, type: "decimal", label: "Cantidad", introducedInVersion: 1, options: [] }] }];
  sheet.records.items = sheet.records.items.map((row, index) => ({ ...row, cells: [...row.cells, index === 0
    ? { fieldId: blockId, type: "group", state: "Answered", value: [item("GLIFOSATO 64%", "200"), item(null, "7"), item("UREA GRANULADA", "1")] }
    : { fieldId: blockId, type: "group", state: "Unanswered", value: [] }] }));
  server.use(http.get("/api/forms/approvals", () => HttpResponse.json({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0, hasPrevious: false, hasNext: false })),
    http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formrecords.read"] })),
    http.post("/api/forms/definitions/:id/records/search", () => HttpResponse.json(sheet)),
    http.get("/api/forms/records/:id/workflow", ({ params }) => HttpResponse.json(responseWorkflowFixture(String(params.id)))),
    http.get("/api/forms/records/:id", ({ params }) => HttpResponse.json(responseDetailFixture(String(params.id)))));

  renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas");

  const header = await screen.findByRole("columnheader", { name: "Artículos" });
  expect(within(header).queryByRole("button")).not.toBeInTheDocument();
  const rows = within(screen.getByRole("table")).getAllByRole("row");
  expect(within(rows[1]).getByText("3")).toHaveClass("text-[var(--color-content-muted)]");
  expect(rows[1]).toHaveTextContent("3 · GLIFOSATO 64%, UREA GRANULADA");
  expect(rows[2]).toHaveTextContent("Sin respuesta");
});
