import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import type { AssistantTurn } from "../../api/assistant";
import { AssistantOperationState } from "./AssistantOperationState";
const turn: AssistantTurn = {
  turnId: "0199a0c0-0000-7000-8000-000000000222",
  requestId: "0199a0c0-0000-7000-8000-000000000333",
  conversationId: "0199a0c0-0000-7000-8000-000000000111",
  ordinal: 1,
  conversationRevision: 1,
  turnRevision: 1,
  state: "pending",
  stage: "pending",
  cancelRequestedAtUtc: null,
  contentAccess: "allowed",
  question: "¿Cuántos usuarios activos hay?",
  answer: null,
  evidences: [],
  failure: null,
  usage: null,
  culture: "es",
  timeZoneId: "UTC",
  submittedAtUtc: "2026-10-04T12:00:00Z",
  serverNowUtc: "2026-10-04T12:00:00Z",
  pollingAfterSeconds: 1,
};
function show(value: AssistantTurn) {
  return renderWithProviders(
    <AssistantOperationState
      turn={value}
      busy={false}
      onCancel={vi.fn()}
      onRefresh={vi.fn()}
      onRepeat={vi.fn()}
    />,
  );
}
describe("AssistantOperationState", () => {
  it("shows the pending stage and cancel for a turn the backend reports as pending", () => {
    show(turn);
    expect(screen.getByText("Consulta pendiente")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancelar consulta" }),
    ).toBeEnabled();
  });
  it("translates every terminal state published by the backend", () => {
    const canceled = show({ ...turn, state: "canceled", stage: "finished" });
    expect(screen.getByText("Consulta cancelada")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Preparar otra consulta" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^states\./)).not.toBeInTheDocument();
    canceled.unmount();
    show({ ...turn, state: "uncertain", stage: "finished" });
    expect(screen.getByText("Resultado incierto")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Consultar estado" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^states\./)).not.toBeInTheDocument();
  });
});
