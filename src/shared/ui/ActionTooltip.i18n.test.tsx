import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTranslation } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { RowActions } from "./RowActions";
import { Pagination } from "./Pagination";
import { PencilIcon, CheckIcon, TrashIcon } from "./icons";

function TranslatedActions() {
  const { t } = useTranslation("users");
  return <RowActions actions={[
    { label: t("actions.edit"), accessibleName: t("actions.editFor", { user: "ana@example.com" }), icon: PencilIcon, onSelect: vi.fn() },
    { label: t("actions.activate"), accessibleName: t("actions.activateFor", { user: "ana@example.com" }), icon: CheckIcon, onSelect: vi.fn() },
    { label: t("actions.delete"), accessibleName: t("actions.deleteFor", { user: "ana@example.com" }), icon: TrashIcon, onSelect: vi.fn(), destructive: true },
  ]} />;
}

describe("shared action tooltips", () => {
  it.each([
    ["es", ["Editar", "Activar", "Eliminar"]],
    ["en", ["Edit", "Activate", "Delete"]],
  ])("translates every row action in %s and keeps its contextual accessible name", async (language, labels) => {
    await i18n.changeLanguage(language);
    try {
      renderWithProviders(<TranslatedActions />);
      for (const label of labels) {
        await userEvent.tab();
        expect(document.activeElement).toHaveAccessibleName(new RegExp(`${label}.*ana@example.com`));
        expect(await screen.findByRole("tooltip")).toHaveTextContent(label);
        await userEvent.keyboard("{Escape}");
      }
    } finally {
      await i18n.changeLanguage("es");
    }
  });

  it.each([
    ["es", "No hay una página anterior"],
    ["en", "There is no previous page"],
  ])("explains a disabled pagination action in %s without enabling it", async (language, explanation) => {
    await i18n.changeLanguage(language);
    try {
      const onPageChange = vi.fn();
      renderWithProviders(<Pagination page={1} pageSize={10} totalCount={5} totalPages={1} hasPrevious={false} hasNext={false} onPageChange={onPageChange} />);
      await userEvent.tab();
      expect(await screen.findByRole("tooltip")).toHaveTextContent(explanation);
      await userEvent.keyboard("{Enter}");
      expect(onPageChange).not.toHaveBeenCalled();
      expect(screen.getAllByRole("button")).toSatisfy((buttons: HTMLElement[]) => buttons.every((button) => button.hasAttribute("disabled")));
    } finally {
      await i18n.changeLanguage("es");
    }
  });
});
