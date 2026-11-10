import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ActionTooltip } from "./ActionTooltip";
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
});
