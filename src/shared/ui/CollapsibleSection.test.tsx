import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type FormEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { CollapsibleSection } from "./CollapsibleSection";

const labels = { title: "Respuesta", expandLabel: "Desplegar respuesta", collapseLabel: "Plegar respuesta" };

function ControlledExample({ onSubmit }: { onSubmit?: (event: FormEvent) => void }) {
  const [responseOpen, setResponseOpen] = useState(true);
  const [activityOpen, setActivityOpen] = useState(true);
  return <form onSubmit={onSubmit}>
    <CollapsibleSection {...labels} open={responseOpen} onOpenChange={setResponseOpen} summary="Dos preguntas" meta="Versión 3">
      <a href="#response-file">Abrir documento</a>
    </CollapsibleSection>
    <CollapsibleSection title="Actividad" expandLabel="Desplegar actividad" collapseLabel="Plegar actividad"
      open={activityOpen} onOpenChange={setActivityOpen} summary="Cuatro momentos">
      <a href="#activity-file">Descargar comprobante</a>
    </CollapsibleSection>
  </form>;
}

describe("CollapsibleSection", () => {
  it("links the named toggle to its content and keeps the shared heading", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ControlledExample />);
    await user.tab();
    const section = screen.getByRole("region", { name: "Respuesta" });
    expect(within(section).getByRole("heading", { name: "Respuesta", level: 2 })).toBeInTheDocument();
    const toggle = within(section).getByRole("button", { name: "Plegar respuesta" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const content = document.getElementById(toggle.getAttribute("aria-controls")!);
    expect(content).toContainElement(screen.getByRole("link", { name: "Abrir documento" }));
    expect(within(section).getByText("Versión 3")).toBeVisible();
    expect(within(section).queryByText("Dos preguntas")).not.toBeInTheDocument();
  });

  it("reports the requested state and waits for its owner before changing visibility", async () => {
    const changed = vi.fn();
    const view = renderWithProviders(<CollapsibleSection {...labels} open onOpenChange={changed} summary="Dos preguntas" meta="Versión 3">
      <a href="#file">Abrir documento</a>
    </CollapsibleSection>);
    const user = userEvent.setup();
    const toggle = screen.getByRole("button", { name: "Plegar respuesta" });
    const contentId = toggle.getAttribute("aria-controls");
    await user.click(toggle);
    expect(changed).toHaveBeenCalledExactlyOnceWith(false);
    expect(screen.getByRole("link", { name: "Abrir documento" })).toBeVisible();
    view.rerender(<CollapsibleSection {...labels} open={false} onOpenChange={changed} summary="Dos preguntas" meta="Versión 3">
      <a href="#file">Abrir documento</a>
    </CollapsibleSection>);
    expect(screen.getByRole("button", { name: "Desplegar respuesta" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Desplegar respuesta" })).toHaveAttribute("aria-controls", contentId);
    expect(screen.queryByRole("link", { name: "Abrir documento" })).not.toBeInTheDocument();
    expect(screen.getByText("Dos preguntas")).toBeVisible();
    expect(screen.queryByText("Versión 3")).not.toBeInTheDocument();
  });

  it("toggles with Enter and Space without submitting or moving focus into hidden content", async () => {
    const submitted = vi.fn((event: FormEvent) => event.preventDefault());
    const user = userEvent.setup();
    renderWithProviders(<ControlledExample onSubmit={submitted} />);
    await user.tab();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "Desplegar respuesta" })).toHaveFocus();
    expect(screen.queryByRole("link", { name: "Abrir documento" })).not.toBeInTheDocument();
    await user.keyboard(" ");
    expect(screen.getByRole("button", { name: "Plegar respuesta" })).toHaveFocus();
    expect(screen.getByRole("link", { name: "Abrir documento" })).toBeVisible();
    expect(submitted).not.toHaveBeenCalled();
  });

  // A zone of fields (ZP1-A, 2026-11-02): its help stays beside the title, and its actions come back to the band only open.
  it("keeps its help beside the title and its actions in the band only while open", () => {
    const section = (open: boolean) => <CollapsibleSection {...labels} open={open} onOpenChange={vi.fn()} summary="Dos preguntas" help="Lo que respondió la persona."
      actions={<button type="button">Agregar filtro</button>}>
      <a href="#file">Abrir documento</a>
    </CollapsibleSection>;
    const view = renderWithProviders(section(false));
    const region = screen.getByRole("region", { name: "Respuesta" });
    expect(within(region).getByRole("button", { name: "Más información sobre Respuesta" })).toHaveAccessibleDescription("Lo que respondió la persona.");
    expect(within(region).queryByRole("button", { name: "Agregar filtro" })).not.toBeInTheDocument();
    expect(within(region).getByText("Dos preguntas")).toBeVisible();
    view.rerender(section(true));
    const add = within(region).getByRole("button", { name: "Agregar filtro" });
    expect(add).toBeVisible();
    expect(within(region).getByRole("button", { name: "Más información sobre Respuesta" })).toBeInTheDocument();
    // The actions go before the arrow, in the band, never inside the content.
    const toggle = within(region).getByRole("button", { name: "Plegar respuesta" });
    expect(add.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(document.getElementById(toggle.getAttribute("aria-controls")!)).not.toContainElement(add);
  });

  it("keeps each section and its control independent", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ControlledExample />);
    const response = screen.getByRole("button", { name: "Plegar respuesta" });
    const activity = screen.getByRole("button", { name: "Plegar actividad" });
    expect(response.getAttribute("aria-controls")).not.toBe(activity.getAttribute("aria-controls"));
    await user.click(response);
    expect(screen.getByRole("button", { name: "Desplegar respuesta" })).toHaveAttribute("aria-expanded", "false");
    expect(activity).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Descargar comprobante" })).toBeVisible();
  });
});
