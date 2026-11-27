import "@testing-library/jest-dom/vitest";
import { toBeEnabled } from "@testing-library/jest-dom/matchers";
import { cleanup, configure, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { afterAll, afterEach, beforeAll, expect, vi } from "vitest";
import i18n from "@/shared/i18n";
import { server } from "./mocks/server";

// Un botón o una casilla apagados con motivo llevan `aria-disabled` y no `disabled` (MA1-A, `DisabledReason`). jest-dom
// sólo lee `disabled`: `toBeEnabled()` pasaría sobre ellos y un `waitFor` dejaría de esperar antes de que se vaya el
// motivo. Acá `aria-disabled="true"` tampoco cuenta como habilitado; lo demás sigue la regla de jest-dom. Que un control
// está apagado con motivo se comprueba con `toHaveAttribute("aria-disabled", "true")`.
expect.extend({
  toBeEnabled(element: HTMLElement) {
    const result = toBeEnabled.call(this, element);
    if (!result.pass || element.getAttribute("aria-disabled") !== "true") return result;
    return { pass: false, message: () => 'expect(element).toBeEnabled()\n\nReceived element has aria-disabled="true"' };
  },
});

// onUnhandledRequest: "error" evita que un test pegue a la red real sin darse cuenta.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Sonner guarda los avisos en un estado del módulo que sobrevive al Toaster de cada test, y saca de pantalla un aviso que
// se va con un temporizador de Node que desmontar no cancela. Si un archivo termina con un aviso yéndose, ese temporizador
// dispara con jsdom ya cerrado: "window is not defined" en sonner con todos los tests en verde (ChatAudio, 2026-11-27).
// Un aviso que queda abierto, en cambio, reaparece en el Toaster del test siguiente, y el componente que lo retira al
// desmontarse le manda una baja que borra el aviso del mismo id que muestre el test siguiente.
// Este gancho corre antes que el desmontaje automático de Testing Library: espera a que terminen de irse los avisos que
// se estaban yendo, retira los demás con el Toaster montado (así nadie agenda otra baja al desmontar) y desmonta.
const leavingNotice = "[data-sonner-toast][data-removed='true']";
afterEach(async () => {
  if (!vi.isFakeTimers() && document.querySelector(leavingNotice)) {
    await waitFor(() => expect(document.querySelector(leavingNotice)).toBeNull());
  }
  toast.dismiss();
  cleanup();
});

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

// jsdom tampoco implementa scrollIntoView. El Select de Radix lo usa al abrirse, para traer a la vista la opción
// elegida (el país del número de WhatsApp, en la pantalla de ingreso).
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom no maqueta: toda caja, y también el viewport, mide 0×0 en el origen. El middleware `hide` de Floating UI
// (`hideWhenDetached` de Radix, que usa la lista de Autocomplete) lo lee como un ancla recortada fuera de la vista y
// oculta el popover con visibility:hidden y pointer-events:none. El viewport toma el tamaño de la ventana y cada
// elemento, una caja que lo cubre. La geometría real se verifica en Playwright.
Object.defineProperties(document.documentElement, {
  clientWidth: { configurable: true, get: () => window.innerWidth },
  clientHeight: { configurable: true, get: () => window.innerHeight },
});
Element.prototype.getBoundingClientRect = () => new DOMRect(0, 0, window.innerWidth, window.innerHeight);

// Sonner usa captura del puntero al interactuar con una notificación; jsdom no implementa estas APIs.
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.hasPointerCapture = () => false;
}

// Todas las rutas del router son `lazy`: la pantalla no pinta nada hasta que su import dinámico resuelve.
// Con la suite entera corriendo, ese import puede tardar varios segundos, y el primer test de cada archivo de
// pantalla (el único que lo paga; después el módulo ya está cargado) falla sin que haya nada roto. Se espera
// más, no se saca el `lazy`. Medido cada archivo solo, el 2026-11-25, ocho primeros tests pasaban los 3 s de
// espera y 43 tests la mitad de los 5 s por test.
//
// La espera tiene que quedar por debajo del plazo de cada test y de cada gancho: si lo alcanza, el que corta
// es Vitest, con un "Test timed out" que no dice qué se estaba buscando, en vez del "Unable to find role=..."
// de Testing Library, que es el que sirve para arreglarlo. Los plazos van acá y no en vite.config.ts para que
// cambiarlos no reinicie el Vite de la app ni el de las escenas visuales.
configure({ asyncUtilTimeout: 10_000 });
vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });
// assistant-ui uses Element.scrollTo to anchor its viewport; real scroll geometry is verified in Playwright.
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = function (options?: ScrollToOptions | number, top?: number) {
    this.scrollTop = typeof options === "object" ? options.top ?? this.scrollTop : top ?? this.scrollTop;
    this.scrollLeft = typeof options === "object" ? options.left ?? this.scrollLeft : options ?? this.scrollLeft;
  };
}
