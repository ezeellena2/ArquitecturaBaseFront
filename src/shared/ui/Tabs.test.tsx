import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, FormEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./Tabs";

function ExampleTabs({ photosDisabled = false, ...props }: ComponentProps<typeof Tabs> & { photosDisabled?: boolean }) {
  return (
    <Tabs defaultValue="response" {...props}>
      <TabsList aria-label="Contenido de la respuesta">
        <TabsTrigger value="response">Respuesta</TabsTrigger>
        <TabsTrigger value="photos" disabled={photosDisabled}>Fotos</TabsTrigger>
        <TabsTrigger value="activity">Actividad</TabsTrigger>
        <TabsTrigger value="pdf">PDF</TabsTrigger>
      </TabsList>
      <TabsContent value="response">Respuesta visible</TabsContent>
      <TabsContent value="photos"><button type="button">Ampliar foto</button></TabsContent>
      <TabsContent value="activity">Actividad observada</TabsContent>
      <TabsContent value="pdf">Archivo PDF</TabsContent>
    </Tabs>
  );
}

describe("Tabs", () => {
  it("names the tabs and links the selected tab to its only visible panel", () => {
    render(<ExampleTabs />);

    const list = screen.getByRole("tablist", { name: "Contenido de la respuesta" });
    expect(within(list).getAllByRole("tab").map(tab => tab.textContent)).toEqual(["Respuesta", "Fotos", "Actividad", "PDF"]);
    const selected = within(list).getByRole("tab", { name: "Respuesta", selected: true });
    const panel = screen.getByRole("tabpanel", { name: "Respuesta" });
    expect(selected).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveAttribute("aria-labelledby", selected.id);
    expect(panel).toHaveTextContent("Respuesta visible");
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    expect(screen.queryByText("Actividad observada")).not.toBeInTheDocument();
    expect(screen.queryByText("Archivo PDF")).not.toBeInTheDocument();
  });

  it("moves focus and selection with arrows, Home and End while skipping a disabled tab", async () => {
    const user = userEvent.setup();
    render(<ExampleTabs photosDisabled />);
    const response = screen.getByRole("tab", { name: "Respuesta" });
    const photos = screen.getByRole("tab", { name: "Fotos" });
    const activity = screen.getByRole("tab", { name: "Actividad" });
    const pdf = screen.getByRole("tab", { name: "PDF" });

    await user.tab();
    expect(response).toHaveFocus();
    expect(photos).toBeDisabled();
    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(activity).toHaveFocus());
    expect(activity).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "Actividad" })).toHaveTextContent("Actividad observada");
    await user.keyboard("{End}");
    await waitFor(() => expect(pdf).toHaveFocus());
    expect(pdf).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Home}");
    await waitFor(() => expect(response).toHaveFocus());
    expect(response).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowLeft}");
    await waitFor(() => expect(pdf).toHaveFocus());
    expect(pdf).toHaveAttribute("aria-selected", "true");
  });

  it("uses one tab stop before entering the selected panel and its controls", async () => {
    const user = userEvent.setup();
    render(<><button type="button">Antes</button><ExampleTabs defaultValue="photos" /><button type="button">Después</button></>);

    await user.tab();
    expect(screen.getByRole("button", { name: "Antes" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("tab", { name: "Fotos" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Respuesta" })).toHaveAttribute("tabindex", "-1");
    await user.tab();
    expect(screen.getByRole("tabpanel", { name: "Fotos" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Ampliar foto" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Después" })).toHaveFocus();
  });

  it("reports a requested tab and keeps selection controlled by its owner", async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    const view = render(<ExampleTabs value="response" onValueChange={changed} />);

    await user.tab();
    await user.keyboard("{End}");
    await waitFor(() => expect(changed).toHaveBeenCalledWith("pdf"));
    expect(screen.getByRole("tab", { name: "Respuesta" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "PDF" })).toHaveAttribute("aria-selected", "false");
    view.rerender(<ExampleTabs value="pdf" onValueChange={changed} />);
    expect(screen.getByRole("tab", { name: "PDF" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "PDF" })).toHaveTextContent("Archivo PDF");
  });

  it("changes tabs by keyboard without submitting its containing form", async () => {
    const user = userEvent.setup();
    const submitted = vi.fn((event: FormEvent) => event.preventDefault());
    render(<form onSubmit={submitted}><ExampleTabs /></form>);

    await user.tab();
    await user.keyboard("{End}{Enter} ");
    await waitFor(() => expect(screen.getByRole("tab", { name: "PDF" })).toHaveFocus());
    expect(screen.getByRole("tab", { name: "PDF" })).toHaveAttribute("aria-selected", "true");
    expect(submitted).not.toHaveBeenCalled();
  });
});
