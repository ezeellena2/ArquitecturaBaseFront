import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Can } from "./Can";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  return { ...actual, useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) };
});

describe("Can", () => {
  it("shows the children when the user has the permission", async () => {
    renderWithProviders(<Can permission="users.read">contenido</Can>);

    expect(await screen.findByText("contenido")).toBeInTheDocument();
  });

  it("hides the children when the user does not have the permission", async () => {
    renderWithProviders(<Can permission="users.manage">contenido</Can>);

    expect(await screen.findByTestId("ready")).toBeInTheDocument();
    expect(screen.queryByText("contenido")).not.toBeInTheDocument();
  });
});
