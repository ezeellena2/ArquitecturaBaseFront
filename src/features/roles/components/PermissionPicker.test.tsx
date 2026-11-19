import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PermissionGroup } from "../api/roles";
import { PermissionPicker } from "./PermissionPicker";
import i18n from "@/shared/i18n";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

// Las tres áreas del núcleo, la de WhatsApp y la de Formularios, con los textos del backend en español y lo que incluye
// cada permiso: «Administrar» incluye «Ver», «Responder chats» incluye «Ver chats» y en Formularios «Publicar» también
// incluye «Ver formularios».
const catalog: PermissionGroup[] = [
  {
    area: "users",
    name: "Usuarios",
    permissions: [
      { code: "users.read", name: "Ver usuarios", description: "El listado y el detalle de cada cuenta.", includes: [] },
      { code: "users.manage", name: "Administrar usuarios", description: "Dar de alta, editar, desactivar y eliminar cuentas.", includes: ["users.read"] },
    ],
  },
  {
    area: "roles",
    name: "Roles",
    permissions: [
      { code: "roles.read", name: "Ver roles", description: "Los roles y qué permisos da cada uno.", includes: [] },
      { code: "roles.manage", name: "Administrar roles", description: "Crear, editar y eliminar roles.", includes: ["roles.read"] },
    ],
  },
  {
    area: "settings",
    name: "Configuración",
    permissions: [
      { code: "settings.manage", name: "Administrar la configuración", description: "El modo de registro y los ajustes del sistema.", includes: [] },
    ],
  },
  {
    area: "whatsapp",
    name: "WhatsApp",
    permissions: [
      { code: "whatsapp.read", name: "Ver chats", description: "Leer conversaciones y tus mensajes sin leer.", includes: [] },
      { code: "whatsapp.send", name: "Responder chats", description: "Enviar respuestas manuales en conversaciones autorizadas.", includes: ["whatsapp.read"] },
      { code: "whatsapp.configureassistant", name: "Configurar el asistente", description: "Pasar una conversación al modo Asistente.", includes: [] },
    ],
  },
  {
    area: "formtemplates",
    name: "Formularios",
    permissions: [
      { code: "formtemplates.read", name: "Ver formularios", description: "Consultar los formularios y sus borradores.", includes: [] },
      { code: "formtemplates.manage", name: "Administrar formularios", description: "Crear y editar borradores de formularios.", includes: ["formtemplates.read"] },
      { code: "formtemplates.publish", name: "Publicar formularios", description: "Publicar un formulario en WhatsApp.", includes: ["formtemplates.read"] },
    ],
  },
];

const areas = ["Usuarios", "Roles", "Configuración", "WhatsApp", "Formularios"];

/// El selector es controlado: la pantalla guarda lo elegido. Esto hace de pantalla, así un clic se ve reflejado. Lo
/// guardado es el punto de partida, como en el editor.
function Harness({ saved = [], initial = saved, readOnly }: { saved?: string[]; initial?: string[]; readOnly?: boolean }) {
  const [picked, setPicked] = useState<readonly string[]>(initial);

  return <PermissionPicker groups={catalog} picked={picked} saved={saved} onChange={setPicked} readOnly={readOnly} />;
}

/// Cada área es un grupo de filas, nombrado por el área: su banda y, abierta, sus permisos.
function area(name: string) {
  return screen.getByRole("rowgroup", { name });
}

