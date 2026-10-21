import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { FormPdfPreview } from "./FormPdfPreview";

afterEach(() => vi.restoreAllMocks());
it("offers the same fixed blob download inside the expanded preview and releases it with its owner", async () => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fixed-copy");
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const load = vi.fn(async () => ({ blob: new Blob(["%PDF"], { type: "application/pdf" }), contentLanguage: "es" as const, fileName: "Recibo.pdf" }));
  const view = renderWithProviders(<FormPdfPreview compact operationId="fixed-pdf" requestedCulture="es" load={load} onForbidden={vi.fn()}/>);
  await screen.findByRole("link", { name: "Descargar" });
  await userEvent.click(screen.getByRole("button", { name: "Ver PDF" }));
  const dialog = within(screen.getByRole("dialog", { name: "Copia fija" }));
  expect(dialog.getByRole("link", { name: "Descargar" })).toHaveAttribute("href", "blob:fixed-copy");
  expect(dialog.getByRole("link", { name: "Descargar" })).toHaveAttribute("download", "Recibo.pdf");
  expect(dialog.getByTitle("Vista previa del PDF")).toHaveAttribute("src", "blob:fixed-copy");
  await userEvent.click(dialog.getAllByRole("button", { name: "Cerrar" }).at(-1)!);
  expect(screen.getByRole("button", { name: "Ver PDF" })).toHaveFocus();
  expect(load).toHaveBeenCalledOnce();
  expect(revoke).not.toHaveBeenCalled();
  view.unmount();
  expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:fixed-copy");
});
