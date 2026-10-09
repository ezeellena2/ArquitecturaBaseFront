import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Pagination } from "./Pagination";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

describe("Pagination", () => {
  it("shows the range and moves between pages", async () => {
    const onPageChange = vi.fn();
    renderWithProviders(
      <Pagination page={2} pageSize={10} totalCount={25} totalPages={3} hasPrevious hasNext onPageChange={onPageChange} />,
    );

    expect(screen.getByText("11–20 de 25")).toBeInTheDocument();
    expect(screen.getByText("Página 2 de 3")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /siguiente/i }));
    expect(onPageChange).toHaveBeenCalledWith(3);

    await userEvent.click(screen.getByRole("button", { name: /anterior/i }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("disables the edges", () => {
    renderWithProviders(
      <Pagination
        page={1}
        pageSize={10}
        totalCount={5}
        totalPages={1}
        hasPrevious={false}
        hasNext={false}
        onPageChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /anterior/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /siguiente/i })).toBeDisabled();
  });

  it("omits the page counter for an empty result and preserves its range and controls", () => {
    renderWithProviders(
      <Pagination page={1} pageSize={20} totalCount={0} totalPages={0} hasPrevious={false} hasNext={false} onPageChange={vi.fn()} />,
    );

    expect(screen.getByText("0–0 de 0")).toBeInTheDocument();
    expect(screen.queryByText(/Página \d+ de \d+/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /anterior/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /siguiente/i })).toBeDisabled();
  });
});
