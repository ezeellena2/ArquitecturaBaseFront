import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FormEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
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

  it("lets an option that does not fit go to the next line on the phone when it wraps", () => {
    render(
      <SegmentedControl
        wrap
        aria-label="Dónde se completa"
        options={[
          { key: "channels", label: "En la app y por WhatsApp", pressed: false, onSelect: vi.fn() },
          { key: "app", label: "Sólo en la app", pressed: true, onSelect: vi.fn() },
        ]}
      />,
    );

    // SA1-A (2026-11-09): en el celular las opciones van separadas y la que no entra baja de renglón; desde 640 px vuelven a
    // ir unidas, como cualquier segmentado.
    const group = screen.getByRole("group", { name: "Dónde se completa" });
    expect(group).toHaveClass("flex-wrap", "gap-1.5", "sm:inline-flex", "sm:divide-x", "sm:border");
    expect(group).not.toHaveClass("max-sm:h-11");
    // A text longer than the line (2026-11-11) takes the whole width and goes down in even lines: the option grows down, at
    // least 44 px high, and never out of its box.
    const long = screen.getByRole("button", { name: "En la app y por WhatsApp" });
    expect(long).toHaveClass("max-sm:min-h-11", "max-sm:max-w-full", "max-sm:py-2", "max-sm:whitespace-normal", "max-sm:text-balance", "max-sm:border", "max-sm:bg-[var(--color-surface)]");
    expect(long).not.toHaveClass("max-sm:h-11");
    expect(screen.getByRole("button", { name: "Sólo en la app" })).toHaveClass("bg-[var(--color-brand-600)]", "max-sm:border-[var(--color-brand-600)]");
  });

  it("keeps the options apart at every width when they always wrap, as in a narrow column", () => {
    render(
      <SegmentedControl
        wrap="always"
        aria-label="Mostrar"
        options={[
          { key: "all", label: "Todos (4)", pressed: true, onSelect: vi.fn() },
          { key: "unread", label: "Sin leer (1)", pressed: false, onSelect: vi.fn() },
          { key: "needsPerson", label: "Necesita una persona (1)", pressed: false, onSelect: vi.fn() },
        ]}
      />,
    );

    // AS4 (2026-11-12): the filters of the chat inbox, where «Necesita una persona» goes on to the next line also on the desktop.
    const group = screen.getByRole("group", { name: "Mostrar" });
    expect(group).toHaveClass("flex", "flex-wrap", "gap-1.5");
    expect(group).not.toHaveClass("sm:inline-flex", "sm:divide-x", "divide-x", "h-[var(--height-control)]");
    const other = screen.getByRole("button", { name: "Necesita una persona (1)" });
    expect(other).toHaveClass("min-h-[var(--height-control)]", "max-w-full", "rounded-[var(--radius-control)]", "border", "border-[var(--color-border)]", "bg-[var(--color-surface)]", "max-sm:min-h-11");
    expect(screen.getByRole("button", { name: "Todos (4)" })).toHaveClass("bg-[var(--color-brand-600)]", "border-[var(--color-brand-600)]");
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

  it("keeps an option that is not available in the tab order and only shows why", async () => {
    const onDelegation = vi.fn();
    renderWithProviders(
      <SegmentedControl
        aria-label="Cómo se conecta"
        options={[
          { key: "company", label: "Certificado de la empresa", pressed: true, onSelect: vi.fn() },
          { key: "delegation", label: "Delegación", pressed: false, onSelect: onDelegation, disabledReason: "Falta la plataforma." },
        ]}
      />,
    );

    // MA1-A: el motivo de lo apagado va sobre el mismo control y el clic sólo lo muestra.
    const option = screen.getByRole("button", { name: "Delegación" });
    expect(option).toHaveAttribute("aria-disabled", "true");
    expect(option).toHaveAccessibleDescription("Falta la plataforma.");
    await userEvent.click(option);
    expect(onDelegation).not.toHaveBeenCalled();
  });
});
