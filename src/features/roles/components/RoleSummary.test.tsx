import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PermissionGroup } from "../api/roles";
import { RoleSummary } from "./RoleSummary";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

const catalog: PermissionGroup[] = [
  {
    area: "users",
    name: "Usuarios",
    permissions: [
      { code: "users.read", name: "Ver usuarios", description: "El listado y el detalle de cada cuenta." },
      {
        code: "users.manage",
        name: "Administrar usuarios",
        description: "Dar de alta, editar, desactivar y eliminar cuentas.",
      },
    ],
  },
  {
    area: "roles",
    name: "Roles",
    permissions: [
      { code: "roles.read", name: "Ver roles", description: "Los roles y qué permisos da cada uno." },
      { code: "roles.manage", name: "Administrar roles", description: "Crear, editar y eliminar roles." },
    ],
  },
];

function summary() {
  return screen.getByRole("region", { name: "Lo que va a poder hacer" });
}

describe("RoleSummary", () => {
  it("counts one permission in one area in the singular", () => {
    renderWithProviders(<RoleSummary groups={catalog} picked={["users.read"]} />);

    expect(within(summary()).getByText("1 permiso en 1 área")).toBeInTheDocument();
  });

  it("groups the picked permissions by area, in the catalog's order", () => {
    renderWithProviders(<RoleSummary groups={catalog} picked={["roles.read", "users.manage", "users.read"]} />);

    expect(within(summary()).getByText("3 permisos en 2 áreas")).toBeInTheDocument();

    const usersList = within(summary()).getByRole("list", { name: "Usuarios" });
    expect(within(usersList).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Ver usuarios",
      "Administrar usuarios",
    ]);
    expect(within(within(summary()).getByRole("list", { name: "Roles" })).getByText("Ver roles")).toBeInTheDocument();
    expect(within(summary()).getAllByRole("list")).toHaveLength(2);
  });

  it("says there is none, and what a role without permissions means", () => {
    renderWithProviders(<RoleSummary groups={catalog} picked={[]} />);

    expect(within(summary()).getByText("Ninguno")).toBeInTheDocument();
    expect(
      within(summary()).getByText(
        "Todavía no elegiste ningún permiso. Un rol sin permisos se puede guardar, pero no habilita nada.",
      ),
    ).toBeInTheDocument();
    expect(within(summary()).queryByRole("list")).not.toBeInTheDocument();
  });

  it("removes a permission from its chip", async () => {
    const onRemove = vi.fn();
    renderWithProviders(<RoleSummary groups={catalog} picked={["users.read", "roles.read"]} onRemove={onRemove} />);

    await userEvent.click(screen.getByRole("button", { name: "Quitar Ver roles" }));

    expect(onRemove).toHaveBeenCalledWith("roles.read");
  });

  it("has nothing to remove without onRemove", () => {
    renderWithProviders(<RoleSummary groups={catalog} picked={["users.read", "roles.read"]} />);

    expect(within(summary()).getByText("Ver roles")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
