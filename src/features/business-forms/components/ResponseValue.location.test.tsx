import { act, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import type { ResponseCell } from "../responses";
import { ResponseValue } from "./ResponseValue";

const answered: ResponseCell = { fieldId: "place", type: "location", state: "Answered", value: { latitude: -34.603722, longitude: -58.381592, accuracyMeters: 2400 } };
const render = (cell: ResponseCell, detail: boolean) => act(async () => {
  renderWithProviders(<ResponseValue cell={cell} actor="reader" recordId="record" label="Dónde estás" detail={detail}
    detailLink="/formularios/form/respuestas/record" onForbidden={() => undefined} onError={() => undefined}/>);
});

// UB4-A: in the sheet the point itself is the link to the map, without its accuracy, and its name still says where it goes.
it("shows the point as the link to the map in the sheet", async () => {
  await render(answered, false);

  const link = screen.getByRole("link", { name: "-34.603722, -58.381592 Ver en el mapa" });
  expect(link).toHaveAttribute("href", "https://www.google.com/maps?q=-34.603722,-58.381592");
  expect(link).toHaveAttribute("target", "_blank");
  expect(link).toHaveAttribute("rel", "noopener noreferrer");
  expect(screen.queryByText("± 2.400 m")).not.toBeInTheDocument();
});

it("shows the point, «Ver en el mapa» and the accuracy in grey in the detail", async () => {
  await render(answered, true);

  expect(screen.getByText("-34.603722, -58.381592")).toBeVisible();
  expect(screen.getByRole("link", { name: "Ver en el mapa" })).toHaveAttribute("href", "https://www.google.com/maps?q=-34.603722,-58.381592");
  expect(screen.getByText("± 2.400 m")).toHaveClass("text-[var(--color-content-muted)]");
});

it.each([
  ["Unanswered", "Sin respuesta"],
  ["NotAsked", "—"],
] as const)("an %s location says so like any question", async (state, text) => {
  await render({ ...answered, state, value: null }, false);

  expect(screen.getByText(text)).toBeVisible();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
