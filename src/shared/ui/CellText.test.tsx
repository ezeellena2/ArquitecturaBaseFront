import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { CellText } from "./CellText";

const whole = (container: HTMLElement) => Array.from(container.querySelectorAll(".whitespace-nowrap"), node => node.textContent);

it("keeps each code with hyphens on one line and lets the text wrap at its spaces", () => {
  const { container } = render(<p><CellText text="30-71458236-9, 30-65432109-7" /></p>);
  expect(container).toHaveTextContent("30-71458236-9, 30-65432109-7");
  expect(whole(container)).toEqual(["30-71458236-9,", "30-65432109-7"]);
});

it("breaks a path only after its slashes, each of its parts whole", () => {
  const { container } = render(<p><CellText text="America/Argentina/Buenos Aires" /></p>);
  expect(container).toHaveTextContent("America/Argentina/Buenos Aires");
  expect(whole(container)).toEqual(["America/", "Argentina/", "Buenos"]);
  expect(container.querySelectorAll("wbr")).toHaveLength(2);
});

it("leaves a date and the words without hyphens or slashes as they are", () => {
  const { container } = render(<p><CellText text="Zona norte, depósito 2, 16/03/2027" /></p>);
  expect(container.querySelector("p")?.innerHTML).toBe("Zona norte, depósito 2, 16/03/2027");
});
