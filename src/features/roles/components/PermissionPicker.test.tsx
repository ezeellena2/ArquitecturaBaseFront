import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type FormEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import type { PermissionGroup } from "../api/roles";
import { PermissionPicker } from "./PermissionPicker";
import i18n from "@/shared/i18n";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

// Las tres áreas reales, con los textos del backend en español.
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
  {
    area: "settings",
    name: "Configuración",
    permissions: [
      {
        code: "settings.manage",
        name: "Administrar la configuración",
        description: "El modo de registro y los ajustes del sistema.",
      },
    ],
  },
];

/// El selector es controlado: la pantalla guarda lo elegido. Esto hace de pantalla, así un clic se ve reflejado.
function Harness({ initial = [], readOnly }: { initial?: string[]; readOnly?: boolean }) {
  const [picked, setPicked] = useState<readonly string[]>(initial);

  return <PermissionPicker groups={catalog} picked={picked} onChange={setPicked} readOnly={readOnly} />;
}

function area(name: string) {
  return screen.getByRole("group", { name });
}

function searchBox() {
  return screen.getByRole("searchbox", { name: "Buscar un permiso" });
}

describe("PermissionPicker", () => {
  it("names every area as a group, even while it is closed", () => {
    renderWithProviders(<Harness initial={["users.read"]} />);

    // El `legend` en `sr-only` es de donde el `fieldset` saca el nombre: si alguien lo "limpia", las casillas
    // de un área se quedan sin decir de qué área son.
    expect(within(area("Roles")).getByRole("button", { expanded: false })).toBeInTheDocument();
    expect(area("Usuarios")).toBeInTheDocument();
    expect(area("Configuración")).toBeInTheDocument();
  });

  it("starts with the areas that have something picked open", () => {
    renderWithProviders(<Harness initial={["users.read", "settings.manage"]} />);

    expect(within(area("Usuarios")).getByRole("button", { expanded: true })).toBeInTheDocument();
    expect(within(area("Roles")).getByRole("button", { expanded: false })).toBeInTheDocument();
    expect(within(area("Configuración")).getByRole("button", { expanded: true })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Ver roles" })).not.toBeInTheDocument();
  });

  it("opens the first area of a role with nothing picked", () => {
    renderWithProviders(<Harness />);

    expect(within(area("Usuarios")).getByRole("button", { expanded: true })).toBeInTheDocument();
    expect(within(area("Roles")).getByRole("button", { expanded: false })).toBeInTheDocument();
  });

  it("opens and closes an area", async () => {
    renderWithProviders(<Harness initial={["users.read"]} />);

    await userEvent.click(within(area("Roles")).getByRole("button", { expanded: false }));

    expect(within(area("Roles")).getByRole("button", { expanded: true })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Ver roles" })).toBeInTheDocument();

    await userEvent.click(within(area("Roles")).getByRole("button", { expanded: true }));

    expect(screen.queryByRole("checkbox", { name: "Ver roles" })).not.toBeInTheDocument();
  });

  it("expands and collapses every area", async () => {
    renderWithProviders(<Harness initial={["users.read"]} />);

    await userEvent.click(screen.getByRole("button", { name: "Expandir todo" }));

    expect(screen.getAllByRole("checkbox")).toHaveLength(5);

    await userEvent.click(screen.getByRole("button", { name: "Contraer todo" }));

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(within(area("Usuarios")).getByRole("button", { expanded: false })).toBeInTheDocument();
  });

  it("keeps what was collapsed while searching for when the search is cleared", async () => {
    renderWithProviders(<Harness initial={["users.read"]} />);

    await userEvent.type(searchBox(), "ver");
    await userEvent.click(screen.getByRole("button", { name: "Contraer todo" }));

    // Mientras se busca, lo que queda se sigue viendo abierto.
    expect(within(area("Usuarios")).getByRole("button", { expanded: true })).toBeInTheDocument();
    expect(within(area("Roles")).getByRole("button", { expanded: true })).toBeInTheDocument();

    await userEvent.clear(searchBox());

    expect(within(area("Usuarios")).getByRole("button", { expanded: false })).toBeInTheDocument();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("describes each checkbox with the permission's description", () => {
    renderWithProviders(<Harness initial={["users.read"]} />);

    expect(screen.getByRole("checkbox", { name: "Ver usuarios" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Ver usuarios" })).toHaveAccessibleDescription(
      "El listado y el detalle de cada cuenta.",
    );
    expect(screen.getByRole("checkbox", { name: "Administrar usuarios" })).not.toBeChecked();
  });

  it("picks a single permission", async () => {
    const onChange = vi.fn();
    renderWithProviders(<PermissionPicker groups={catalog} picked={["users.read"]} onChange={onChange} />);

    await userEvent.click(screen.getByRole("checkbox", { name: "Administrar usuarios" }));

    expect(onChange).toHaveBeenCalledWith(["users.read", "users.manage"]);
  });

  it("picks and removes a whole area, and counts over all of its permissions", async () => {
    renderWithProviders(<Harness initial={["users.read"]} />);

    expect(within(area("Usuarios")).getByText("1 de 2")).toBeInTheDocument();

    // El texto visible es corto; el nombre accesible dice de qué área, o serían tres botones iguales.
    const pickAll = screen.getByRole("button", { name: "Elegir todos los permisos de Usuarios" });
    expect(pickAll).toHaveTextContent("Elegir todos");

    await userEvent.click(pickAll);

    expect(within(area("Usuarios")).getByText("2 de 2")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Administrar usuarios" })).toBeChecked();

    const clearAll = screen.getByRole("button", { name: "Quitar todos los permisos de Usuarios" });
    expect(clearAll).toHaveTextContent("Quitar todos");

    await userEvent.click(clearAll);

    expect(within(area("Usuarios")).getByText("0 de 2")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Ver usuarios" })).not.toBeChecked();
  });

  // WCAG 2.5.3 (el nombre contiene lo que se ve): quien maneja la pantalla con la voz dice "clic en Elegir
  // todos", y eso tiene que encontrar al botón. En los dos idiomas, que cada traducción puede romperlo sola.
  it.each(["es", "en"])("names each area's button starting with the text it shows, in %s", async (language) => {
    await i18n.changeLanguage(language);

    try {
      // Usuarios, con todo elegido, muestra "Quitar todos"; Roles, sin nada, "Elegir todos".
      renderWithProviders(<Harness initial={["users.read", "users.manage"]} />);

      for (const name of ["Usuarios", "Roles"]) {
        const action = within(await screen.findByRole("group", { name }))
          .getAllByRole("button")
          .find((button) => !button.hasAttribute("aria-expanded"));
        const shown = action?.textContent ?? "";

        expect(shown).not.toBe("");
        expect(action?.getAttribute("aria-label")?.slice(0, shown.length)).toBe(shown);
      }
    } finally {
      await i18n.changeLanguage("es");
    }
  });

  it("picks the whole area even when the search hides part of it", async () => {
    const onChange = vi.fn();
    renderWithProviders(<PermissionPicker groups={catalog} picked={[]} onChange={onChange} />);

    await userEvent.type(searchBox(), "ver usuarios");

    expect(screen.queryByRole("checkbox", { name: "Administrar usuarios" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Elegir todos los permisos de Usuarios" }));

    expect(onChange).toHaveBeenCalledWith(["users.read", "users.manage"]);
  });

  it("filters by search without minding case or accents", async () => {
    renderWithProviders(<Harness />);

    await userEvent.type(searchBox(), "CONFIGURACION");

    expect(area("Configuración")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Usuarios" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Roles" })).not.toBeInTheDocument();
    // Lo que queda a la vista se muestra abierto: buscar y tener que abrir cada resultado es buscar dos veces.
    expect(screen.getByRole("checkbox", { name: "Administrar la configuración" })).toBeInTheDocument();
  });

  it("finds a permission by its description", async () => {
    renderWithProviders(<Harness />);

    await userEvent.type(searchBox(), "desactivar");

    expect(screen.getByRole("checkbox", { name: "Administrar usuarios" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Ver usuarios" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Roles" })).not.toBeInTheDocument();
  });

  it("does not filter on a search of only spaces", async () => {
    renderWithProviders(<Harness />);

    await userEvent.type(searchBox(), "   ");

    expect(area("Usuarios")).toBeInTheDocument();
    expect(area("Roles")).toBeInTheDocument();
    expect(area("Configuración")).toBeInTheDocument();
    // No cuenta como una búsqueda: las áreas siguen como estaban, no se abren todas.
    expect(within(area("Roles")).getByRole("button", { expanded: false })).toBeInTheDocument();
    expect(screen.queryByText("Ningún permiso coincide")).not.toBeInTheDocument();
  });

  it("shows only the picked permissions, with their count", async () => {
    renderWithProviders(<Harness initial={["users.read", "roles.manage"]} />);

    const show = screen.getByRole("group", { name: "Mostrar" });
    expect(within(show).getByRole("button", { name: "Todos" })).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(within(show).getByRole("button", { name: "Elegidos · 2" }));

    expect(within(show).getByRole("button", { name: "Elegidos · 2" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect(screen.getByRole("checkbox", { name: "Ver usuarios" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Administrar roles" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Configuración" })).not.toBeInTheDocument();
  });

  it("explains that nothing is picked yet when only the picked are shown", async () => {
    renderWithProviders(<Harness />);

    await userEvent.click(screen.getByRole("button", { name: "Elegidos · 0" }));

    expect(screen.getByRole("heading", { name: "Ningún permiso coincide" })).toBeInTheDocument();
    expect(screen.getByText("Este rol todavía no tiene permisos elegidos.")).toBeInTheDocument();
  });

  it("repeats the trimmed search when nothing matches it", async () => {
    renderWithProviders(<Harness />);

    await userEvent.type(searchBox(), "  factura  ");

    expect(screen.getByRole("heading", { name: "Ningún permiso coincide" })).toBeInTheDocument();
    expect(screen.getByText("No hay permisos ni áreas que digan “factura”.")).toBeInTheDocument();
  });

  it("says that the search found nothing among the picked ones", async () => {
    renderWithProviders(<Harness initial={["users.read"]} />);

    await userEvent.click(screen.getByRole("button", { name: "Elegidos · 1" }));
    await userEvent.type(searchBox(), "roles");

    expect(screen.getByText("No hay permisos ni áreas que digan “roles” entre los elegidos.")).toBeInTheDocument();
  });

  it("clears the search and the filter from the empty state", async () => {
    renderWithProviders(<Harness initial={["users.read"]} />);

    await userEvent.click(screen.getByRole("button", { name: "Elegidos · 1" }));
    await userEvent.type(searchBox(), "roles");
    await userEvent.click(screen.getByRole("button", { name: "Ver todos los permisos" }));

    expect(searchBox()).toHaveValue("");
    expect(screen.getByRole("button", { name: "Todos" })).toHaveAttribute("aria-pressed", "true");
    expect(area("Usuarios")).toBeInTheDocument();
    expect(area("Roles")).toBeInTheDocument();
    expect(area("Configuración")).toBeInTheDocument();
    expect(screen.queryByText("Ningún permiso coincide")).not.toBeInTheDocument();
  });

  // Los controles que se sacan a sí mismos de la vista no dejan el foco en `<body>`: con el teclado se perdería
  // el lugar justo mientras se revisa y se limpia lo elegido.
  describe("keeps the focus when what had it goes away", () => {
    async function showOnlyPicked(total: number) {
      await userEvent.click(screen.getByRole("button", { name: `Elegidos · ${total}` }));
    }

    async function pressOn(element: HTMLElement, key: string) {
      act(() => element.focus());
      await userEvent.keyboard(key);
    }

    it("moves to the next permission after unpicking one with only the picked shown", async () => {
      renderWithProviders(<Harness initial={["users.read", "users.manage", "roles.read"]} />);
      await showOnlyPicked(3);

      await pressOn(screen.getByRole("checkbox", { name: "Administrar usuarios" }), " ");

      expect(screen.queryByRole("checkbox", { name: "Administrar usuarios" })).not.toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: "Ver roles" })).toHaveFocus();
    });

    it("moves back to the previous permission after unpicking the last one shown", async () => {
      renderWithProviders(<Harness initial={["users.read", "users.manage", "roles.read"]} />);
      await showOnlyPicked(3);

      await pressOn(screen.getByRole("checkbox", { name: "Ver roles" }), " ");

      expect(screen.queryByRole("group", { name: "Roles" })).not.toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: "Administrar usuarios" })).toHaveFocus();
    });

    it("moves to the next area's button after removing a whole area with only the picked shown", async () => {
      renderWithProviders(<Harness initial={["users.read", "users.manage", "roles.read"]} />);
      await showOnlyPicked(3);

      await pressOn(screen.getByRole("button", { name: "Quitar todos los permisos de Usuarios" }), "{Enter}");

      expect(screen.queryByRole("group", { name: "Usuarios" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Elegir todos los permisos de Roles" })).toHaveFocus();
    });

    it("moves to the way out of the empty list after unpicking the only one shown", async () => {
      renderWithProviders(<Harness initial={["users.read"]} />);
      await showOnlyPicked(1);

      await pressOn(screen.getByRole("checkbox", { name: "Ver usuarios" }), " ");

      expect(screen.getByRole("button", { name: "Ver todos los permisos" })).toHaveFocus();
    });

    it("moves to the search after showing every permission from the empty state", async () => {
      renderWithProviders(<Harness initial={["users.read"]} />);
      await userEvent.type(searchBox(), "zzz");

      await pressOn(screen.getByRole("button", { name: "Ver todos los permisos" }), "{Enter}");

      expect(screen.queryByRole("button", { name: "Ver todos los permisos" })).not.toBeInTheDocument();
      expect(searchBox()).toHaveFocus();
    });
  });

  it("does not submit the form it lives in when Enter is pressed in the search", async () => {
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());
    renderWithProviders(
      <form onSubmit={onSubmit}>
        <PermissionPicker groups={catalog} picked={[]} onChange={vi.fn()} />
        <button type="submit">Guardar</button>
      </form>,
    );

    // Es el campo donde un Enter es natural, y adentro del formulario del rol dispararía el Guardar.
    await userEvent.type(searchBox(), "roles{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
    expect(searchBox()).toHaveValue("roles");
  });

  it("only shows what the role allows when it is read-only", async () => {
    renderWithProviders(<Harness initial={["users.read", "users.manage"]} readOnly />);

    expect(screen.getByRole("checkbox", { name: "Ver usuarios" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Administrar usuarios" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /^(Elegir|Quitar) todos los permisos/ })).not.toBeInTheDocument();

    // Mirar sí se puede: abrir áreas y buscar no cambian el rol.
    await userEvent.click(within(area("Roles")).getByRole("button", { expanded: false }));

    expect(screen.getByRole("checkbox", { name: "Ver roles" })).toBeDisabled();
  });
});
