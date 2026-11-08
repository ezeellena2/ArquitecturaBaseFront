import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormSkeleton } from "./FormSkeleton";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

describe("FormSkeleton", () => {
  it("draws one zone per entry with the bars of its fields (ES3)", () => {
    const { container } = renderWithProviders(<FormSkeleton zones={[{ fields: 2 }, { fields: 1 }, { rows: 2 }]} />);

    expect(container.querySelectorAll('[data-slot="surface"]')).toHaveLength(3);
    // Cada campo es una etiqueta y un control; cada fila, una barra; cada zona, además, la barra de su título.
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(3 + 2 * 2 + 2 * 1 + 2);
  });

  it("stacks the fields of a zone in rows, one below the other, when it asks for it (IA1-A)", () => {
    const { container } = renderWithProviders(<FormSkeleton zones={[{ fields: 4, stacked: true }, { fields: 2 }]} />);

    const [rows, columns] = [...container.querySelectorAll('[data-slot="surface"]')].map(zone => zone.querySelector('[data-slot="skeleton"] + div') as HTMLElement);
    expect(rows.children).toHaveLength(4);
    expect(rows).not.toHaveClass("sm:grid-cols-2");
    expect(columns).toHaveClass("sm:grid-cols-2");
  });

  it("announces a single loading status", () => {
    renderWithProviders(<FormSkeleton zones={[{ fields: 2 }]} />);

    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status", { name: "Cargando…" })).toBeInTheDocument();
  });
});
