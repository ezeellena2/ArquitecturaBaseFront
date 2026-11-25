import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { AssistantProposalCard } from "./AssistantProposalCard";

it("names its kind in the band with its actions, and folds to one line with its state and nothing to do", () => {
  const { rerender } = render(<AssistantProposalCard kind="Formulario" title="Control de carga"
    actions={<button type="button">Crear borrador</button>}><p>1. Patente</p></AssistantProposalCard>);
  const card = screen.getByRole("region", { name: "Formulario: Control de carga" });
  expect(within(card).getByRole("heading", { name: "Formulario" })).toBeInTheDocument();
  expect(within(card).getByText("Control de carga")).toBeInTheDocument();
  expect(within(card).getByText("1. Patente")).toBeInTheDocument();
  expect(within(card).getByRole("button", { name: "Crear borrador" })).toBeInTheDocument();
  rerender(<AssistantProposalCard kind="Formulario" title="Control de carga" folded={{ state: "Reemplazada" }}><p>1. Patente</p></AssistantProposalCard>);
  const folded = screen.getByRole("region", { name: "Formulario: Control de carga" });
  expect(folded).toHaveAttribute("data-folded", "true");
  expect(within(folded).getByText("Reemplazada")).toBeInTheDocument();
  expect(within(folded).queryByText("1. Patente")).not.toBeInTheDocument();
  expect(within(folded).queryByRole("button")).not.toBeInTheDocument();
});

// TC2-B (2026-11-25): a table runs from edge to edge of the card and the foot, in the tone of the band, closes it.
it("closes with its foot, after the content", () => {
  render(<AssistantProposalCard kind="Catálogo" title="Contratistas" footer="Primeras 3 de 86 filas">
    <div className="assistant-proposal-table"><table><tbody><tr><td>20-11111111-1</td></tr></tbody></table></div>
  </AssistantProposalCard>);
  const card = screen.getByRole("region", { name: "Catálogo: Contratistas" });
  const foot = within(card).getByText("Primeras 3 de 86 filas");
  expect(foot).toHaveClass("assistant-proposal-foot");
  expect(card.lastElementChild).toBe(foot);
});
