import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PermissionGroup } from "../api/roles";
import { PermissionPicker } from "./PermissionPicker";
import i18n from "@/shared/i18n";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

// Las tres áreas del núcleo y la de WhatsApp, con los textos del backend en español: WhatsApp no tiene «Administrar» y
// sus otros dos permisos van en «Otros permisos».
const core: PermissionGroup[] = [
  {
    area: "users",
    name: "Usuarios",
    permissions: [
      { code: "users.read", name: "Ver usuarios", description: "El listado y el detalle de cada cuenta." },
      { code: "users.manage", name: "Administrar usuarios", description: "Dar de alta, editar, desactivar y eliminar cuentas." },
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
      { code: "settings.manage", name: "Administrar la configuración", description: "El modo de registro y los ajustes del sistema." },
    ],
  },
];

const whatsapp: PermissionGroup = {
  area: "whatsapp",
  name: "WhatsApp",
  permissions: [
    { code: "whatsapp.read", name: "Ver chats", description: "Leer conversaciones y tus mensajes sin leer." },
    { code: "whatsapp.send", name: "Responder chats", description: "Enviar respuestas manuales en conversaciones autorizadas." },
    { code: "whatsapp.configureassistant", name: "Configurar el asistente", description: "Pasar una conversación al modo Asistente." },
  ],
};

const catalog = [...core, whatsapp];

/// El selector es controlado: la pantalla guarda lo elegido. Esto hace de pantalla, así un clic se ve reflejado.
function Harness({ groups = catalog, initial = [], readOnly }: { groups?: PermissionGroup[]; initial?: string[]; readOnly?: boolean }) {
  const [picked, setPicked] = useState<readonly string[]>(initial);

  return <PermissionPicker groups={groups} picked={picked} onChange={setPicked} readOnly={readOnly} />;
}

/// La matriz es la del escritorio (RO1-A): desde 768 px. jsdom no tiene `matchMedia` y el de los tests dice que no.
function onDesktop() {
  vi.spyOn(globalThis, "matchMedia").mockImplementation((query) => ({
    matches: query === "(min-width: 768px)",
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }) as MediaQueryList);
}

function areaRow(name: string) {
  return screen.getByRole("rowheader", { name }).closest("tr")!;
}

/// Las celdas de una fila de la matriz por su encabezado, para no depender de en qué lugar está cada columna.
function cellUnder(row: HTMLElement, header: string) {
  const headers = screen.getAllByRole("columnheader").map((cell) => cell.textContent);

  return row.querySelectorAll("th, td")[headers.indexOf(header)] as HTMLElement;
}

