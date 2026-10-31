import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { Dialog, DialogContent, DialogTitle } from "./dialog";

// While a dialog cannot close (an import applying), its × stays in sight, off, with the reason as its help.
it("keeps the close button in sight but off, with its reason, while the dialog cannot close", async () => {
  const change = vi.fn(), reason = "Esperá a que termine de aplicar.";
  renderWithProviders(<Dialog open onOpenChange={change}><DialogContent aria-describedby={undefined} closeDisabledReason={reason}><DialogTitle>Importar</DialogTitle></DialogContent></Dialog>);
  const close = await screen.findByRole("button", { name: "Cerrar" });
  expect(close).toBeDisabled();
  expect(close).toHaveAccessibleDescription(reason);
  await userEvent.hover(close);
  expect(await screen.findByRole("tooltip")).toHaveTextContent(reason);
  await userEvent.click(close);
  expect(change).not.toHaveBeenCalled();
});
