import { createRef, useRef, useState } from "react";
import type { ReactElement } from "react";
import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n";
import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { CatalogOptionsActions } from "./CatalogOptionsActions";
import type { CatalogOptionsActionsProps } from "./CatalogOptionsActions";

const viewport = vi.hoisted(() => ({ mobile: false }));
vi.mock("@/shared/hooks/useMediaQuery", () => ({ useMediaQuery: () => viewport.mobile }));
afterEach(async () => { cleanup(); viewport.mobile = false; await act(async () => { await i18n.changeLanguage("es"); }); });
async function mount(node: ReactElement) { await act(async () => { renderWithProviders(node); }); }
function props(overrides: Partial<CatalogOptionsActionsProps> = {}): CatalogOptionsActionsProps {
  return { canManage: true, busy: false, saved: true, importDisabledReason: null, hasPendingMoves: false,
    sortPending: false, dialogOpen: false, focusRef: createRef<HTMLButtonElement>(), onImport: vi.fn(),
    onExport: vi.fn(), onSort: vi.fn(), onGenerateCodes: vi.fn(), ...overrides };
}
async function more(user: ReturnType<typeof userEvent.setup>) {
  const trigger = screen.getByRole("button", { name: "Más acciones de opciones" });
  act(() => trigger.focus()); await user.keyboard("{Enter}");
  return { trigger, menu: await screen.findByRole("menu") };
}

it("keeps desktop import and export visible and dispatches the explicit file or paste source", async () => {
  const value = props(); await mount(<CatalogOptionsActions {...value} />); const user = userEvent.setup();
  const paste = await screen.findByRole("button", { name: "Pegar desde Excel" });
  await user.click(paste); expect(value.onImport).toHaveBeenLastCalledWith("paste"); expect(value.focusRef.current).toBe(paste);
  const file = screen.getByRole("button", { name: "Importar" });
  await user.click(file); expect(value.onImport).toHaveBeenLastCalledWith("file"); expect(value.focusRef.current).toBe(file);
  await user.click(screen.getByRole("button", { name: "Exportar" })); expect(value.onExport).toHaveBeenLastCalledWith(false);
  await more(user); await user.click(screen.getByRole("menuitem", { name: "Descargar la plantilla" })); expect(value.onExport).toHaveBeenLastCalledWith(true);
  await more(user); await user.click(screen.getByRole("menuitem", { name: "Ordenar A–Z" })); expect(value.onSort).toHaveBeenCalledOnce();
  await more(user); await user.click(screen.getByRole("menuitem", { name: "Generar los códigos que faltan" })); expect(value.onGenerateCodes).toHaveBeenCalledOnce();
});

