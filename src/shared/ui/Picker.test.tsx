import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { FormField } from "./FormField";
import { Picker, type PickerOption } from "./Picker";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

const roles: PickerOption[] = [
  { id: "admin", label: "Admin" },
  { id: "agronomist", label: "Agrónomo" },
  { id: "no-chats", label: "Asistente sin chats", description: "Configura el asistente de WhatsApp sin ver los chats." },
  { id: "field", label: "Encargado de campo", description: "Carga los formularios desde el campo." },
  { id: "help", label: "Mesa de ayuda", description: "Da de alta y edita cuentas, sin tocar los roles." },
  { id: "user", label: "User" },
];

// Twelve: more than ten, so the list brings its search.
const places: PickerOption[] = ["DON PEDRO", "EL OMBÚ", "EL TALA", "LA CELINA", "LA ESPERANZA", "LOS ÁLAMOS", "SAN JOSÉ", "SANTA ANA",
  "SANTA ROSA", "TRES ARROYOS", "VILLA ELISA", "ZAPALLAR"].map(label => ({ id: label.toLowerCase(), label }));

function Roles({ initial = [], max, disabled = false }: { initial?: string[]; max?: number; disabled?: boolean }) {
  const [value, setValue] = useState<string[]>(initial);
  return <>
    <FormField label="Roles"><Picker label="Roles" multiple options={roles} value={value} onChange={setValue} placeholder="Sin roles" max={max} disabled={disabled}/></FormField>
    <button type="button">Después</button>
  </>;
}

function Place({ initial = null, options = places, first }: { initial?: string | null; options?: PickerOption[]; first?: PickerOption }) {
  const [value, setValue] = useState<string | null>(initial);
  return <>
    <FormField label="Campo asignado"><Picker label="Campo asignado" options={options} value={value} onChange={setValue} placeholder="Sin campo asignado" first={first}/></FormField>
    <button type="button">Después</button>
  </>;
}

async function openList(name: RegExp) {
  const user = userEvent.setup();
  const trigger = screen.getByRole("button", { name });
  await act(async () => { trigger.focus(); });
  await user.keyboard("{Enter}");
  return { user, list: await screen.findByRole("listbox") };
}

const closed = () => waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());

