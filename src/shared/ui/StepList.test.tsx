import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { CheckIcon, SlidersIcon } from "./icons";
import { StepList } from "./StepList";

const steps = [
  { key: "when", icon: <CheckIcon />, content: "Se aprueba una respuesta" },
  { key: "if", icon: <SlidersIcon />, content: "Si Lote es Norte" },
  { key: "do", icon: <CheckIcon />, content: "Armar el PDF" },
];

it("reads each step in order as an item of an ordered list, with its text", () => {
  render(<StepList steps={steps} />);
  const items = within(screen.getByRole("list")).getAllByRole("listitem");
  expect(screen.getByRole("list").tagName).toBe("OL");
  expect(items.map(item => item.textContent)).toEqual(["Se aprueba una respuesta", "Si Lote es Norte", "Armar el PDF"]);
});

it("keeps the icons out of what is read and joins each step to the next with a line", () => {
  const { container } = render(<StepList steps={steps} />);
  const icons = container.querySelectorAll("[data-step-icon]");
  expect(icons).toHaveLength(3);
  for (const icon of icons) expect(icon.closest("[aria-hidden='true']")).not.toBeNull();
  // The last step has nothing to join.
  expect(container.querySelectorAll("[data-step-line]")).toHaveLength(2);
});