it("moves the mobile actions into the same menu and remembers its actual trigger", async () => {
  viewport.mobile = true; const value = props(); await mount(<CatalogOptionsActions {...value} />); const user = userEvent.setup();
  expect(screen.queryByRole("button", { name: "Importar" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Exportar" })).not.toBeInTheDocument();
  const { trigger, menu } = await more(user);
  expect(within(menu).getAllByRole("menuitem")).toHaveLength(6);
  await user.click(within(menu).getByRole("menuitem", { name: "Pegar desde Excel" }));
  expect(value.onImport).toHaveBeenCalledWith("paste"); expect(value.focusRef.current).toBe(trigger);
});

it.each([false, true])("offers only export and template to a read-only user on mobile=%s", async mobile => {
  viewport.mobile = mobile; const value = props({ canManage: false }); await mount(<CatalogOptionsActions {...value} />);
  const user = userEvent.setup(); const { menu } = await more(user);
  expect(within(menu).getAllByRole("menuitem")).toHaveLength(mobile ? 2 : 1);
  expect(screen.queryByRole("menuitem", { name: /Importar|Pegar|Ordenar|Generar/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Importar|Pegar/ })).not.toBeInTheDocument();
  await user.click(within(menu).getByRole("menuitem", { name: "Descargar la plantilla" }));
  expect(value.onExport).toHaveBeenCalledWith(true); expect(value.onImport).not.toHaveBeenCalled();
});

it("keeps a new catalog's reason visible and its unavailable menu actions keyboard reachable", async () => {
  const value = props({ saved: false }); await mount(<CatalogOptionsActions {...value} />); const user = userEvent.setup();
  const file = await screen.findByRole("button", { name: "Importar" });
  expect(file).toBeDisabled(); expect(file).toHaveAccessibleDescription("Guardá el catálogo antes.");
  expect(screen.getByRole("button", { name: "Pegar desde Excel" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Exportar" })).toBeDisabled();
  const { menu } = await more(user); const template = within(menu).getByRole("menuitem", { name: /Descargar la plantilla/ });
  await user.keyboard("{Home}"); expect(template).toHaveFocus(); expect(template).toHaveAttribute("aria-disabled", "true");
  await user.keyboard("{Enter}"); expect(value.onExport).not.toHaveBeenCalled(); expect(menu).toBeVisible();
  const generate = within(menu).getByRole("menuitem", { name: "Generar los códigos que faltan" });
  await user.click(generate); expect(value.onGenerateCodes).toHaveBeenCalledOnce();
});

it("blocks dirty import without disabling the saved catalog's export", async () => {
  const value = props({ importDisabledReason: "Guardá o descartá los cambios antes de importar." });
  await mount(<CatalogOptionsActions {...value} />); const user = userEvent.setup();
  const file = await screen.findByRole("button", { name: "Importar" });
  expect(file).toBeDisabled(); expect(file).toHaveAccessibleDescription(value.importDisabledReason!);
  await user.click(file); expect(value.onImport).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Exportar" })); expect(value.onExport).toHaveBeenCalledWith(false);
});

it.each(["moves", "sortPending"])("explains and prevents unavailable sorting for %s", async state => {
  const value = props({ hasPendingMoves: state === "moves", sortPending: state === "sortPending" });
  await mount(<CatalogOptionsActions {...value} />); const user = userEvent.setup(); const { menu } = await more(user);
  const sort = within(menu).getByRole("menuitem", { name: /Ordenar A–Z/ });
  expect(sort).toHaveAttribute("aria-disabled", "true");
  expect(sort).toHaveTextContent(state === "moves" ? "Primero descartá los cambios de posición." : "Se ordenará A–Z al guardar.");
  act(() => sort.focus()); await user.keyboard("{Enter}"); expect(value.onSort).not.toHaveBeenCalled(); expect(menu).toBeVisible();
});

it("prevents duplicate operations while its owner is busy", async () => {
  const value = props({ busy: true }); await mount(<CatalogOptionsActions {...value} />);
  const buttons = await screen.findAllByRole("button"); expect(buttons).toHaveLength(4);
  for (const button of buttons) expect(button).toBeDisabled();
  expect(value.onImport).not.toHaveBeenCalled(); expect(value.onExport).not.toHaveBeenCalled();
});

it("hands menu focus to the dialog without restoring it to More", async () => {
  viewport.mobile = true;
  function Host() {
    const [open, setOpen] = useState(false); const focusRef = useRef<HTMLButtonElement>(null);
    return <><CatalogOptionsActions {...props()} focusRef={focusRef} dialogOpen={open} onImport={() => setOpen(true)} />
      <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogTitle>Importar opciones</DialogTitle><Input aria-label="Archivo de prueba" /></DialogContent></Dialog></>;
  }
  await mount(<Host />); const user = userEvent.setup(); await more(user);
  await user.click(screen.getByRole("menuitem", { name: "Importar" }));
  await screen.findByRole("dialog", { name: "Importar opciones" });
  await waitFor(() => expect(screen.getByRole("textbox", { name: "Archivo de prueba" })).toHaveFocus());
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
});

it("uses the existing English action labels", async () => {
  await act(async () => { await i18n.changeLanguage("en"); }); await mount(<CatalogOptionsActions {...props()} />);
  expect(await screen.findByRole("button", { name: "Paste from Excel" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Import" })).toBeEnabled(); expect(screen.getByRole("button", { name: "Export" })).toBeEnabled();
  const user = userEvent.setup(), trigger = screen.getByRole("button", { name: "More option actions" });
  act(() => trigger.focus()); await user.keyboard("{Enter}");
  expect(await screen.findByRole("menuitem", { name: "Download the template" })).toBeEnabled();
});
