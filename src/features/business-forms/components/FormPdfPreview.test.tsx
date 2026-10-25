import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/api/ApiError";
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

// The wait of a 429 is not written under Retry: it is the reason of the disabled button (tooltip and accessible description).
it("explains the retry wait only as the reason of the disabled retry", async () => {
  const load = vi.fn(async () => { throw new ApiError(429, { code: "RateLimit.Exceeded", detail: "Demasiados pedidos.", retryAfter: 30 }); });
  renderWithProviders(<FormPdfPreview operationId="retry-pdf" requestedCulture="es" load={load} onForbidden={vi.fn()}/>);
  const retry = await screen.findByRole("button", { name: "Reintentar" });
  expect(retry).toBeDisabled();
  expect(retry).toHaveAccessibleDescription(/^Esperá [0-9]+ segundos para volver a intentar\.$/);
  expect(screen.getAllByText(/Esperá [0-9]+ segundos para volver a intentar\./)).toHaveLength(1);
  await userEvent.hover(retry);
  expect(await screen.findByRole("tooltip")).toHaveTextContent(/Esperá [0-9]+ segundos para volver a intentar\./);
  expect(load).toHaveBeenCalledOnce();
});