describe("PermissionPicker", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("on a desktop, a matrix", () => {
    it("draws one row per area with the columns Área, Ver, Administrar and Otros permisos, without search, filters or folding", () => {
      onDesktop();
      renderWithProviders(<Harness initial={["users.read"]} />);

      const table = screen.getByRole("table", { name: "Permisos" });
      expect(within(table).getAllByRole("columnheader").map((heading) => heading.textContent)).toEqual([
        "Todo el área", "Área", "Ver", "Administrar", "Otros permisos",
      ]);
      // Cada fila la nombra su área; su (i) va en la misma celda sin sumarse al nombre.
      const areas = within(table).getAllByRole("rowheader");
      expect(areas).toHaveLength(4);
      ["Usuarios", "Roles", "Configuración", "WhatsApp"].forEach((name, index) => expect(areas[index]).toHaveAccessibleName(name));

      const users = areaRow("Usuarios");
      expect(within(cellUnder(users, "Ver")).getByRole("checkbox", { name: "Ver usuarios" })).toBeChecked();
      expect(within(cellUnder(users, "Administrar")).getByRole("checkbox", { name: "Administrar usuarios" })).not.toBeChecked();
      expect(cellUnder(users, "Otros permisos")).toBeEmptyDOMElement();

      expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Expandir todo|Contraer todo|Elegidos/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { expanded: false })).not.toBeInTheDocument();
    });

    it("puts the permissions that are not to view or to manage in «Otros permisos», with their names", async () => {
      onDesktop();
      renderWithProviders(<Harness />);

      const chats = areaRow("WhatsApp");
      expect(within(cellUnder(chats, "Ver")).getByRole("checkbox", { name: "Ver chats" })).toBeInTheDocument();
      const others = cellUnder(chats, "Otros permisos");
      expect(within(others).getAllByRole("checkbox").map((checkbox) => checkbox.closest("label")?.textContent)).toEqual([
        "Responder chats", "Configurar el asistente",
      ]);

      await userEvent.click(within(others).getByText("Responder chats"));

      expect(within(others).getByRole("checkbox", { name: "Responder chats" })).toBeChecked();
    });

    it("leaves out «Otros permisos» when no area has another permission, as in the core without modules", () => {
      onDesktop();
      renderWithProviders(<Harness groups={core} />);

      expect(screen.getAllByRole("columnheader").map((heading) => heading.textContent)).toEqual([
        "Todo el área", "Área", "Ver", "Administrar",
      ]);
    });

    it("draws a dash where the area does not have that permission, with nothing to pick", () => {
      onDesktop();
      renderWithProviders(<Harness />);

      const settings = cellUnder(areaRow("Configuración"), "Ver");
      expect(settings).toHaveTextContent("—");
      expect(within(settings).queryByRole("checkbox")).not.toBeInTheDocument();
      expect(within(cellUnder(areaRow("WhatsApp"), "Administrar")).queryByRole("checkbox")).not.toBeInTheDocument();
    });

    it("picks a single permission", async () => {
      onDesktop();
      const onChange = vi.fn();
      renderWithProviders(<PermissionPicker groups={catalog} picked={["users.read"]} onChange={onChange} />);

      await userEvent.click(screen.getByRole("checkbox", { name: "Administrar usuarios" }));

      expect(onChange).toHaveBeenCalledWith(["users.read", "users.manage"]);
    });

    it("describes each checkbox with what its permission allows", () => {
      onDesktop();
      renderWithProviders(<Harness />);

      expect(screen.getByRole("checkbox", { name: "Ver usuarios" })).toHaveAccessibleDescription("El listado y el detalle de cada cuenta.");
      expect(screen.getByRole("checkbox", { name: "Responder chats" })).toHaveAccessibleDescription(
        "Enviar respuestas manuales en conversaciones autorizadas.",
      );
    });

    it("says what each permission of an area allows in the area's (i)", () => {
      onDesktop();
      renderWithProviders(<Harness />);

      const info = within(areaRow("Usuarios")).getByRole("button", { name: "Más información sobre Usuarios" });
      // Un permiso por renglón: el tooltip conserva los saltos.
      expect(info).toHaveAccessibleDescription(
        "Ver usuarios — El listado y el detalle de cada cuenta.\nAdministrar usuarios — Dar de alta, editar, desactivar y eliminar cuentas.",
      );
    });

    it("picks and removes a whole area from its checkbox, mixed while only part of it is picked", async () => {
      onDesktop();
      renderWithProviders(<Harness initial={["users.read", "roles.read"]} />);

      const pickAll = within(areaRow("Usuarios")).getByRole("checkbox", { name: "Elegir todos los permisos de Usuarios" });
      expect(pickAll).toBePartiallyChecked();

      await userEvent.click(pickAll);

      expect(screen.getByRole("checkbox", { name: "Administrar usuarios" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Ver roles" })).toBeChecked();
      const clearAll = within(areaRow("Usuarios")).getByRole("checkbox", { name: "Quitar todos los permisos de Usuarios" });
      expect(clearAll).toBeChecked();

      await userEvent.click(clearAll);

      expect(screen.getByRole("checkbox", { name: "Ver usuarios" })).not.toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Administrar usuarios" })).not.toBeChecked();
    });

    it("has no area checkbox for an area of a single permission, which would repeat that permission's", () => {
      onDesktop();
      renderWithProviders(<Harness />);

      expect(within(areaRow("Configuración")).getAllByRole("checkbox")).toHaveLength(1);
      expect(screen.queryByRole("checkbox", { name: /todos los permisos de Configuración/ })).not.toBeInTheDocument();
    });

    // El check de un área conserva un nombre contextual en ambos idiomas.
    it.each(["es", "en"])("names each area's checkbox after what it does and the area, in %s", async (language) => {
      onDesktop();
      await i18n.changeLanguage(language);

      try {
        renderWithProviders(<Harness initial={["users.read", "users.manage"]} />);

        expect(within(areaRow("Usuarios")).getByRole("checkbox", { name: /Usuarios$/ })).toHaveAttribute("aria-checked", "true");
        expect(within(areaRow("Roles")).getByRole("checkbox", { name: /Roles$/ })).toHaveAttribute("aria-checked", "false");
      } finally {
        await i18n.changeLanguage("es");
      }
    });

    it("reads what the role has with a tick, without checkboxes nor the column of the whole area, when it is read-only", () => {
      onDesktop();
      renderWithProviders(<Harness initial={["users.read", "users.manage", "settings.manage", "whatsapp.send"]} readOnly />);

      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
      expect(screen.getAllByRole("columnheader").map((heading) => heading.textContent)).toEqual([
        "Área", "Ver", "Administrar", "Otros permisos",
      ]);
      expect(cellUnder(areaRow("Usuarios"), "Ver")).toHaveTextContent("Ver usuarios");
      expect(cellUnder(areaRow("Usuarios"), "Administrar")).toHaveTextContent("Administrar usuarios");
      expect(cellUnder(areaRow("Roles"), "Ver")).toBeEmptyDOMElement();
      expect(cellUnder(areaRow("Configuración"), "Ver")).toHaveTextContent("—");
      expect(cellUnder(areaRow("WhatsApp"), "Otros permisos")).toHaveTextContent("Responder chats");
      expect(cellUnder(areaRow("WhatsApp"), "Otros permisos")).not.toHaveTextContent("Configurar el asistente");
    });
  });

  describe("on a phone, one band per area", () => {
    it("lists each area as a group, with its permissions named in full and without the matrix's columns", () => {
      renderWithProviders(<Harness initial={["whatsapp.send"]} />);

      expect(screen.queryByRole("columnheader")).not.toBeInTheDocument();
      const chats = screen.getByRole("rowgroup", { name: "WhatsApp" });
      expect(within(chats).getAllByRole("checkbox").map((checkbox) => checkbox.closest("label")?.textContent || checkbox.getAttribute("aria-label"))).toEqual([
        "Elegir todos los permisos de WhatsApp", "Ver chats", "Responder chats", "Configurar el asistente",
      ]);
      expect(within(chats).getByRole("checkbox", { name: "Responder chats" })).toBeChecked();
      expect(within(chats).getByRole("button", { name: "Más información sobre WhatsApp" })).toBeInTheDocument();
    });

    it("picks a permission by touching its name and a whole area from its band", async () => {
      renderWithProviders(<Harness />);

      await userEvent.click(screen.getByText("Ver usuarios"));
      expect(screen.getByRole("checkbox", { name: "Ver usuarios" })).toBeChecked();

      await userEvent.click(within(screen.getByRole("rowgroup", { name: "Roles" })).getByRole("checkbox", { name: "Elegir todos los permisos de Roles" }));
      expect(screen.getByRole("checkbox", { name: "Ver roles" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Administrar roles" })).toBeChecked();
      expect(within(screen.getByRole("rowgroup", { name: "Configuración" })).getAllByRole("checkbox")).toHaveLength(1);
    });

    it("reads what the role has with a tick when it is read-only", () => {
      renderWithProviders(<Harness initial={["users.read"]} readOnly />);

      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
      const users = screen.getByRole("rowgroup", { name: "Usuarios" });
      expect(within(users).getByText("Ver usuarios")).toBeInTheDocument();
      expect(within(users).queryByText("Administrar usuarios")).not.toBeInTheDocument();
    });
  });
});
