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
