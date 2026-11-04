import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { AssistantProposalCard } from "./AssistantProposalCard";

it("names its kind in the band with its actions, and folds to one line with its state and nothing to do", () => {
  const { rerender } = render(<AssistantProposalCard kind="Formulario" title="Control de carga" summary="CCC · 2 preguntas"
    actions={<button type="button">Crear borrador</button>}><p>1. Patente</p></AssistantProposalCard>);
  const card = screen.getByRole("region", { name: "Formulario: Control de carga" });
  expect(within(card).getByRole("heading", { name: "Formulario" })).toBeInTheDocument();
  expect(within(card).getByText("CCC · 2 preguntas")).toBeInTheDocument();
  expect(within(card).getByText("1. Patente")).toBeInTheDocument();
  expect(within(card).getByRole("button", { name: "Crear borrador" })).toBeInTheDocument();
  rerender(<AssistantProposalCard kind="Formulario" title="Control de carga" folded={{ state: "Reemplazada" }}><p>1. Patente</p></AssistantProposalCard>);
  const folded = screen.getByRole("region", { name: "Formulario: Control de carga" });
  expect(folded).toHaveAttribute("data-folded", "true");
  expect(within(folded).getByText("Reemplazada")).toBeInTheDocument();
  expect(within(folded).queryByText("1. Patente")).not.toBeInTheDocument();
  expect(within(folded).queryByRole("button")).not.toBeInTheDocument();
});
