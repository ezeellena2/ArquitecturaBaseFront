import { useState } from "react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { Autocomplete } from "./Autocomplete";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog";
import { Table, TableBody, TableCell, TableRow } from "./table";
describe("Autocomplete", () => {
  it("renders the list outside a scrolling table so the table cannot clip it", async () => {
    render(<Table scrollLabel="Options"><TableBody><TableRow><TableCell>
      <Autocomplete aria-label="Zone" value="" onValueChange={() => {}}
        options={[{ id: "north", label: "North" }, { id: "south", label: "South" }]} onSelect={() => {}} />
    </TableCell></TableRow></TableBody></Table>);
    await userEvent.click(screen.getByRole("combobox", { name: "Zone" }));
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Options" })).not.toContainElement(screen.getByRole("listbox"));
  });
  it("opens the list on a click, typing or the arrows, not when the code focuses the field", async () => {
    render(<Autocomplete aria-label="Zone" value="" onValueChange={() => {}}
      options={[{ id: "north", label: "North" }, { id: "south", label: "South" }]} onSelect={() => {}} />);
    const input = screen.getByRole("combobox", { name: "Zone" });
    // Focusing the field from code (the first error when saving) leaves the list closed, so it does not cover the error.
    act(() => input.focus());
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await userEvent.keyboard("{ArrowDown}");
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await userEvent.click(input);
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
  });
  it("keeps the list open when the field is tapped again", async () => {
    render(<Autocomplete aria-label="Zone" value="" onValueChange={() => {}}
      options={[{ id: "north", label: "North" }, { id: "south", label: "South" }]} onSelect={() => {}} />);
    const input = screen.getByRole("combobox", { name: "Zone" });
    await userEvent.click(input);
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
    await userEvent.click(input);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-expanded", "true");
  });
  it("selects with the pointer and closes only the list with Escape inside a modal dialog", async () => {
    const select = vi.fn(), openChange = vi.fn();
    renderWithProviders(<Dialog open onOpenChange={openChange}><DialogContent>
      <DialogTitle>Edit user</DialogTitle><DialogDescription>Person data</DialogDescription>
      <Autocomplete aria-label="Zone" value="" onValueChange={() => {}}
        options={[{ id: "north", label: "North" }, { id: "south", label: "South" }]} onSelect={select} />
    </DialogContent></Dialog>);
    const dialog = await screen.findByRole("dialog", { name: "Edit user" });
    const input = within(dialog).getByRole("combobox", { name: "Zone" });
    await userEvent.click(input);
    await userEvent.click(screen.getByRole("option", { name: "North" }));
    expect(select).toHaveBeenCalledWith("north");
    expect(input).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(openChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Edit user" })).toBeInTheDocument();
    expect(input).toHaveFocus();
  });
  it("shows attribution inside the popup without making it a selectable option", async () => {
    render(<Autocomplete aria-label="Place" value="Clinic" onValueChange={() => {}}
      options={[{ id: "one", label: "Clinic One" }]} onSelect={() => {}}
      footer={<span>Provider attribution</span>} />);
    await userEvent.click(screen.getByRole("combobox"));
    expect(within(screen.getByRole("listbox")).getByText("Provider attribution")).toBeVisible();
    expect(screen.getAllByRole("option")).toHaveLength(1);
  });
  it("selects with the keyboard without submitting and closes with Escape", async () => {
    const select = vi.fn(), submit = vi.fn(event => event.preventDefault());
    function Example() {
      const [value, setValue] = useState("");
      return <form onSubmit={submit}><Autocomplete aria-label="Place" value={value} onValueChange={setValue}
        options={[{ id: "one", label: "Clinic One" }, { id: "two", label: "Clinic Two" }]} onSelect={select} /></form>;
    }
    render(<Example />);
    const input = screen.getByRole("combobox", { name: "Place" });
    await userEvent.type(input, "Clinic");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(select).toHaveBeenCalledWith("two");
    expect(submit).not.toHaveBeenCalled();
    expect(input).toHaveAttribute("aria-expanded", "false");
    await userEvent.keyboard("{ArrowDown}{Escape}");
    expect(input).toHaveAttribute("aria-expanded", "false");
  });
  it("keeps input focus when a pointer selects an option", async () => {
    const select = vi.fn();
    render(<Autocomplete aria-label="Place" value="Clinic" onValueChange={() => {}}
      options={[{ id: "one", label: "Clinic One" }]} onSelect={select} />);
    const input = screen.getByRole("combobox");
    await userEvent.click(input);
    await userEvent.click(screen.getByRole("option", { name: "Clinic One" }));
    expect(select).toHaveBeenCalledWith("one");
    expect(input).toHaveFocus();
  });
});
