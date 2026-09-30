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
});
