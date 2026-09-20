import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import i18n from "@/shared/i18n";
import { server } from "./mocks/server";

// onUnhandledRequest: "error" evita que un test pegue a la red real sin darse cuenta.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Cada namespace se carga con un import dinámico (sección de i18n): en la app real hay tiempo de sobra antes
// de que alguien interactúe, pero un test que consulta sin esperar (getBy, no findBy) puede toparse con el
// `<Suspense fallback={null}>` de AppProviders todavía sin resolver. Los precargamos todos acá, una sola vez,
// para que los tests no tengan que saber que existe esa carrera. `import.meta.glob` los descubre solos: un
// namespace nuevo no requiere tocar este archivo.
const localeModules = import.meta.glob("../locales/*/*.json");
const namespaces = [...new Set(Object.keys(localeModules).map((path) => path.split("/").at(-1)?.replace(".json", "") ?? ""))];

beforeAll(() => i18n.loadNamespaces(namespaces));

// jsdom no implementa matchMedia. El Toaster de sonner lo usa para saber si el sistema está en modo oscuro.
if (!globalThis.matchMedia) {
  globalThis.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
