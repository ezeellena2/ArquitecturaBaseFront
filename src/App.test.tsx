import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import App from "./App";

describe("App", () => {
  it("renders the application shell", async () => {
    renderWithProviders(<App />);

    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});
