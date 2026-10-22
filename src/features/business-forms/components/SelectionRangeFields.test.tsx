import { useState } from "react";
import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { SelectionRangeFields, type SelectionRange } from "./SelectionRangeFields";

function RangeEditor() {
  const [value, setValue] = useState<SelectionRange>({ minimum: 0, maximum: 4 });
  return <SelectionRangeFields value={value} limit={10} minimumLabel="Mínimo" maximumLabel="Máximo" readOnly={false} onChange={setValue}/>;
}

it("keeps an empty minimum distinct from zero and preserves the other bound", async () => {
  await act(async () => { renderWithProviders(<RangeEditor/>); });
  const minimum = screen.getByRole("spinbutton", { name: "Mínimo" });
  const maximum = screen.getByRole("spinbutton", { name: "Máximo" });
  expect(minimum).toHaveValue(0);
  fireEvent.change(minimum, { target: { value: "" } });
  expect(minimum).toHaveValue(null);
  expect(maximum).toHaveValue(4);
  fireEvent.change(minimum, { target: { value: "2" } });
  fireEvent.change(maximum, { target: { value: "" } });
  expect(minimum).toHaveValue(2);
  expect(maximum).toHaveValue(null);
});

it("leaves an invalid entered bound visible for the owner to explain instead of clamping it", async () => {
  await act(async () => { renderWithProviders(<RangeEditor/>); });
  const maximum = screen.getByRole("spinbutton", { name: "Máximo" });
  fireEvent.change(maximum, { target: { value: "11" } });
  expect(maximum).toHaveValue(11);
  expect(screen.getByRole("spinbutton", { name: "Mínimo" })).toHaveValue(0);
});

it("associates the owner's range error with both accessible controls", async () => {
  await act(async () => { renderWithProviders(<SelectionRangeFields value={{ minimum: 3, maximum: 1 }} limit={10} minimumLabel="Minimum" maximumLabel="Maximum" readOnly={false} error="Check the range" onChange={() => undefined}/>); });
  for (const label of ["Minimum", "Maximum"]) {
    const control = screen.getByRole("spinbutton", { name: label });
    expect(control).toHaveAttribute("aria-invalid", "true");
    expect(control).toHaveAccessibleDescription("Check the range");
  }
});

it("keeps both values unchanged under a read-only permission", async () => {
  const change = vi.fn();
  await act(async () => { renderWithProviders(<SelectionRangeFields value={{ minimum: 1, maximum: 4 }} limit={10} minimumLabel="Minimum" maximumLabel="Maximum" readOnly onChange={change}/>); });
  await userEvent.type(screen.getByRole("spinbutton", { name: "Minimum" }), "2");
  await userEvent.type(screen.getByRole("spinbutton", { name: "Maximum" }), "8");
  expect(screen.getByRole("spinbutton", { name: "Minimum" })).toHaveValue(1);
  expect(screen.getByRole("spinbutton", { name: "Maximum" })).toHaveValue(4);
  expect(change).not.toHaveBeenCalled();
});
