import { screen, within } from "@testing-library/react";
import { beforeAll, expect, it } from "vitest";
import i18n from "@/shared/i18n";
import { renderInRouterWithProviders } from "@/test/utils/renderWithProviders";
import { AssistantSources } from "./AssistantSources";

const evidence = {
  id: "01990000-0000-7000-8000-000000000301", sourceId: "users.summary", sourceVersion: 1, observedAtUtc: "2026-11-03T13:00:00Z", revision: null,
  destination: null, requiredPermissions: [], rows: [{ id: null, values: [{ label: "Activos", value: "3" }, { label: "Inactivos", value: "1" }] }], isComplete: true,
};
const role = (id: string, name: string, description: string, accounts: string) => ({ id,
  values: [{ label: "Rol", value: name }, { label: "Descripción", value: description }, { label: "Cuentas asignadas", value: accounts }] });
const roles = { ...evidence, id: "01990000-0000-7000-8000-000000000302", sourceId: "roles.list", destination: "roles", isComplete: false,
  rows: [role("01990000-0000-7000-8000-000000000311", "Administrador", "Administra la cuenta entera", "1"),
    role("01990000-0000-7000-8000-000000000312", "Soporte", "Atiende consultas", "1.250")] };

beforeAll(async () => { await i18n.changeLanguage("es"); await i18n.loadNamespaces("assistant"); });

// TC4-A (2026-11-25): each source goes in the card of a proposal, by its name, its data in two columns (LR1) and when it was read
// in its foot; without a destination it can open, nothing to open.
it("shows a source in its card, with its data in two columns and when it was read in its foot", async () => {
  renderInRouterWithProviders(<AssistantSources evidences={[evidence]} permissions={[]} timeZone="UTC" />);
  const card = await screen.findByRole("region", { name: "Fuente verificada: Usuarios" });
  expect(within(card).getByRole("heading", { name: "Fuente verificada" })).toBeInTheDocument();
  expect(within(card).getByText("3").closest("dd")?.previousElementSibling).toHaveTextContent(/^Activos$/);
  expect(within(card).getByText("1").closest("dd")?.previousElementSibling).toHaveTextContent(/^Inactivos$/);
  expect(within(card).getByText(/^Consultado /)).toHaveClass("assistant-proposal-foot");
  expect(within(card).queryByRole("link")).not.toBeInTheDocument();
  expect(within(card).queryByText("Resultado parcial")).not.toBeInTheDocument();
});

// Several rows that bring the same data read in a table, one per row and the numbers to the right; a partial result says so in
// the band, beside «Abrir fuente».
it("reads several rows with the same data in a table and opens the source it can open", async () => {
  renderInRouterWithProviders(<AssistantSources evidences={[roles]} permissions={["roles.read"]} timeZone="UTC" />);
  const card = await screen.findByRole("region", { name: "Fuente verificada: Roles" });
  const table = within(card).getByRole("table");
  const headers = within(table).getAllByRole("columnheader");
  expect(headers.map(header => header.textContent)).toEqual(["Rol", "Descripción", "Cuentas asignadas"]);
  expect(headers[2]).toHaveClass("text-right");
  expect(within(table).getAllByRole("row")).toHaveLength(3);
  expect(within(table).getByText("1.250")).toHaveClass("text-right");
  expect(within(card).queryByRole("term")).not.toBeInTheDocument();
  expect(within(card).getByText("Resultado parcial")).toBeInTheDocument();
  expect(within(card).getByRole("link", { name: "Abrir fuente" })).toHaveAttribute("href", "/roles");
});
