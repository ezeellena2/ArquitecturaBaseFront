import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { EntryLocationField } from "./EntryLocationField";

const point = '{"latitude":-34.603722,"longitude":-58.381592,"accuracyMeters":15}';

/** The browser's location service, answered by the test: a point, a failure code or nothing yet. */
function browser() {
  let answer: ((success: PositionCallback, failure: PositionErrorCallback) => void) | null = null;
  const pending: { success: PositionCallback; failure: PositionErrorCallback }[] = [];
  const geolocation = {
    getCurrentPosition: vi.fn((success: PositionCallback, failure: PositionErrorCallback) => {
      if (answer) answer(success, failure); else pending.push({ success, failure });
    }),
  } as unknown as Geolocation;
  return {
    geolocation,
    answerWith(next: (success: PositionCallback, failure: PositionErrorCallback) => void) { answer = next; },
    resolvePending(next: (success: PositionCallback, failure: PositionErrorCallback) => void) { pending.splice(0).forEach(call => next(call.success, call.failure)); },
  };
}

const position = (accuracy: number) => (success: PositionCallback) =>
  success({ coords: { latitude: -34.6037224, longitude: -58.3815916, accuracy } } as GeolocationPosition);

function Harness({ initial = "", geolocation, onChange }: { initial?: string; geolocation?: Geolocation; onChange?: (value: string) => void }) {
  const [value, setValue] = useState(initial);
  return <EntryLocationField id="place" value={value} geolocation={geolocation}
    onChange={next => { setValue(next); onChange?.(next); }}/>;
}

describe("EntryLocationField", () => {
  it("asks only when the button is pressed, shows the wait in the same button and keeps the point", async () => {
    const service = browser();
    const changes: string[] = [];
    renderWithProviders(<Harness geolocation={service.geolocation} onChange={value => changes.push(value)}/>);
    expect(service.geolocation.getCurrentPosition).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Usar mi ubicación" }));
    expect(await screen.findByRole("button", { name: "Buscando tu ubicación…" })).toHaveAttribute("aria-busy", "true");
    await act(async () => { service.resolvePending(position(15.2)); });

    expect(await screen.findByText("-34.603722, -58.381592")).toBeInTheDocument();
    expect(screen.getByText("± 15 m")).toBeInTheDocument();
    expect(changes).toEqual([point]);
    expect(screen.getByRole("link", { name: "Ver en el mapa" })).toHaveAttribute("href", "https://www.google.com/maps?q=-34.603722,-58.381592");
    expect(screen.getByRole("link", { name: "Ver en el mapa" })).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("button", { name: "Volver a pedirla" })).toBeEnabled();
  });

  // UB3-A: «Ver en el mapa» is a link with its icon; only on a phone does it take the shape of a full-width button.
  it("opens the map from a plain link on a computer and from a button on a phone", () => {
    const { unmount } = renderWithProviders(<Harness initial={point} geolocation={browser().geolocation}/>);
    expect(screen.getByRole("link", { name: "Ver en el mapa" })).not.toHaveAttribute("data-slot", "button");
    unmount();

    vi.spyOn(globalThis, "matchMedia").mockImplementation(query => ({ matches: query === "(width < 640px)", media: query, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
    try {
      renderWithProviders(<Harness initial={point} geolocation={browser().geolocation}/>);
      expect(screen.getByRole("link", { name: "Ver en el mapa" })).toHaveAttribute("data-slot", "button");
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("removes the point with its cross and asks again for another", async () => {
    const service = browser();
    service.answerWith(position(30));
    const changes: string[] = [];
    renderWithProviders(<Harness initial={point} geolocation={service.geolocation} onChange={value => changes.push(value)}/>);

    await userEvent.click(screen.getByRole("button", { name: "Volver a pedirla" }));
    await waitFor(() => expect(changes).toEqual(['{"latitude":-34.603722,"longitude":-58.381592,"accuracyMeters":30}']));
    await userEvent.click(screen.getByRole("button", { name: "Quitar la ubicación" }));

    expect(changes.at(-1)).toBe("");
    expect(screen.getByRole("button", { name: "Usar mi ubicación" })).toBeInTheDocument();
  });

  it("shows a low accuracy in amber with its explanation, and lets it be sent", async () => {
    renderWithProviders(<Harness initial='{"latitude":-34.603722,"longitude":-58.381592,"accuracyMeters":2400}' geolocation={browser().geolocation}/>);

    const accuracy = screen.getByText("± 2.400 m");
    expect(accuracy.closest("p")).toHaveClass("text-[var(--color-warning-700)]");
    expect(screen.getByRole("button", { name: "Más información sobre la precisión" })).toBeInTheDocument();
  });

  it.each([
    [1, "No hay permiso para usar tu ubicación. Permitilo en la configuración del sitio, en el navegador, y volvé a tocar «Usar mi ubicación»."],
    [3, "No se pudo obtener tu ubicación. Revisá que la ubicación del dispositivo esté activada y volvé a tocar «Usar mi ubicación»."],
  ])("says why the browser did not give it (code %i)", async (code, message) => {
    const service = browser();
    service.answerWith((_, failure) => failure({ code } as GeolocationPositionError));
    renderWithProviders(<Harness geolocation={service.geolocation}/>);

    await userEvent.click(screen.getByRole("button", { name: "Usar mi ubicación" }));

    expect(await screen.findByText(message)).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("button", { name: "Usar mi ubicación" })).toBeEnabled();
  });

  it("turns the button off with its reason when the browser cannot give it", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis.navigator, "geolocation");
    Object.defineProperty(globalThis.navigator, "geolocation", { value: undefined, configurable: true });
    try {
      renderWithProviders(<Harness/>);
      // MA1-A: the control stays reachable so its reason can be read, and it does nothing.
      expect(screen.getByRole("button", { name: "Usar mi ubicación" })).toHaveAttribute("aria-disabled", "true");
      expect(screen.getByText("Este navegador no da la ubicación. Abrí el formulario en otro navegador o en el celular.")).toBeInTheDocument();
    } finally {
      if (original) Object.defineProperty(globalThis.navigator, "geolocation", original);
      else delete (globalThis.navigator as { geolocation?: Geolocation }).geolocation;
    }
  });
});
