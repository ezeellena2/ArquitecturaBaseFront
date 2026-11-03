import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem } from "./dropdown-menu";

describe("DropdownMenuRadioItem", () => {
  it("marks the chosen option with a tick, like a checkbox item", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup value="Soporte">
            <DropdownMenuRadioItem value="Admin">Admin</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="Soporte">Soporte</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    // OE1-A (2026-11-03): en un desplegable, la elegida lleva la tilde a la izquierda; un punto de 8 px casi no se veía.
    const chosen = screen.getByRole("menuitemradio", { name: "Soporte" });
    expect(chosen).toHaveAttribute("aria-checked", "true");
    expect(chosen.querySelector("svg path[d='M20 6 9 17l-5-5']")).not.toBeNull();
    expect(chosen.querySelector("svg circle")).toBeNull();
    expect(screen.getByRole("menuitemradio", { name: "Admin" }).querySelector("svg")).toBeNull();
  });
});
