import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import type { ReceivedDocumentValue } from "../../api/receivedDocuments";
import { receivedDocumentFieldId } from "../../receivedDocuments";
import { ReceivedDocumentData } from "./ReceivedDocumentData";

const paid: ReceivedDocumentValue = { fieldId: "0199b000-0000-7000-8000-000000000001", label: "Pagada", type: "boolean", required: false,
  value: "true", text: "Sí", mark: "doubtful", errorCode: null, options: null, optionsUnavailable: null };

function Harness({ value, onChange }: { value: ReceivedDocumentValue; onChange: (fieldId: string, value: string) => void }) {
  const [draft, setDraft] = useState<Record<string, string>>({ [value.fieldId]: value.value ?? "" });
  return <ReceivedDocumentData documentId="document" person="Ana" values={[value]} draft={draft} problems={{}} server={{}} edit disabled={false}
    onChange={(fieldId, next) => { onChange(fieldId, next); setDraft(current => ({ ...current, [fieldId]: next })); }} onConflict={() => {}} />;
}

async function openList(name: string) {
  const button = screen.getByRole("button", { name });
  await act(async () => { button.focus(); });
  await userEvent.keyboard("{Enter}");
  return screen.findByRole("listbox", { name: "Pagada" });
}

// A yes or no datum goes in the shared piece for choosing (DS1-A, 2026-11-22), like a choice: its mark goes in the label and
// in the name of its button, which keeps the id the panel takes the focus to.
it("chooses a yes or no datum in the piece for choosing, with its mark", async () => {
  const onChange = vi.fn();
  renderWithProviders(<Harness value={paid} onChange={onChange} />);
  expect(screen.getByRole("button", { name: "Pagada Revisá Sí" })).toHaveAttribute("id", receivedDocumentFieldId(paid.fieldId));

  const list = await openList("Pagada Revisá Sí");
  expect(within(list).getAllByRole("option").map(option => option.textContent)).toEqual(["Sí", "No"]);
  await userEvent.click(within(list).getByRole("option", { name: "Sí" }));
  expect(onChange).not.toHaveBeenCalled();

  await userEvent.click(within(await openList("Pagada Revisá Sí")).getByRole("option", { name: "No" }));
  expect(onChange).toHaveBeenCalledWith(paid.fieldId, "false");
  expect(screen.getByRole("button", { name: "Pagada Revisá No" })).toHaveFocus();
});

it("invites to choose a yes or no that was not read", () => {
  renderWithProviders(<Harness value={{ ...paid, value: null, text: null, mark: "notRead" }} onChange={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Pagada No se leyó Elegí una opción" })).toBeInTheDocument();
});
