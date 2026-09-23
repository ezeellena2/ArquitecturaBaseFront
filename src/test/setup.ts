import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";
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

// jsdom no implementa matchMedia. `useMediaQuery` (shared/hooks) lo usa para separar escritorio de móvil.
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

// jsdom tampoco implementa ResizeObserver. El Checkbox de Radix mide su control con `useSize` cuando está
// adentro de un <form>, para montar el input espejo que hace que el valor viaje con el formulario: sin esto,
// cualquier casilla dentro de un formulario revienta el render (una casilla suelta, no).
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// Todas las rutas del router son `lazy`: la pantalla no pinta nada hasta que su import dinámico resuelve.
// Con la suite entera corriendo en paralelo, ese import puede tardar más que el segundo que espera `findBy*`
// por defecto, y el primer test de cada archivo de pantalla (el único que lo paga; después el módulo ya está
// cargado) falla sin que haya nada roto. Se espera más, no se saca el `lazy`.
//
// Tiene que quedar por debajo del `testTimeout` de Vitest (5 s): si lo alcanza, el que corta es Vitest, con
// un "Test timed out" que no dice qué se estaba buscando, en vez del "Unable to find role=..." de
// Testing Library, que es el que sirve para arreglarlo.
configure({ asyncUtilTimeout: 3000 });
