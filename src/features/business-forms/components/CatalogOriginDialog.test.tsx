import { useState } from "react";
import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n";
import { Button } from "@/shared/ui/button";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { CatalogOriginDialog } from "./CatalogOriginDialog";

afterEach(async () => { cleanup(); await act(async () => { await i18n.changeLanguage("es"); }); });

async function mount(language: "es" | "en") {
  await i18n.changeLanguage(language);
  const onSelect = vi.fn();
  function Host() {
    const [open, setOpen] = useState(false);
    return <><Button onClick={() => setOpen(true)}>{language === "es" ? "Nuevo catálogo" : "New catalog"}</Button>
      {open ? <CatalogOriginDialog onOpenChange={setOpen} onSelect={onSelect} /> : null}</>;
  }
  await act(async () => { renderWithProviders(<Host />); });
  const user = userEvent.setup();
  const trigger = screen.getByRole("button", { name: language === "es" ? "Nuevo catálogo" : "New catalog" });
  await user.click(trigger);
  return { user, trigger, onSelect };
}

describe("Chosen catalog origin board K2", () => {
  for (const language of ["es", "en"] as const) {
    it("selects Filters by keyboard only after explicit Continue in " + language, async () => {
      const { user, onSelect } = await mount(language);
      const es = language === "es", question = es ? "¿De dónde salen las opciones?" : "Where do the options come from?";
      // The origin is chosen with the shared piece (DS1-A, 2026-11-22): its button says the question and the chosen one.
      const origin = screen.getByRole("button", { name: question + " " + (es ? "Escribirlas a mano" : "Write them manually") });
      act(() => origin.focus());
      await user.keyboard("{ArrowDown}");
      const list = await screen.findByRole("listbox", { name: question });
      expect(within(list).getAllByRole("option")).toHaveLength(2);
      expect(within(list).getByRole("option", { name: es ? "Escribirlas a mano" : "Write them manually" })).toHaveAttribute("aria-selected", "true");
      expect(within(list).queryByRole("option", { name: es ? "Escribir una consulta" : "Write a query" })).not.toBeInTheDocument();
      await user.keyboard("{ArrowDown}{Enter}");
      await waitFor(() => expect(screen.getByRole("button", { name: question + " " + (es ? "Tomarlas de la base, con filtros" : "Use database options with filters") })).toHaveFocus());
      expect(onSelect).not.toHaveBeenCalled();
      // A catalog with filters has no value type to choose.
      expect(screen.queryByRole("button", { name: es ? /^Tipo de valor / : /^Value type / })).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: es ? "Continuar" : "Continue" }));
      expect(onSelect).toHaveBeenCalledExactlyOnceWith("Filters", "Text");
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });
    it("continues with the manual source without creating a catalog in " + language, async () => {
      const { user, onSelect } = await mount(language);
      await user.click(screen.getByRole("button", { name: language === "es" ? "Continuar" : "Continue" }));
      expect(onSelect).toHaveBeenCalledExactlyOnceWith("Manual", "Text");
    });
  }
  for (const action of ["Cancel", "Escape"] as const) {
    it("does not select a source and restores the trigger on " + action, async () => {
      const { user, trigger, onSelect } = await mount("es");
      await user.click(screen.getByRole("button", { name: "¿De dónde salen las opciones? Escribirlas a mano" }));
      await user.click(within(await screen.findByRole("listbox", { name: "¿De dónde salen las opciones?" })).getByRole("option", { name: "Tomarlas de la base, con filtros" }));
      if (action === "Escape") await user.keyboard("{Escape}");
      else await user.click(screen.getByRole("button", { name: "Cancelar" }));
      expect(onSelect).not.toHaveBeenCalled();
      await waitFor(() => expect(trigger).toHaveFocus());
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  }
});


it.each(["es", "en"] as const)("chooses the immutable manual value type explicitly in %s", async language => {
  const { user, onSelect } = await mount(language);
  const es = language === "es";
  await user.click(screen.getByRole("button", { name: es ? "Tipo de valor Texto" : "Value type Text" }));
  const list = await screen.findByRole("listbox", { name: es ? "Tipo de valor" : "Value type" });
  expect(within(list).getAllByRole("option").map(option => option.textContent)).toEqual(es ? ["Texto", "Entero", "Decimal", "Fecha"] : ["Text", "Whole number", "Decimal", "Date"]);
  await user.click(within(list).getByRole("option", { name: "Decimal" }));
  expect(screen.getByRole("button", { name: es ? "Tipo de valor Decimal" : "Value type Decimal" })).toBeInTheDocument();
  expect(onSelect).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: language === "es" ? "Continuar" : "Continue" }));
  expect(onSelect).toHaveBeenCalledExactlyOnceWith("Manual", "Decimal");
});

// Without legends (2026-10-31): the question is the visible label of the field, and what cannot change goes in the (i).
it.each(["es", "en"] as const)("asks where the options come from as the label of its field and explains in the information icons in %s", async language => {
  const { user } = await mount(language);
  const es = language === "es", question = es ? "¿De dónde salen las opciones?" : "Where do the options come from?";
  const dialog = screen.getByRole("dialog", { name: es ? "Nuevo catálogo" : "New catalog" });
  expect(dialog).not.toHaveAccessibleDescription();
  expect(within(dialog).getByText(question, { selector: "label" })).toBeVisible();
  const fixed = es ? "No se puede cambiar después: para otro origen, se arma otro catálogo." : "This cannot change later: use a new catalog for another source.";
  // Each choice is the shared piece with its visible label (DS1-A, 2026-11-22): the (i) also describes its button.
  const origin = within(dialog).getByRole("button", { name: question + " " + (es ? "Escribirlas a mano" : "Write them manually") });
  expect(origin).toHaveAccessibleDescription(fixed);
  expect(within(dialog).getByRole("button", { name: (es ? "Más información sobre " : "More about ") + question })).toHaveAccessibleDescription(fixed);
  expect(within(dialog).queryByText(es ? /Para listas que mantiene una persona/ : /For lists maintained by a person/)).not.toBeInTheDocument();
  const filters = es ? "Elegís una vista de catálogo (por ahora, Usuarios) y qué filas entran. Se actualiza sola: un usuario nuevo aparece en el próximo envío."
    : "Choose a catalog view (currently Users) and which rows to include. It updates automatically: a new user appears in the next send.";
  expect(within(dialog).queryByText(filters)).not.toBeInTheDocument();
  // How the options with filters work is the grey line under that option, inside the list.
  await user.click(origin);
  const list = await screen.findByRole("listbox", { name: question });
  expect(within(list).getByRole("option", { name: es ? "Escribirlas a mano" : "Write them manually" })).not.toHaveAccessibleDescription();
  expect(within(list).getByRole("option", { name: es ? "Tomarlas de la base, con filtros" : "Use database options with filters" })).toHaveAccessibleDescription(filters);
  await user.keyboard("{Escape}");
  const valueType = es ? "Se elige al crear el catálogo y después no se puede cambiar." : "Choose it when creating the catalog. It cannot be changed later.";
  expect(within(dialog).getByRole("button", { name: (es ? "Más información sobre " : "More about ") + (es ? "Tipo de valor" : "Value type") })).toHaveAccessibleDescription(valueType);
  expect(within(dialog).queryByText(valueType, { selector: "p" })).not.toBeInTheDocument();
});
