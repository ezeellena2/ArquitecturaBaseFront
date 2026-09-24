import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VerificationBadge } from "./VerificationBadge";

describe("VerificationBadge", () => {
  it("says it in words, with the check only when it is verified", () => {
    const { container, rerender } = render(<VerificationBadge verified>Verificado</VerificationBadge>);

    expect(screen.getByText("Verificado")).toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");

    rerender(<VerificationBadge verified={false}>Sin verificar</VerificationBadge>);

    expect(screen.getByText("Sin verificar")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
  });
});
