import { useState } from "react";
import { act, cleanup, screen, waitFor } from "@testing-library/react";
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
      const manual = screen.getByRole("radio", { name: language === "es" ? "Escribirlas a mano" : "Write them manually" });
      const filters = screen.getByRole("radio", { name: language === "es" ? "Tomarlas de la base, con filtros" : "Use database options with filters" });
      expect(manual).toBeChecked();
      act(() => manual.focus());
      await user.keyboard("{ArrowDown>}");
      await waitFor(() => expect(filters).toBeChecked());
      await user.keyboard("{/ArrowDown}");
      expect(filters).toHaveFocus();
      expect(onSelect).not.toHaveBeenCalled();
      expect(screen.queryByRole("radio", { name: language === "es" ? "Escribir una consulta" : "Write a query" })).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: language === "es" ? "Continuar" : "Continue" }));
      expect(onSelect).toHaveBeenCalledExactlyOnceWith("Filters");
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });
    it("continues with the manual source without creating a catalog in " + language, async () => {
      const { user, onSelect } = await mount(language);
      await user.click(screen.getByRole("button", { name: language === "es" ? "Continuar" : "Continue" }));
      expect(onSelect).toHaveBeenCalledExactlyOnceWith("Manual");
    });
  }
  for (const action of ["Cancel", "Escape"] as const) {
    it("does not select a source and restores the trigger on " + action, async () => {
      const { user, trigger, onSelect } = await mount("es");
      await user.click(screen.getByRole("radio", { name: "Tomarlas de la base, con filtros" }));
      if (action === "Escape") await user.keyboard("{Escape}");
      else await user.click(screen.getByRole("button", { name: "Cancelar" }));
      expect(onSelect).not.toHaveBeenCalled();
      await waitFor(() => expect(trigger).toHaveFocus());
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  }
});
