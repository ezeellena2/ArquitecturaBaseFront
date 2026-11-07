import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { expect, it, vi } from "vitest";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { responseFormId } from "@/test/responseFixtures";
import type { ResponseColumn } from "../responses";
import { ResponseFiltersMenu } from "./ResponseFiltersMenu";
vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));

const supplier: ResponseColumn = { fieldId: "01990000-0000-7000-8000-000000000959", type: "shortText", label: "Proveedor", introducedInVersion: 1, options: [] };
const quantity = "01990000-0000-7000-8000-000000000962";
const block: ResponseColumn = { fieldId: "01990000-0000-7000-8000-000000000960", type: "group", label: "Artículos", introducedInVersion: 1, options: [], questions: [
  { fieldId: "01990000-0000-7000-8000-000000000961", type: "choice", label: "Artículo", introducedInVersion: 1, options: [] },
  { fieldId: quantity, type: "decimal", label: "Cantidad", introducedInVersion: 1, options: [] },
] };

// Board RG4-A with PL1-A: the questions of the block go under its name, and each one filters by any item.
it("lists the questions of the block under its name and filters by any item", async () => {
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formrecords.read"] })),
    http.post("/api/forms/definitions/:id/records/filter-counts/search", () =>
      HttpResponse.json({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0, hasPrevious: false, hasNext: false })));
  const apply = vi.fn();
  renderWithProviders(<ResponseFiltersMenu formId={responseFormId} query={{ page: 1, pageSize: 20 }} columns={[supplier, block]} zone="UTC" onApply={apply}/>);

  await userEvent.click(screen.getByRole("button", { name: /^Filtros/ }));
  const panel = within(await screen.findByRole("dialog", { name: "Filtros" }));

  expect(panel.getAllByRole("button").filter(button => button.closest("ul")).map(button => button.textContent))
    .toEqual(["Recibida", "Proveedor", "Artículo", "Cantidad", "Cargó", "Versión del formulario"]);
  expect(panel.getByText("Artículos")).toBeInTheDocument();
  await userEvent.click(panel.getByRole("button", { name: "Cantidad" }));
  const pane = within(panel.getByRole("region", { name: "Cantidad" }));
  expect(pane.getByText("En algún ítem de Artículos")).toBeInTheDocument();
  await userEvent.type(pane.getByLabelText("Desde"), "200");
  await waitFor(() => expect(apply).toHaveBeenLastCalledWith(expect.objectContaining({ conditions: [{ fieldId: quantity, operator: "gte", values: ["200"] }] }), []));
});
