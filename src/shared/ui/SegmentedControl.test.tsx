import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FormEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { FormField } from "./FormField";
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

  it("goes in a FormField like any control: its help and its error describe the group, marked invalid", () => {
    renderWithProviders(
      <FormField label="Filas por página" help="Cantidad inicial de filas." error="Revisá el tamaño.">
        <SegmentedControl
          aria-label="Filas por página"
          options={[
            { key: "10", label: "10", pressed: true, onSelect: vi.fn() },
            { key: "20", label: "20", pressed: false, onSelect: vi.fn() },
          ]}
        />
      </FormField>,
    );

    const group = screen.getByRole("group", { name: "Filas por página" });
    expect(group).toHaveAccessibleDescription("Cantidad inicial de filas. Revisá el tamaño.");
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Filas por página", { selector: "label" })).toHaveAttribute("for", group.id);
  });

  it("underlines the chosen channel of the access, without the compact boxes", async () => {
    const onWhatsApp = vi.fn();
    render(
      <SegmentedControl
        appearance="public"
        aria-label="Ingresar con"
        options={[
          { key: "email", label: "Correo", pressed: true, onSelect: vi.fn() },
          { key: "whatsapp", label: "WhatsApp", pressed: false, onSelect: onWhatsApp },
        ]}
      />,
    );

    // «Ingresar con» del acceso (2026-11-24): el subrayado de `.access-channel` marca el elegido; sin el relleno ni el borde
    // del segmentado compacto.
    const group = screen.getByRole("group", { name: "Ingresar con" });
    expect(group).toHaveClass("access-channel");
    expect(group).not.toHaveClass("inline-flex", "divide-x", "border");
    const chosen = screen.getByRole("button", { name: "Correo" });
    expect(chosen).toHaveAttribute("aria-pressed", "true");
    expect(chosen).not.toHaveClass("bg-[var(--color-brand-600)]");
    await userEvent.click(screen.getByRole("button", { name: "WhatsApp" }));
    expect(onWhatsApp).toHaveBeenCalledTimes(1);
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
});