describe("Picker", () => {
  it("says the chosen option in the closed field, with the label in its name", async () => {
    await act(async () => { renderWithProviders(<Place initial="la esperanza"/>); });

    const trigger = screen.getByRole("button", { name: "Campo asignado LA ESPERANZA" });
    expect(trigger).toHaveAttribute("aria-haspopup", "listbox");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("says what it says while nothing is chosen", async () => {
    await act(async () => { renderWithProviders(<Roles/>); });

    expect(screen.getByRole("button", { name: "Roles Sin roles" })).toHaveTextContent("Sin roles");
  });

  it("says several chosen options in the order of the list, separated by commas", async () => {
    await act(async () => { renderWithProviders(<Roles initial={["user", "field"]}/>); });

    expect(screen.getByRole("button", { name: "Roles Encargado de campo, User" })).toBeInTheDocument();
  });

  it("opens with Enter on the chosen one and gives the focus back when Escape closes it", async () => {
    renderWithProviders(<Place options={places.slice(0, 5)} initial="el tala"/>);
    const { user, list } = await openList(/^Campo asignado/);

    expect(list).toHaveAccessibleName("Campo asignado");
    expect(list).toHaveFocus();
    const chosen = within(list).getByRole("option", { name: "EL TALA" });
    expect(chosen).toHaveAttribute("aria-selected", "true");
    expect(list).toHaveAttribute("aria-activedescendant", chosen.id);

    await user.keyboard("{Escape}");
    await closed();
    await waitFor(() => expect(screen.getByRole("button", { name: "Campo asignado EL TALA" })).toHaveFocus());
  });

  it("chooses one with the arrows and Enter, and closes", async () => {
    renderWithProviders(<Place options={places.slice(0, 5)} initial="el tala"/>);
    const { user, list } = await openList(/^Campo asignado/);

    await user.keyboard("{ArrowDown}");
    expect(list).toHaveAttribute("aria-activedescendant", within(list).getByRole("option", { name: "LA CELINA" }).id);
    await user.keyboard("{Enter}");

    await closed();
    expect(screen.getByRole("button", { name: "Campo asignado LA CELINA" })).toBeInTheDocument();
  });

  it("opens with the down arrow on the closed field", async () => {
    renderWithProviders(<Roles/>);
    const user = userEvent.setup();
    await act(async () => { screen.getByRole("button", { name: /^Roles/ }).focus(); });

    await user.keyboard("{ArrowDown}");

    expect(await screen.findByRole("listbox", { name: "Roles" })).toBeInTheDocument();
  });

  it("keeps a list of several open while Enter and Space mark and unmark", async () => {
    renderWithProviders(<Roles initial={["user"]}/>);
    const { user, list } = await openList(/^Roles/);

    expect(list).toHaveAttribute("aria-multiselectable", "true");
    // It starts on the first chosen one.
    expect(list).toHaveAttribute("aria-activedescendant", within(list).getByRole("option", { name: "User" }).id);
    await user.keyboard("{Enter}");
    expect(within(list).getByRole("option", { name: "User" })).toHaveAttribute("aria-selected", "false");
    await user.keyboard("{Home} ");
    expect(within(list).getByRole("option", { name: "Admin" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await closed();
    expect(screen.getByRole("button", { name: "Roles Admin" })).toBeInTheDocument();
  });

  it("reads the grey line of an option as its description", async () => {
    renderWithProviders(<Roles/>);
    const { list } = await openList(/^Roles/);

    expect(within(list).getByRole("option", { name: "Encargado de campo" })).toHaveAccessibleDescription("Carga los formularios desde el campo.");
  });

  it("closes with Tab and goes on to the next field", async () => {
    renderWithProviders(<Roles/>);
    const { user } = await openList(/^Roles/);

    await user.keyboard("{Tab}");

    await closed();
    await waitFor(() => expect(screen.getByRole("button", { name: "Después" })).toHaveFocus());
  });

  it("goes to the first option that starts with the typed letter when it has no search", async () => {
    renderWithProviders(<Roles/>);
    const { user, list } = await openList(/^Roles/);

    await user.keyboard("m");

    expect(list).toHaveAttribute("aria-activedescendant", within(list).getByRole("option", { name: "Mesa de ayuda" }).id);
  });

  it("brings its search with more than ten options, with the focus on it, and finds without accents", async () => {
    renderWithProviders(<Place/>);
    const { user, list } = await openList(/^Campo asignado/);

    expect(screen.getByRole("combobox", { name: "Buscar en Campo asignado" })).toHaveFocus();
    expect(screen.getByText("12 opciones")).toBeInTheDocument();
    await user.keyboard("alamos");

    expect(within(list).getAllByRole("option").map(option => option.textContent)).toEqual(["LOS ÁLAMOS"]);
    expect(screen.getByText("1 de 12")).toBeInTheDocument();
    await user.keyboard("{Enter}");
    await closed();
    expect(screen.getByRole("button", { name: "Campo asignado LOS ÁLAMOS" })).toBeInTheDocument();
  });

  it("puts first the names that start with the search, and last what only the grey line answers", async () => {
    const zones = [{ id: "boise", label: "Boise", description: "hora de las Montañas Rocosas" }, { id: "la-paz", label: "La Paz", description: "hora de Bolivia" },
      { id: "monterrey", label: "Monterrey", description: "hora central" }, { id: "montevideo", label: "Montevideo", description: "hora de Uruguay" },
      ...places.slice(0, 8)];
    renderWithProviders(<Place options={zones}/>);
    const { user, list } = await openList(/^Campo asignado/);

    await user.keyboard("mont");

    expect(within(list).getAllByRole("option").map(option => option.querySelector('[id$="-label"]')?.textContent)).toEqual(["Monterrey", "Montevideo", "Boise"]);
  });

  it("puts the first option apart and leaves it out while searching", async () => {
    renderWithProviders(<Place first={{ id: "", label: "Sin campo asignado" }} initial=""/>);
    const { user, list } = await openList(/^Campo asignado/);

    const options = within(list).getAllByRole("option");
    expect(options[0]).toHaveAccessibleName("Sin campo asignado");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(options[1]).toHaveAccessibleName("DON PEDRO");
    await user.keyboard("pedro");

    expect(within(list).queryByRole("option", { name: "Sin campo asignado" })).not.toBeInTheDocument();
  });

  it("does not choose an option that is off and says its reason", async () => {
    renderWithProviders(<Place options={[{ id: "a", label: "Alta" }, { id: "b", label: "Baja", disabledReason: "Ya está dada de baja." }]}/>);
    const { user, list } = await openList(/^Campo asignado/);

    const off = within(list).getByRole("option", { name: "Baja" });
    expect(off).toHaveAttribute("aria-disabled", "true");
    expect(off).toHaveAccessibleDescription("Ya está dada de baja.");
    expect(within(off).getByText("· Ya está dada de baja.")).toBeInTheDocument();
    await user.keyboard("{ArrowDown}{Enter}");

    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(off).toHaveAttribute("aria-selected", "false");
  });

  it("leaves the search to its owner and says how the list comes from the server", async () => {
    const onSearchChange = vi.fn(), onRetry = vi.fn();
    const view = renderWithProviders(<FormField label="Persona"><Picker label="Persona" options={[]} value={null} onChange={vi.fn()} search="" onSearchChange={onSearchChange} loading/></FormField>);
    const { user } = await openList(/^Persona/);

    expect(screen.getByRole("status", { name: "Buscando…" })).toBeInTheDocument();
    await user.keyboard("j");
    expect(onSearchChange).toHaveBeenLastCalledWith("j");

    view.rerender(<FormField label="Persona"><Picker label="Persona" options={[]} value={null} onChange={vi.fn()} search="jz" onSearchChange={onSearchChange}/></FormField>);
    expect(await screen.findByText("Ninguna opción coincide con «jz».")).toBeInTheDocument();

    view.rerender(<FormField label="Persona"><Picker label="Persona" options={[]} value={null} onChange={vi.fn()} search="jz" onSearchChange={onSearchChange} failed onRetry={onRetry}/></FormField>);
    expect(await screen.findByText("No se pudieron traer las opciones.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("asks the server for more with its button and with the down arrow at the end", async () => {
    const onLoadMore = vi.fn();
    renderWithProviders(<FormField label="Persona"><Picker label="Persona" options={places.slice(0, 3)} total={120} value={null} onChange={vi.fn()} search="" onSearchChange={vi.fn()} onLoadMore={onLoadMore}/></FormField>);
    const { user } = await openList(/^Persona/);

    expect(screen.getByText("120 opciones")).toBeInTheDocument();
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(onLoadMore).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Mostrar 50 más" }));
    expect(onLoadMore).toHaveBeenCalledTimes(2);
    // The click leaves the focus in the search, so what is typed next still searches.
    expect(screen.getByRole("combobox", { name: "Buscar en Persona" })).toHaveFocus();
  });

  it("says the count in the words of its owner, which name the answer the list depends on", async () => {
    const view = renderWithProviders(<FormField label="Lote"><Picker label="Lote" options={places.slice(0, 2)} total={2} countText="2 opciones de El Ombú" value={null}
      onChange={vi.fn()} search="" onSearchChange={vi.fn()}/></FormField>);
    await openList(/^Lote/);

    expect(screen.getByRole("status")).toHaveTextContent(/^2 opciones de El Ombú$/);

    view.rerender(<FormField label="Lote"><Picker label="Lote" options={[]} total={2} countText="2 opciones de El Ombú" value={null} onChange={vi.fn()} search=""
      onSearchChange={vi.fn()} loading/></FormField>);
    expect(screen.queryByText("2 opciones de El Ombú")).not.toBeInTheDocument();
  });

  it("says it is searching or that it failed under the first option and the chosen one from another page", async () => {
    const onRetry = vi.fn();
    const zone = (state: { loading?: boolean; failed?: boolean }) => <FormField label="Zona">
      <Picker label="Zona" options={[]} value="norte" onChange={vi.fn()} search="" onSearchChange={vi.fn()} first={{ id: "", label: "Sin zona" }}
        selectedOptions={[{ id: "norte", label: "Norte" }]} onRetry={onRetry} {...state}/>
    </FormField>;
    const view = renderWithProviders(zone({ loading: true }));
    const { user, list } = await openList(/^Zona/);

    expect(within(list).getAllByRole("option").map(option => option.textContent)).toEqual(["Sin zona", "Norte"]);
    expect(screen.getByRole("status", { name: "Buscando…" })).toBeInTheDocument();

    view.rerender(zone({ failed: true }));
    expect(await screen.findByText("No se pudieron traer las opciones.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("puts first the chosen ones that came from another page", async () => {
    renderWithProviders(<FormField label="Campos"><Picker label="Campos" multiple options={places.slice(0, 3)} selectedOptions={[{ id: "zapallar", label: "ZAPALLAR" }]} value={["zapallar"]}
      onChange={vi.fn()} search="" onSearchChange={vi.fn()} total={12}/></FormField>);

    expect(screen.getByRole("button", { name: "Campos ZAPALLAR" })).toBeInTheDocument();
    const { list } = await openList(/^Campos/);
    const options = within(list).getAllByRole("option");
    expect(options[0]).toHaveAccessibleName("ZAPALLAR");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(options[1]).toHaveAccessibleName("DON PEDRO");
  });

  it("says up to how many and turns the rest off once they are reached", async () => {
    renderWithProviders(<Roles initial={["admin"]} max={2}/>);
    const { user, list } = await openList(/^Roles/);

    expect(screen.getByText("Hasta 2")).toBeInTheDocument();
    await user.keyboard("{ArrowDown}{Enter}");

    expect(screen.getByText("Elegiste 2 de 2")).toBeInTheDocument();
    expect(within(list).getByRole("option", { name: "User" })).toHaveAttribute("aria-disabled", "true");
    expect(within(list).getByRole("option", { name: "Agrónomo" })).toHaveAttribute("aria-selected", "true");
  });

  it("does not open while it is off", async () => {
    renderWithProviders(<Roles disabled/>);
    const user = userEvent.setup();
    const trigger = screen.getByRole("button", { name: /^Roles/ });

    await user.click(trigger);
    await act(async () => { trigger.focus(); });
    await user.keyboard("{Enter}{ArrowDown}");

    expect(trigger).toBeDisabled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("opens the same list from the button of a listing bar", async () => {
    function RoleFilter() {
      const [value, setValue] = useState<string | null>("");
      return <Picker label="Rol" trigger="button" first={{ id: "", label: "Cualquier rol" }} options={roles} value={value} onChange={setValue}/>;
    }
    renderWithProviders(<RoleFilter/>);

    expect(screen.getByRole("button", { name: "Rol Cualquier rol" })).toHaveTextContent("Cualquier rol");
    const { user, list } = await openList(/^Rol/);
    expect(within(list).getAllByRole("option")[0]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowDown}{Enter}");

    await closed();
    expect(screen.getByRole("button", { name: "Rol Admin" })).toBeInTheDocument();
  });

  it("shows the short text of the chosen one and gives the reader its whole name", async () => {
    await act(async () => {
      renderWithProviders(<Picker label="País" options={[{ id: "AR", label: "Argentina, +54", short: "AR +54" }, { id: "UY", label: "Uruguay, +598", short: "UY +598" }]}
        value="AR" onChange={vi.fn()}/>);
    });

    const trigger = screen.getByRole("button", { name: "País Argentina, +54" });
    expect(within(trigger).getByText("AR +54")).toBeInTheDocument();
  });

  it("names the button of a bar by what it says and puts the label on top of its list", async () => {
    renderWithProviders(<Picker label="Creado" trigger="button" triggerLabel="Más filtros" first={{ id: "", label: "Cualquier fecha" }}
      options={[{ id: "7", label: "Últimos 7 días" }]} value="" onChange={vi.fn()}/>);

    const { list } = await openList(/^Más filtros$/);

    expect(list).toHaveAccessibleName("Creado");
    expect(screen.getByText("Creado")).toBeInTheDocument();
  });

  describe("on the phone", () => {
    let media: MockInstance;
    beforeEach(() => {
      media = vi.spyOn(globalThis, "matchMedia").mockImplementation(query => ({ matches: query === "(width < 640px)", media: query, onchange: null,
        addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }) as MediaQueryList);
    });
    afterEach(() => media.mockRestore());

    it("takes the whole screen and applies several with «Listo»", async () => {
      renderWithProviders(<Roles initial={["user"]}/>);
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: /^Roles/ }));
      const dialog = await screen.findByRole("dialog", { name: "Roles" });
      await user.click(within(dialog).getByRole("option", { name: "Admin" }));
      expect(within(dialog).getByRole("option", { name: "Admin" })).toHaveAttribute("aria-selected", "true");
      await user.click(within(dialog).getByRole("button", { name: "Listo (2)" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(screen.getByRole("button", { name: "Roles Admin, User" })).toBeInTheDocument();
    });

    it("chooses one with a touch and closes", async () => {
      renderWithProviders(<Place/>);
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: /^Campo asignado/ }));
      const dialog = await screen.findByRole("dialog", { name: "Campo asignado" });
      expect(within(dialog).getByRole("combobox", { name: "Buscar en Campo asignado" })).toHaveFocus();
      await user.click(within(dialog).getByRole("option", { name: "EL OMBÚ" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(screen.getByRole("button", { name: "Campo asignado EL OMBÚ" })).toBeInTheDocument();
    });
  });
});
