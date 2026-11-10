import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IconButton } from "./IconButton";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

describe("IconButton", () => {
  it("exposes its label to assistive technology", async () => {
    const onClick = vi.fn();
    renderWithProviders(
      <IconButton label="Cerrar" onClick={onClick}>
        <span aria-hidden="true">×</span>
      </IconButton>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("shows the same label on hover and keyboard focus with no native title", async () => {
    renderWithProviders(<IconButton label="Cerrar"><span aria-hidden="true">×</span></IconButton>);
    const button = screen.getByRole("button", { name: "Cerrar" });
    expect(button).not.toHaveAttribute("title");
    await userEvent.hover(button);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Cerrar");
    await userEvent.unhover(button);
    await userEvent.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Cerrar");
  });

  it("keeps its name when it is off, with the reason as its tooltip and description (MA1-A)", async () => {
    const onClick = vi.fn();
    renderWithProviders(
      <IconButton label="Subir la pregunta 1" disabledLabel="Ya es la primera." disabled onClick={onClick}>
        <span aria-hidden="true">↑</span>
      </IconButton>,
    );
    const button = screen.getByRole("button", { name: "Subir la pregunta 1" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription("Ya es la primera.");

    await userEvent.tab();
    expect(button).toHaveFocus();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Ya es la primera.");

    await userEvent.keyboard("{Escape}");
    await userEvent.click(button);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Ya es la primera.");
    await userEvent.keyboard("{Escape}");
    await userEvent.pointer({ keys: "[TouchA]", target: button });
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Ya es la primera.");
    expect(onClick).not.toHaveBeenCalled();
  });
});