describe("PermissionPicker", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("draws one column, «Permiso», and a band per area with its arrow, its checkbox, its name and its (i)", () => {
    renderWithProviders(<Harness />);

    const table = screen.getByRole("table", { name: "Permisos" });
    expect(within(table).getAllByRole("columnheader").map((heading) => heading.textContent)).toEqual(["Permiso"]);
    areas.forEach((name) => {
      const band = within(area(name));
      expect(band.getByRole("button", { name: `Abrir ${name}` })).toHaveAttribute("aria-expanded", "false");
      // Toda área lleva su casilla, también las de un solo permiso.
      expect(band.getByRole("checkbox", { name: `Elegir todos los permisos de ${name}` })).not.toBeChecked();
      expect(band.getByRole("button", { name: `Más información sobre ${name}` })).toBeInTheDocument();
    });
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("opens the areas with something saved or picked and leaves the others closed", async () => {
    renderWithProviders(<Harness saved={["users.read"]} initial={["users.read", "whatsapp.read"]} />);

    expect(within(area("Usuarios")).getByRole("button", { name: "Cerrar Usuarios" })).toHaveAttribute("aria-expanded", "true");
    expect(within(area("Usuarios")).getAllByRole("checkbox").map((checkbox) => checkbox.getAttribute("aria-label") ?? checkbox.closest("label")?.textContent)).toEqual([
      "Elegir todos los permisos de Usuarios", "Ver usuarios", "Administrar usuarios",
    ]);
    expect(within(area("WhatsApp")).getByRole("checkbox", { name: "Ver chats" })).toBeChecked();
    expect(within(area("Roles")).getByRole("button", { name: "Abrir Roles" })).toHaveAttribute("aria-expanded", "false");
    expect(within(area("Roles")).queryByRole("checkbox", { name: "Ver roles" })).not.toBeInTheDocument();

    // Lo guardado la deja abierta aunque se le quite todo: lo que se quitó sigue a la vista.
    await userEvent.click(screen.getByText("Ver usuarios"));

    expect(screen.getByRole("checkbox", { name: "Ver usuarios" })).not.toBeChecked();
    expect(within(area("Usuarios")).getByRole("button", { name: "Cerrar Usuarios" })).toBeInTheDocument();
  });

  it("opens and closes an area from its arrow or its name, and what the person chose stays", async () => {
    renderWithProviders(<Harness saved={["users.read"]} />);

    await userEvent.click(screen.getByRole("button", { name: "Abrir Roles" }));

    expect(within(area("Roles")).getByRole("button", { name: "Cerrar Roles" })).toHaveAttribute("aria-expanded", "true");
    expect(within(area("Roles")).getByRole("checkbox", { name: "Ver roles" })).not.toBeChecked();

    await userEvent.click(within(area("Roles")).getByText("Roles"));

    expect(within(area("Roles")).getByRole("button", { name: "Abrir Roles" })).toHaveAttribute("aria-expanded", "false");
    expect(within(area("Roles")).queryByRole("checkbox", { name: "Ver roles" })).not.toBeInTheDocument();

    // Cerrada a mano, sigue cerrada aunque se elija toda desde su casilla.
    await userEvent.click(screen.getByRole("button", { name: "Cerrar Usuarios" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Elegir todos los permisos de Usuarios" }));

    expect(screen.getByRole("checkbox", { name: "Quitar todos los permisos de Usuarios" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Abrir Usuarios" })).toHaveAttribute("aria-expanded", "false");
  });

  it("picks and removes a whole area from its checkbox, which reads empty, mixed or full", async () => {
    renderWithProviders(<Harness saved={["users.read"]} />);

    const pickAll = within(area("Usuarios")).getByRole("checkbox", { name: "Elegir todos los permisos de Usuarios" });
    expect(pickAll).toBePartiallyChecked();
    expect(within(area("Roles")).getByRole("checkbox", { name: "Elegir todos los permisos de Roles" })).not.toBeChecked();

    await userEvent.click(pickAll);

    const clearAll = within(area("Usuarios")).getByRole("checkbox", { name: "Quitar todos los permisos de Usuarios" });
    expect(clearAll).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Administrar usuarios" })).toBeChecked();

    // Quita también lo incluido: nada del área lo sigue incluyendo.
    await userEvent.click(clearAll);

    expect(screen.getByRole("checkbox", { name: "Ver usuarios" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Administrar usuarios" })).not.toBeChecked();

    // Un área de un solo permiso se elige igual, sin abrirla; al tener algo, se abre.
    await userEvent.click(within(area("Configuración")).getByRole("checkbox", { name: "Elegir todos los permisos de Configuración" }));

    expect(within(area("Configuración")).getByRole("checkbox", { name: "Quitar todos los permisos de Configuración" })).toBeChecked();
    expect(within(area("Configuración")).getByRole("checkbox", { name: "Administrar la configuración" })).toBeChecked();
  });

  it("adds what a permission includes when it is picked", async () => {
    const onChange = vi.fn();
    renderWithProviders(<PermissionPicker groups={catalog} picked={["roles.read"]} saved={["users.read", "roles.read"]} onChange={onChange} />);

    await userEvent.click(screen.getByRole("checkbox", { name: "Administrar usuarios" }));

    expect(onChange).toHaveBeenCalledWith(["roles.read", "users.manage", "users.read"]);
  });

  it("marks what a permission includes, off and with its reason, and leaves it marked when the permission is removed", async () => {
    renderWithProviders(<Harness />);

    await userEvent.click(screen.getByRole("button", { name: "Abrir Usuarios" }));
    await userEvent.click(screen.getByText("Administrar usuarios"));

    const read = screen.getByRole("checkbox", { name: "Ver usuarios" });
    expect(read).toBeChecked();
    expect(read).toHaveAttribute("aria-disabled", "true");
    expect(read).toHaveAccessibleDescription("El listado y el detalle de cada cuenta. Lo incluye «Administrar usuarios».");

    // Tocarla, también en su nombre, muestra el motivo y no la cambia (MA1-A).
    await userEvent.click(screen.getByText("Ver usuarios"));

    expect(read).toBeChecked();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Lo incluye «Administrar usuarios».");

    // Quitar «Administrar» deja «Ver» marcado, y ya se puede tocar.
    await userEvent.click(screen.getByText("Administrar usuarios"));

    expect(screen.getByRole("checkbox", { name: "Administrar usuarios" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Ver usuarios" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Ver usuarios" })).not.toHaveAttribute("aria-disabled");

    await userEvent.click(screen.getByText("Ver usuarios"));

    expect(screen.getByRole("checkbox", { name: "Ver usuarios" })).not.toBeChecked();
  });

  it.each([
    ["es", "Lo incluyen «Administrar formularios» y «Publicar formularios»."],
    ["en", "Included in “Administrar formularios” and “Publicar formularios”."],
  ])("names every picked permission that includes it, in %s", async (language, reason) => {
    await i18n.changeLanguage(language);

    try {
      renderWithProviders(<Harness saved={["formtemplates.read", "formtemplates.manage", "formtemplates.publish"]} />);

      const read = screen.getByRole("checkbox", { name: "Ver formularios" });
      expect(read).toHaveAttribute("aria-disabled", "true");
      expect(read).toHaveAccessibleDescription(`Consultar los formularios y sus borradores. ${reason}`);
    } finally {
      await i18n.changeLanguage("es");
    }
  });

  it("describes each checkbox with what its permission allows", () => {
    renderWithProviders(<Harness saved={["users.read", "whatsapp.read"]} />);

    expect(screen.getByRole("checkbox", { name: "Ver usuarios" })).toHaveAccessibleDescription("El listado y el detalle de cada cuenta.");
    expect(screen.getByRole("checkbox", { name: "Responder chats" })).toHaveAccessibleDescription(
      "Enviar respuestas manuales en conversaciones autorizadas.",
    );
  });

  it("says what each permission of an area allows in the area's (i)", () => {
    renderWithProviders(<Harness />);

    // Un permiso por renglón: el tooltip conserva los saltos.
    expect(within(area("Usuarios")).getByRole("button", { name: "Más información sobre Usuarios" })).toHaveAccessibleDescription(
      "Ver usuarios — El listado y el detalle de cada cuenta.\nAdministrar usuarios — Dar de alta, editar, desactivar y eliminar cuentas.",
    );
  });

  it("goes through the arrow, the area's checkbox, its (i) and the open permissions with the keyboard", async () => {
    renderWithProviders(<Harness />);

    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Abrir Usuarios" })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("checkbox", { name: "Elegir todos los permisos de Usuarios" })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Más información sobre Usuarios" })).toHaveFocus();
    // El nombre abre y cierra con el mouse, pero no está en el recorrido.
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Abrir Roles" })).toHaveFocus();

    await userEvent.tab({ shift: true });
    await userEvent.tab({ shift: true });
    await userEvent.tab({ shift: true });
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "Cerrar Usuarios" })).toHaveFocus();

    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByRole("checkbox", { name: "Ver usuarios" })).toHaveFocus();
    await userEvent.tab();
    await userEvent.keyboard(" ");
    expect(screen.getByRole("checkbox", { name: "Administrar usuarios" })).toBeChecked();

    // Lo incluido sigue en el recorrido: Espacio muestra el motivo y no lo cambia.
    await userEvent.tab({ shift: true });
    const read = screen.getByRole("checkbox", { name: "Ver usuarios" });
    expect(read).toHaveFocus();
    await userEvent.keyboard(" ");
    expect(read).toBeChecked();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Lo incluye «Administrar usuarios».");
  });

  // La flecha y la casilla de un área conservan un nombre que dice qué hacen, en los dos idiomas.
  it.each([
    ["es", "Cerrar Usuarios", "Abrir Roles"],
    ["en", "Close Usuarios", "Open Roles"],
  ])("names each area's arrow and checkbox after what they do and the area, in %s", async (language, close, open) => {
    await i18n.changeLanguage(language);

    try {
      renderWithProviders(<Harness saved={["users.read", "users.manage"]} />);

      expect(within(area("Usuarios")).getByRole("checkbox", { name: /Usuarios$/ })).toHaveAttribute("aria-checked", "true");
      expect(within(area("Usuarios")).getByRole("button", { expanded: true })).toHaveAccessibleName(close);
      expect(within(area("Roles")).getByRole("checkbox", { name: /Roles$/ })).toHaveAttribute("aria-checked", "false");
      expect(within(area("Roles")).getByRole("button", { expanded: false })).toHaveAccessibleName(open);
    } finally {
      await i18n.changeLanguage("es");
    }
  });

  it("reads a read-only role with ticks and no checkboxes, every area closed until it is opened", async () => {
    renderWithProviders(<Harness saved={["users.read", "users.manage", "settings.manage", "whatsapp.read", "whatsapp.send"]} readOnly />);

    // Admin está todo completo: la banda no lleva tilde ni casilla, y cada área se abre para leer los nombres.
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    areas.forEach((name) => {
      expect(within(area(name)).getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual([
        `Abrir ${name}`, `Más información sobre ${name}`,
      ]);
    });
    expect(screen.queryByText("Responder chats")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Abrir WhatsApp" }));

    // Debajo de la banda, sólo los permisos que tiene, cada uno con su tilde.
    const [, ...permissions] = within(area("WhatsApp")).getAllByRole("row");
    expect(permissions.map((row) => row.textContent)).toEqual(["Ver chats", "Responder chats"]);
    permissions.forEach((row) => expect(row.querySelector("svg")).toBeInTheDocument());
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("draws the same list on a phone and on a desktop, without the matrix", () => {
    const saved = ["users.read", "whatsapp.read", "whatsapp.send"];
    const rows = () => screen.getAllByRole("row").map((row) => row.textContent);
    const phone = renderWithProviders(<Harness saved={saved} />);
    const onPhone = rows();
    phone.unmount();

    // Cualquier consulta de ancho dice que sí: es una pantalla ancha.
    vi.spyOn(globalThis, "matchMedia").mockImplementation((query) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as MediaQueryList);
    renderWithProviders(<Harness saved={saved} />);

    expect(rows()).toEqual(onPhone);
    expect(screen.getAllByRole("columnheader").map((heading) => heading.textContent)).toEqual(["Permiso"]);
  });
});
