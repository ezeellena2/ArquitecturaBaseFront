import { act, render, screen } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Toaster } from "./sonner";

// Simula un sistema operativo en modo oscuro: solo responde que sí a la consulta del esquema de color.
function mockDarkColorScheme() {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: query.includes("prefers-color-scheme: dark"),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
}

// sonner.tsx lo genera la CLI de shadcn atado al tema del sistema (`useTheme` de next-themes, que sin un
// ThemeProvider cae en "system"), pero la app tiene un solo tema, el claro. Con el sistema en oscuro el aviso
// salía con el fondo blanco de la app y la descripción en el gris claro que sonner reserva para su tema oscuro:
// casi invisible. Está fijado en claro a mano: si alguien regenera el archivo, esto se pone en rojo.
describe("Toaster", () => {
  afterEach(() => {
    toast.dismiss();
    vi.unstubAllGlobals();
  });

  it("stays light when the system prefers a dark color scheme", async () => {
    mockDarkColorScheme();
    render(<Toaster />);

    act(() => {
      toast("Cambios guardados", { description: "El rol quedó actualizado." });
    });

    expect(await screen.findByText("El rol quedó actualizado.")).toBeInTheDocument();
    expect(screen.getByRole("list")).toHaveAttribute("data-sonner-theme", "light");
  });
});
