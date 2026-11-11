import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { readFormEntry } from "../api/entries";
import { initialEntryDraft, type EntryDraft } from "../entryForm";
import { FormEntryForm } from "./FormEntryForm";

const fieldId = "0199b0c0-0000-7000-8000-000000000011";
// Synthetic behavior DTO; the bodies the backend exports qualify the contract in entriesLocationHttpContract.
const entry = readFormEntry({ definitionId: "0199b0c0-0000-7000-8000-000000000001", versionId: "0199b0c0-0000-7000-8000-000000000002", versionNumber: 1,
  prefix: "REG", name: "Registro de visita", culture: "es", submitLabel: "Enviar", maxFileSizeMiB: 25,
  questions: [{ fieldId, type: "location", label: "Dónde estás", help: null, required: true, maxLength: null, options: null, selection: null, files: null, catalog: null }] });
const getCurrentPosition = vi.fn((success: PositionCallback) =>
  success({ coords: { latitude: -34.6037224, longitude: -58.3815916, accuracy: 15 } } as GeolocationPosition));

beforeEach(() => Object.defineProperty(globalThis.navigator, "geolocation", { value: { getCurrentPosition }, configurable: true }));
afterEach(() => { delete (globalThis.navigator as { geolocation?: Geolocation }).geolocation; getCurrentPosition.mockClear(); });

function Harness({ errors = {} }: { errors?: Record<string, string> }) {
  const [draft, setDraft] = useState<EntryDraft>(initialEntryDraft(entry));
  return <><FormEntryForm entry={entry} draft={draft} onChange={setDraft} errors={errors} layout="panel"/><output data-testid="value">{draft.values[fieldId] ?? ""}</output></>;
}

it("asks for the point in its question and keeps it in the draft to send", async () => {
  await act(async () => { renderWithProviders(<Harness/>); });
  expect(screen.getByText("Dónde estás")).toBeVisible();

  await userEvent.click(screen.getByRole("button", { name: "Usar mi ubicación" }));

  expect(await screen.findByText("-34.603722, -58.381592")).toBeVisible();
  expect(screen.getByTestId("value")).toHaveTextContent('{"latitude":-34.603722,"longitude":-58.381592,"accuracyMeters":15}');
});

it("says a required location is missing under its question", async () => {
  await act(async () => { renderWithProviders(<Harness errors={{ [fieldId]: "Completá esta respuesta." }}/>); });

  expect(screen.getByRole("alert")).toHaveTextContent("Completá esta respuesta.");
  expect(screen.getByRole("button", { name: "Usar mi ubicación" })).toHaveAttribute("aria-invalid", "true");
});
