import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IconButton } from "./IconButton";

describe("IconButton", () => {
  it("exposes its label to assistive technology", async () => {
    const onClick = vi.fn();
    render(
      <IconButton label="Cerrar" onClick={onClick}>
        <span aria-hidden="true">×</span>
      </IconButton>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
