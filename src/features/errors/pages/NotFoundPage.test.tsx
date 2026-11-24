import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { NotFoundPage } from "./NotFoundPage";

// SP1-B (2026-11-24): the 404 takes the form of the route error, the title in the band and the way back below it.
describe("NotFoundPage", () => {
  it("says the page is not there in its band and offers the way back home", () => {
    render(<MemoryRouter initialEntries={["/no-existe"]}><NotFoundPage /></MemoryRouter>);

    expect(screen.getByRole("heading", { level: 1, name: "No encontramos esta página" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver al inicio" })).toHaveAttribute("href", "/");
  });
});
