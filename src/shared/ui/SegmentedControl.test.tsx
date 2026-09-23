import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FormEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { SegmentedControl } from "./SegmentedControl";

describe("SegmentedControl", () => {
  it("is a named group of buttons that say which one is pressed", () => {
    render(
      <SegmentedControl
        aria-label="Mostrar"
        options={[
          { key: "all", label: "Todos", pressed: true, onSelect: vi.fn() },
          { key: "picked", label: "Elegidos · 3", pressed: false, onSelect: vi.fn() },
        ]}
      />,
    );

    // Sin nombre, el lector anuncia dos botones sueltos y no dice qué eligen.
    const group = screen.getByRole("group", { name: "Mostrar" });

    expect(group).toContainElement(screen.getByRole("button", { name: "Todos" }));
    expect(screen.getByRole("button", { name: "Todos" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Elegidos · 3" })).toHaveAttribute("aria-pressed", "false");
  });

  it("selects the option that was clicked", async () => {
    const onAll = vi.fn();
    const onPicked = vi.fn();
    render(
      <SegmentedControl
        aria-label="Mostrar"
        options={[
          { key: "all", label: "Todos", pressed: true, onSelect: onAll },
          { key: "picked", label: "Elegidos · 3", pressed: false, onSelect: onPicked },
        ]}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Elegidos · 3" }));

    expect(onPicked).toHaveBeenCalledTimes(1);
    expect(onAll).not.toHaveBeenCalled();
  });

  it("never submits the form it lives in", async () => {
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <SegmentedControl
          aria-label="Mostrar"
          options={[{ key: "all", label: "Todos", pressed: false, onSelect: vi.fn() }]}
        />
      </form>,
    );

    // El editor de un rol lo pone adentro de su `<form>`: un botón sin `type` lo enviaría.
    await userEvent.click(screen.getByRole("button", { name: "Todos" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
