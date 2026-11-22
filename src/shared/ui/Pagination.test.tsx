import { screen, within } from "@testing-library/react";
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

    expect(screen.getByRole("button", { name: /anterior/i })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: /siguiente/i })).toHaveAttribute("aria-disabled", "true");
  });

  it("changes the rows per page in the shared piece, with the current size chosen", async () => {
    const onPageSizeChange = vi.fn();
    renderWithProviders(
      <Pagination page={2} pageSize={20} totalCount={45} totalPages={3} hasPrevious hasNext onPageChange={vi.fn()} onPageSizeChange={onPageSizeChange} />,
    );

    // The text in sight beside the piece, not its name inside the button.
    expect(screen.getByText("Filas por página", { ignore: "button *, script, style" })).toBeVisible();
    const sizes = screen.getByRole("button", { name: "Filas por página 20" });
    await userEvent.click(sizes);
    const list = await screen.findByRole("listbox", { name: "Filas por página" });
    expect(within(list).getAllByRole("option").map((option) => option.textContent)).toEqual(["10", "20", "50", "100"]);
    expect(within(list).getByRole("option", { name: "20" })).toHaveAttribute("aria-selected", "true");

    // The size in use does not send the list back to its first page.
    await userEvent.click(within(list).getByRole("option", { name: "20" }));
    expect(onPageSizeChange).not.toHaveBeenCalled();
    await userEvent.click(sizes);
    await userEvent.click(within(await screen.findByRole("listbox", { name: "Filas por página" })).getByRole("option", { name: "50" }));
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });

  it("offers the current size among the others when it is none of them", async () => {
    renderWithProviders(
      <Pagination page={1} pageSize={25} totalCount={30} totalPages={2} hasPrevious={false} hasNext onPageChange={vi.fn()} onPageSizeChange={vi.fn()} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Filas por página 25" }));
    const list = await screen.findByRole("listbox", { name: "Filas por página" });
    expect(within(list).getAllByRole("option").map((option) => option.textContent)).toEqual(["10", "20", "25", "50", "100"]);
    expect(within(list).getByRole("option", { name: "25" })).toHaveAttribute("aria-selected", "true");
  });

  it("does not offer the rows per page without an owner that changes them", () => {
    renderWithProviders(
      <Pagination page={1} pageSize={20} totalCount={5} totalPages={1} hasPrevious={false} hasNext={false} onPageChange={vi.fn()} />,
    );

    expect(screen.queryByRole("button", { name: /^Filas por página/ })).not.toBeInTheDocument();
  });

  it("omits the page counter for an empty result and preserves its range and controls", () => {
    renderWithProviders(
      <Pagination page={1} pageSize={20} totalCount={0} totalPages={0} hasPrevious={false} hasNext={false} onPageChange={vi.fn()} />,
    );

    expect(screen.getByText("0–0 de 0")).toBeInTheDocument();
    expect(screen.queryByText(/Página \d+ de \d+/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /anterior/i })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: /siguiente/i })).toHaveAttribute("aria-disabled", "true");
  });
});
