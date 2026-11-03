import { screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { AssistantSources } from "./AssistantSources";

const evidence = {
  id: "01990000-0000-7000-8000-000000000301", sourceId: "users", sourceVersion: 1, observedAtUtc: "2026-11-03T13:00:00Z", revision: null,
  destination: null, requiredPermissions: [], rows: [{ id: null, values: [{ label: "Activos", value: "3" }, { label: "Inactivos", value: "1" }] }], isComplete: true,
};

// Board LR1: the values of a source read in two columns, the datum in grey and its value in its own column.
it("reads the values of a source in two columns", async () => {
  renderWithProviders(<AssistantSources evidences={[evidence]} permissions={[]} timeZone="UTC" />);
  const value = await screen.findByText("3");
  expect(value.closest("dd")?.previousElementSibling).toHaveTextContent(/^Activos$/);
  expect(value.closest("dl")).toHaveClass("divide-y");
  expect(screen.getByText("1").closest("dd")?.previousElementSibling).toHaveTextContent(/^Inactivos$/);
});
