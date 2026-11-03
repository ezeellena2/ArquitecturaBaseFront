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

  it("fills the chosen option with the color of the buttons and leaves the others white", () => {
    render(
      <SegmentedControl
        aria-label="¿Llegó en buen estado?"
        options={[
          { key: "true", label: "Sí", pressed: true, onSelect: vi.fn() },
          { key: "false", label: "No", pressed: false, onSelect: vi.fn() },
        ]}
      />,
    );

    // OE1-A (2026-11-03): un verde casi blanco sobre blanco no decía cuál estaba elegida. El tono de los enlaces da
    // 4,5:1 contra el blanco en cualquier paleta de Apariencia, y su tinta, 4,5:1 sobre él.
    expect(screen.getByRole("button", { name: "Sí" })).toHaveClass("bg-[var(--color-brand-600)]", "text-[var(--color-brand-ink)]", "font-semibold");
    expect(screen.getByRole("button", { name: "No" })).toHaveClass("text-[var(--color-content)]");
    expect(screen.getByRole("button", { name: "No" })).not.toHaveClass("bg-[var(--color-brand-600)]");
  });

  it("draws the keyboard focus outside the option, where it shows on the filled one too", () => {
    render(
      <SegmentedControl
        aria-label="¿Llegó en buen estado?"
        options={[
          { key: "true", label: "Sí", pressed: true, onSelect: vi.fn() },
          { key: "false", label: "No", pressed: false, onSelect: vi.fn() },
        ]}
      />,
    );

    // Un contorno de la marca adentro de la opción pintada no se vería; afuera, el grupo no tiene que recortarlo.
    expect(screen.getByRole("button", { name: "Sí" })).toHaveClass("focus-visible:outline-offset-2");
    expect(screen.getByRole("group", { name: "¿Llegó en buen estado?" })).not.toHaveClass("overflow-hidden");
  });

  it("grows each option to the touch target on the phone", () => {
    render(
      <SegmentedControl
        aria-label="¿Llegó en buen estado?"
        options={[
          { key: "true", label: "Sí", pressed: false, onSelect: vi.fn() },
          { key: "false", label: "No", pressed: false, onSelect: vi.fn() },
        ]}
      />,
    );

    expect(screen.getByRole("group", { name: "¿Llegó en buen estado?" })).toHaveClass("max-sm:h-11");
    expect(screen.getByRole("button", { name: "Sí" })).toHaveClass("max-sm:min-w-11");
  });

  it("turns every option off while its owner works", async () => {
    const onFile = vi.fn();
    render(
      <SegmentedControl
        aria-label="Desde"
        disabled
        options={[
          { key: "file", label: "Subir un archivo", pressed: true, onSelect: vi.fn() },
          { key: "paste", label: "Pegar desde Excel", pressed: false, onSelect: onFile },
        ]}
      />,
    );

    // La importación, mientras revisa o aplica: no se cambia de origen a mitad de camino.
    for (const name of ["Subir un archivo", "Pegar desde Excel"]) expect(screen.getByRole("button", { name })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Pegar desde Excel" }));
    expect(onFile).not.toHaveBeenCalled();
  });
});
