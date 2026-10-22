import { act, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import type { ResponseCell } from "../responses";
import { ResponseValue } from "./ResponseValue";

it.each([false, true])("preserves the captured option label and detail without current catalog data (detail: %s)", async detail => {
  const cell: ResponseCell = { fieldId: "branch", type: "choice", state: "Answered", value: {
    choiceId: "historic-option", valueType: "Decimal", value: "9007199254740993.0123", label: "Sucursal histórica", detail: "Detalle capturado", catalogName: "Catálogo histórico",
  } };
  await act(async () => { renderWithProviders(<ResponseValue cell={cell} actor="reader" recordId="record" number="VIS-000001" label="Sucursal" detail={detail} detailLink="/formularios/form/respuestas/record" onForbidden={() => undefined} onError={() => undefined}/>); });
  expect(screen.getByText("Sucursal histórica", { exact: true })).toBeVisible();
  expect(screen.getByText("Detalle capturado", { exact: true })).toBeVisible();
  if (detail) expect(screen.getByText("Catálogo histórico", { exact: true })).toBeVisible();
  else expect(screen.queryByText("Catálogo histórico", { exact: true })).not.toBeInTheDocument();
  expect(screen.queryByText(/9007199254740993|9\.007\.199/)).not.toBeInTheDocument();
});
