import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Can } from "./Can";
import { usePermissions } from "./usePermissions";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  return { ...actual, useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) };
});

/// Expone si /api/me ya resolvió: sin esto, la ausencia de "contenido" en el test de abajo sería trivial
/// (mientras la consulta está pendiente, Can tampoco lo muestra) y no probaría nada sobre el chequeo de
/// permiso en sí.
function PermissionProbe() {
  const { isPending } = usePermissions();

  return <p>{isPending ? "revisando permiso" : "permiso revisado"}</p>;
}

describe("Can", () => {
  it("shows the children when the user has the permission", async () => {
    renderWithProviders(<Can permission="users.read">contenido</Can>);

    expect(await screen.findByText("contenido")).toBeInTheDocument();
  });

  it("hides the children when the user does not have the permission", async () => {
    renderWithProviders(
      <>
        <PermissionProbe />
        <Can permission="users.manage">contenido</Can>
      </>,
    );

    await screen.findByText("permiso revisado");
    expect(screen.queryByText("contenido")).not.toBeInTheDocument();
  });
});
