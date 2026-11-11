import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FilterChip } from "./FilterChip";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

describe("FilterChip", () => {
  it("removes its filter with the cross, named by what it removes", async () => {
    const onRemove = vi.fn();
    renderWithProviders(<FilterChip removeLabel="Quitar Estado: Recibida" onRemove={onRemove}>Estado: Recibida</FilterChip>);

    await userEvent.click(screen.getByRole("button", { name: "Quitar Estado: Recibida" }));

    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("reads the same without the cross where its filter is not removed, as in a dialog", () => {
    renderWithProviders(<FilterChip>Estado: Recibida</FilterChip>);

    expect(screen.getByText("Estado: Recibida")).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
