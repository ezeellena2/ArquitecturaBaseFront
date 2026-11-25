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

// TC5-A (2026-11-25): the list is the box and each row, the datum next to its value; `index.css` draws the box, the tinted
// column of the datum and the lines, and makes it run from edge to edge inside a card, a zone or a table cell.
it("keeps each datum next to its value in the same row of its box", () => {
  const { container } = render(<DataList items={[{ label: "Zona", value: "Norte" }, { label: "Rubro", value: "—" }]} />);
  expect(container.querySelector("dl")).toHaveAttribute("data-slot", "data-list");
  const rows = container.querySelectorAll("dl > div");
  expect(rows).toHaveLength(2);
  for (const row of rows) {
    expect(row).toHaveAttribute("data-slot", "data-list-row");
    expect(Array.from(row.children, child => child.tagName)).toEqual(["DT", "DD"]);
  }
});

// A list that is the body of a frame of its own (the row of a spreadsheet, the review of an import, the form of a card in a
// message) says so with `flush`: `index.css` takes its box away and the frame draws the border.
it("marks a flush list so that its frame draws the border", () => {
  const items = [{ label: "Hoja", value: "Hoja1" }];
  const { container, rerender } = render(<DataList items={items} />);
  expect(container.querySelector("dl")).not.toHaveAttribute("data-flush");
  rerender(<DataList flush items={items} />);
  expect(container.querySelector("dl")).toHaveAttribute("data-flush");
});
