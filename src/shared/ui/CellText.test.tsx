import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { CellText } from "./CellText";

const whole = (container: HTMLElement) => Array.from(container.querySelectorAll(".whitespace-nowrap"), node => node.textContent);

it("keeps each code with hyphens on one line and lets the text wrap at its spaces", () => {
  const { container } = render(<p><CellText text="30-71458236-9, 30-65432109-7" /></p>);
  expect(container).toHaveTextContent("30-71458236-9, 30-65432109-7");
  expect(whole(container)).toEqual(["30-71458236-9,", "30-65432109-7"]);
});

it("leaves the words without hyphens as they are", () => {
  const { container } = render(<p><CellText text="Zona norte, depósito 2" /></p>);
  expect(container.querySelector("p")?.innerHTML).toBe("Zona norte, depósito 2");
});
