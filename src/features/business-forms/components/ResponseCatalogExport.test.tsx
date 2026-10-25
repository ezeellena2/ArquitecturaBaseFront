import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { api } from "@/shared/api/httpClient";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { ResponseExportDialog } from "./ResponseExportDialog";
vi.mock("@/shared/hooks/usePrivateFormFile", () => ({ savePrivateBlob: vi.fn() }));
afterEach(() => vi.restoreAllMocks());
it("exports an independently visible extra field with its base question hidden", async () => { const download = vi.spyOn(api, "download").mockResolvedValue({ blob: new Blob(["xlsx"]), fileName: "response.xlsx" });
 await act(async () => { renderWithProviders(<ResponseExportDialog formId="form" prefix="VIS" filter={{ page: 1, pageSize: 20 }} total={1} ready cooldown={{ seconds: 0, isRunning: false, restart: vi.fn() }} columns={[{ fieldId: "supplier", type: "choice", label: "Proveedor", introducedInVersion: 1, options: [], fields: [{ fieldId: "tax", key: "tax", label: "CUIT", type: "text", role: "data" }] }]} visible={[]} visibleCatalogFields={[{ questionId: "supplier", fieldId: "tax" }]} filterLabels={[]} onClose={vi.fn()} onForbidden={vi.fn()}/>); });
 await userEvent.click(screen.getByRole("radio", { name: /Solo las visibles/ })); await userEvent.click(screen.getByRole("button", { name: "Exportar a Excel" })); await waitFor(() => expect(download).toHaveBeenCalled()); expect(download.mock.calls[0]![1]).toMatchObject({ columns: [], catalogFields: [{ questionId: "supplier", fieldId: "tax" }] }); expect(screen.getByRole("radio", { name: /Solo las visibles \(1 columna\)/ })).toBeInTheDocument(); });
// The export limit is not written in the dialog: it is the reason (tooltip and description) of the disabled download.
it("explains the export limit only as the reason of the disabled download", async () => {
  const limit = "Podés exportar hasta 10.000 respuestas. Acotá los filtros para continuar.";
  await act(async () => { renderWithProviders(<ResponseExportDialog formId="form" prefix="VIS" filter={{ page: 1, pageSize: 20 }} total={10001} ready cooldown={{ seconds: 0, isRunning: false, restart: vi.fn() }} columns={[]} visible={[]} filterLabels={[]} onClose={vi.fn()} onForbidden={vi.fn()}/>); });
  const download = screen.getByRole("button", { name: "Exportar a Excel" });
  expect(download).toBeDisabled();
  expect(download).toHaveAccessibleDescription(limit);
  for (const text of screen.getAllByText(limit)) expect(text).not.toBeVisible();
  await userEvent.hover(download);
  expect(await screen.findByRole("tooltip")).toHaveTextContent(limit);
});
it("explains the export wait only as the reason of the disabled download", async () => {
  const wait = "Esperá 30 segundos para volver a intentar.";
  await act(async () => { renderWithProviders(<ResponseExportDialog formId="form" prefix="VIS" filter={{ page: 1, pageSize: 20 }} total={2} ready cooldown={{ seconds: 30, isRunning: true, restart: vi.fn() }} columns={[]} visible={[]} filterLabels={[]} onClose={vi.fn()} onForbidden={vi.fn()}/>); });
  const download = screen.getByRole("button", { name: "Exportar a Excel" });
  expect(download).toBeDisabled();
  expect(download).toHaveAccessibleDescription(wait);
  for (const text of screen.getAllByText(wait)) expect(text).not.toBeVisible();
});
