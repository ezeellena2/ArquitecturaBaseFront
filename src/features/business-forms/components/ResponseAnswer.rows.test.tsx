import { screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { responseDetailFixture } from "@/test/responseFixtures";
import type { ResponseDetail } from "../api/responses";
import { ResponseAnswer } from "./ResponseAnswer";
vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"),
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));

const id = (n: number) => "0199a0c0-0000-7000-8000-" + String(n).padStart(12, "0");
const value = (n: number, type: "choice" | "decimal" | "boolean", label: string, answer: unknown) => ({ fieldId: id(n), key: "field_" + n, type, label, value: answer }) as never;
const item = (article: string, quantity: string | null) => ({ values: [value(61, "choice", "Artículo", { choiceId: id(70), label: article }),
  value(62, "decimal", "Cantidad", quantity), value(63, "boolean", "¿Llegó bien?", true)] });
function record(): ResponseDetail {
  const detail = responseDetailFixture();
  return { ...detail, values: [{ fieldId: id(60), key: "field_60", type: "group", label: "Artículos",
    value: [item("GLIFOSATO 64%", "1500.5"), item("UREA GRANULADA", null)] } as never] };
}
const render = (layout: "panel" | "page") => renderWithProviders(<ResponseAnswer record={record()} actor={id(1)} busy={false} photos={[]}
  onForbidden={() => {}} onError={() => {}} layout={layout}/>);

// Board RG4-A in the quick view (D2, TL1-A): each item with its number and its first value in black, the others aligned below.
it("lists each item with its number and first value, and the other answers aligned under it", () => {
  render("panel");

  const items = within(screen.getByRole("list", { name: "Artículos" })).getAllByRole("listitem");
  expect(items).toHaveLength(2);
  expect(within(items[0]).getByText("GLIFOSATO 64%").closest(".font-medium")).not.toBeNull();
  expect(items[0]).toHaveTextContent("1GLIFOSATO 64%Cantidad1.500,5¿Llegó bien?Sí");
  expect(items[1]).toHaveTextContent("Sin respuesta");
});

// Board RG4-A on the full page (DC1): a table with the number of the item and a column per question.
it("shows the items in a table with the number to the right and a column per question", () => {
  render("page");

  const table = within(screen.getByRole("region", { name: "Artículos" })).getByRole("table");
  expect(within(table).getAllByRole("columnheader").map(header => header.textContent)).toEqual(["Ítem", "Artículo", "Cantidad", "¿Llegó bien?"]);
  const rows = within(table).getAllByRole("row").slice(1);
  expect(rows.map(row => within(row).getAllByRole("cell").map(cell => cell.textContent))).toEqual([
    ["1", "GLIFOSATO 64%", "1.500,5", "Sí"], ["2", "UREA GRANULADA", "Sin respuesta", "Sí"]]);
  expect(within(rows[0]).getAllByRole("cell")[2]).toHaveClass("text-right");
});
