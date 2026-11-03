import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { DataList } from "./DataList";

it("reads each datum with its value as a term and its definition, in order", () => {
  const { container } = render(<DataList items={[{ label: "Cliente", value: "Pérez Hnos." }, { label: "Producto", value: <strong>Fertilizante</strong> }]} />);
  expect(container.querySelector("dl")).not.toBeNull();
  expect(Array.from(container.querySelectorAll("dt"), term => term.textContent)).toEqual(["Cliente", "Producto"]);
  expect(Array.from(container.querySelectorAll("dd"), value => value.textContent)).toEqual(["Pérez Hnos.", "Fertilizante"]);
  expect(screen.getByText("Fertilizante").tagName).toBe("STRONG");
});

it("keeps each datum next to its value in the same row, with a line between rows", () => {
  const { container } = render(<DataList items={[{ label: "Zona", value: "Norte" }, { label: "Rubro", value: "—" }]} />);
  const rows = container.querySelectorAll("dl > div");
  expect(rows).toHaveLength(2);
  for (const row of rows) expect(Array.from(row.children, child => child.tagName)).toEqual(["DT", "DD"]);
  expect(container.querySelector("dl")?.className).toContain("divide-y");
});
