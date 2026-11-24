import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ActionTooltip } from "./ActionTooltip";
import { ConfirmDialog } from "./ConfirmDialog";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

const reason = "Hay una publicación en curso.";
const touch = (target: Element) => userEvent.pointer({ keys: "[TouchA]", target });

function renderInformative() {
  renderWithProviders(
    <ActionTooltip informative label={reason}>
      <button type="button">Publicar</button>
    </ActionTooltip>,
  );
  return screen.getByRole("button", { name: "Publicar" });
}

describe("a tooltip that only informs (MA1-A)", () => {
  it("opens with a click and stays open", async () => {
    await userEvent.click(renderInformative());

    expect(await screen.findByRole("tooltip")).toHaveTextContent(reason);
  });

  it("opens with a touch, which a tooltip of an action ignores", async () => {
    await touch(renderInformative());

    expect(await screen.findByRole("tooltip")).toHaveTextContent(reason);
  });

  it("opens again with Enter or Space after Escape closes it", async () => {
    renderInformative();
    await userEvent.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent(reason);

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByRole("tooltip")).toHaveTextContent(reason);

    await userEvent.keyboard("{Escape}");
    await userEvent.keyboard(" ");
    expect(await screen.findByRole("tooltip")).toHaveTextContent(reason);
  });

  // O2 (2026-11-24): a focus given back by code after a click does not open it; a click still does (MA1-A).
  it("does not open with a focus given back by code after a click, and a click opens it", async () => {
    const button = renderInformative();
    await userEvent.click(document.body);
    act(() => button.focus());
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    await userEvent.click(button);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(reason);
  });

  it("stays open with another touch on the control and closes with a touch outside", async () => {
    const button = renderInformative();
    await touch(button);
    await touch(button);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(reason);

    await touch(document.body);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});

describe("the tooltip of an action", () => {
  it("lets the click do the action and closes", async () => {
    const onClick = vi.fn();
    renderWithProviders(
      <ActionTooltip label="Editar">
        <button type="button" onClick={onClick}>✎</button>
      </ActionTooltip>,
    );

    await userEvent.click(screen.getByRole("button", { name: "✎" }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  // O2 (2026-11-24): closing a dialog with the mouse gives the focus back to its icon by code. The name of the icon does
  // not open: it covered the icon of the row above and took its first click. With the keyboard it opens as always.
  it("does not open when a dialog gives the focus back after a click, and opens with the keyboard", async () => {
    function Row() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <ActionTooltip label="Editar">
            <button type="button" onClick={() => setOpen(true)}>✎</button>
          </ActionTooltip>
          <ConfirmDialog open={open} onOpenChange={setOpen} title="Editar a Lucía" confirmLabel="Guardar" onConfirm={() => setOpen(false)} />
        </>
      );
    }
    renderWithProviders(<Row />);
    const icon = screen.getByRole("button", { name: "✎" });

    await userEvent.click(icon);
    await userEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(icon).toHaveFocus());
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    await userEvent.tab();
    await userEvent.tab({ shift: true });
    expect(icon).toHaveFocus();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Editar");
  });
});
