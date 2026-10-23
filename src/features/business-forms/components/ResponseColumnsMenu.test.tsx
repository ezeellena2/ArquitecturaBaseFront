import { useState } from "react";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { ResponseColumnsMenu } from "./ResponseColumnsMenu";
import type { ResponseColumn } from "../responses";
const column: ResponseColumn = { fieldId: "supplier", type: "multiChoice", label: "Proveedores", introducedInVersion: 1, options: [], fields: [{ fieldId: "tax", key: "tax", label: "CUIT", type: "text", role: "data" }, { fieldId: "zone", key: "zone", label: "Zona", type: "catalog", role: "filter" }] };
it("keeps the base question and extra-field selections independent", async () => {
  const changed = vi.fn();
  function Harness() { const [ids, setIds] = useState<readonly string[]>(["supplier", "supplier:tax"]); return <ResponseColumnsMenu columns={[column]} visible={ids.includes("supplier") ? [column] : []} visibleCatalogFields={column.fields!.filter(field => ids.includes("supplier:" + field.fieldId)).map(field => ({ questionId: "supplier", fieldId: field.fieldId }))} onChange={next => { setIds(next); changed(next); }}/>; }
  await act(async () => { renderWithProviders(<Harness/>); });
  await userEvent.click(screen.getByRole("button", { name: "Columnas" }));
  const zone = screen.getByRole("menuitemcheckbox", { name: "Zona · filtro" }); expect(zone).not.toBeChecked();
  await userEvent.click(zone); expect(changed).toHaveBeenLastCalledWith(["supplier", "supplier:tax", "supplier:zone"]); expect(zone).toBeChecked();
  await userEvent.click(screen.getByRole("menuitemcheckbox", { name: "Proveedores" })); expect(changed).toHaveBeenLastCalledWith(["supplier:tax", "supplier:zone"]);
  expect(screen.getByRole("menuitemcheckbox", { name: "CUIT · dato" })).toBeChecked();
  await userEvent.keyboard("{Escape}");
});
