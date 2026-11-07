import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmbeddedPreview } from "./EmbeddedPreview";

afterEach(() => { vi.restoreAllMocks(); });

describe("EmbeddedPreview", () => {
  it("keeps the default preview at its height, with its border", () => {
    render(<EmbeddedPreview url="https://example.test/page" title="Vista" />);
    const frame = screen.getByTitle("Vista");
    expect(frame).toHaveClass("w-full", "border");
    expect(frame).toHaveAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
    expect(frame).toHaveAttribute("referrerpolicy", "no-referrer");
  });

  // VO1-A (2026-11-06): a page laid out for a fixed frame (like Meta's official preview) keeps that layout and scales whole to
  // the room it is given, never cut and without scroll bars.
  it("keeps a fixed frame's layout and scales it whole to its room", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(322.5);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(700);
    render(<EmbeddedPreview url="https://example.test/page" title="Vista" frame={{ width: 430, height: 800 }} />);
    const frame = screen.getByTitle("Vista");
    expect(frame).toHaveStyle({ width: "430px", height: "800px", transform: "scale(0.75)" });
    expect(frame.parentElement).toHaveStyle({ width: "322.5px", height: "600px" });
    expect(frame).toHaveAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
  });

  it("never draws a fixed frame bigger than its own size", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(900);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(1200);
    render(<EmbeddedPreview url="https://example.test/page" title="Vista" frame={{ width: 430, height: 800 }} />);
    expect(screen.getByTitle("Vista")).toHaveStyle({ transform: "scale(1)" });
  });
});
