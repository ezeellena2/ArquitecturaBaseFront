import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KeepHeight } from "./KeepHeight";

// jsdom no maqueta ni mide: este observador avisa cuando el test lo pide, y el alto que lee el bloque lo pone el test.
let notify = () => {};
class ResizeObserverDouble {
  constructor(callback: ResizeObserverCallback) {
    notify = () => callback([], this as unknown as ResizeObserver);
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

function measures(block: Element, height: number) {
  Object.defineProperty(block, "offsetHeight", { configurable: true, get: () => height });
  act(() => notify());
}

describe("KeepHeight", () => {
  beforeEach(() => vi.stubGlobal("ResizeObserver", ResizeObserverDouble));
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the last height of its content while it waits for the new one", () => {
    const { container, rerender } = render(<KeepHeight keep={false}><p>Opciones</p></KeepHeight>);
    const block = container.firstElementChild as HTMLElement;
    measures(block, 640);

    rerender(<KeepHeight keep><p>Cargando…</p></KeepHeight>);

    expect(block).toHaveStyle({ minHeight: "640px" });
  });

  it("lets what arrives take its own height", () => {
    const { container, rerender } = render(<KeepHeight keep={false}><p>Opciones</p></KeepHeight>);
    const block = container.firstElementChild as HTMLElement;
    measures(block, 640);
    rerender(<KeepHeight keep><p>Cargando…</p></KeepHeight>);

    rerender(<KeepHeight keep={false}><p>Opciones nuevas</p></KeepHeight>);

    expect(block.style.minHeight).toBe("");
  });

  it("keeps nothing before measuring anything, as on the first load", () => {
    const { container } = render(<KeepHeight keep><p>Cargando…</p></KeepHeight>);

    expect((container.firstElementChild as HTMLElement).style.minHeight).toBe("");
  });
});
