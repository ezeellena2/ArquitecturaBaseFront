import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Autocomplete } from "./Autocomplete";
describe("Autocomplete", () => {
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
