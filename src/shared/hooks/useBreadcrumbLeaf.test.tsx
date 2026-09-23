import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useBreadcrumbLeaf, useCurrentBreadcrumbLeaf } from "./useBreadcrumbLeaf";

// La pantalla que escribe la hoja y las migas que la leen son componentes distintos, así que se montan
// por separado: leer en el mismo componente que escribe no probaría que el aviso llega a otro.
describe("useBreadcrumbLeaf", () => {
  it("publishes the leaf that the screen sets", () => {
    const reader = renderHook(() => useCurrentBreadcrumbLeaf());

    renderHook(() => useBreadcrumbLeaf("Soporte"));

    expect(reader.result.current).toBe("Soporte");
  });

  it("follows the screen when the leaf changes", () => {
    const reader = renderHook(() => useCurrentBreadcrumbLeaf());
    const writer = renderHook<void, { label?: string }>(({ label }) => useBreadcrumbLeaf(label), {
      initialProps: { label: "Soporte" },
    });

    writer.rerender({ label: "Soporte técnico" });
    expect(reader.result.current).toBe("Soporte técnico");

    writer.rerender({ label: undefined });
    expect(reader.result.current).toBeUndefined();
  });

  it("clears the leaf when the screen goes away", () => {
    // Si quedara puesta, la próxima pantalla hija mostraría el último nivel de la anterior hasta poner el
    // suyo.
    const reader = renderHook(() => useCurrentBreadcrumbLeaf());
    const writer = renderHook(() => useBreadcrumbLeaf("Soporte"));

    writer.unmount();

    expect(reader.result.current).toBeUndefined();
  });
});
